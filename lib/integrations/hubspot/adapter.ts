import crypto from 'crypto'

import type {
  IntegrationAdapter,
  IntegrationActionResult,
  IntegrationContext,
  IntegrationWebhookPayload,
} from '../baseAdapter'
import type { CRMAction, CRMTrigger, CRMObjectType } from '../types'
import { decryptToken, encryptToken } from '../crypto'
import { loadIntegrationEnv } from '../env'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

const HUBSPOT_TRIGGERS: CRMTrigger[] = [
  'contact.created',
  'deal.stage_changed',
  'lead.assigned',
]

const HUBSPOT_ACTIONS: CRMAction[] = [
  'contact.create',
  'contact.update',
  'note.create',
  'deal.update_stage',
]

const HUBSPOT_BASE = 'https://api.hubapi.com'

async function refreshTokenIfNeeded(ctx: IntegrationContext) {
  const integration = await prisma.integration.findUnique({
    where: { id: ctx.integrationId },
    include: { credentials: true },
  })
  const cred = integration?.credentials?.[0]
  if (!cred) throw new Error('No credentials found for integration')

  const expiresAt = cred.expiresAt ? new Date(cred.expiresAt) : null
  const needsRefresh =
    !cred.expiresAt || (expiresAt && expiresAt.getTime() < Date.now() - 60_000)

  const env = loadIntegrationEnv()

  if (!needsRefresh) {
    return decryptToken(cred.accessToken)
  }

  if (!cred.refreshToken) {
    throw new Error('Missing refresh token for HubSpot integration')
  }

  const tokenRes = await fetch(`${HUBSPOT_BASE}/oauth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${env.HUBSPOT_CLIENT_ID}:${env.HUBSPOT_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(cred.refreshToken),
    }),
  })

  if (!tokenRes.ok) {
    throw new Error('Failed to refresh HubSpot token')
  }

  const tokenJson = (await tokenRes.json()) as any
  const expiresIn = tokenJson.expires_in
    ? Number(tokenJson.expires_in) * 1000
    : null
  const expiresAtNew = expiresIn ? new Date(Date.now() + expiresIn) : null

  const newAccess = encryptToken(tokenJson.access_token)
  const newRefresh = tokenJson.refresh_token
    ? encryptToken(tokenJson.refresh_token)
    : cred.refreshToken

  const existingCred = await prisma.integrationCredential.findFirst({
    where: { integrationId: ctx.integrationId },
  })

  if (existingCred) {
    await prisma.integrationCredential.update({
      where: { id: existingCred.id },
      data: {
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresAt: expiresAtNew ?? undefined,
      },
    })
  } else {
    await prisma.integrationCredential.create({
      data: {
        integrationId: ctx.integrationId,
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresAt: expiresAtNew ?? undefined,
      },
    })
  }

  await logAudit({
    workspaceId: integration.workspaceId,
    action: 'CRM_TOKEN_REFRESHED',
    targetType: 'Integration',
    targetId: integration.id,
    meta: { provider: 'hubspot', integrationId: integration.id },
  })

  return tokenJson.access_token as string
}

async function hubspotFetch(
  ctx: IntegrationContext,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let accessToken = ctx.credentials?.accessToken
    ? decryptToken(ctx.credentials.accessToken)
    : null
  if (!accessToken) {
    try {
      accessToken = await refreshTokenIfNeeded(ctx)
    } catch (err) {
      throw new Error(
        `HubSpot token error: ${(err as any)?.message ?? 'unknown'}`,
      )
    }
  }

  const headers = {
    ...(init?.headers || {}),
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  return fetch(`${HUBSPOT_BASE}${path}`, { ...init, headers })
}

function mapObjectType(objectType: CRMObjectType) {
  if (objectType === 'deal') return 'deals'
  if (objectType === 'company') return 'companies'
  return 'contacts'
}

function mapWebhookEvent(subType: string): {
  objectType: CRMObjectType
  event: 'created' | 'updated' | 'deleted' | 'stage_changed'
} | null {
  if (subType.startsWith('contact.creation'))
    return { objectType: 'contact', event: 'created' }
  if (subType.startsWith('contact.propertyChange'))
    return { objectType: 'contact', event: 'updated' }
  if (subType.startsWith('contact.deletion'))
    return { objectType: 'contact', event: 'deleted' }
  if (subType.startsWith('deal.propertyChange'))
    return { objectType: 'deal', event: 'stage_changed' }
  if (subType.startsWith('deal.creation'))
    return { objectType: 'deal', event: 'created' }
  if (subType.startsWith('deal.deletion'))
    return { objectType: 'deal', event: 'deleted' }
  if (subType.startsWith('company.creation'))
    return { objectType: 'company', event: 'created' }
  if (subType.startsWith('company.propertyChange'))
    return { objectType: 'company', event: 'updated' }
  if (subType.startsWith('company.deletion'))
    return { objectType: 'company', event: 'deleted' }
  return null
}

const HUBSPOT_SIGNATURE_MAX_AGE_MS = 5 * 60_000

// HubSpot v3 requires only these encoded URI characters to be decoded before
// signature calculation. decodeURIComponent would decode more than the
// provider protocol specifies and can invalidate otherwise legitimate calls.
const HUBSPOT_URI_DECODINGS: Record<string, string> = {
  '%3A': ':',
  '%2F': '/',
  '%3F': '?',
  '%40': '@',
  '%21': '!',
  '%24': '$',
  '%27': "'",
  '%28': '(',
  '%29': ')',
  '%2A': '*',
  '%2C': ',',
  '%3B': ';',
}

function decodeHubSpotRequestUri(uri: string) {
  return uri.replace(
    /%3A|%2F|%3F|%40|%21|%24|%27|%28|%29|%2A|%2C|%3B/gi,
    (encoded) => HUBSPOT_URI_DECODINGS[encoded.toUpperCase()] ?? encoded,
  )
}

export function verifyHubSpotV3Signature(input: {
  method: string
  url: string
  body: string
  signature: string | null
  timestamp: string | null
  secret: string | undefined
  now?: number
}) {
  if (!input.signature || !input.timestamp || !input.secret) return false

  const timestamp = Number(input.timestamp)
  const now = input.now ?? Date.now()
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > HUBSPOT_SIGNATURE_MAX_AGE_MS
  ) {
    return false
  }

  const source =
    input.method +
    decodeHubSpotRequestUri(input.url) +
    input.body +
    input.timestamp
  const expected = crypto
    .createHmac('sha256', input.secret)
    .update(source)
    .digest('base64')
  const actualBuffer = Buffer.from(input.signature)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export const hubspotAdapter: IntegrationAdapter = {
  provider: 'hubspot',

  async connect(_ctx: IntegrationContext) {
    return 'connected'
  },

  async disconnect(_ctx: IntegrationContext) {
    return 'disconnected'
  },

  listTriggers() {
    return HUBSPOT_TRIGGERS
  },

  listActions() {
    return HUBSPOT_ACTIONS
  },

  async testConnection(ctx: IntegrationContext): Promise<boolean> {
    try {
      const res = await hubspotFetch(ctx, '/crm/v3/owners?limit=1', {
        method: 'GET',
      })
      return res.ok
    } catch {
      return false
    }
  },

  async executeAction(
    ctx: IntegrationContext,
    action: CRMAction,
    params: Record<string, any>,
  ): Promise<IntegrationActionResult> {
    try {
      const objectType = (params.objectType as CRMObjectType) || 'contact'
      const apiObject = mapObjectType(objectType)

      if (action === 'contact.create' || action === 'contact.update') {
        const id = params.externalId as string | undefined
        if (action === 'contact.create' || !id) {
          const res = await hubspotFetch(ctx, `/crm/v3/objects/${apiObject}`, {
            method: 'POST',
            body: JSON.stringify({ properties: params.properties ?? {} }),
          })
          if (!res.ok) throw new Error(`HubSpot create failed (${res.status})`)
          const json = await res.json()
          return { ok: true, data: json }
        } else {
          const res = await hubspotFetch(
            ctx,
            `/crm/v3/objects/${apiObject}/${encodeURIComponent(id)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ properties: params.properties ?? {} }),
            },
          )
          if (!res.ok) throw new Error(`HubSpot update failed (${res.status})`)
          const json = await res.json()
          return { ok: true, data: json }
        }
      }

      if (action === 'note.create') {
        const res = await hubspotFetch(ctx, '/crm/v3/objects/notes', {
          method: 'POST',
          body: JSON.stringify({
            properties: params.properties ?? {},
          }),
        })
        if (!res.ok)
          throw new Error(`HubSpot note create failed (${res.status})`)
        return { ok: true, data: await res.json() }
      }

      if (action === 'deal.update_stage') {
        const id = params.externalId as string
        const res = await hubspotFetch(
          ctx,
          `/crm/v3/objects/deals/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ properties: params.properties ?? {} }),
          },
        )
        if (!res.ok)
          throw new Error(`HubSpot deal update failed (${res.status})`)
        return { ok: true, data: await res.json() }
      }

      return { ok: true, data: { action, params } }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'HubSpot action failed' }
    }
  },

  async verifyWebhook(
    req: Request,
  ): Promise<IntegrationWebhookPayload | IntegrationWebhookPayload[] | null> {
    try {
      const bodyText = await req.text()
      const valid = verifyHubSpotV3Signature({
        method: req.method,
        url: req.url,
        body: bodyText,
        signature: req.headers.get('X-HubSpot-Signature-v3'),
        timestamp: req.headers.get('X-HubSpot-Request-Timestamp'),
        secret: process.env.HUBSPOT_CLIENT_SECRET,
      })
      if (!valid) return null

      const rawLength = Buffer.byteLength(bodyText)
      let parsed: any = null
      try {
        parsed = JSON.parse(bodyText)
      } catch {
        return null
      }

      const events = Array.isArray(parsed) ? parsed : []
      if (!events.length || events.length > 50) return null

      const normalized = events.flatMap(
        (event): IntegrationWebhookPayload[] => {
          const mapped = mapWebhookEvent(event.subscriptionType ?? '')
          const externalId = String(event.objectId ?? '')
          if (!mapped || !externalId) return []

          const occurredAt = Number(event.occurredAt ?? event.timestamp)
          return [
            {
              provider: 'hubspot',
              objectType: mapped.objectType,
              externalId,
              event: mapped.event as any,
              payload: event,
              occurredAt: Number.isFinite(occurredAt) ? occurredAt : undefined,
              eventId:
                event.eventId === undefined ? undefined : String(event.eventId),
              workspaceId: undefined,
              integrationId: undefined,
              portalId: event.portalId ?? event.accountId ?? null,
              rawLength,
              eventCount: events.length,
            },
          ]
        },
      )

      if (!normalized.length) return null
      return normalized.length === 1 ? normalized[0] : normalized
    } catch (err) {
      return null
    }
  },
}
