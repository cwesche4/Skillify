import { randomUUID } from 'crypto'

import {
  getSchedulingProviderConfig,
  type SchedulingProviderKey,
} from '@/lib/scheduling/providers/config'
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

export type CalDavPlatform = 'apple' | 'fastmail' | 'nextcloud' | 'generic'

export type CalDavPlatformPreset = {
  platform: CalDavPlatform
  label: string
  description: string
  defaultServerUrl?: string
  usernameLabel: string
  passwordLabel: string
  passwordHelp: string
}

export const calDavPlatformPresets: Record<
  CalDavPlatform,
  CalDavPlatformPreset
> = {
  apple: {
    platform: 'apple',
    label: 'Apple Calendar',
    description: 'Connect iCloud Calendar with an Apple app-specific password.',
    defaultServerUrl: 'https://caldav.icloud.com',
    usernameLabel: 'Apple ID',
    passwordLabel: 'App-specific password',
    passwordHelp:
      'Use an Apple app-specific password. Your Apple ID password is not accepted.',
  },
  fastmail: {
    platform: 'fastmail',
    label: 'Fastmail CalDAV',
    description: 'Connect Fastmail calendars through CalDAV.',
    defaultServerUrl: 'https://caldav.fastmail.com',
    usernameLabel: 'Username',
    passwordLabel: 'App password',
    passwordHelp:
      'Use the app password or account password supported by Fastmail.',
  },
  nextcloud: {
    platform: 'nextcloud',
    label: 'Nextcloud CalDAV',
    description: 'Connect calendars from a Nextcloud server.',
    usernameLabel: 'Username',
    passwordLabel: 'App password',
    passwordHelp:
      'Use a Nextcloud app password when two-factor auth is enabled.',
  },
  generic: {
    platform: 'generic',
    label: 'Generic CalDAV',
    description: 'Connect any standards-compatible CalDAV server.',
    usernameLabel: 'Username',
    passwordLabel: 'Password or app password',
    passwordHelp: 'Use a server-supported CalDAV password or app password.',
  },
}

const CALDAV_PROVIDER_KEY: SchedulingProviderKey = 'caldav'
const DAV_NS = 'DAV:'
const CALENDAR_NS = 'urn:ietf:params:xml:ns:caldav'
const APPLE_NS = 'http://apple.com/ns/ical/'
const CS_NS = 'http://calendarserver.org/ns/'

function calDavUnavailable<T>(operation: string): ProviderSyncResult<T> {
  const config = getSchedulingProviderConfig(CALDAV_PROVIDER_KEY)
  return {
    ok: false,
    code: config.status,
    safeMessage:
      config.status === 'available'
        ? `CalDAV ${operation} failed.`
        : `CalDAV ${operation} is unavailable because provider status is ${config.status}.`,
    retryable: config.status === 'available',
  }
}

function calDavConfigAvailable() {
  return getSchedulingProviderConfig(CALDAV_PROVIDER_KEY).status === 'available'
}

export function normalizeCalDavPlatform(value: unknown): CalDavPlatform {
  if (value === 'apple' || value === 'fastmail' || value === 'nextcloud') {
    return value
  }
  return 'generic'
}

export function getCalDavPlatformPreset(value: unknown): CalDavPlatformPreset {
  return calDavPlatformPresets[normalizeCalDavPlatform(value)]
}

export function normalizeCalDavServerUrl(
  value: string,
  platform?: CalDavPlatform,
) {
  const fallback = platform
    ? calDavPlatformPresets[platform].defaultServerUrl
    : undefined
  const raw = (value || fallback || '').trim()
  if (!raw) {
    throw new Error('CalDAV server URL is required.')
  }
  const url = new URL(raw)
  if (url.protocol !== 'https:') {
    throw new Error('CalDAV server URL must use HTTPS.')
  }
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function metadataString(ctx: CalendarProviderContext, key: string) {
  const value = metadataRecord(ctx.metadata)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function basicAuth(ctx: CalendarProviderContext) {
  const username = ctx.username ?? metadataString(ctx, 'username')
  const password = ctx.accessToken
  if (!username || !password) return null
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

function hrefToAbsolute(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString().replace(/\/$/, '')
  } catch {
    return href
  }
}

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function localTag(tag: string) {
  const parts = tag.split(':')
  return parts[parts.length - 1]
}

function firstTagValue(xml: string, tag: string) {
  const pattern = new RegExp(
    `<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`,
    'i',
  )
  const match = xml.match(pattern)
  const value = match?.[1]
  if (!value) return undefined
  const cdata = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i)
  if (cdata) return cdata[1]?.trim()
  return value.replace(/<[^>]+>/g, '').trim()
}

function tagBlocks(xml: string, tag: string) {
  const pattern = new RegExp(
    `<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`,
    'gi',
  )
  return Array.from(xml.matchAll(pattern), (match) => match[1] ?? '')
}

type DavResponse = {
  href: string
  displayName?: string
  calendarDescription?: string
  calendarTimezone?: string
  color?: string
  etag?: string
  syncToken?: string
  ctag?: string
  calendarData?: string
  resourceTypes: Set<string>
  raw: string
}

function parseDavMultistatus(xml: string, baseUrl: string): DavResponse[] {
  return tagBlocks(xml, 'response').reduce<DavResponse[]>(
    (responses, block) => {
      const href = firstTagValue(block, 'href')
      if (!href) return responses
      const resourceTypes = new Set<string>()
      for (const resourceType of tagBlocks(block, 'resourcetype')) {
        for (const match of resourceType.matchAll(/<([^/\s>]+)[^>]*\/?>/g)) {
          const tag = localTag(match[1] ?? '')
          if (tag && tag !== 'resourcetype')
            resourceTypes.add(tag.toLowerCase())
        }
      }
      responses.push({
        href: hrefToAbsolute(href, baseUrl),
        displayName: firstTagValue(block, 'displayname'),
        calendarDescription: firstTagValue(block, 'calendar-description'),
        calendarTimezone: firstTagValue(block, 'calendar-timezone'),
        color: firstTagValue(block, 'calendar-color'),
        etag: firstTagValue(block, 'getetag')?.replace(/^"|"$/g, ''),
        syncToken: firstTagValue(block, 'sync-token'),
        ctag: firstTagValue(block, 'getctag'),
        calendarData: firstTagValue(block, 'calendar-data'),
        resourceTypes,
        raw: block,
      })
      return responses
    },
    [],
  )
}

async function calDavRequest({
  ctx,
  url,
  method,
  body,
  headers,
}: {
  ctx: CalendarProviderContext
  url: string
  method: string
  body?: string
  headers?: HeadersInit
}): Promise<
  ProviderSyncResult<{ text: string; status: number; headers: Headers }>
> {
  const authorization = basicAuth(ctx)
  if (!authorization) {
    return {
      ok: false,
      code: 'missingCredentials',
      safeMessage: 'CalDAV credentials are missing.',
      retryable: false,
    }
  }
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      Accept: 'application/xml,text/calendar,*/*',
      ...(body ? { 'Content-Type': 'application/xml; charset=utf-8' } : {}),
      ...(headers ?? {}),
    },
    body,
  })
  const text = await response.text().catch(() => '')
  if (!response.ok && response.status !== 207) {
    return {
      ok: false,
      code: `caldav_${response.status}`,
      safeMessage:
        response.status === 401 || response.status === 403
          ? 'CalDAV authentication failed. Check the username and app password.'
          : `CalDAV request failed with status ${response.status}.`,
      retryable:
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500,
    }
  }
  return {
    ok: true,
    value: { text, status: response.status, headers: response.headers },
  }
}

async function propfind(
  ctx: CalendarProviderContext,
  url: string,
  props: string,
  depth = '0',
) {
  return calDavRequest({
    ctx,
    url,
    method: 'PROPFIND',
    headers: { Depth: depth },
    body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="${DAV_NS}" xmlns:c="${CALENDAR_NS}" xmlns:cs="${CS_NS}" xmlns:a="${APPLE_NS}">
  <d:prop>${props}</d:prop>
</d:propfind>`,
  })
}

function eventPath(calendarUrl: string, eventId: string) {
  const encoded = encodeURIComponent(eventId.replace(/\.ics$/i, ''))
  return `${calendarUrl.replace(/\/$/, '')}/${encoded}.ics`
}

function unfoldIcs(value: string) {
  return value.replace(/\r?\n[ \t]/g, '')
}

function getIcsProperty(ics: string, name: string) {
  const regex = new RegExp(`^${name}(?:;[^:]+)?:(.*)$`, 'im')
  return unfoldIcs(ics).match(regex)?.[1]?.trim()
}

function parseIcsDate(value?: string) {
  if (!value) return null
  if (/^\d{8}$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`,
    )
  }
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}.000Z`,
    )
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`,
    )
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeIcsEvent({
  ics,
  calendarId,
  etag,
}: {
  ics: string
  calendarId: string
  etag?: string
}): ProviderEventPayload | null {
  const uid = getIcsProperty(ics, 'UID')
  const startsAt = parseIcsDate(getIcsProperty(ics, 'DTSTART'))
  const endsAt = parseIcsDate(getIcsProperty(ics, 'DTEND'))
  if (!uid || !startsAt || !endsAt) return null
  const recurrenceRule = getIcsProperty(ics, 'RRULE')
  return {
    id: uid,
    calendarId,
    title: getIcsProperty(ics, 'SUMMARY') ?? 'Untitled CalDAV event',
    description: getIcsProperty(ics, 'DESCRIPTION'),
    startsAtUtc: startsAt.toISOString(),
    endsAtUtc: endsAt.toISOString(),
    timezone: getIcsProperty(ics, 'TZID') ?? 'UTC',
    allDay: /^\d{8}$/.test(getIcsProperty(ics, 'DTSTART') ?? ''),
    location: getIcsProperty(ics, 'LOCATION'),
    recurrenceRule,
    recurrence: recurrenceRule ? [`RRULE:${recurrenceRule}`] : undefined,
    providerEtag: etag,
    providerUpdatedAt: parseIcsDate(
      getIcsProperty(ics, 'LAST-MODIFIED'),
    )?.toISOString(),
    recurringEventId: getIcsProperty(ics, 'RELATED-TO'),
    originalStartTime: parseIcsDate(
      getIcsProperty(ics, 'RECURRENCE-ID'),
    )?.toISOString(),
    status: getIcsProperty(ics, 'STATUS')?.toLowerCase(),
    raw: { ics },
  }
}

function formatUtcIcsDate(value: string) {
  const date = new Date(value)
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

function buildIcsEvent(payload: ProviderEventPayload) {
  const uid = payload.id ?? randomUUID()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skillify//Scheduling CalDAV//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatUtcIcsDate(payload.startsAtUtc)}`,
    `DTEND:${formatUtcIcsDate(payload.endsAtUtc)}`,
    `SUMMARY:${xmlEscape(payload.title)}`,
  ]
  if (payload.description)
    lines.push(`DESCRIPTION:${xmlEscape(payload.description)}`)
  if (payload.location) lines.push(`LOCATION:${xmlEscape(payload.location)}`)
  if (payload.recurrenceRule) lines.push(`RRULE:${payload.recurrenceRule}`)
  if (payload.status) lines.push(`STATUS:${payload.status.toUpperCase()}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return { uid, ics: `${lines.join('\r\n')}\r\n` }
}

export async function discoverCalDavAccount({
  ctx,
  serverUrl,
}: {
  ctx: CalendarProviderContext
  serverUrl: string
}): Promise<
  ProviderSyncResult<{
    principalUrl: string
    calendarHomeSetUrl: string
    calendars: ProviderCalendar[]
    capabilities: string[]
  }>
> {
  const principal = await propfind(
    ctx,
    serverUrl,
    '<d:current-user-principal /><d:principal-URL />',
  )
  if (!principal.ok) return principal
  const principalHref =
    firstTagValue(principal.value.text, 'current-user-principal') ??
    firstTagValue(principal.value.text, 'principal-URL') ??
    firstTagValue(principal.value.text, 'href') ??
    serverUrl
  const principalUrl = hrefToAbsolute(principalHref, serverUrl)
  const home = await propfind(ctx, principalUrl, '<c:calendar-home-set />')
  if (!home.ok) return home
  const homeHref =
    firstTagValue(home.value.text, 'calendar-home-set') ??
    firstTagValue(home.value.text, 'href')
  const calendarHomeSetUrl = hrefToAbsolute(
    homeHref ?? principalUrl,
    principalUrl,
  )
  const calendarsResult = await propfind(
    ctx,
    calendarHomeSetUrl,
    '<d:resourcetype /><d:displayname /><c:calendar-description /><c:calendar-timezone /><a:calendar-color /><d:current-user-privilege-set /><d:getetag /><cs:getctag /><d:sync-token />',
    '1',
  )
  if (!calendarsResult.ok) return calendarsResult
  const calendars = parseDavMultistatus(
    calendarsResult.value.text,
    calendarHomeSetUrl,
  )
    .filter((response) => response.resourceTypes.has('calendar'))
    .map(
      (response, index): ProviderCalendar => ({
        id: response.href,
        name: response.displayName ?? `CalDAV calendar ${index + 1}`,
        description: response.calendarDescription,
        timezone: response.calendarTimezone,
        color: response.color,
        accessRole: response.raw.includes('write') ? 'writer' : 'reader',
        isPrimary: index === 0,
        isWritable: response.raw.includes('write'),
        raw: {
          url: response.href,
          etag: response.etag,
          ctag: response.ctag,
          syncToken: response.syncToken,
          resourceTypes: Array.from(response.resourceTypes),
        },
      }),
    )
  return {
    ok: true,
    value: {
      principalUrl,
      calendarHomeSetUrl,
      calendars,
      capabilities: [
        'calendarDiscovery',
        'pollingSync',
        'etagSync',
        'ctagSync',
        'recurrence',
      ],
    },
  }
}

export function createCalDavCalendarProvider(): CalendarProvider {
  const enabled = calDavConfigAvailable()
  return {
    key: CALDAV_PROVIDER_KEY,
    label: 'CalDAV',
    enabled,
    capabilities: [
      'basicAuth',
      'calendarDiscovery',
      'incrementalSync',
      'pollingSync',
      'etagSync',
      'ctagSync',
      'pushSync',
      'recurrence',
    ],
    connect() {
      if (!enabled) return calDavUnavailable('connect')
      return {
        ok: false,
        code: 'manualCredentialsRequired',
        safeMessage: 'CalDAV uses username and app-password authentication.',
        retryable: false,
      }
    },
    async disconnect(_ctx) {
      return { ok: true, value: { disconnected: true } }
    },
    async refreshToken(_ctx) {
      return {
        ok: false,
        code: 'basicAuthNoRefresh',
        safeMessage: 'CalDAV app passwords do not support token refresh.',
        retryable: false,
      }
    },
    async exchangeCode(): Promise<ProviderSyncResult<ProviderTokenSet>> {
      return {
        ok: false,
        code: 'oauthUnsupported',
        safeMessage: 'CalDAV does not use OAuth callbacks in this integration.',
        retryable: false,
      }
    },
    async listCalendars(ctx) {
      if (!enabled) return calDavUnavailable('calendar listing')
      try {
        const serverUrl = normalizeCalDavServerUrl(
          metadataString(ctx, 'serverUrl') ?? '',
          normalizeCalDavPlatform(metadataString(ctx, 'platform')),
        )
        const discovery = await discoverCalDavAccount({ ctx, serverUrl })
        if (!discovery.ok) return discovery
        return { ok: true, value: discovery.value.calendars }
      } catch (error) {
        return {
          ok: false,
          code: 'invalidServerUrl',
          safeMessage:
            error instanceof Error
              ? error.message
              : 'CalDAV server URL is invalid.',
          retryable: false,
        }
      }
    },
    async watchCalendar() {
      return {
        ok: false,
        code: 'pollingOnly',
        safeMessage:
          'This CalDAV provider uses polling and sync tokens instead of webhook channels.',
        retryable: false,
      }
    },
    async stopWatching(): Promise<ProviderSyncResult<{ stopped: true }>> {
      return {
        ok: false,
        code: 'pollingOnly',
        safeMessage: 'This CalDAV provider does not create watch channels.',
        retryable: false,
      }
    },
    async pullChanges(
      ctx,
    ): Promise<ProviderSyncResult<ProviderPullChangesResult>> {
      if (!enabled) return calDavUnavailable('incremental sync')
      const calendarUrl = ctx.calendarId
      const result = await propfind(
        ctx,
        calendarUrl,
        '<d:getetag /><c:calendar-data /><d:sync-token /><cs:getctag />',
        '1',
      )
      if (!result.ok) return result
      const responses = parseDavMultistatus(result.value.text, calendarUrl)
      const events = responses
        .filter(
          (response) => response.href.endsWith('.ics') && response.calendarData,
        )
        .map((response) =>
          normalizeIcsEvent({
            ics: response.calendarData ?? '',
            calendarId: calendarUrl,
            etag: response.etag,
          }),
        )
        .filter((event): event is ProviderEventPayload => Boolean(event))
      const nextSyncToken =
        responses.find((response) => response.syncToken)?.syncToken ??
        responses.find((response) => response.ctag)?.ctag ??
        result.value.headers.get('sync-token')
      return { ok: true, value: { events, nextSyncToken } }
    },
    async pushChanges(ctx) {
      let pushed = 0
      for (const event of ctx.events) {
        pushed += 1
      }
      return { ok: true, value: { pushed } }
    },
    async createEvent(ctx, payload) {
      if (!enabled) return calDavUnavailable('event creation')
      const calendarUrl = payload.calendarId
      const event = buildIcsEvent(payload)
      const result = await calDavRequest({
        ctx,
        url: eventPath(calendarUrl, event.uid),
        method: 'PUT',
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
        body: event.ics,
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: {
          ...payload,
          id: event.uid,
          providerEtag: result.value.headers.get('etag') ?? undefined,
          raw: { ics: event.ics },
        },
      }
    },
    async updateEvent(ctx, payload) {
      if (!enabled) return calDavUnavailable('event update')
      const event = buildIcsEvent(payload)
      const result = await calDavRequest({
        ctx,
        url: eventPath(payload.calendarId, event.uid),
        method: 'PUT',
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
        body: event.ics,
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: {
          ...payload,
          id: event.uid,
          providerEtag: result.value.headers.get('etag') ?? undefined,
          raw: { ics: event.ics },
        },
      }
    },
    async deleteEvent(ctx) {
      if (!enabled) return calDavUnavailable('event deletion')
      const result = await calDavRequest({
        ctx,
        url: eventPath(ctx.calendarId, ctx.providerEventId),
        method: 'DELETE',
      })
      if (!result.ok) return result
      return { ok: true, value: { deleted: true } }
    },
    async getEvent(ctx) {
      if (!enabled) return calDavUnavailable('event lookup')
      const result = await calDavRequest({
        ctx,
        url: eventPath(ctx.calendarId, ctx.providerEventId),
        method: 'GET',
      })
      if (!result.ok) return result
      return {
        ok: true,
        value: normalizeIcsEvent({
          ics: result.value.text,
          calendarId: ctx.calendarId,
          etag: result.value.headers.get('etag') ?? undefined,
        }),
      }
    },
    async sync() {
      return { ok: true, value: { processed: 0 } }
    },
    async health(ctx) {
      const result = await this.validateConnection(ctx)
      if (!result.ok) return result
      return {
        ok: true,
        value: { health: result.value.valid ? 'connected' : 'error' },
      }
    },
    async validateConnection(ctx) {
      if (!enabled) return calDavUnavailable('connection validation')
      const serverUrl = metadataString(ctx, 'serverUrl')
      if (!serverUrl) {
        return {
          ok: false,
          code: 'missingServerUrl',
          safeMessage: 'CalDAV server URL is missing.',
          retryable: false,
        }
      }
      const result = await propfind(
        ctx,
        serverUrl,
        '<d:current-user-principal />',
      )
      if (!result.ok) return result
      return { ok: true, value: { valid: true } }
    },
  }
}
