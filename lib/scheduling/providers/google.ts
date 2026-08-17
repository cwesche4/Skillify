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
import type { SchedulingEvent } from '@/lib/scheduling/types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'

const googleScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

function googleUnavailable<T>(operation: string): ProviderSyncResult<T> {
  const config = getSchedulingProviderConfig('google')
  return {
    ok: false,
    code: config.status,
    safeMessage:
      config.status === 'available'
        ? `Google Calendar ${operation} failed.`
        : `Google Calendar ${operation} is unavailable because provider status is ${config.status}.`,
    retryable: config.status === 'available',
  }
}

function googleClientConfig() {
  const config = getSchedulingProviderConfig('google')
  if (config.status !== 'available') return null
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET as string,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI as string,
  }
}

function bearer(ctx: CalendarProviderContext) {
  return {
    Authorization: `Bearer ${ctx.accessToken ?? ''}`,
    Accept: 'application/json',
  }
}

async function readGoogleJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: 'Google returned a non-JSON response.' } }
  }
}

function googleError<T>(
  response: Response,
  payload: unknown,
): ProviderSyncResult<T> {
  const body = payload as {
    error?: { message?: string; status?: string; code?: string }
  }
  const code = body.error?.status ?? body.error?.code ?? String(response.status)
  const retryable =
    response.status === 408 || response.status === 429 || response.status >= 500
  return {
    ok: false,
    code,
    safeMessage:
      body.error?.message ??
      `Google Calendar request failed with status ${response.status}.`,
    retryable,
  }
}

async function googleRequest<T>({
  ctx,
  path,
  init,
}: {
  ctx: CalendarProviderContext
  path: string
  init?: RequestInit
}): Promise<ProviderSyncResult<T>> {
  if (!ctx.accessToken) {
    return {
      ok: false,
      code: 'missingAccessToken',
      safeMessage: 'Google Calendar access token is missing.',
      retryable: false,
    }
  }
  const response = await fetch(`${GOOGLE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...bearer(ctx),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const json = await readGoogleJson(response)
  if (!response.ok) return googleError(response, json)
  return { ok: true, value: json as T }
}

function normalizeCalendar(item: Record<string, unknown>): ProviderCalendar {
  const accessRole = String(item.accessRole ?? '')
  return {
    id: String(item.id ?? ''),
    name: String(item.summary ?? item.id ?? 'Untitled calendar'),
    description:
      typeof item.description === 'string' ? item.description : undefined,
    timezone: typeof item.timeZone === 'string' ? item.timeZone : undefined,
    isPrimary: item.primary === true,
    accessRole: accessRole || undefined,
    ownerEmail:
      typeof item.id === 'string' && item.id.includes('@')
        ? item.id
        : undefined,
    color:
      typeof item.backgroundColor === 'string'
        ? item.backgroundColor
        : undefined,
    visibility: typeof item.selected === 'boolean' ? 'selected' : undefined,
    isWritable: ['owner', 'writer'].includes(accessRole),
    raw: item,
  }
}

function normalizeGoogleEvent(
  item: Record<string, unknown>,
  calendarId: string,
) {
  const start = item.start as
    | { date?: string; dateTime?: string; timeZone?: string }
    | undefined
  const end = item.end as
    | { date?: string; dateTime?: string; timeZone?: string }
    | undefined
  const startsAtUtc = start?.dateTime ?? `${start?.date ?? ''}T00:00:00.000Z`
  const endsAtUtc = end?.dateTime ?? `${end?.date ?? ''}T00:00:00.000Z`
  const recurrence = Array.isArray(item.recurrence)
    ? item.recurrence.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : undefined
  return {
    id: String(item.id ?? ''),
    calendarId,
    title: String(item.summary ?? 'Untitled event'),
    description:
      typeof item.description === 'string' ? item.description : undefined,
    startsAtUtc: new Date(startsAtUtc).toISOString(),
    endsAtUtc: new Date(endsAtUtc).toISOString(),
    timezone: start?.timeZone ?? end?.timeZone ?? 'UTC',
    allDay: Boolean(start?.date && !start?.dateTime),
    location: typeof item.location === 'string' ? item.location : undefined,
    recurrence,
    providerEtag: typeof item.etag === 'string' ? item.etag : undefined,
    providerUpdatedAt:
      typeof item.updated === 'string' ? item.updated : undefined,
    recurringEventId:
      typeof item.recurringEventId === 'string'
        ? item.recurringEventId
        : undefined,
    status: typeof item.status === 'string' ? item.status : undefined,
    raw: item,
  } satisfies ProviderEventPayload
}

function toGoogleEvent(payload: ProviderEventPayload) {
  const visibilityMap: Record<string, string> = {
    default: 'default',
    public: 'public',
    private: 'private',
    busyOnly: 'private',
  }
  return {
    summary: payload.title,
    description: payload.description,
    location: payload.location,
    start: payload.allDay
      ? { date: payload.startsAtUtc.slice(0, 10), timeZone: payload.timezone }
      : { dateTime: payload.startsAtUtc, timeZone: payload.timezone },
    end: payload.allDay
      ? { date: payload.endsAtUtc.slice(0, 10), timeZone: payload.timezone }
      : { dateTime: payload.endsAtUtc, timeZone: payload.timezone },
    attendees: payload.attendees?.map((attendee) => ({
      email: attendee.email,
      displayName: attendee.name,
      responseStatus: attendee.responseStatus,
    })),
    recurrence:
      payload.recurrence ??
      (payload.recurrenceRule ? [payload.recurrenceRule] : undefined),
    visibility: payload.visibility
      ? visibilityMap[payload.visibility]
      : undefined,
    extendedProperties: {
      private: {
        skillifySource: 'scheduling',
      },
    },
  }
}

export function createGoogleCalendarProvider(): CalendarProvider {
  const key: SchedulingProviderKey = 'google'
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
      const client = googleClientConfig()
      if (!client) return googleUnavailable('connect')
      const url = new URL(GOOGLE_AUTH_URL)
      url.searchParams.set('client_id', client.clientId)
      url.searchParams.set('redirect_uri', redirectUri ?? client.redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('scope', googleScopes.join(' '))
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
      const client = googleClientConfig()
      if (!client) return googleUnavailable('OAuth callback')
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: client.clientId,
          client_secret: client.clientSecret,
          redirect_uri: redirectUri ?? client.redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      const json = await readGoogleJson(response)
      if (!response.ok) return googleError(response, json)
      const body = json as {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        scope?: string
        id_token?: string
      }
      if (!body.access_token) return googleUnavailable('token exchange')
      return {
        ok: true,
        value: {
          accessToken: body.access_token,
          refreshToken: body.refresh_token ?? null,
          expiresAt: body.expires_in
            ? new Date(Date.now() + body.expires_in * 1000)
            : null,
          scopes: body.scope?.split(/\s+/).filter(Boolean) ?? googleScopes,
        },
      }
    },
    async refreshToken(ctx) {
      const client = googleClientConfig()
      if (!client) return googleUnavailable('token refresh')
      if (!ctx.refreshToken) {
        return {
          ok: false,
          code: 'missingRefreshToken',
          safeMessage: 'Google Calendar refresh token is missing.',
          retryable: false,
        }
      }
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.clientId,
          client_secret: client.clientSecret,
          refresh_token: ctx.refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      const json = await readGoogleJson(response)
      if (!response.ok) return googleError(response, json)
      const body = json as {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        scope?: string
      }
      if (!body.access_token) return googleUnavailable('token refresh')
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
    async disconnect(_ctx) {
      return { ok: true, value: { disconnected: true } }
    },
    async listCalendars(ctx) {
      const result = await googleRequest<{ items?: Record<string, unknown>[] }>(
        {
          ctx,
          path: '/users/me/calendarList',
        },
      )
      if (!result.ok) return result
      return {
        ok: true,
        value: (result.value.items ?? [])
          .map(normalizeCalendar)
          .filter((calendar) => calendar.id),
      }
    },
    async watchCalendar(ctx) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: `/calendars/${encodeURIComponent(ctx.calendarId)}/events/watch`,
        init: {
          method: 'POST',
          body: JSON.stringify({
            id: ctx.channelId,
            type: 'web_hook',
            address: ctx.webhookUrl,
            token: ctx.token,
          }),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: {
          id: String(result.value.id ?? ctx.channelId),
          resourceId:
            typeof result.value.resourceId === 'string'
              ? result.value.resourceId
              : undefined,
          resourceUri:
            typeof result.value.resourceUri === 'string'
              ? result.value.resourceUri
              : undefined,
          token: ctx.token,
          expiresAt:
            typeof result.value.expiration === 'string'
              ? new Date(Number(result.value.expiration))
              : null,
        } satisfies ProviderWatchChannel,
      }
    },
    async stopWatching(ctx) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: '/channels/stop',
        init: {
          method: 'POST',
          body: JSON.stringify({
            id: ctx.channelId,
            resourceId: ctx.resourceId,
          }),
        },
      })
      if (!result.ok) return result
      return { ok: true, value: { stopped: true } }
    },
    async pullChanges(ctx) {
      const params = new URLSearchParams({
        singleEvents: 'false',
        showDeleted: 'true',
        maxResults: '250',
      })
      if (ctx.syncToken) params.set('syncToken', ctx.syncToken)
      if (ctx.pageToken) params.set('pageToken', ctx.pageToken)
      const result = await googleRequest<{
        items?: Record<string, unknown>[]
        nextSyncToken?: string
        nextPageToken?: string
      }>({
        ctx,
        path: `/calendars/${encodeURIComponent(ctx.calendarId)}/events?${params.toString()}`,
      })
      if (!result.ok) {
        return result.code === '410'
          ? {
              ok: true,
              value: {
                events: [],
                fullSyncRequired: true,
              } satisfies ProviderPullChangesResult,
            }
          : result
      }
      return {
        ok: true,
        value: {
          events: (result.value.items ?? []).map((item) =>
            normalizeGoogleEvent(item, ctx.calendarId),
          ),
          nextSyncToken: result.value.nextSyncToken,
          nextPageToken: result.value.nextPageToken,
        },
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
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: `/calendars/${encodeURIComponent(payload.calendarId)}/events`,
        init: {
          method: 'POST',
          body: JSON.stringify(toGoogleEvent(payload)),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeGoogleEvent(result.value, payload.calendarId),
      }
    },
    async updateEvent(ctx, payload) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: `/calendars/${encodeURIComponent(payload.calendarId)}/events/${encodeURIComponent(payload.id)}`,
        init: {
          method: 'PATCH',
          body: JSON.stringify(toGoogleEvent(payload)),
        },
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeGoogleEvent(result.value, payload.calendarId),
      }
    },
    async deleteEvent(ctx) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: `/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(ctx.providerEventId)}`,
        init: { method: 'DELETE' },
      })
      if (!result.ok) return result
      return { ok: true, value: { deleted: true } }
    },
    async getEvent(ctx) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: `/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(ctx.providerEventId)}`,
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeGoogleEvent(result.value, ctx.calendarId),
      }
    },
    async sync(_ctx) {
      return { ok: true, value: { processed: 0 } }
    },
    async health(ctx) {
      const result = await this.validateConnection(ctx)
      if (!result.ok) {
        return { ok: true, value: { health: 'error' } }
      }
      return { ok: true, value: { health: 'connected' } }
    },
    async validateConnection(ctx) {
      const result = await googleRequest<Record<string, unknown>>({
        ctx,
        path: '/users/me/settings/timezone',
      })
      if (!result.ok) return result
      return { ok: true, value: { valid: true } }
    },
  }
}

export function createGoogleWatchChannelId() {
  return `skillify-google-${randomUUID()}`
}
