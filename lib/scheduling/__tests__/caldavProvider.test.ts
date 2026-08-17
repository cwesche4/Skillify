import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createCalDavCalendarProvider,
  discoverCalDavAccount,
  getCalDavPlatformPreset,
  normalizeCalDavPlatform,
  normalizeCalDavServerUrl,
} from '@/lib/scheduling/providers/caldav'
import { getSchedulingProviderRegistry } from '@/lib/scheduling/providers/registry'

const originalEnv = { ...process.env }

function enableCalDav() {
  process.env.CALDAV_SYNC_ENABLED = 'true'
  process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString(
    'base64',
  )
}

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 207, ...init })
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

describe('CalDAV provider foundation', () => {
  it('registers CalDAV as the production provider for Apple and generic platforms', () => {
    enableCalDav()

    const registry = getSchedulingProviderRegistry()
    const caldav = registry.find((provider) => provider.key === 'caldav')
    const apple = registry.find((provider) => provider.key === 'appleIcloud')

    expect(caldav).toMatchObject({
      enabled: true,
      status: 'available',
    })
    expect(caldav?.capabilities).toEqual(
      expect.arrayContaining([
        'basicAuth',
        'calendarDiscovery',
        'pollingSync',
        'etagSync',
        'ctagSync',
        'recurrence',
      ]),
    )
    expect(apple?.label).toBe('Apple Calendar')
    expect(createCalDavCalendarProvider().enabled).toBe(true)
  })

  it('treats Apple Calendar as a CalDAV platform preset', () => {
    expect(normalizeCalDavPlatform('apple')).toBe('apple')
    expect(getCalDavPlatformPreset('apple')).toMatchObject({
      label: 'Apple Calendar',
      defaultServerUrl: 'https://caldav.icloud.com',
      passwordLabel: 'App-specific password',
    })
  })

  it('requires HTTPS CalDAV server URLs', () => {
    expect(() => normalizeCalDavServerUrl('http://example.com')).toThrow(
      /HTTPS/,
    )
    expect(normalizeCalDavServerUrl('', 'apple')).toBe(
      'https://caldav.icloud.com',
    )
  })

  it('discovers principal, calendar home, calendars, CTag, sync token, color, and timezone', async () => {
    enableCalDav()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response(`
          <d:multistatus xmlns:d="DAV:">
            <d:response>
              <d:href>/</d:href>
              <d:propstat><d:prop>
                <d:current-user-principal><d:href>/principal/user/</d:href></d:current-user-principal>
              </d:prop></d:propstat>
            </d:response>
          </d:multistatus>
        `),
      )
      .mockResolvedValueOnce(
        response(`
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/principal/user/</d:href>
              <d:propstat><d:prop>
                <c:calendar-home-set><d:href>/calendars/user/</d:href></c:calendar-home-set>
              </d:prop></d:propstat>
            </d:response>
          </d:multistatus>
        `),
      )
      .mockResolvedValueOnce(
        response(`
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/" xmlns:cs="http://calendarserver.org/ns/">
            <d:response>
              <d:href>/calendars/user/work/</d:href>
              <d:propstat><d:prop>
                <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
                <d:displayname>Work</d:displayname>
                <c:calendar-description>Work calendar</c:calendar-description>
                <c:calendar-timezone>America/New_York</c:calendar-timezone>
                <a:calendar-color>#00AEEF</a:calendar-color>
                <d:getetag>"calendar-etag"</d:getetag>
                <cs:getctag>ctag-1</cs:getctag>
                <d:sync-token>sync-1</d:sync-token>
              </d:prop></d:propstat>
            </d:response>
          </d:multistatus>
        `),
      )

    const result = await discoverCalDavAccount({
      serverUrl: 'https://caldav.example.com',
      ctx: {
        workspaceId: 'workspace-1',
        username: 'user@example.com',
        accessToken: 'app-password',
        metadata: {
          platform: 'generic',
          serverUrl: 'https://caldav.example.com',
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.principalUrl).toBe(
      'https://caldav.example.com/principal/user',
    )
    expect(result.value.calendarHomeSetUrl).toBe(
      'https://caldav.example.com/calendars/user',
    )
    expect(result.value.calendars[0]).toMatchObject({
      id: 'https://caldav.example.com/calendars/user/work',
      name: 'Work',
      timezone: 'America/New_York',
      color: '#00AEEF',
    })
    expect(result.value.calendars[0]?.raw).toMatchObject({
      ctag: 'ctag-1',
      syncToken: 'sync-1',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://caldav.example.com',
      expect.objectContaining({
        method: 'PROPFIND',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    )
  })

  it('pulls ICS events with recurrence and ETag metadata', async () => {
    enableCalDav()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response(`
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
          <d:response>
            <d:href>/calendars/user/work/event-1.ics</d:href>
            <d:propstat><d:prop>
              <d:getetag>"event-etag"</d:getetag>
              <cs:getctag>ctag-2</cs:getctag>
              <c:calendar-data><![CDATA[
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Proposal Review
DTSTART:20260730T180000Z
DTEND:20260730T190000Z
RRULE:FREQ=WEEKLY;COUNT=3
LAST-MODIFIED:20260729T120000Z
END:VEVENT
END:VCALENDAR
              ]]></c:calendar-data>
            </d:prop></d:propstat>
          </d:response>
        </d:multistatus>
      `),
    )

    const provider = createCalDavCalendarProvider()
    const result = await provider.pullChanges({
      workspaceId: 'workspace-1',
      calendarId: 'https://caldav.example.com/calendars/user/work',
      username: 'user@example.com',
      accessToken: 'app-password',
      metadata: { serverUrl: 'https://caldav.example.com' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.nextSyncToken).toBe('ctag-2')
    expect(result.value.events[0]).toMatchObject({
      id: 'event-1',
      title: 'Proposal Review',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=3',
      providerEtag: 'event-etag',
    })
  })
})
