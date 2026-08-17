import {
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
  CalendarConnectionStatus,
  CalendarEventOwnership,
  CalendarEventSyncState,
  CalendarSyncDirection,
  CalendarSyncLogStatus,
  ExternalCalendarVisibilityMode,
} from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    workspace: { findUnique: vi.fn() },
    workspaceSettings: { findUnique: vi.fn() },
    calendarConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    calendarSyncCursor: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    calendarEventMapping: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    connectedCalendar: {
      update: vi.fn(),
    },
    calendarSyncLog: {
      create: vi.fn(),
    },
    calendarSyncConflict: {
      create: vi.fn(),
    },
  },
  schedulingRepository: {
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    listEventsByRange: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/integrations/crypto', () => ({
  encryptToken: (value: string) => `encrypted:${value}`,
  decryptToken: () => 'app-password',
  isIntegrationEncryptionConfigured: () => true,
  assertIntegrationEncryptionConfigured: () => undefined,
}))
vi.mock('@/lib/scheduling/repository', () => ({
  schedulingRepository: mocks.schedulingRepository,
}))

import { syncCalDavConnection } from '@/lib/scheduling/providers/caldavService'

const originalEnv = { ...process.env }

function response(body: string) {
  return new Response(body, { status: 207 })
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
  for (const group of Object.values(mocks.prisma)) {
    for (const fn of Object.values(group)) {
      if (typeof fn === 'function') fn.mockReset()
    }
  }
  for (const fn of Object.values(mocks.schedulingRepository)) {
    fn.mockReset()
  }
})

describe('CalDAV sync service', () => {
  it('flows pulled CalDAV events through Scheduling repository and mapping engine', async () => {
    process.env.CALDAV_SYNC_ENABLED = 'true'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString(
      'base64',
    )
    mocks.prisma.workspace.findUnique.mockResolvedValue({
      businessModel: 'consultative',
    })
    mocks.prisma.workspaceSettings.findUnique.mockResolvedValue({
      scheduling: {
        calendarConnectionPolicy: {
          allowWorkspaceConnections: true,
        },
      },
    })
    mocks.prisma.calendarConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      workspaceId: 'workspace-1',
      connectedByUserId: 'user-1',
      connectedByWorkspaceMemberId: 'member-1',
      workspaceMemberId: null,
      ownershipType: CalendarConnectionOwnershipType.WORKSPACE,
      connectionPurpose: CalendarConnectionPurpose.WORKSPACE_SHARED,
      visibilityMode: ExternalCalendarVisibilityMode.FULL_DETAILS,
      approvalStatus: 'APPROVED',
      syncStatus: CalendarConnectionStatus.CONNECTED,
      disconnectedAt: null,
      disabledAt: null,
      disabledReason: null,
      ownerInactiveAt: null,
      availabilityBehavior: 'IGNORE',
      busyDisplayMode: 'HIDDEN',
      conflictPolicy: 'SKILLIFY_WINS',
      syncFrequencyMinutes: 15,
      metadata: {
        platform: 'generic',
        serverUrl: 'https://caldav.example.com',
        username: 'ops@example.com',
      },
      accessTokenEncrypted: 'encrypted:app-password',
      refreshTokenEncrypted: null,
      workspaceMember: null,
      calendars: [
        {
          id: 'cal-1',
          providerCalendarId: 'https://caldav.example.com/calendars/work',
          calendarPurpose: CalendarConnectionPurpose.WORKSPACE_SHARED,
          syncDirection: CalendarSyncDirection.IMPORT_ONLY,
          availabilityBehavior: 'IGNORE',
          busyDisplayMode: 'HIDDEN',
        },
      ],
    })
    mocks.prisma.calendarSyncCursor.findUnique.mockResolvedValue(null)
    mocks.prisma.calendarEventMapping.findUnique.mockResolvedValue(null)
    mocks.schedulingRepository.createEvent.mockResolvedValue({
      id: 'event-from-caldav',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(`
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
          <d:response>
            <d:href>/calendars/work/proposal.ics</d:href>
            <d:propstat><d:prop>
              <d:getetag>"etag-1"</d:getetag>
              <cs:getctag>ctag-1</cs:getctag>
              <c:calendar-data><![CDATA[
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:proposal
SUMMARY:Proposal Review
DTSTART:20260730T180000Z
DTEND:20260730T190000Z
LAST-MODIFIED:20260729T120000Z
END:VEVENT
END:VCALENDAR
              ]]></c:calendar-data>
            </d:prop></d:propstat>
          </d:response>
        </d:multistatus>
      `),
    )

    const result = await syncCalDavConnection({
      workspaceId: 'workspace-1',
      connectionId: 'conn-1',
      workerId: 'test-worker',
    })

    expect(result).toMatchObject({
      ok: true,
      value: { processed: 1, failures: 0, dryRun: false },
    })
    expect(mocks.schedulingRepository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        actorUserId: 'user-1',
        input: expect.objectContaining({
          title: 'Proposal Review',
          externalCalendarState: 'synced',
        }),
      }),
    )
    expect(mocks.prisma.calendarEventMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          schedulingEventId: 'event-from-caldav',
          providerEventId: 'proposal',
          providerEtag: 'etag-1',
          ownership: CalendarEventOwnership.EXTERNAL_ONLY,
          syncState: CalendarEventSyncState.SYNCED,
          lastSyncOrigin: 'caldav',
        }),
      }),
    )
    expect(mocks.prisma.calendarSyncCursor.upsert).toHaveBeenCalled()
    expect(mocks.prisma.calendarSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CalendarSyncLogStatus.SUCCEEDED,
          operation: 'syncConnection',
        }),
      }),
    )
  })
})
