import { randomUUID } from 'crypto'

import {
  getSchedulingProviderConfig,
  type SchedulingProviderKey,
} from '@/lib/scheduling/providers/config'
import { mapSchedulingEventToGooglePayload } from '@/lib/scheduling/providers/recurrenceMapping'
import type {
  CalendarProvider,
  CalendarProviderContext,
  ProviderCalendar,
  ProviderEventPayload,
  ProviderPullChangesResult,
  ProviderSyncResult,
  ProviderTokenSet,
  ProviderWatchChannel,
} from '@/lib/scheduling/providers/types'

const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const DEFAULT_TENANT = 'common'

const microsoftScopes = [
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
  'Calendars.ReadWrite.Shared',
]

function tenantId() {
  return process.env.MICROSOFT_CALENDAR_TENANT_ID?.trim() || DEFAULT_TENANT
}

function microsoftAuthorizeUrl() {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize`
}

function microsoftTokenUrl() {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`
}

function microsoftUnavailable<T>(operation: string): ProviderSyncResult<T> {
  const config = getSchedulingProviderConfig('microsoft')
  return {
    ok: false,
    code: config.status,
    safeMessage:
      config.status === 'available'
        ? `Microsoft Outlook ${operation} failed.`
        : `Microsoft Outlook ${operation} is unavailable because provider status is ${config.status}.`,
    retryable: config.status === 'available',
  }
}

function microsoftClientConfig() {
  const config = getSchedulingProviderConfig('microsoft')
  if (config.status !== 'available') return null
  return {
    clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET as string,
    redirectUri: process.env.MICROSOFT_CALENDAR_REDIRECT_URI as string,
  }
}

async function readMicrosoftJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {
      error: { message: 'Microsoft Graph returned a non-JSON response.' },
    }
  }
}

function microsoftError<T>(
  response: Response,
  payload: unknown,
): ProviderSyncResult<T> {
  const body = payload as {
    error?: { code?: string; message?: string; error_description?: string }
  }
  const code = body.error?.code ?? String(response.status)
  return {
    ok: false,
    code,
    safeMessage:
      body.error?.message ??
      body.error?.error_description ??
      `Microsoft Graph request failed with status ${response.status}.`,
    retryable:
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500,
  }
}

function bearer(ctx: CalendarProviderContext) {
  return {
    Authorization: `Bearer ${ctx.accessToken ?? ''}`,
    Accept: 'application/json',
  }
}

async function microsoftRequest<T>({
  ctx,
  path,
  init,
  absoluteUrl,
}: {
  ctx: CalendarProviderContext
  path?: string
  init?: RequestInit
  absoluteUrl?: string
}): Promise<ProviderSyncResult<T>> {
  if (!ctx.accessToken) {
    return {
      ok: false,
      code: 'missingAccessToken',
      safeMessage: 'Microsoft Outlook access token is missing.',
      retryable: false,
    }
  }
  const response = await fetch(
    absoluteUrl ?? `${MICROSOFT_GRAPH_BASE}${path}`,
    {
      ...init,
      headers: {
        ...bearer(ctx),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    },
  )
  const json = await readMicrosoftJson(response)
  if (!response.ok) return microsoftError(response, json)
  return { ok: true, value: json as T }
}

function normalizeCalendar(item: Record<string, unknown>): ProviderCalendar {
  const canEdit = item.canEdit === true || item.isRemovable === true
  const owner = item.owner as { address?: string; name?: string } | undefined
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? item.id ?? 'Untitled calendar'),
    ownerEmail: typeof owner?.address === 'string' ? owner.address : undefined,
    description:
      typeof item.name === 'string' && typeof owner?.name === 'string'
        ? owner.name
        : undefined,
    color: typeof item.hexColor === 'string' ? item.hexColor : undefined,
    timezone:
      typeof item.defaultOnlineMeetingProvider === 'string'
        ? undefined
        : undefined,
    isPrimary: item.isDefaultCalendar === true,
    accessRole: canEdit ? 'writer' : 'reader',
    visibility:
      item.isShared === true
        ? 'shared'
        : item.isDefaultCalendar === true
          ? 'primary'
          : undefined,
    isWritable: canEdit,
    raw: item,
  }
}

function normalizeDateTime(
  value: { dateTime?: string; timeZone?: string } | undefined,
) {
  if (!value?.dateTime) return null
  const raw = value.dateTime.endsWith('Z')
    ? value.dateTime
    : `${value.dateTime}${value.dateTime.includes('+') ? '' : 'Z'}`
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeEvent(
  item: Record<string, unknown>,
  calendarId: string,
): ProviderEventPayload {
  const start = item.start as
    | { dateTime?: string; timeZone?: string }
    | undefined
  const end = item.end as { dateTime?: string; timeZone?: string } | undefined
  const location = item.location as { displayName?: string } | undefined
  const recurrence = item.recurrence
    ? [JSON.stringify(item.recurrence)]
    : undefined
  return {
    id: String(item.id ?? ''),
    calendarId,
    title: String(item.subject ?? 'Untitled event'),
    description:
      typeof (item.bodyPreview as unknown) === 'string'
        ? (item.bodyPreview as string)
        : undefined,
    startsAtUtc: normalizeDateTime(start) ?? new Date(0).toISOString(),
    endsAtUtc: normalizeDateTime(end) ?? new Date(0).toISOString(),
    timezone: start?.timeZone ?? end?.timeZone ?? 'UTC',
    allDay: item.isAllDay === true,
    location:
      typeof location?.displayName === 'string'
        ? location.displayName
        : undefined,
    attendees: Array.isArray(item.attendees)
      ? item.attendees.flatMap((attendee) => {
          const record = attendee as {
            emailAddress?: { address?: string; name?: string }
            status?: { response?: string }
          }
          if (!record.emailAddress?.address) return []
          return [
            {
              email: record.emailAddress.address,
              name: record.emailAddress.name,
              responseStatus:
                record.status?.response === 'accepted'
                  ? 'accepted'
                  : record.status?.response === 'declined'
                    ? 'declined'
                    : record.status?.response === 'tentativelyAccepted'
                      ? 'tentative'
                      : 'needsAction',
            } as const,
          ]
        })
      : undefined,
    recurrence,
    providerEtag:
      typeof item['@odata.etag'] === 'string'
        ? (item['@odata.etag'] as string)
        : typeof item.changeKey === 'string'
          ? item.changeKey
          : undefined,
    providerUpdatedAt:
      typeof item.lastModifiedDateTime === 'string'
        ? item.lastModifiedDateTime
        : undefined,
    recurringEventId:
      typeof item.seriesMasterId === 'string' ? item.seriesMasterId : undefined,
    originalStartTime:
      typeof item.originalStartTimeZone === 'string'
        ? item.originalStartTimeZone
        : undefined,
    status: item.isCancelled === true ? 'cancelled' : String(item.showAs ?? ''),
    raw: item,
  }
}

function toGraphEvent(payload: ProviderEventPayload) {
  return {
    subject: payload.title,
    body: payload.description
      ? { contentType: 'text', content: payload.description }
      : undefined,
    start: {
      dateTime: payload.startsAtUtc.replace(/\.000Z$/, ''),
      timeZone: payload.timezone,
    },
    end: {
      dateTime: payload.endsAtUtc.replace(/\.000Z$/, ''),
      timeZone: payload.timezone,
    },
    isAllDay: payload.allDay ?? false,
    location: payload.location ? { displayName: payload.location } : undefined,
    attendees: payload.attendees?.map((attendee) => ({
      emailAddress: {
        address: attendee.email,
        name: attendee.name,
      },
      type: 'required',
    })),
    showAs: payload.visibility === 'busyOnly' ? 'busy' : 'busy',
    transactionId: payload.raw
      ? `skillify-${String(
          (payload.raw as Record<string, unknown>).skillifyEventId ??
            randomUUID(),
        )}`
      : undefined,
  }
}

export function createMicrosoftCalendarProvider(): CalendarProvider {
  const key: SchedulingProviderKey = 'microsoft'
  const config = getSchedulingProviderConfig(key)
  return {
    key,
    label: config.label,
    enabled: config.status === 'available',
    capabilities: [
      'oauth',
      'calendarDiscovery',
      'incrementalSync',
      'pushSync',
      'watchChannels',
      'recurrence',
      'webhooks',
    ],
    connect({
      workspaceId,
      workspaceMemberId,
      state,
      redirectUri,
      returnToSetup,
      setupStep,
    }) {
      const client = microsoftClientConfig()
      if (!client) return microsoftUnavailable('connect')
      const url = new URL(microsoftAuthorizeUrl())
      url.searchParams.set('client_id', client.clientId)
      url.searchParams.set('redirect_uri', redirectUri ?? client.redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('response_mode', 'query')
      url.searchParams.set('scope', microsoftScopes.join(' '))
      url.searchParams.set(
        'state',
        JSON.stringify({
          workspaceId,
          workspaceMemberId,
          state,
          ...(returnToSetup === true ? { returnToSetup: true, setupStep } : {}),
        }),
      )
      return { ok: true, value: { authorizationUrl: url.toString() } }
    },
    async exchangeCode({ code, redirectUri }) {
      const client = microsoftClientConfig()
      if (!client) return microsoftUnavailable('OAuth callback')
      const response = await fetch(microsoftTokenUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.clientId,
          client_secret: client.clientSecret,
          redirect_uri: redirectUri ?? client.redirectUri,
          code,
          grant_type: 'authorization_code',
          scope: microsoftScopes.join(' '),
        }),
      })
      const json = await readMicrosoftJson(response)
      if (!response.ok) return microsoftError(response, json)
      const body = json as {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        scope?: string
      }
      if (!body.access_token) return microsoftUnavailable('token exchange')
      const profile = await microsoftRequest<{
        id?: string
        userPrincipalName?: string
        mail?: string
        displayName?: string
      }>({
        ctx: { workspaceId: 'oauth-probe', accessToken: body.access_token },
        path: '/me?$select=id,userPrincipalName,mail,displayName',
      })
      const user = profile.ok ? profile.value : {}
      return {
        ok: true,
        value: {
          accessToken: body.access_token,
          refreshToken: body.refresh_token ?? null,
          expiresAt: body.expires_in
            ? new Date(Date.now() + body.expires_in * 1000)
            : null,
          scopes: body.scope?.split(/\s+/).filter(Boolean) ?? microsoftScopes,
          providerAccountId: user.id,
          accountEmail: user.mail ?? user.userPrincipalName,
          displayName: user.displayName,
        },
      }
    },
    async refreshToken(ctx) {
      const client = microsoftClientConfig()
      if (!client) return microsoftUnavailable('token refresh')
      if (!ctx.refreshToken) {
        return {
          ok: false,
          code: 'missingRefreshToken',
          safeMessage: 'Microsoft Outlook refresh token is missing.',
          retryable: false,
        }
      }
      const response = await fetch(microsoftTokenUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.clientId,
          client_secret: client.clientSecret,
          refresh_token: ctx.refreshToken,
          grant_type: 'refresh_token',
          scope: microsoftScopes.join(' '),
        }),
      })
      const json = await readMicrosoftJson(response)
      if (!response.ok) return microsoftError(response, json)
      const body = json as {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        scope?: string
      }
      if (!body.access_token) return microsoftUnavailable('token refresh')
      return {
        ok: true,
        value: {
          accessToken: body.access_token,
          refreshToken: body.refresh_token ?? ctx.refreshToken,
          expiresAt: body.expires_in
            ? new Date(Date.now() + body.expires_in * 1000)
            : null,
          scopes: body.scope?.split(/\s+/).filter(Boolean),
        },
      }
    },
    async disconnect() {
      return { ok: true, value: { disconnected: true } }
    },
    async listCalendars(ctx) {
      const result = await microsoftRequest<{
        value?: Record<string, unknown>[]
      }>({
        ctx,
        path: '/me/calendars',
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: (result.value.value ?? [])
          .map(normalizeCalendar)
          .filter((calendar) => calendar.id),
      }
    },
    async watchCalendar(ctx) {
      const expiration = new Date(Date.now() + 60 * 60 * 1000)
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: '/subscriptions',
        init: {
          method: 'POST',
          body: JSON.stringify({
            changeType: 'created,updated,deleted',
            notificationUrl: ctx.webhookUrl,
            resource: `/me/calendars/${ctx.calendarId}/events`,
            expirationDateTime: expiration.toISOString(),
            clientState: ctx.token,
          }),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: {
          id: String(result.value.id ?? ctx.channelId),
          resourceId:
            typeof result.value.resource === 'string'
              ? result.value.resource
              : ctx.calendarId,
          resourceUri:
            typeof result.value.resource === 'string'
              ? result.value.resource
              : undefined,
          token: ctx.token,
          expiresAt:
            typeof result.value.expirationDateTime === 'string'
              ? new Date(result.value.expirationDateTime)
              : expiration,
        } satisfies ProviderWatchChannel,
      }
    },
    async stopWatching(ctx) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: `/subscriptions/${encodeURIComponent(ctx.channelId)}`,
        init: { method: 'DELETE' },
      })
      if (!result.ok) return result
      return { ok: true, value: { stopped: true } }
    },
    async pullChanges(ctx) {
      const url = ctx.syncToken
        ? ctx.syncToken
        : `${MICROSOFT_GRAPH_BASE}/me/calendars/${encodeURIComponent(ctx.calendarId)}/events/delta`
      const result = await microsoftRequest<{
        value?: Record<string, unknown>[]
        '@odata.deltaLink'?: string
        '@odata.nextLink'?: string
      }>({
        ctx,
        absoluteUrl: url,
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: {
          events: (result.value.value ?? []).map((item) =>
            normalizeEvent(item, ctx.calendarId),
          ),
          nextSyncToken: result.value['@odata.deltaLink'],
          nextPageToken: result.value['@odata.nextLink'],
        } satisfies ProviderPullChangesResult,
      }
    },
    async pushChanges(ctx) {
      let pushed = 0
      for (const event of ctx.events) {
        const payload = mapSchedulingEventToGooglePayload(event, ctx.calendarId)
        const result = await this.createEvent(ctx, payload)
        if (!result.ok) return result
        pushed += 1
      }
      return { ok: true, value: { pushed } }
    },
    async createEvent(ctx, payload) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: `/me/calendars/${encodeURIComponent(payload.calendarId)}/events`,
        init: {
          method: 'POST',
          body: JSON.stringify(toGraphEvent(payload)),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeEvent(result.value, payload.calendarId),
      }
    },
    async updateEvent(ctx, payload) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: `/me/calendars/${encodeURIComponent(payload.calendarId)}/events/${encodeURIComponent(payload.id)}`,
        init: {
          method: 'PATCH',
          body: JSON.stringify(toGraphEvent(payload)),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeEvent(result.value, payload.calendarId),
      }
    },
    async deleteEvent(ctx) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: `/me/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(ctx.providerEventId)}`,
        init: { method: 'DELETE' },
      })
      if (!result.ok) return result
      return { ok: true, value: { deleted: true } }
    },
    async getEvent(ctx) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: `/me/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(ctx.providerEventId)}`,
      })
      if (!result.ok) return result
      return { ok: true, value: normalizeEvent(result.value, ctx.calendarId) }
    },
    async sync() {
      return { ok: true, value: { processed: 0 } }
    },
    async health(ctx) {
      const result = await this.validateConnection(ctx)
      return { ok: true, value: { health: result.ok ? 'connected' : 'error' } }
    },
    async validateConnection(ctx) {
      const result = await microsoftRequest<Record<string, unknown>>({
        ctx,
        path: '/me?$select=id',
      })
      if (!result.ok) return result
      return { ok: true, value: { valid: true } }
    },
  }
}

export function createMicrosoftWatchChannelId() {
  return `skillify-microsoft-${randomUUID()}`
}
