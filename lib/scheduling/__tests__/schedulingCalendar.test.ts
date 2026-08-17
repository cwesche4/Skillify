import React from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'

import {
  CalendarView,
  CalendarWorkspace,
  getBusyAvailabilityIntervals,
  resolveSchedulingCreateInitialDate,
  SchedulingPage,
  SchedulingCreateModal,
  sortBusyRecords,
} from '@/components/scheduling/SchedulingPage'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import {
  getSchedulingFixtureEvents,
  getSchedulingFixtureSeries,
  getTeamAvailabilityFixtures,
} from '@/lib/scheduling/schedulingFixtures'
import {
  getPreviewTeamAvailabilityRecords,
  readPreviewSchedulingSettings,
  savePreviewTeamAvailabilityRecords,
  savePreviewSchedulingSettings,
  savePreviewSchedulingEvents,
} from '@/lib/scheduling/previewSchedulingStorage'
import {
  combineDateAndTimeInTimezone,
  dateKeyToCalendarDate,
  formatInWorkspaceTimezone,
  getCalendarDateKey,
  getWorkspaceDateKey,
  getWorkspaceNow,
  getWorkspaceTimeInputValue,
  isSchedulingDateKey,
  parseSchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import {
  filterSchedulingTimezoneOptions,
  getSchedulingTimezoneOption,
  normalizeSchedulingTimezone,
} from '@/lib/scheduling/schedulingTimezones'
import {
  emptySchedulingFilters,
  eventMatchesFilters,
  eventMatchesSearch,
  formatPeriodLabel,
  getCalendarDateVisualState,
  getCalendarPeriod,
  getEventsForSection,
  getScheduleSummaryEmptyMessage,
  getScheduleSummaryTitle,
  getSchedulingOccurrencesForRange,
  getUpcomingEventsForVisibleRange,
  isDateInRange,
  moveCalendarAnchor,
} from '@/lib/scheduling/schedulingCalendar'
import {
  resolveEffectiveWorkingHours,
  resolveWorkingHoursScopeOptions,
} from '@/lib/scheduling/workingHours'
import type {
  SchedulingCalendarView,
  SchedulingEvent,
  SchedulingOccurrence,
  SchedulingSectionKey,
  TeamAvailabilityRecord,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

const clerkMockState = vi.hoisted(() => ({
  userId: 'user-alpha',
}))

vi.mock('sonner', () => {
  const toastMock = vi.fn()
  return {
    toast: Object.assign(toastMock, {
      success: vi.fn(),
      error: vi.fn(),
    }),
  }
})

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: { id: clerkMockState.userId },
  }),
}))

const baseEvent: SchedulingEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  title: 'Discovery Call',
  description: 'Review Adams proposal',
  type: 'discoveryCall',
  status: 'scheduled',
  startsAt: '2026-07-27T14:00:00.000Z',
  endsAt: '2026-07-27T15:00:00.000Z',
  allDay: false,
  timezone: 'America/New_York',
  location: 'Zoom',
  assignedMemberIds: ['owner'],
  linkedRecord: {
    recordType: 'lead',
    recordId: 'lead-1',
    label: 'Rachel Adams',
  },
  externalCalendarState: 'notConnected',
  createdAt: '2026-07-25T12:00:00.000Z',
  updatedAt: '2026-07-25T12:00:00.000Z',
}

function renderCalendarView({
  view,
  anchorDate,
  selectedDate = null,
  todayDate = dateKeyToCalendarDate('2026-07-25'),
  timezone = 'America/New_York',
  occurrences = [],
  onSelectDate = () => undefined,
  onOpenEvent = () => undefined,
}: {
  view: 'day' | 'week' | 'month'
  anchorDate: Date
  selectedDate?: string | null
  todayDate?: Date
  timezone?: string
  occurrences?: ReturnType<typeof getSchedulingOccurrencesForRange>
  onSelectDate?: (date: Date) => void
  onOpenEvent?: (event: SchedulingOccurrence) => void
}) {
  const period = getCalendarPeriod({
    view,
    anchorDate,
    weekStartsOn: 0,
    timezone,
  })
  return render(
    React.createElement(CalendarView, {
      view,
      anchorDate,
      selectedDate,
      todayDate,
      timezone,
      periodStart: period.start,
      periodEnd: period.end,
      occurrences,
      weekStartsOn: 0,
      onOpenEvent,
      onSelectDate,
    }),
  )
}

function getDrawerTimeInputs(drawer: HTMLElement) {
  const inputs = Array.from(
    drawer.querySelectorAll<HTMLInputElement>('input[type="time"]'),
  )
  expect(inputs.length).toBeGreaterThanOrEqual(2)
  return {
    startInput: inputs[0],
    endInput: inputs[1],
  }
}

async function clickFirstEventButton(name: RegExp) {
  const buttons = await screen.findAllByRole('button', { name })
  expect(buttons.length).toBeGreaterThan(0)
  fireEvent.click(buttons[0])
}

function getSchedulingTestContext() {
  const settings = normalizeSchedulingSettings({
    businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
    settings: {
      timezone: 'America/New_York',
      defaultCalendarView: 'week',
      weekStartsOn: 0,
    },
  })
  const capabilities = getWorkspaceSchedulingCapabilities({
    businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
    settings,
  })
  return { capabilities, settings }
}

function renderCalendarWorkspace({
  view,
  anchorDate,
  events = [],
  onCreateForDate = vi.fn(),
  settingsOverride,
  businessModel = WorkspaceBusinessModel.PRODUCT_COMMERCE,
}: {
  view: 'day' | 'week' | 'month' | 'agenda'
  anchorDate: Date
  events?: SchedulingEvent[]
  onCreateForDate?: (dateKey: string) => void
  settingsOverride?: Parameters<
    typeof normalizeSchedulingSettings
  >[0]['settings']
  businessModel?: WorkspaceBusinessModel
}) {
  const settings = normalizeSchedulingSettings({
    businessModel,
    settings: settingsOverride ?? {
      timezone: 'America/New_York',
      defaultCalendarView: 'week',
      weekStartsOn: 0,
    },
  })
  const capabilities = getWorkspaceSchedulingCapabilities({
    businessModel,
    settings,
  })
  return {
    onCreateForDate,
    ...render(
      React.createElement(CalendarWorkspace, {
        view,
        setView: () => undefined,
        events,
        capabilities,
        settings,
        visibleEventTypes: capabilities.supportedEventTypes,
        anchorDate,
        selectedDate: null,
        setAnchorDate: () => undefined,
        onTodayClick: () => undefined,
        currentInstant: new Date('2026-07-27T05:20:00.000Z'),
        query: '',
        setQuery: () => undefined,
        filters: emptySchedulingFilters,
        setFilters: () => undefined,
        memberOptions: [],
        onOpenDateInDayView: () => undefined,
        onCreateForDate,
        onOpenEvent: () => undefined,
      }),
    ),
  }
}

function renderSchedulingPage({
  section,
  businessModel = WorkspaceBusinessModel.DIRECT_SALES,
  settingsOverride,
  events,
  availability,
  series,
  members,
  teams,
  locations,
  seedSettings = true,
  canManage = true,
}: {
  section: SchedulingSectionKey | 'settings'
  businessModel?: WorkspaceBusinessModel
  settingsOverride?: Partial<WorkspaceSchedulingSettings>
  events?: SchedulingEvent[]
  availability?: TeamAvailabilityRecord[]
  series?: ReturnType<typeof getSchedulingFixtureSeries>
  members?: Array<{
    id?: string | null
    userId?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
    status?: string | null
    removedAt?: string | null
  }>
  teams?: Array<{
    id: string
    name: string
    isActive?: boolean
    members?: Array<{ workspaceMemberId: string }>
  }>
  locations?: Array<{
    id: string
    name: string
    isActive?: boolean
    city?: string | null
    region?: string | null
    timezone?: string | null
  }>
  seedSettings?: boolean
  canManage?: boolean
}) {
  const workspaceId = `workspace-${section}`
  const settings = normalizeSchedulingSettings({
    businessModel,
    settings: settingsOverride,
  })
  const capabilities = getWorkspaceSchedulingCapabilities({
    businessModel,
    settings,
  })
  const storedAvailability = getPreviewTeamAvailabilityRecords(workspaceId)
  let persistedSettings = settings
  let persistedEvents =
    events ??
    getSchedulingFixtureEvents({
      workspaceId,
      capabilities,
      timezone: settings.timezone,
    })
  let persistedSeries =
    series ??
    getSchedulingFixtureSeries({
      workspaceId,
      capabilities,
    })
  let persistedTeams = teams ?? []
  let persistedLocations = locations ?? []
  let persistedAvailability =
    availability ??
    (storedAvailability.length > 0
      ? storedAvailability
      : section === 'teamAvailability'
        ? getTeamAvailabilityFixtures({ workspaceId })
        : [])
  if (seedSettings) {
    savePreviewSchedulingSettings({
      workspaceId,
      businessModel,
      settings,
    })
  }
  if (events) {
    savePreviewSchedulingEvents({ workspaceId, events })
  }
  if (availability) {
    savePreviewTeamAvailabilityRecords({ workspaceId, records: availability })
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/members')) {
        return {
          ok: true,
          json: async () => ({ members: members ?? [] }),
        }
      }
      if (url.includes('/teams')) {
        if (method === 'POST' && typeof init?.body === 'string') {
          const body = JSON.parse(init.body) as {
            team?: {
              name?: string
              description?: string | null
              teamType?: string | null
              leadMemberId?: string | null
              memberIds?: string[]
            }
          }
          const createdTeam = {
            id: `team-${(body.team?.name ?? 'created')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`,
            workspaceId,
            name: body.team?.name?.trim() || 'Created team',
            description: body.team?.description ?? null,
            teamType: body.team?.teamType ?? 'general',
            leadMemberId: body.team?.leadMemberId ?? null,
            isActive: true,
            archivedAt: null,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
            members: (body.team?.memberIds ?? []).map((workspaceMemberId) => ({
              workspaceMemberId,
            })),
          }
          persistedTeams = [...persistedTeams, createdTeam]
          return {
            ok: true,
            json: async () => ({ team: createdTeam }),
          }
        }
        return {
          ok: true,
          json: async () => ({
            teams: persistedTeams.map((team) => ({
              workspaceId,
              description: null,
              teamType: 'general',
              leadMemberId: null,
              archivedAt: null,
              createdAt: '2026-07-25T12:00:00.000Z',
              updatedAt: '2026-07-25T12:00:00.000Z',
              ...team,
              isActive: team.isActive ?? true,
              members: team.members ?? [],
            })),
          }),
        }
      }
      if (url.includes('/locations')) {
        if (method === 'POST' && typeof init?.body === 'string') {
          const body = JSON.parse(init.body) as {
            location?: {
              name?: string
              locationType?: string | null
              city?: string | null
              region?: string | null
              timezone?: string | null
              isPrimary?: boolean
            }
          }
          const createdLocation = {
            id: `location-${(body.location?.name ?? 'created')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`,
            workspaceId,
            name: body.location?.name?.trim() || 'Created location',
            locationType: body.location?.locationType ?? 'office',
            isPrimary: Boolean(body.location?.isPrimary),
            isActive: true,
            archivedAt: null,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
            city: body.location?.city ?? null,
            region: body.location?.region ?? null,
            timezone: body.location?.timezone ?? settings.timezone,
          }
          persistedLocations = [...persistedLocations, createdLocation]
          return {
            ok: true,
            json: async () => ({ location: createdLocation }),
          }
        }
        return {
          ok: true,
          json: async () => ({
            locations: persistedLocations.map((location) => ({
              workspaceId,
              locationType: 'office',
              isPrimary: false,
              archivedAt: null,
              createdAt: '2026-07-25T12:00:00.000Z',
              updatedAt: '2026-07-25T12:00:00.000Z',
              ...location,
              isActive: location.isActive ?? true,
            })),
          }),
        }
      }
      if (url.includes('/scheduling/settings')) {
        if (method === 'PUT' && typeof init?.body === 'string') {
          const body = JSON.parse(init.body) as {
            settings?: WorkspaceSchedulingSettings
          }
          if (body.settings) {
            persistedSettings = body.settings
            savePreviewSchedulingSettings({
              workspaceId,
              businessModel,
              settings: body.settings,
            })
          }
        }
        return {
          ok: true,
          json: async () => ({ settings: persistedSettings }),
        }
      }
      if (
        url.includes('/scheduling/google') ||
        url.includes('/scheduling/microsoft')
      ) {
        const isMicrosoft = url.includes('/scheduling/microsoft')
        return {
          ok: true,
          json: async () => ({
            provider: {
              key: isMicrosoft ? 'microsoft' : 'google',
              label: isMicrosoft ? 'Microsoft Outlook' : 'Google Calendar',
              status: 'notConfigured',
              syncEnabled: true,
              missing: isMicrosoft
                ? [
                    'MICROSOFT_CALENDAR_CLIENT_ID',
                    'MICROSOFT_CALENDAR_CLIENT_SECRET',
                    'MICROSOFT_CALENDAR_REDIRECT_URI',
                  ]
                : [
                    'GOOGLE_CALENDAR_CLIENT_ID',
                    'GOOGLE_CALENDAR_CLIENT_SECRET',
                    'GOOGLE_CALENDAR_REDIRECT_URI',
                  ],
            },
            policy: {
              memberConnectionsAllowed: canManage,
              multipleAccountsPerMemberAllowed: true,
              sharedConnectionsAllowed: canManage,
              requireAdminApproval: false,
              defaultPersonalVisibilityMode: 'BUSY_ONLY',
              defaultWorkspaceVisibilityMode: 'TITLE_ONLY',
            },
            currentMember: { id: 'workspace-member-owner' },
            connections: [],
            diagnostics: {
              pendingSync: 0,
              connectedAccounts: 0,
              openConflicts: 0,
              activeWatchChannels: 0,
              expiredWatchChannels: 0,
            },
          }),
        }
      }
      if (url.includes('/scheduling/external-availability/preview')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              members: [
                {
                  workspaceMemberId: 'owner',
                  memberName: 'Owner',
                  highestSeverity: 'suggestion',
                  conflictCount: 1,
                  blockingCount: 0,
                  suggestionCount: 1,
                  totalUnavailableMinutes: 45,
                  conflicts: [
                    {
                      signalId: 'signal-owner-preview',
                      startsAtUtc: '2026-07-27T14:15:00.000Z',
                      endsAtUtc: '2026-07-27T15:00:00.000Z',
                      provider: 'google',
                      effect: 'suggestion',
                      displayLabel: 'Unavailable',
                    },
                  ],
                },
              ],
            },
          }),
        }
      }
      if (url.includes('/scheduling/availability')) {
        let record: TeamAvailabilityRecord =
          persistedAvailability[0] ??
          ({
            id: 'availability-created',
            workspaceId,
            kind: 'timeOff',
            type: 'timeOff',
            title: 'Time Off',
            reason: 'Time Off',
            memberId: 'owner',
            memberName: 'Owner',
            startsAt: '2026-07-29T14:00:00.000Z',
            endsAt: '2026-07-29T15:00:00.000Z',
            timezone: settings.timezone,
            allDay: false,
            notes: '',
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          } as TeamAvailabilityRecord)
        if (typeof init?.body === 'string') {
          const body = JSON.parse(init.body) as {
            record?: Partial<TeamAvailabilityRecord>
          }
          if (body.record) {
            record = {
              ...record,
              ...body.record,
              workspaceId,
            } as TeamAvailabilityRecord
          }
        }
        if (method === 'POST') {
          record = {
            ...record,
            id: `availability-${persistedAvailability.length + 1}`,
            workspaceId,
          } as TeamAvailabilityRecord
          persistedAvailability = [...persistedAvailability, record]
        } else if (method === 'PATCH') {
          const recordId = url.split('/').filter(Boolean).at(-1)
          record = {
            ...record,
            id: recordId ?? record.id,
            workspaceId,
          } as TeamAvailabilityRecord
          persistedAvailability = persistedAvailability.map((current) =>
            current.id === record.id ? record : current,
          )
        } else if (method === 'DELETE') {
          const recordId = url.split('/').filter(Boolean).at(-1)
          persistedAvailability = persistedAvailability.filter(
            (current) => current.id !== recordId,
          )
        }
        savePreviewTeamAvailabilityRecords({
          workspaceId,
          records: persistedAvailability,
        })
        return {
          ok: true,
          json: async () =>
            method === 'GET'
              ? {
                  settings: persistedSettings,
                  events: persistedEvents,
                  series: persistedSeries,
                  availability: persistedAvailability,
                }
              : { record },
        }
      }
      if (url.includes('/scheduling/events')) {
        let event: SchedulingEvent = persistedEvents[0] ?? {
          ...baseEvent,
          workspaceId,
        }
        if (typeof init?.body === 'string') {
          const body = JSON.parse(init.body) as {
            event?: Partial<SchedulingEvent>
            status?: SchedulingEvent['status']
          }
          if (body.event) {
            event = {
              ...event,
              ...body.event,
              workspaceId,
            } as SchedulingEvent
          }
          if (body.status) {
            event = { ...event, status: body.status }
          }
        }
        if (method === 'POST') {
          event = {
            ...event,
            id: `event-${persistedEvents.length + 1}`,
            workspaceId,
          }
          persistedEvents = [...persistedEvents, event]
        } else if (method === 'PATCH') {
          const eventId = url.split('/').filter(Boolean).at(-1)
          event = { ...event, id: eventId ?? event.id, workspaceId }
          persistedEvents = persistedEvents.map((current) =>
            current.id === event.id ? event : current,
          )
        } else if (method === 'DELETE') {
          const eventId = url.split('/').filter(Boolean).at(-1)
          persistedEvents = persistedEvents.filter(
            (current) => current.id !== eventId,
          )
        }
        savePreviewSchedulingEvents({ workspaceId, events: persistedEvents })
        return {
          ok: true,
          json: async () =>
            method === 'GET'
              ? {
                  settings: persistedSettings,
                  events: persistedEvents,
                  series: persistedSeries,
                  availability: persistedAvailability,
                }
              : { event },
        }
      }
      return {
        ok: true,
        json: async () => ({}),
      }
    }),
  )
  return render(
    React.createElement(SchedulingPage, {
      workspaceId,
      workspaceSlug: 'acme',
      businessModel,
      initialCapabilities: capabilities,
      initialSettings: persistedSettings,
      initialEvents: persistedEvents,
      initialSeries: persistedSeries,
      initialAvailability: persistedAvailability,
      section,
      canManage,
    }),
  )
}

function CalendarWorkspaceSelectionHarness({
  initialView,
  initialAnchorDate,
  initialSelectedDate,
  todayInstant = new Date('2026-07-27T05:20:00.000Z'),
}: {
  initialView: 'week' | 'month'
  initialAnchorDate: Date
  initialSelectedDate: string
  todayInstant?: Date
}) {
  const { capabilities, settings } = getSchedulingTestContext()
  const [view, setView] = React.useState<SchedulingCalendarView>(initialView)
  const [anchorDate, setAnchorDate] = React.useState(initialAnchorDate)
  const [selectedDate, setSelectedDate] = React.useState<string | null>(
    initialSelectedDate,
  )

  return React.createElement(CalendarWorkspace, {
    view,
    setView: (nextView) => setView(nextView),
    events: [],
    capabilities,
    settings,
    visibleEventTypes: capabilities.supportedEventTypes,
    anchorDate,
    selectedDate,
    setAnchorDate,
    onTodayClick: (date) => {
      setAnchorDate(date)
      setSelectedDate(null)
    },
    currentInstant: todayInstant,
    query: '',
    setQuery: () => undefined,
    filters: emptySchedulingFilters,
    setFilters: () => undefined,
    memberOptions: [],
    onOpenDateInDayView: (date) => {
      setSelectedDate(getCalendarDateKey(date))
      setAnchorDate(date)
      setView('day')
    },
    onCreateForDate: () => undefined,
    onOpenEvent: () => undefined,
  })
}

describe('scheduling calendar helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-27T05:20:00.000Z'))
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    clerkMockState.userId = 'user-alpha'
    vi.mocked(toast).mockClear()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('calculates day, week, month, and agenda ranges', () => {
    const anchor = new Date('2026-07-25T12:00:00.000Z')
    expect(
      getCalendarPeriod({
        view: 'day',
        anchorDate: anchor,
        weekStartsOn: 0,
      }).start.toISOString(),
    ).toContain('2026-07-25')
    expect(
      getCalendarPeriod({
        view: 'week',
        anchorDate: anchor,
        weekStartsOn: 1,
      }).start.toISOString(),
    ).toContain('2026-07-20')
    expect(
      getCalendarPeriod({
        view: 'month',
        anchorDate: anchor,
        weekStartsOn: 0,
      }).start.toISOString(),
    ).toContain('2026-06-28')
    expect(
      formatPeriodLabel({
        view: 'agenda',
        anchorDate: anchor,
        ...getCalendarPeriod({
          view: 'agenda',
          anchorDate: anchor,
          weekStartsOn: 0,
        }),
      }),
    ).toContain('Upcoming')
  })

  it.each(['day', 'week', 'month', 'agenda'] as const)(
    'renders standalone events in %s view after refresh',
    (view) => {
      renderCalendarWorkspace({
        view,
        anchorDate: dateKeyToCalendarDate('2026-07-27'),
        events: [
          {
            ...baseEvent,
            id: `standalone-${view}`,
            title: 'Standalone Refresh Event',
            recurrenceSeriesId: undefined,
            recurrenceRule: undefined,
            occurrenceOriginalAt: undefined,
            occurrenceState: undefined,
            startsAt: '2026-07-27T14:00:00.000Z',
            endsAt: '2026-07-27T15:00:00.000Z',
          },
        ],
      })

      expect(
        screen.getAllByText('Standalone Refresh Event').length,
      ).toBeGreaterThan(0)
    },
  )

  it('renders standalone events on the Appointments page after refresh', async () => {
    renderSchedulingPage({
      section: 'appointments',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [
        {
          ...baseEvent,
          id: 'standalone-appointment-refresh',
          workspaceId: 'workspace-appointments',
          title: 'Standalone Appointment Refresh Event',
          recurrenceSeriesId: undefined,
          recurrenceRule: undefined,
          occurrenceOriginalAt: undefined,
          occurrenceState: undefined,
          startsAt: '2026-07-27T14:00:00.000Z',
          endsAt: '2026-07-27T15:00:00.000Z',
        },
      ],
    })

    expect(
      await screen.findByText('Standalone Appointment Refresh Event'),
    ).toBeTruthy()
  })

  it('renders standalone cross-midnight events in the visible calendar range', () => {
    const crossMidnight = {
      ...baseEvent,
      id: 'standalone-cross-midnight',
      title: 'Cross Midnight Standalone Event',
      recurrenceSeriesId: undefined,
      recurrenceRule: undefined,
      occurrenceOriginalAt: undefined,
      occurrenceState: undefined,
      startsAt: '2026-07-28T03:30:00.000Z',
      endsAt: '2026-07-28T05:00:00.000Z',
    } satisfies SchedulingEvent

    const occurrences = getSchedulingOccurrencesForRange({
      events: [crossMidnight],
      rangeStart: new Date('2026-07-27T04:00:00.000Z'),
      rangeEnd: new Date('2026-07-28T04:00:00.000Z'),
      timezone: 'America/New_York',
    })

    expect(occurrences.map((event) => event.title)).toContain(
      'Cross Midnight Standalone Event',
    )
  })

  it('renders standalone all-day events in the visible calendar range', () => {
    renderCalendarWorkspace({
      view: 'day',
      anchorDate: dateKeyToCalendarDate('2026-07-27'),
      events: [
        {
          ...baseEvent,
          id: 'standalone-all-day',
          title: 'All Day Standalone Event',
          allDay: true,
          recurrenceSeriesId: undefined,
          recurrenceRule: undefined,
          occurrenceOriginalAt: undefined,
          occurrenceState: undefined,
          startsAt: '2026-07-27T04:00:00.000Z',
          endsAt: '2026-07-28T04:00:00.000Z',
        },
      ],
    })

    expect(
      screen.getAllByText('All Day Standalone Event').length,
    ).toBeGreaterThan(0)
  })

  it('keeps a newly created standalone event visible after Calendar refresh', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Calendar Standalone Refresh Event' },
    })
    fireEvent.change(within(dialog).getAllByRole('combobox')[0], {
      target: { value: 'internalMeeting' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Schedule Event' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Schedule Event' }),
      ).toBeNull()
    })
    expect(
      (await screen.findAllByText('Calendar Standalone Refresh Event')).length,
    ).toBeGreaterThan(0)

    const fetchCalls = vi.mocked(fetch).mock.calls
    expect(
      fetchCalls.some(
        ([url, init]) =>
          String(url) ===
            '/api/workspaces/workspace-calendar/scheduling/events' &&
          init?.method === 'POST',
      ),
    ).toBe(true)
    expect(
      fetchCalls.some(
        ([url, init]) =>
          String(url) ===
            '/api/workspaces/workspace-calendar/scheduling/events' &&
          !init?.method,
      ),
    ).toBe(true)
  })

  it('keeps the scheduling date parser strict while create initialization repairs invalid context', () => {
    const { settings } = getSchedulingTestContext()

    expect(() => parseSchedulingDateKey('' as never)).toThrow(
      'Invalid scheduling date key:',
    )

    const resolution = resolveSchedulingCreateInitialDate({
      explicitDateKey: '',
      selectedDate: '2026-08-14',
      anchorDate: dateKeyToCalendarDate('2026-09-01'),
      timezone: settings.timezone,
      now: new Date('2026-07-27T05:20:00.000Z'),
      entryPoint: 'test-invalid-explicit',
    })

    expect(resolution).toMatchObject({
      dateKey: '2026-08-14',
      source: 'selectedDate',
    })
  })

  it('opens the page-level Schedule Event modal with a valid workspace-local date', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })

    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-27')
  })

  it('resets the page-level Schedule Event date after close and reopen', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    let dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    const dateInput = within(dialog).getByLabelText('Date') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-08-14' } })
    expect(dateInput.value).toBe('2026-08-14')

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Close create schedule item',
      }),
    )
    expect(screen.queryByRole('dialog', { name: 'Schedule Event' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-27')
  })

  it('opens the contextual Schedule Event modal from a Month date with that exact date', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Tuesday, July 28, 2026' }),
    )
    await screen.findByText('Day calendar')
    const scheduleButtons = screen.getAllByRole('button', {
      name: 'Schedule Event',
    })
    fireEvent.click(scheduleButtons[scheduleButtons.length - 1])

    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-28')
  })

  it('opens the contextual Schedule Event modal from a Week day with that exact date', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    await screen.findByText('Week calendar')
    fireEvent.click(
      screen.getByRole('button', {
        name: /Open Tuesday, July 28 in Day view/i,
      }),
    )
    await screen.findByText('Day calendar')
    const scheduleButtons = screen.getAllByRole('button', {
      name: 'Schedule Event',
    })
    fireEvent.click(scheduleButtons[scheduleButtons.length - 1])

    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-28')
  })

  it('opens Appointments create with a valid workspace-local date', async () => {
    renderSchedulingPage({
      section: 'appointments',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'appointments', 'crmMeetings'],
      },
    })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Schedule Appointment' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Schedule Appointment' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-27')
  })

  it('opens Sales Meetings create with a valid workspace-local date', async () => {
    renderSchedulingPage({
      section: 'crmMeetings',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      events: [],
      settingsOverride: {
        enabled: true,
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
    })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Schedule Meeting' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Schedule Meeting' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-27')
  })

  it('repairs an empty initial Schedule Event date before modal state is created', () => {
    const { capabilities, settings } = getSchedulingTestContext()

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-empty-create-date',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '' as never,
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    expect(
      (within(dialog).getByLabelText('Date') as HTMLInputElement).value,
    ).toBe('2026-07-27')
  })

  it('validates an empty Schedule Event date without crashing recurrence preview', async () => {
    const { capabilities, settings } = getSchedulingTestContext()

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-empty-date-validation',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        initialRepeat: 'weekly',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    expect(
      await screen.findByText(
        'Complete the highlighted fields before scheduling this event.',
      ),
    ).toBeTruthy()
    expect(screen.getAllByText('Enter a valid date.').length).toBeGreaterThan(0)
  })

  it('moves calendar periods by the active view unit', () => {
    const anchor = new Date('2026-07-25T12:00:00.000Z')
    expect(
      moveCalendarAnchor({
        view: 'day',
        anchorDate: anchor,
        direction: 1,
      }).toISOString(),
    ).toContain('2026-07-26')
    expect(
      moveCalendarAnchor({
        view: 'week',
        anchorDate: anchor,
        direction: 1,
      }).toISOString(),
    ).toContain('2026-08-01')
    expect(
      moveCalendarAnchor({
        view: 'month',
        anchorDate: anchor,
        direction: 1,
      }).toISOString(),
    ).toContain('2026-08-25')
  })

  it('keeps today and selected-date visual state independent of grid index', () => {
    const today = new Date('2026-07-25T12:00:00.000Z')
    const julyPeriod = getCalendarPeriod({
      view: 'month',
      anchorDate: new Date('2026-07-25T12:00:00.000Z'),
      weekStartsOn: 0,
    })
    const augustPeriod = getCalendarPeriod({
      view: 'month',
      anchorDate: new Date('2026-08-25T12:00:00.000Z'),
      weekStartsOn: 0,
    })

    expect(
      getCalendarDateVisualState({
        date: new Date('2026-07-25T12:00:00.000Z'),
        today,
        selectedDate: null,
        activeRange: julyPeriod,
        activeMonth: new Date('2026-07-01T12:00:00.000Z'),
      }),
    ).toMatchObject({ isToday: true, isSelected: false, isInActiveMonth: true })

    expect(
      getCalendarDateVisualState({
        date: new Date('2026-08-22T12:00:00.000Z'),
        today,
        selectedDate: '2026-07-25',
        activeRange: augustPeriod,
        activeMonth: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).toMatchObject({
      isToday: false,
      isSelected: false,
      isInActiveMonth: true,
    })
  })

  it('identifies when selected dates fall outside a newly visible range', () => {
    const currentWeek = getCalendarPeriod({
      view: 'week',
      anchorDate: new Date('2026-07-25T12:00:00.000Z'),
      weekStartsOn: 0,
    })
    const nextWeek = getCalendarPeriod({
      view: 'week',
      anchorDate: moveCalendarAnchor({
        view: 'week',
        anchorDate: new Date('2026-07-25T12:00:00.000Z'),
        direction: 1,
      }),
      weekStartsOn: 0,
    })

    expect(
      isDateInRange('2026-07-25', currentWeek.start, currentWeek.end),
    ).toBe(true)
    expect(isDateInRange('2026-07-25', nextWeek.start, nextWeek.end)).toBe(
      false,
    )
  })

  it('expands weekly custom recurrence on selected weekdays', () => {
    const recurring: SchedulingEvent = {
      ...baseEvent,
      id: 'recurring',
      recurrenceRule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3],
        endType: 'afterOccurrences',
        occurrenceCount: 4,
      },
    }
    const occurrences = getSchedulingOccurrencesForRange({
      events: [recurring],
      rangeStart: new Date('2026-07-27T00:00:00.000Z'),
      rangeEnd: new Date('2026-08-10T23:59:59.000Z'),
    })
    expect(
      occurrences.map((event) => new Date(event.startsAt).getDay()),
    ).toEqual([1, 3, 1, 3])
  })

  it('expands every-two-weeks and monthly recurrence with end controls', () => {
    const everyTwoWeeks: SchedulingEvent = {
      ...baseEvent,
      id: 'biweekly',
      recurrenceRule: {
        frequency: 'weekly',
        interval: 2,
        daysOfWeek: [1],
        endType: 'afterOccurrences',
        occurrenceCount: 2,
      },
    }
    const monthly: SchedulingEvent = {
      ...baseEvent,
      id: 'monthly',
      startsAt: '2026-07-15T14:00:00.000Z',
      endsAt: '2026-07-15T15:00:00.000Z',
      recurrenceRule: {
        frequency: 'monthly',
        interval: 1,
        endType: 'onDate',
        endDate: '2026-09-30',
      },
    }
    expect(
      getSchedulingOccurrencesForRange({
        events: [everyTwoWeeks],
        rangeStart: new Date('2026-07-27T00:00:00.000Z'),
        rangeEnd: new Date('2026-08-31T23:59:59.000Z'),
      }).map((event) => event.startsAt.slice(0, 10)),
    ).toEqual(['2026-07-27', '2026-08-10'])
    expect(
      getSchedulingOccurrencesForRange({
        events: [monthly],
        rangeStart: new Date('2026-07-01T00:00:00.000Z'),
        rangeEnd: new Date('2026-10-31T23:59:59.000Z'),
      }).map((event) => event.startsAt.slice(0, 10)),
    ).toEqual(['2026-07-15', '2026-08-15', '2026-09-15'])
  })

  it('filters by search, event type, status, linked record, assigned member, and section', () => {
    expect(eventMatchesSearch(baseEvent, 'Rachel')).toBe(true)
    expect(eventMatchesSearch(baseEvent, 'proposal')).toBe(true)
    expect(eventMatchesSearch(baseEvent, 'warehouse')).toBe(false)
    expect(
      eventMatchesFilters(baseEvent, {
        ...emptySchedulingFilters,
        eventType: 'discoveryCall',
      }),
    ).toBe(true)
    expect(
      eventMatchesFilters(baseEvent, {
        ...emptySchedulingFilters,
        status: 'completed',
      }),
    ).toBe(false)
    expect(
      eventMatchesFilters(baseEvent, {
        ...emptySchedulingFilters,
        assignedMemberId: 'owner',
      }),
    ).toBe(true)
    expect(
      eventMatchesFilters(baseEvent, {
        ...emptySchedulingFilters,
        linkedRecordType: 'lead',
      }),
    ).toBe(true)
    expect(
      getEventsForSection({ events: [baseEvent], section: 'crmMeetings' }),
    ).toHaveLength(1)
    expect(
      getEventsForSection({ events: [baseEvent], section: 'pickupDelivery' }),
    ).toHaveLength(0)
  })

  it('summarizes only events inside the visible calendar range', () => {
    const visible = {
      ...baseEvent,
      id: 'visible',
      title: 'Visible week event',
      startsAt: '2026-07-28T14:00:00.000Z',
      endsAt: '2026-07-28T15:00:00.000Z',
    }
    const canceled: SchedulingEvent = {
      ...baseEvent,
      id: 'canceled',
      status: 'canceled',
      startsAt: '2026-07-29T14:00:00.000Z',
      endsAt: '2026-07-29T15:00:00.000Z',
    }
    const outside: SchedulingEvent = {
      ...baseEvent,
      id: 'outside',
      startsAt: '2026-08-12T14:00:00.000Z',
      endsAt: '2026-08-12T15:00:00.000Z',
    }
    const period = getCalendarPeriod({
      view: 'week',
      anchorDate: new Date('2026-07-28T12:00:00.000Z'),
      weekStartsOn: 0,
    })
    const occurrences = getSchedulingOccurrencesForRange({
      events: [visible, canceled, outside],
      rangeStart: period.start,
      rangeEnd: period.end,
    })

    expect(
      getUpcomingEventsForVisibleRange({
        occurrences,
        rangeStart: period.start,
        rangeEnd: period.end,
        now: new Date('2026-07-25T12:00:00.000Z'),
        limit: 5,
      }).map((event) => event.title),
    ).toEqual(['Visible week event'])
  })

  it('uses view-specific schedule summary labels and empty messages', () => {
    const anchor = new Date('2026-07-25T12:00:00.000Z')
    expect(
      getScheduleSummaryTitle({
        view: 'day',
        anchorDate: anchor,
        today: anchor,
      }),
    ).toBe("Today's Schedule")
    expect(
      getScheduleSummaryTitle({
        view: 'month',
        anchorDate: new Date('2026-08-12T12:00:00.000Z'),
        today: anchor,
      }),
    ).toBe('August Schedule')
    expect(getScheduleSummaryEmptyMessage('week')).toBe(
      'No events in this week.',
    )
  })

  it('resolves workspace-local today in America/New_York near midnight', () => {
    const instant = new Date('2026-07-26T05:20:00.000Z')
    expect(getWorkspaceDateKey(instant, 'America/New_York')).toBe('2026-07-26')
    expect(
      getWorkspaceNow({ timezone: 'America/New_York', now: instant }).dateKey,
    ).toBe('2026-07-26')
    expect(getWorkspaceDateKey(instant, 'America/Los_Angeles')).toBe(
      '2026-07-25',
    )
  })

  it('groups timestamps near UTC midnight into the correct workspace day', () => {
    const lateEastern = {
      ...baseEvent,
      id: 'late-eastern',
      startsAt: '2026-07-26T03:30:00.000Z',
      endsAt: '2026-07-26T04:00:00.000Z',
    }
    const period = getCalendarPeriod({
      view: 'day',
      anchorDate: dateKeyToCalendarDate('2026-07-25'),
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    const occurrences = getSchedulingOccurrencesForRange({
      events: [lateEastern],
      rangeStart: period.rangeStart,
      rangeEnd: period.rangeEnd,
    })

    expect(getWorkspaceDateKey(lateEastern.startsAt, 'America/New_York')).toBe(
      '2026-07-25',
    )
    expect(occurrences).toHaveLength(1)
  })

  it('does not shift date-only scheduling keys through UTC parsing', () => {
    const date = dateKeyToCalendarDate('2026-07-26')
    expect(isSchedulingDateKey('2026-07-26')).toBe(true)
    expect(getWorkspaceDateKey(date, 'America/New_York')).toBe('2026-07-26')
  })

  it('keeps all-day event bounds on the intended local date', () => {
    const start = combineDateAndTimeInTimezone({
      dateKey: '2026-07-26',
      time: '00:00',
      timezone: 'America/New_York',
    })
    const end = new Date(
      combineDateAndTimeInTimezone({
        dateKey: '2026-07-27',
        time: '00:00',
        timezone: 'America/New_York',
      }).getTime() - 1,
    )

    expect(getWorkspaceDateKey(start, 'America/New_York')).toBe('2026-07-26')
    expect(getWorkspaceDateKey(end, 'America/New_York')).toBe('2026-07-26')
  })

  it('uses IANA timezone rules for daylight-saving time', () => {
    const winter = combineDateAndTimeInTimezone({
      dateKey: '2026-01-15',
      time: '09:00',
      timezone: 'America/New_York',
    })
    const summer = combineDateAndTimeInTimezone({
      dateKey: '2026-07-15',
      time: '09:00',
      timezone: 'America/New_York',
    })

    expect(winter.toISOString()).toBe('2026-01-15T14:00:00.000Z')
    expect(summer.toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })

  it('recalculates today when the workspace timezone changes', () => {
    const instant = new Date('2026-07-26T05:20:00.000Z')
    expect(
      getWorkspaceNow({ timezone: 'America/New_York', now: instant }).dateKey,
    ).toBe('2026-07-26')
    expect(
      getWorkspaceNow({ timezone: 'America/Los_Angeles', now: instant })
        .dateKey,
    ).toBe('2026-07-25')
  })

  it('normalizes invalid timezone settings and keeps selector values canonical', () => {
    expect(normalizeSchedulingTimezone({ timezone: 'Not/AZone' })).toBe(
      'America/New_York',
    )
    const option = getSchedulingTimezoneOption('America/New_York')
    expect(option.label).toContain('Eastern Time')
    expect(option.value).toBe('America/New_York')
    expect(
      filterSchedulingTimezoneOptions('eastern').map((item) => item.value),
    ).toContain('America/New_York')
    expect(
      formatInWorkspaceTimezone(
        new Date('2026-07-26T05:20:00.000Z'),
        option.value,
        {
          hour: 'numeric',
          minute: '2-digit',
        },
      ),
    ).toBe('1:20 AM')
  })

  it('formats event time in the selected workspace timezone without changing the stored instant', () => {
    const instant = '2026-07-26T14:00:00.000Z'
    expect(getWorkspaceTimeInputValue(instant, 'America/New_York')).toBe(
      '10:00',
    )
    expect(getWorkspaceTimeInputValue(instant, 'America/Los_Angeles')).toBe(
      '07:00',
    )
    expect(instant).toBe('2026-07-26T14:00:00.000Z')
  })

  it('keeps Month date numbers pinned to the same top-left header for empty and event-filled cells', () => {
    const anchor = dateKeyToCalendarDate('2026-07-27')
    const period = getCalendarPeriod({
      view: 'month',
      anchorDate: anchor,
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    const occurrences = getSchedulingOccurrencesForRange({
      events: [
        {
          ...baseEvent,
          id: 'single-event',
          title: 'Single Event',
          startsAt: '2026-07-27T14:00:00.000Z',
          endsAt: '2026-07-27T15:00:00.000Z',
        },
        {
          ...baseEvent,
          id: 'multi-event-a',
          title: 'Proposal Review',
          startsAt: '2026-07-28T14:00:00.000Z',
          endsAt: '2026-07-28T15:00:00.000Z',
        },
        {
          ...baseEvent,
          id: 'multi-event-b',
          title: 'Install Prep',
          startsAt: '2026-07-28T16:00:00.000Z',
          endsAt: '2026-07-28T17:00:00.000Z',
        },
      ],
      rangeStart: period.rangeStart,
      rangeEnd: period.rangeEnd,
      timezone: 'America/New_York',
    })

    const { container } = renderCalendarView({
      view: 'month',
      anchorDate: anchor,
      todayDate: dateKeyToCalendarDate('2026-07-29'),
      occurrences,
    })

    const emptyCell = container.querySelector(
      '[data-calendar-date="2026-07-29"]',
    )
    const oneEventCell = container.querySelector(
      '[data-calendar-date="2026-07-27"]',
    )
    const multiEventCell = container.querySelector(
      '[data-calendar-date="2026-07-28"]',
    )
    const emptyHeader = emptyCell?.querySelector(
      '[data-month-day-header="true"]',
    )
    const oneEventHeader = oneEventCell?.querySelector(
      '[data-month-day-header="true"]',
    )
    const multiEventHeader = multiEventCell?.querySelector(
      '[data-month-day-header="true"]',
    )

    expect(emptyCell?.className).toContain('flex')
    expect(emptyHeader?.className).toContain('h-7')
    expect(oneEventHeader?.className).toBe(emptyHeader?.className)
    expect(multiEventHeader?.className).toBe(emptyHeader?.className)
    expect(
      oneEventCell?.querySelector('[data-month-day-events="true"]')?.className,
    ).toContain('mt-1')
    expect(
      multiEventCell?.querySelectorAll('[data-month-day-events="true"] button'),
    ).toHaveLength(2)
  })

  it('renders Month overflow below the reserved date header', () => {
    const anchor = dateKeyToCalendarDate('2026-07-27')
    const period = getCalendarPeriod({
      view: 'month',
      anchorDate: anchor,
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    const events = Array.from({ length: 5 }, (_, index) => ({
      ...baseEvent,
      id: `overflow-${index}`,
      title: `Overflow ${index + 1}`,
      startsAt: `2026-07-27T${String(14 + index).padStart(2, '0')}:00:00.000Z`,
      endsAt: `2026-07-27T${String(15 + index).padStart(2, '0')}:00:00.000Z`,
    }))
    const occurrences = getSchedulingOccurrencesForRange({
      events,
      rangeStart: period.rangeStart,
      rangeEnd: period.rangeEnd,
      timezone: 'America/New_York',
    })

    const { container } = renderCalendarView({
      view: 'month',
      anchorDate: anchor,
      todayDate: dateKeyToCalendarDate('2026-07-29'),
      occurrences,
    })
    const dayCell = container.querySelector('[data-calendar-date="2026-07-27"]')
    const eventsContainer = dayCell?.querySelector(
      '[data-month-day-events="true"]',
    )

    expect(eventsContainer?.textContent).toContain('+ 2 more')
    expect(
      eventsContainer?.previousElementSibling?.getAttribute(
        'data-month-day-header',
      ),
    ).toBe('true')
  })

  it('renders the Today badge only when Day view is anchored to today', () => {
    const today = dateKeyToCalendarDate('2026-07-26')
    const { rerender } = renderCalendarView({
      view: 'day',
      anchorDate: today,
      todayDate: today,
    })

    expect(screen.getByText('Today')).toBeTruthy()
    expect(document.querySelector('[aria-current="date"]')).not.toBeNull()

    const previous = dateKeyToCalendarDate('2026-07-25')
    const previousPeriod = getCalendarPeriod({
      view: 'day',
      anchorDate: previous,
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    rerender(
      React.createElement(CalendarView, {
        view: 'day',
        anchorDate: previous,
        selectedDate: null,
        todayDate: today,
        timezone: 'America/New_York',
        periodStart: previousPeriod.start,
        periodEnd: previousPeriod.end,
        occurrences: [],
        weekStartsOn: 0,
        onOpenEvent: () => undefined,
        onSelectDate: () => undefined,
      }),
    )

    expect(screen.queryByText('Today')).toBeNull()
    expect(document.querySelector('[aria-current="date"]')).toBeNull()
  })

  it('marks only the actual current date in Week view with a compact weekday/date pill', () => {
    const anchor = dateKeyToCalendarDate('2026-07-26')
    const { container } = renderCalendarView({
      view: 'week',
      anchorDate: anchor,
      todayDate: anchor,
    })

    const todayColumns = container.querySelectorAll(
      '[data-calendar-today="true"]',
    )
    expect(todayColumns).toHaveLength(1)
    expect(todayColumns[0].className).not.toContain('ring-blue-300')
    expect(todayColumns[0].className).toContain('ring-cyan-300/30')
    expect(todayColumns[0].className).toContain('shadow-[0_0_16px')
    expect(todayColumns[0].className).not.toContain('bg-cyan-300/[0.025]')
    expect(screen.queryByText('Today')).toBeNull()
    expect(screen.getByLabelText('Sunday, July 26, today').className).toContain(
      'rounded-full',
    )
    expect(
      screen.getByLabelText('Sunday, July 26, today').textContent,
    ).toContain('Sun')
    expect(
      screen.getByLabelText('Sunday, July 26, today').textContent,
    ).toContain('26')
  })

  it('opens Day view for the exact Week header date, including month boundaries', () => {
    const onSelectDate = vi.fn()
    renderCalendarView({
      view: 'week',
      anchorDate: dateKeyToCalendarDate('2026-07-28'),
      todayDate: dateKeyToCalendarDate('2026-07-27'),
      onSelectDate,
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: /Open Saturday, August 1 in Day view/i,
      }),
    )

    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(getCalendarDateKey(onSelectDate.mock.calls[0][0])).toBe('2026-08-01')
  })

  it('opens Day view from empty Week column space', () => {
    const onSelectDate = vi.fn()
    const { container } = renderCalendarView({
      view: 'week',
      anchorDate: dateKeyToCalendarDate('2026-07-28'),
      todayDate: dateKeyToCalendarDate('2026-07-27'),
      onSelectDate,
    })

    const column = container.querySelector('[data-calendar-date="2026-07-29"]')
    expect(column).not.toBeNull()
    fireEvent.click(column as Element)

    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(getCalendarDateKey(onSelectDate.mock.calls[0][0])).toBe('2026-07-29')
  })

  it('opens an event from Week view without also navigating to Day view', () => {
    const onSelectDate = vi.fn()
    const onOpenEvent = vi.fn()
    const anchor = dateKeyToCalendarDate('2026-07-27')
    const period = getCalendarPeriod({
      view: 'week',
      anchorDate: anchor,
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    const occurrences = getSchedulingOccurrencesForRange({
      events: [
        {
          ...baseEvent,
          startsAt: '2026-07-27T14:00:00.000Z',
          endsAt: '2026-07-27T15:00:00.000Z',
        },
      ],
      rangeStart: period.rangeStart,
      rangeEnd: period.rangeEnd,
      timezone: 'America/New_York',
    })

    renderCalendarView({
      view: 'week',
      anchorDate: anchor,
      todayDate: dateKeyToCalendarDate('2026-07-26'),
      occurrences,
      onSelectDate,
      onOpenEvent,
    })

    fireEvent.click(screen.getByRole('button', { name: /Discovery Call/i }))

    expect(onOpenEvent).toHaveBeenCalledTimes(1)
    expect(onSelectDate).not.toHaveBeenCalled()
  })

  it('does not mark a future week as today', () => {
    const { container } = renderCalendarView({
      view: 'week',
      anchorDate: dateKeyToCalendarDate('2026-08-08'),
      todayDate: dateKeyToCalendarDate('2026-07-26'),
    })

    expect(container.querySelector('[data-calendar-today="true"]')).toBeNull()
  })

  it('marks Month today through the date number without selected cell border', () => {
    const anchor = dateKeyToCalendarDate('2026-07-26')
    const { container } = renderCalendarView({
      view: 'month',
      anchorDate: anchor,
      todayDate: anchor,
    })

    const todayCell = container.querySelector('[data-calendar-today="true"]')
    expect(todayCell).not.toBeNull()
    expect(todayCell?.className).not.toContain('ring-blue-300')
    expect(todayCell?.className).toContain('ring-cyan-300/30')
    expect(todayCell?.className).toContain('shadow-[0_0_16px')
    expect(todayCell?.className).not.toContain('bg-cyan-300/[0.025]')
    expect(todayCell?.querySelector('span')?.className).toContain(
      'bg-cyan-300/18',
    )
  })

  it('allows today and selected date treatments to appear together distinctly', () => {
    const anchor = dateKeyToCalendarDate('2026-07-26')
    const { container } = renderCalendarView({
      view: 'month',
      anchorDate: anchor,
      selectedDate: '2026-07-26',
      todayDate: anchor,
    })

    const todayCell = container.querySelector('[data-calendar-today="true"]')
    expect(todayCell?.getAttribute('data-calendar-selected')).toBe('true')
    expect(todayCell?.className).toContain('ring-blue-300/50')
    expect(todayCell?.querySelector('span')?.className).toContain(
      'bg-cyan-300/25',
    )
  })

  it('clears a previously selected Month date when Today is clicked', () => {
    const { container } = render(
      React.createElement(CalendarWorkspaceSelectionHarness, {
        initialView: 'month',
        initialAnchorDate: dateKeyToCalendarDate('2026-08-01'),
        initialSelectedDate: '2026-08-01',
      }),
    )

    expect(
      container
        .querySelector('[data-calendar-date="2026-08-01"]')
        ?.getAttribute('data-calendar-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))

    expect(
      container.querySelectorAll('[data-calendar-selected="true"]'),
    ).toHaveLength(0)
    expect(
      container
        .querySelector('[data-calendar-date="2026-07-27"]')
        ?.getAttribute('data-calendar-today'),
    ).toBe('true')
    expect(
      container
        .querySelector('[data-calendar-date="2026-08-01"]')
        ?.getAttribute('data-calendar-selected'),
    ).not.toBe('true')
  })

  it('clears a previously selected Week column when Today is clicked', () => {
    const { container } = render(
      React.createElement(CalendarWorkspaceSelectionHarness, {
        initialView: 'week',
        initialAnchorDate: dateKeyToCalendarDate('2026-08-01'),
        initialSelectedDate: '2026-08-01',
      }),
    )

    expect(
      container
        .querySelector('[data-calendar-date="2026-08-01"]')
        ?.getAttribute('data-calendar-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))

    expect(
      container.querySelectorAll('[data-calendar-selected="true"]'),
    ).toHaveLength(0)
    expect(
      container
        .querySelector('[data-calendar-date="2026-07-27"]')
        ?.getAttribute('data-calendar-today'),
    ).toBe('true')
    expect(
      container
        .querySelector('[data-calendar-date="2026-08-01"]')
        ?.getAttribute('data-calendar-selected'),
    ).not.toBe('true')
  })

  it('does not mark a future month active cell as today', () => {
    const { container } = renderCalendarView({
      view: 'month',
      anchorDate: dateKeyToCalendarDate('2026-08-25'),
      todayDate: dateKeyToCalendarDate('2026-07-26'),
    })

    const outsideMonthToday = container.querySelector(
      '[data-calendar-today="true"]',
    )
    expect(outsideMonthToday).not.toBeNull()
    expect(outsideMonthToday?.className).toContain('opacity-65')
    expect(outsideMonthToday?.querySelector('span')?.className).toContain(
      'bg-cyan-300/10',
    )
  })

  it('leaves event card structure and emphasis unchanged', () => {
    const anchor = dateKeyToCalendarDate('2026-07-26')
    const period = getCalendarPeriod({
      view: 'week',
      anchorDate: anchor,
      weekStartsOn: 0,
      timezone: 'America/New_York',
    })
    const occurrences = getSchedulingOccurrencesForRange({
      events: [
        {
          ...baseEvent,
          startsAt: '2026-07-26T14:00:00.000Z',
          endsAt: '2026-07-26T15:00:00.000Z',
        },
      ],
      rangeStart: period.rangeStart,
      rangeEnd: period.rangeEnd,
    })
    renderCalendarView({
      view: 'week',
      anchorDate: anchor,
      todayDate: anchor,
      occurrences,
    })

    const eventButton = screen.getByRole('button', { name: /Discovery Call/i })
    expect(eventButton.className).toContain('border-cyan-300/25')
    expect(eventButton.className).toContain('bg-cyan-300/10')
  })

  it('shows a secondary Day-card Schedule Event action only in Day view', () => {
    const dayCreate = vi.fn()
    renderCalendarWorkspace({
      view: 'day',
      anchorDate: dateKeyToCalendarDate('2026-08-14'),
      onCreateForDate: dayCreate,
    })

    const contextualAction = screen.getByRole('button', {
      name: 'Schedule Event',
    })
    expect(contextualAction.className).toContain('border-app')
    expect(contextualAction.className).toContain('text-app-primary')
    expect(contextualAction.className).toContain('hover:bg-app-surface-hover')
    fireEvent.click(contextualAction)
    expect(dayCreate).toHaveBeenCalledWith('2026-08-14')

    cleanup()

    renderCalendarWorkspace({
      view: 'week',
      anchorDate: dateKeyToCalendarDate('2026-08-14'),
    })
    expect(screen.queryByRole('button', { name: 'Schedule Event' })).toBeNull()

    cleanup()

    renderCalendarWorkspace({
      view: 'month',
      anchorDate: dateKeyToCalendarDate('2026-08-14'),
    })
    expect(screen.queryByRole('button', { name: 'Schedule Event' })).toBeNull()

    cleanup()

    renderCalendarWorkspace({
      view: 'agenda',
      anchorDate: dateKeyToCalendarDate('2026-08-14'),
    })
    expect(screen.queryByRole('button', { name: 'Schedule Event' })).toBeNull()
  })

  it.each([
    [
      'default Consultative sections',
      ['calendar', 'appointments', 'crmMeetings', 'teamAvailability'],
    ],
    [
      'Jobs enabled',
      [
        'calendar',
        'appointments',
        'crmMeetings',
        'teamAvailability',
        'scheduledJobs',
      ],
    ],
    [
      'Recurring Services enabled',
      [
        'calendar',
        'appointments',
        'crmMeetings',
        'teamAvailability',
        'recurringServices',
      ],
    ],
    [
      'Internal Meetings enabled',
      [
        'calendar',
        'appointments',
        'crmMeetings',
        'teamAvailability',
        'internalMeetings',
      ],
    ],
    [
      'all supported Consultative sections',
      [
        'calendar',
        'appointments',
        'teamAvailability',
        'crmMeetings',
        'scheduledJobs',
        'recurringServices',
        'internalMeetings',
      ],
    ],
  ] as const)('keeps Filters clickable with %s', (_, visibleSections) => {
    renderCalendarWorkspace({
      view: 'week',
      anchorDate: dateKeyToCalendarDate('2026-07-27'),
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        enabled: true,
        visibleSections: [...visibleSections],
      },
    })

    const filtersButton = screen.getByRole('button', { name: 'Filters' })
    fireEvent.click(filtersButton)

    expect(filtersButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Event type')).toBeTruthy()
    expect(screen.getByText('Clear all')).toBeTruthy()
  })

  it('renders Jobs as its own section route with Jobs content and active tab state', async () => {
    renderSchedulingPage({ section: 'scheduledJobs' })

    expect(
      await screen.findAllByRole('heading', { name: 'Scheduled Jobs' }),
    ).toHaveLength(2)
    expect(
      screen.getByText(
        'Scheduled service jobs with crew, status, location, and customer context.',
      ),
    ).toBeTruthy()
    expect(screen.getAllByText('Scheduled Job').length).toBeGreaterThan(0)
    expect(screen.queryByText('Week calendar')).toBeNull()

    const jobsTab = screen.getByRole('link', { name: 'Jobs' })
    expect(jobsTab.getAttribute('href')).toBe('/dashboard/acme/scheduling/jobs')
    expect(jobsTab.className).toContain('border-cyan-300/60')

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Clear all')).toBeTruthy()
  })

  it('opens the existing create form from Jobs with a scheduled-job preset', async () => {
    renderSchedulingPage({ section: 'scheduledJobs' })

    await screen.findAllByRole('heading', { name: 'Scheduled Jobs' })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Job' }))

    expect(screen.getByRole('dialog', { name: 'Schedule Job' })).toBeTruthy()
    const dialog = screen.getByRole('dialog', { name: 'Schedule Job' })
    expect(dialog.querySelector('select')?.value).toBe('scheduledJob')
  })

  it('renders an empty Jobs section without redirecting to Calendar', async () => {
    renderSchedulingPage({
      section: 'scheduledJobs',
      events: [
        {
          ...baseEvent,
          id: 'appointment-for-empty-jobs',
          workspaceId: 'workspace-scheduledJobs',
          type: 'serviceAppointment',
          title: 'Service Appointment',
          linkedRecord: {
            recordType: 'client',
            recordId: 'client-1',
            label: 'NorthStar Electric',
          },
        },
      ],
    })

    expect(await screen.findByText('No scheduled jobs yet.')).toBeTruthy()
    expect(screen.queryByText('Week calendar')).toBeNull()
    expect(screen.queryByText('Back to Calendar')).toBeNull()
  })

  it('renders Recurring Services as plan content with section-specific filters', async () => {
    renderSchedulingPage({ section: 'recurringServices' })

    expect(
      await screen.findAllByRole('heading', { name: 'Recurring Services' }),
    ).toHaveLength(2)
    expect(
      screen.getByText(
        'Series are modeled separately from individual calendar occurrences.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Recurring Service Plan')).toBeTruthy()
    expect(screen.getByText('Plan')).toBeTruthy()
    expect(screen.queryByText('Week calendar')).toBeNull()

    const recurringTab = screen.getByRole('link', {
      name: 'Recurring Services',
    })
    expect(recurringTab.getAttribute('href')).toBe(
      '/dashboard/acme/scheduling/recurring-services',
    )
    expect(recurringTab.className).toContain('border-cyan-300/60')

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Event type')).toBeTruthy()
    expect(screen.getByText('Clear all')).toBeTruthy()
  })

  it('opens the existing create form from Recurring Services with recurrence enabled', async () => {
    renderSchedulingPage({ section: 'recurringServices' })

    await screen.findAllByRole('heading', { name: 'Recurring Services' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Recurring Service' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Add Recurring Service' }),
    ).toBeTruthy()
    const dialog = screen.getByRole('dialog', { name: 'Add Recurring Service' })
    const selects = dialog.querySelectorAll('select')
    expect(selects[0]?.value).toBe('recurringServiceVisit')
    expect(
      Array.from(selects).some((select) => select.value === 'weekly'),
    ).toBe(true)
  })

  it('renders an empty Recurring Services section without redirecting to Calendar', async () => {
    renderSchedulingPage({
      section: 'recurringServices',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        enabled: true,
        visibleSections: ['calendar', 'recurringServices'],
      },
    })

    expect(
      await screen.findByText('No recurring service plans yet.'),
    ).toBeTruthy()
    expect(screen.queryByText('Week calendar')).toBeNull()
    expect(screen.queryByText('Back to Calendar')).toBeNull()
  })

  it('renders Internal Meetings as its own empty section instead of Calendar', async () => {
    renderSchedulingPage({
      section: 'internalMeetings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'internalMeetings'],
      },
      events: [
        {
          ...baseEvent,
          id: 'service-appointment-for-internal-empty',
          workspaceId: 'workspace-internalMeetings',
          type: 'serviceAppointment',
          title: 'Service Appointment',
          linkedRecord: {
            recordType: 'client',
            recordId: 'client-1',
            label: 'NorthStar Electric',
          },
        },
      ],
    })

    expect(
      await screen.findAllByRole('heading', { name: 'Internal Meetings' }),
    ).toHaveLength(2)
    expect(
      screen.getByText(
        'Workspace-only meetings that are not tied to customer records.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('No internal meetings scheduled.')).toBeTruthy()
    expect(screen.queryByText('Week calendar')).toBeNull()

    const internalTab = screen.getByRole('link', { name: 'Internal Meetings' })
    expect(internalTab.getAttribute('href')).toBe(
      '/dashboard/acme/scheduling/internal-meetings',
    )
    expect(internalTab.className).toContain('border-cyan-300/60')
  })

  it('opens the existing create form from Internal Meetings with an internal-meeting preset', async () => {
    renderSchedulingPage({
      section: 'internalMeetings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'internalMeetings'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Internal Meetings' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Schedule Internal Meeting' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Schedule Internal Meeting' }),
    ).toBeTruthy()
    const dialog = screen.getByRole('dialog', {
      name: 'Schedule Internal Meeting',
    })
    expect(dialog.querySelector('select')?.value).toBe('internalMeeting')
  })

  it('uses server-provided visible sections when no preview settings are saved', async () => {
    renderSchedulingPage({
      section: 'internalMeetings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'internalMeetings'],
      },
      seedSettings: false,
    })

    expect(
      await screen.findAllByRole('heading', { name: 'Internal Meetings' }),
    ).toHaveLength(2)
    expect(screen.queryByText('Scheduling section hidden')).toBeNull()
    expect(screen.queryByText('Back to Calendar')).toBeNull()
    expect(screen.queryByText('Week calendar')).toBeNull()
  })

  it('keeps custom section labels display-only for specialized section routes', async () => {
    renderSchedulingPage({
      section: 'scheduledJobs',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'scheduledJobs'],
        sectionLabelOverrides: {
          scheduledJobs: 'Field Visits',
        },
      },
    })

    expect(
      await screen.findAllByRole('heading', { name: 'Field Visits' }),
    ).toHaveLength(2)
    const fieldVisitsTab = screen.getByRole('link', { name: 'Field Visits' })
    expect(fieldVisitsTab.getAttribute('href')).toBe(
      '/dashboard/acme/scheduling/jobs',
    )
    expect(screen.getAllByText('Scheduled Job').length).toBeGreaterThan(0)
    expect(screen.queryByText('Week calendar')).toBeNull()
  })

  it('keeps renamed Recurring Services and Internal Meetings on their stable routes', async () => {
    renderSchedulingPage({
      section: 'recurringServices',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'recurringServices', 'internalMeetings'],
        sectionLabelOverrides: {
          recurringServices: 'Maintenance Plans',
          internalMeetings: 'Team Huddles',
        },
      },
    })

    expect(
      await screen.findAllByRole('heading', { name: 'Maintenance Plans' }),
    ).toHaveLength(2)
    const recurringTab = screen.getByRole('link', { name: 'Maintenance Plans' })
    expect(recurringTab.getAttribute('href')).toBe(
      '/dashboard/acme/scheduling/recurring-services',
    )
    expect(recurringTab.className).toContain('border-cyan-300/60')
    expect(
      screen.getByRole('link', { name: 'Team Huddles' }).getAttribute('href'),
    ).toBe('/dashboard/acme/scheduling/internal-meetings')
  })

  it('keeps a routed server-visible section visible when stale preview settings omitted it', async () => {
    const staleWorkspaceId = 'workspace-internalMeetings'
    savePreviewSchedulingSettings({
      workspaceId: staleWorkspaceId,
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      settings: normalizeSchedulingSettings({
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
        settings: {
          preset: 'service',
          enabled: true,
          visibleSections: ['calendar'],
        },
      }),
    })

    renderSchedulingPage({
      section: 'internalMeetings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'internalMeetings'],
      },
      seedSettings: false,
    })

    expect(
      await screen.findAllByRole('heading', { name: 'Internal Meetings' }),
    ).toHaveLength(2)
    expect(screen.queryByText('Scheduling section hidden')).toBeNull()
    expect(screen.queryByText('Week calendar')).toBeNull()
  })

  it('renders custom event types as full cards and includes active custom types in Create Event', async () => {
    renderSchedulingPage({
      section: 'settings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
        customEventTypes: [
          {
            id: 'custom-1',
            workspaceId: 'workspace-calendar',
            key: 'custom.training-session',
            label: 'Training Session',
            description: 'Internal skills training.',
            presetScope: ['service'],
            sectionKeys: ['calendar', 'teamAvailability'],
            defaultDurationMinutes: 30,
            blocksAvailability: true,
            requiresLinkedRecord: false,
            supportedLinkedRecordTypes: [],
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          },
        ],
      },
    })

    expect(await screen.findByText('Training Session')).toBeTruthy()
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0)
    expect(screen.getByText('Internal skills training.')).toBeTruthy()
    expect(screen.getByText(/Default duration: 30 min/)).toBeTruthy()

    cleanup()

    renderSchedulingPage({
      section: 'calendar',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar'],
        customEventTypes: [
          {
            id: 'custom-1',
            workspaceId: 'workspace-calendar',
            key: 'custom.training-session',
            label: 'Training Session',
            description: 'Internal skills training.',
            presetScope: ['service'],
            sectionKeys: ['calendar'],
            defaultDurationMinutes: 30,
            blocksAvailability: true,
            requiresLinkedRecord: false,
            supportedLinkedRecordTypes: [],
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          },
        ],
      },
    })
    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    expect(
      screen.getByRole('option', { name: 'Training Session' }),
    ).toBeTruthy()
  })

  it('edits custom event types without changing their stable key', async () => {
    renderSchedulingPage({
      section: 'settings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar'],
        customEventTypes: [
          {
            id: 'custom-edit',
            workspaceId: 'workspace-settings',
            key: 'custom.training-session',
            label: 'Training Session',
            description: 'Internal skills training.',
            presetScope: ['service'],
            sectionKeys: ['calendar'],
            defaultDurationMinutes: 30,
            blocksAvailability: true,
            requiresLinkedRecord: false,
            supportedLinkedRecordTypes: [],
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          },
        ],
      },
    })

    await screen.findByText('Training Session')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByDisplayValue('Training Session'), {
      target: { value: 'Team Training' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Team Training')
    fireEvent.click(screen.getByRole('link', { name: 'Back to Calendar' }))
    cleanup()

    renderSchedulingPage({
      section: 'calendar',
      settingsOverride: readPreviewSchedulingSettings({
        workspaceId: 'workspace-settings',
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      }),
    })
    await screen.findByText('Week calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    const option = screen.getByRole('option', {
      name: 'Team Training',
    }) as HTMLOptionElement
    expect(option.value).toBe('custom.training-session')
  })

  it('hides all and shows all event types without deleting custom records', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderSchedulingPage({
      section: 'settings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar'],
        customEventTypes: [
          {
            id: 'custom-hide',
            workspaceId: 'workspace-settings',
            key: 'custom.training-session',
            label: 'Training Session',
            presetScope: ['service'],
            sectionKeys: ['calendar'],
            defaultDurationMinutes: 30,
            blocksAvailability: true,
            requiresLinkedRecord: false,
            supportedLinkedRecordTypes: [],
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          },
        ],
      },
    })

    await screen.findByText('Training Session')
    fireEvent.click(screen.getByRole('button', { name: 'Hide All' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(await screen.findByText('Hidden')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }))
    expect(await screen.findByText('Active')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hide All' })).toBeTruthy()
  })

  it('keeps Hide All horizontal and renders Calendar as required instead of a disabled checkbox', async () => {
    renderSchedulingPage({ section: 'settings' })

    const hideAll = await screen.findByRole('button', { name: 'Hide All' })
    expect(hideAll.className).toContain('whitespace-nowrap')
    expect(hideAll.className).toContain('min-w-[5.75rem]')
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.queryByLabelText('Show Calendar')).toBeNull()
    expect(screen.getByLabelText('Show Appointments')).toBeTruthy()
  })

  it('shows friendly not-configured provider states and mutes diagnostics before connection', async () => {
    renderSchedulingPage({ section: 'settings' })

    expect(
      await screen.findByText('Google Calendar has not been configured yet.'),
    ).toBeTruthy()
    expect(
      screen.getByText('Microsoft Outlook has not been configured yet.'),
    ).toBeTruthy()
    expect(
      screen.getAllByText(
        'A Skillify administrator must configure this integration before workspace accounts can be connected.',
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('No Google accounts connected')).toBeTruthy()
    expect(screen.getByText('No Outlook accounts connected')).toBeTruthy()
    expect(
      screen.getAllByText(
        'Sync diagnostics become available after an account is connected.',
      ).length,
    ).toBe(2)
    expect(screen.getAllByText(/Pending sync · —/).length).toBe(2)
  })

  it('hides raw provider environment names from ordinary workspace members', async () => {
    renderSchedulingPage({ section: 'settings', canManage: false })

    expect(
      await screen.findByText('Google Calendar has not been configured yet.'),
    ).toBeTruthy()
    expect(screen.queryByText('Developer details')).toBeNull()
    expect(screen.queryByText('GOOGLE_CALENDAR_CLIENT_ID')).toBeNull()
    expect(screen.queryByText('MICROSOFT_CALENDAR_CLIENT_ID')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Connect Google' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Connect Outlook' })).toBeNull()
  })

  it('uses compact duration labels and stores custom hours and minutes as total minutes', async () => {
    renderSchedulingPage({ section: 'settings' })

    await screen.findByText('Event types')
    expect(
      screen.getAllByRole('option', { name: 'System default — 1 hr' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('option', { name: '15 min' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('option', { name: '1 hr 30 min' }).length,
    ).toBeGreaterThan(0)

    const durationSelect = screen
      .getAllByRole('combobox')
      .find((select) =>
        Array.from((select as HTMLSelectElement).options).some(
          (option) => option.textContent === 'System default — 1 hr',
        ),
      ) as HTMLSelectElement
    expect(durationSelect).toBeTruthy()
    fireEvent.change(durationSelect, { target: { value: 'custom' } })

    const hours = screen.getByLabelText('Hours') as HTMLInputElement
    const minutes = screen.getByLabelText('Minutes') as HTMLInputElement
    fireEvent.change(hours, { target: { value: '1' } })
    fireEvent.change(minutes, { target: { value: '30' } })
    expect(screen.getByText('Resolved duration: 1 hr 30 min')).toBeTruthy()

    const settings = readPreviewSchedulingSettings({
      workspaceId: 'workspace-settings',
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
    })
    expect(settings.eventTypePreferences?.[0]?.defaultDurationMinutes).toBe(90)
  })

  it('rejects custom duration minutes above 59', async () => {
    renderSchedulingPage({ section: 'settings' })

    await screen.findByText('Event types')
    const durationSelect = screen
      .getAllByRole('combobox')
      .find((select) =>
        Array.from((select as HTMLSelectElement).options).some(
          (option) => option.textContent === 'System default — 1 hr',
        ),
      ) as HTMLSelectElement
    fireEvent.change(durationSelect, { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('Minutes'), {
      target: { value: '75' },
    })

    expect(
      await screen.findByText('Minutes must be between 0 and 59.'),
    ).toBeTruthy()
  })

  it('renders the timezone dropdown above connected calendars', async () => {
    renderSchedulingPage({ section: 'settings' })

    const preferencesCard = (
      await screen.findByText('Calendar preferences')
    ).closest('div')
    expect(preferencesCard).not.toBeNull()
    const timezoneButton = within(preferencesCard!).getByRole('button', {
      name: /timezone:.*America\/New_York/i,
    })
    expect(timezoneButton.textContent).toContain('Eastern Time')
    expect(timezoneButton.textContent).toMatch(/\d{1,2}:\d{2}/)
    expect(timezoneButton.textContent).not.toContain('Change')
    expect(timezoneButton.querySelector('svg')).not.toBeNull()
    fireEvent.keyDown(timezoneButton!, { key: 'Enter' })
    expect(document.querySelector('[data-timezone-menu="true"]')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(document.querySelector('[data-timezone-menu="true"]')).toBeNull()
    })
    fireEvent.click(timezoneButton!)
    const menu = document.querySelector('[data-timezone-menu="true"]')
    expect(menu).not.toBeNull()
    expect(menu?.parentElement).toBe(document.body)
    expect(menu?.className).toContain('z-[120]')
    expect(
      screen.getByRole('heading', { name: 'Google Calendar' }),
    ).toBeTruthy()
  })

  it('opens a dedicated Time Off form and saves a member availability record with a readable card range', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Time Off' }))

    expect(screen.getByRole('dialog', { name: 'Add Time Off' })).toBeTruthy()
    expect(screen.queryByLabelText('Event type')).toBeNull()
    expect(screen.queryByText('Linked record')).toBeNull()

    fireEvent.change(screen.getByLabelText('Optional title or reason'), {
      target: { value: 'Jury Duty' },
    })
    const dialog = screen.getByRole('dialog', { name: 'Add Time Off' })
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Add Time Off',
      )!,
    )

    expect((await screen.findAllByText('Jury Duty')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Owner · .* · All day/)).toBeTruthy()
    const records = getPreviewTeamAvailabilityRecords(
      'workspace-teamAvailability',
    )
    expect(
      records.some((record) => record.kind === 'timeOff' && record.memberId),
    ).toBe(true)
  })

  it('edits and deletes Time Off records from the availability drawer', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: /Personal Owner/ }))
    expect(screen.getByRole('dialog', { name: 'Time Off' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(screen.getByText(/Eastern Time/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const editDialog = await screen.findByRole('dialog', {
      name: 'Edit Time Off',
    })
    expect(screen.queryByRole('dialog', { name: 'Time Off' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Optional title or reason'), {
      target: { value: 'Doctor Appointment' },
    })
    fireEvent.click(
      Array.from(editDialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Save Changes',
      )!,
    )

    expect(
      (await screen.findAllByText('Doctor Appointment')).length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Doctor Appointment/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this time-off record?')).toBeTruthy()
    expect(
      screen.getByText('Delete this time-off record?').closest('div')
        ?.className,
    ).toContain('border-b')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Time Off' }))
    await waitFor(() => {
      expect(screen.queryByText('Doctor Appointment')).toBeNull()
    })
  })

  it('hides past Time Off by default while preserving it in storage', async () => {
    savePreviewTeamAvailabilityRecords({
      workspaceId: 'workspace-teamAvailability',
      records: [
        {
          id: 'past-time-off',
          workspaceId: 'workspace-teamAvailability',
          kind: 'timeOff',
          memberId: 'owner',
          memberName: 'Owner',
          category: 'personal',
          title: 'Past PTO',
          reason: 'Past PTO',
          startsAt: '2026-07-20T13:00:00.000Z',
          endsAt: '2026-07-20T17:00:00.000Z',
          allDay: false,
          timezone: 'America/New_York',
        },
        {
          id: 'current-working-hours',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          memberId: 'owner',
          memberName: 'Owner',
          daysOfWeek: [1, 2, 3, 4, 5],
          startsAt: '09:00',
          endsAt: '17:00',
          timezone: 'America/New_York',
        },
      ],
    })

    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.queryByText('Past PTO')).toBeNull()
    expect(
      getPreviewTeamAvailabilityRecords('workspace-teamAvailability').some(
        (record) => record.kind === 'timeOff' && record.title === 'Past PTO',
      ),
    ).toBe(true)
    expect(screen.getByText(/9:00 AM-5:00 PM/)).toBeTruthy()
  })

  it('opens, edits, and deletes Admin Block as a normal Time Off record', async () => {
    const now = new Date()
    const startsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
    const endsAt = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString()
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      availability: [
        {
          id: 'office-team-hours',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          memberId: 'team-office',
          memberName: 'Office Team',
          daysOfWeek: [1, 2, 3, 4, 5],
          startsAt: '09:00',
          endsAt: '17:00',
          timezone: 'America/New_York',
        },
        {
          id: 'admin-block-time-off',
          workspaceId: 'workspace-teamAvailability',
          kind: 'timeOff',
          memberId: 'team-office',
          memberName: 'Office Team',
          category: 'unavailable',
          title: 'Admin Block',
          reason: 'Admin Block',
          startsAt,
          endsAt,
          allDay: false,
          timezone: 'America/New_York',
          createdByUserId: 'owner',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: /Admin Block/ }))
    expect(screen.getByRole('dialog', { name: 'Time Off' })).toBeTruthy()
    expect(screen.getByText('Record type')).toBeTruthy()
    expect(screen.getAllByText('Time Off').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Office Team').length).toBeGreaterThan(1)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const editDialog = await screen.findByRole('dialog', {
      name: 'Edit Time Off',
    })
    expect(
      (screen.getByLabelText('Team member') as HTMLSelectElement).value,
    ).toBe('team-office')
    fireEvent.change(screen.getByLabelText('Optional title or reason'), {
      target: { value: 'Admin Focus' },
    })
    fireEvent.click(
      Array.from(editDialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Save Changes',
      )!,
    )

    expect((await screen.findAllByText('Admin Focus')).length).toBeGreaterThan(
      0,
    )
    const updated = getPreviewTeamAvailabilityRecords(
      'workspace-teamAvailability',
    ).find(
      (record) => record.kind === 'timeOff' && record.title === 'Admin Focus',
    )
    expect(updated?.kind).toBe('timeOff')
    expect(updated?.memberId).toBe('team-office')

    fireEvent.click(screen.getByRole('button', { name: /Admin Focus/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this time-off record?')).toBeTruthy()
    expect(
      screen.getByText(/Office Team will be shown as available/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Time Off' }))
    await waitFor(() => {
      expect(screen.queryByText('Admin Focus')).toBeNull()
    })
  })

  it('formats Working Hours in 12-hour time and validates edits', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.getByText(/9:00 AM-5:00 PM/)).toBeTruthy()
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Owner/ })
        .find((button) => button.textContent?.includes('9:00 AM-5:00 PM'))!,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      await screen.findByRole('dialog', { name: 'Edit Working Hours' }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('End time'), {
      target: { value: '08:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText('End time must be later than start time.'),
    ).toBeTruthy()
  })

  it('creates workspace Business Hours and persists the scoped baseline', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    expect(screen.getByLabelText('Applies to')).toBeTruthy()
    expect(screen.queryByText('Custom')).toBeNull()
    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '08:00' },
    })
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Add Working Hours',
      )!,
    )

    expect(
      (await screen.findAllByText('Business Hours')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Entire business · .*8:00 AM-5:00 PM/)).toBeTruthy()
    const records = getPreviewTeamAvailabilityRecords(
      'workspace-teamAvailability',
    )
    expect(
      records.some(
        (record) =>
          record.kind === 'workingHours' &&
          record.scope === 'workspace' &&
          record.memberName === 'Business Hours',
      ),
    ).toBe(true)
  })

  it('resolves Working Hours scopes only from active entity options', () => {
    expect(
      resolveWorkingHoursScopeOptions({
        activeMembers: [{ id: 'member-owner', label: 'Owner' }],
        activeTeams: [],
        activeLocations: [],
      }).map((option) => option.key),
    ).toEqual(['workspace', 'member'])

    expect(
      resolveWorkingHoursScopeOptions({
        activeMembers: [{ id: 'member-owner', label: 'Owner' }],
        activeTeams: [{ id: 'team-office', label: 'Office Team' }],
        activeLocations: [{ id: 'location-main', label: 'Main Office' }],
      }).map((option) => option.key),
    ).toEqual(['workspace', 'location', 'team', 'member'])

    expect(
      resolveWorkingHoursScopeOptions({
        activeMembers: [],
        activeTeams: [],
        activeLocations: [],
        initialScope: 'team',
      }).find((option) => option.key === 'team'),
    ).toMatchObject({
      key: 'team',
      enabled: false,
      helperText:
        'No teams are available. Create a team from Members to configure Team Hours.',
    })
  })

  it('omits Team and Location scopes when only fixture or snapshot records exist', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.getAllByText('Office Team').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    await waitFor(() => {
      expect(
        Array.from(
          (within(dialog).getByLabelText('Applies to') as HTMLSelectElement)
            .options,
        ).map((option) => option.value),
      ).toContain('member')
    })
    const scopeValues = Array.from(
      (within(dialog).getByLabelText('Applies to') as HTMLSelectElement)
        .options,
    ).map((option) => option.value)

    expect(scopeValues).toContain('workspace')
    expect(scopeValues).toContain('member')
    expect(scopeValues).not.toContain('team')
    expect(scopeValues).not.toContain('location')
    expect(within(dialog).getByText('No teams are available.')).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Create team' }),
    ).toBeTruthy()
    expect(
      within(dialog).getByText('No business locations are available.'),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Add location' }),
    ).toBeTruthy()
  })

  it('shows Team and Location scopes from real workspace records', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
      teams: [
        {
          id: 'team-field',
          name: 'Field Crew',
          members: [{ workspaceMemberId: 'workspace-member-owner' }],
        },
      ],
      locations: [
        {
          id: 'location-main',
          name: 'Main Office',
          city: 'Fairfax',
          timezone: 'America/New_York',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    await waitFor(() => {
      const scopeValues = Array.from(
        (within(dialog).getByLabelText('Applies to') as HTMLSelectElement)
          .options,
      ).map((option) => option.value)
      expect(scopeValues).toEqual(['workspace', 'location', 'team', 'member'])
    })
    fireEvent.change(within(dialog).getByLabelText('Applies to'), {
      target: { value: 'team' },
    })
    expect(
      (within(dialog).getByLabelText('Team') as HTMLSelectElement).value,
    ).toBe('team-field')
    fireEvent.change(within(dialog).getByLabelText('Applies to'), {
      target: { value: 'location' },
    })
    expect(
      (within(dialog).getByLabelText('Location') as HTMLSelectElement).value,
    ).toBe('location-main')
  })

  it('quick-creates a Team from Add Working Hours and preserves the form state', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    let dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    fireEvent.change(within(dialog).getByLabelText('Start time'), {
      target: { value: '08:30' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    dialog = await screen.findByRole('dialog', { name: 'Create Team' })
    fireEvent.change(within(dialog).getByLabelText('Team name'), {
      target: { value: 'Field Crew' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Team' }))

    dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    await waitFor(() => {
      expect(
        (within(dialog).getByLabelText('Applies to') as HTMLSelectElement)
          .value,
      ).toBe('team')
    })
    expect(
      (within(dialog).getByLabelText('Team') as HTMLSelectElement).value,
    ).toBe('team-field-crew')
    expect(
      (within(dialog).getByLabelText('Start time') as HTMLInputElement).value,
    ).toBe('08:30')
  })

  it('quick-creates a Business Location from Add Working Hours and preserves the form state', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    let dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    fireEvent.change(within(dialog).getByLabelText('End time'), {
      target: { value: '16:30' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add location' }),
    )

    dialog = await screen.findByRole('dialog', {
      name: 'Add Business Location',
    })
    fireEvent.change(within(dialog).getByLabelText('Location name'), {
      target: { value: 'Main Office' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add Location' }),
    )

    dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    await waitFor(() => {
      expect(
        (within(dialog).getByLabelText('Applies to') as HTMLSelectElement)
          .value,
      ).toBe('location')
    })
    expect(
      (within(dialog).getByLabelText('Location') as HTMLSelectElement).value,
    ).toBe('location-main-office')
    expect(
      (within(dialog).getByLabelText('End time') as HTMLInputElement).value,
    ).toBe('16:30')
  })

  it('saves member Working Hours inheritance without duplicating schedule values', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      availability: [
        {
          id: 'business-hours',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          scope: 'workspace',
          memberId: '',
          memberName: 'Business Hours',
          scheduleMode: 'custom',
          daysOfWeek: [1, 2, 3, 4, 5],
          startsAt: '08:00',
          endsAt: '17:00',
          timezone: 'America/New_York',
        },
      ],
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Working Hours' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Add Working Hours',
    })
    fireEvent.change(screen.getByLabelText('Applies to'), {
      target: { value: 'member' },
    })
    fireEvent.change(screen.getByLabelText('Member'), {
      target: { value: 'workspace-member-owner' },
    })
    fireEvent.change(screen.getByLabelText('Schedule'), {
      target: { value: 'inherit' },
    })
    expect(screen.queryByLabelText('Start time')).toBeNull()
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Add Working Hours',
      )!,
    )

    await waitFor(() => {
      expect(
        getPreviewTeamAvailabilityRecords('workspace-teamAvailability').some(
          (record) =>
            record.kind === 'workingHours' &&
            record.workspaceMemberId === 'workspace-member-owner',
        ),
      ).toBe(true)
    })
    const inherited = getPreviewTeamAvailabilityRecords(
      'workspace-teamAvailability',
    ).find(
      (
        record,
      ): record is Extract<TeamAvailabilityRecord, { kind: 'workingHours' }> =>
        record.kind === 'workingHours' &&
        record.workspaceMemberId === 'workspace-member-owner',
    )
    expect(inherited?.kind).toBe('workingHours')
    expect(inherited?.scheduleMode).toBe('inherit')
    expect(inherited?.daysOfWeek).toEqual([])
  })

  it('shows inherited Working Hours cards with their source schedule', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      availability: [
        {
          id: 'business-hours',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          scope: 'workspace',
          memberId: '',
          memberName: 'Business Hours',
          scheduleMode: 'custom',
          daysOfWeek: [1, 2, 3, 4, 5],
          startsAt: '08:00',
          endsAt: '17:00',
          timezone: 'America/New_York',
        },
        {
          id: 'owner-inherits',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          scope: 'member',
          workspaceMemberId: 'workspace-member-owner',
          memberId: 'workspace-member-owner',
          memberName: 'Owner',
          scheduleMode: 'inherit',
          daysOfWeek: [],
          timezone: 'America/New_York',
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.getByText('Member · Uses Business Hours')).toBeTruthy()
  })

  it('resolves scoped Working Hours with exception and Time Off precedence', () => {
    const availability: TeamAvailabilityRecord[] = [
      {
        id: 'business-hours',
        workspaceId: 'workspace-teamAvailability',
        kind: 'workingHours',
        scope: 'workspace',
        memberId: '',
        memberName: 'Business Hours',
        scheduleMode: 'custom',
        daysOfWeek: [1, 2, 3, 4, 5],
        startsAt: '08:00',
        endsAt: '17:00',
        timezone: 'America/New_York',
      },
      {
        id: 'team-hours',
        workspaceId: 'workspace-teamAvailability',
        kind: 'workingHours',
        scope: 'team',
        teamId: 'team-field',
        teamName: 'Field Crew',
        memberId: 'team-field',
        memberName: 'Field Crew',
        scheduleMode: 'custom',
        daysOfWeek: [1, 2, 3, 4, 5, 6],
        startsAt: '07:00',
        endsAt: '16:00',
        timezone: 'America/New_York',
      },
      {
        id: 'location-hours',
        workspaceId: 'workspace-teamAvailability',
        kind: 'workingHours',
        scope: 'location',
        locationId: 'location-north',
        locationName: 'North Office',
        memberId: 'location:location-north',
        memberName: 'North Office',
        scheduleMode: 'custom',
        daysOfWeek: [1, 2, 3, 4, 5],
        startsAt: '06:30',
        endsAt: '15:30',
        timezone: 'America/New_York',
      },
      {
        id: 'member-hours',
        workspaceId: 'workspace-teamAvailability',
        kind: 'workingHours',
        scope: 'member',
        workspaceMemberId: 'member-owner',
        memberId: 'member-owner',
        memberName: 'Owner',
        scheduleMode: 'custom',
        daysOfWeek: [2, 3, 4, 5, 6],
        startsAt: '09:00',
        endsAt: '18:00',
        timezone: 'America/New_York',
      },
    ]

    expect(
      resolveEffectiveWorkingHours({
        availability,
        workspaceId: 'workspace-teamAvailability',
        workspaceMemberId: 'member-owner',
        teamIds: ['team-field'],
        date: '2026-07-28',
        timezone: 'America/New_York',
      }),
    ).toMatchObject({
      source: 'member',
      sourceRecordId: 'member-hours',
      startTime: '09:00',
      endTime: '18:00',
      isAvailable: true,
    })

    expect(
      resolveEffectiveWorkingHours({
        availability: availability.filter(
          (record) => record.id !== 'member-hours',
        ),
        workspaceId: 'workspace-teamAvailability',
        workspaceMemberId: 'member-owner',
        teamIds: ['team-field'],
        date: '2026-07-28',
        timezone: 'America/New_York',
      }).source,
    ).toBe('team')

    expect(
      resolveEffectiveWorkingHours({
        availability: availability.filter(
          (record) =>
            record.id !== 'member-hours' && record.id !== 'team-hours',
        ),
        workspaceId: 'workspace-teamAvailability',
        workspaceMemberId: 'member-owner',
        teamIds: [],
        locationId: 'location-north',
        date: '2026-07-28',
        timezone: 'America/New_York',
      }),
    ).toMatchObject({
      source: 'location',
      sourceRecordId: 'location-hours',
      startTime: '06:30',
      endTime: '15:30',
      isAvailable: true,
    })

    const withException: TeamAvailabilityRecord[] = [
      ...availability,
      {
        id: 'closed-exception',
        workspaceId: 'workspace-teamAvailability',
        kind: 'availabilityException',
        scope: 'workspace',
        exceptionType: 'closed',
        title: 'Closed',
        date: '2026-07-28',
        allDayClosed: true,
        timezone: 'America/New_York',
        createdAt: '2026-07-25T12:00:00.000Z',
        updatedAt: '2026-07-25T12:00:00.000Z',
      },
    ]
    expect(
      resolveEffectiveWorkingHours({
        availability: withException,
        workspaceId: 'workspace-teamAvailability',
        workspaceMemberId: 'member-owner',
        teamIds: ['team-field'],
        date: '2026-07-28',
        timezone: 'America/New_York',
      }),
    ).toMatchObject({ source: 'exception', isAvailable: false })

    const withTimeOff: TeamAvailabilityRecord[] = [
      ...withException,
      {
        id: 'time-off',
        workspaceId: 'workspace-teamAvailability',
        kind: 'timeOff',
        memberId: 'member-owner',
        memberName: 'Owner',
        reason: 'Personal time',
        startsAt: '2026-07-28T13:00:00.000Z',
        endsAt: '2026-07-28T21:00:00.000Z',
        allDay: false,
        timezone: 'America/New_York',
      },
    ]
    expect(
      resolveEffectiveWorkingHours({
        availability: withTimeOff,
        workspaceId: 'workspace-teamAvailability',
        workspaceMemberId: 'member-owner',
        teamIds: ['team-field'],
        date: '2026-07-28',
        timezone: 'America/New_York',
      }),
    ).toMatchObject({ source: 'timeOff', isAvailable: false })
  })

  it('adds availability exceptions and surfaces closed-day conflict warnings', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.queryByText('Independence Day')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Availability Exception' }),
    )
    expect(
      await screen.findByRole('dialog', { name: 'Add Availability Exception' }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Office Closure' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-08-02' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }))
    expect(
      (await screen.findAllByText('Office Closure')).length,
    ).toBeGreaterThan(0)
  })

  it('stores weekly and annual recurrence rules for availability exceptions', async () => {
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Availability Exception' }),
    )
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Sunday Closure' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-08-02' },
    })
    fireEvent.change(screen.getByLabelText('Repeat'), {
      target: { value: 'weekly' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    expect(
      (await screen.findAllByText('Sunday Closure')).length,
    ).toBeGreaterThan(0)
    let records = getPreviewTeamAvailabilityRecords(
      'workspace-teamAvailability',
    )
    expect(
      records.some(
        (record) =>
          record.kind === 'availabilityException' &&
          record.title === 'Sunday Closure' &&
          record.recurrenceRule?.frequency === 'weekly',
      ),
    ).toBe(true)

    fireEvent.click(
      screen.getByRole('button', { name: 'Close availability details' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Availability Exception' }),
    )
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'July 4 Closure' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-07-04' },
    })
    fireEvent.change(screen.getByLabelText('Repeat'), {
      target: { value: 'annually' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    expect(
      (await screen.findAllByText('July 4 Closure')).length,
    ).toBeGreaterThan(0)
    records = getPreviewTeamAvailabilityRecords('workspace-teamAvailability')
    expect(
      records.some(
        (record) =>
          record.kind === 'availabilityException' &&
          record.title === 'July 4 Closure' &&
          record.recurrenceRule?.frequency === 'yearly',
      ),
    ).toBe(true)
    expect(screen.getAllByText(/Repeats/).length).toBeGreaterThan(0)
  })

  it('derives Busy from active current and upcoming assigned blocking events', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      settings: {
        preset: 'service',
        visibleSections: ['calendar', 'teamAvailability'],
        customEventTypes: [
          {
            id: 'custom-nonblocking',
            workspaceId: 'workspace-1',
            key: 'custom.nonblocking',
            label: 'Nonblocking Note',
            presetScope: ['service'],
            sectionKeys: ['calendar', 'teamAvailability'],
            blocksAvailability: false,
            requiresLinkedRecord: false,
            supportedLinkedRecordTypes: [],
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            createdAt: '2026-07-25T12:00:00.000Z',
            updatedAt: '2026-07-25T12:00:00.000Z',
          },
        ],
      },
    })
    const workspaceNow = new Date('2026-07-27T14:00:00.000Z')
    const rangeEnd = new Date('2026-08-26T14:00:00.000Z')
    const events: SchedulingEvent[] = [
      {
        ...baseEvent,
        id: 'past-completed',
        type: 'scheduledJob',
        status: 'completed',
        startsAt: '2026-07-26T14:00:00.000Z',
        endsAt: '2026-07-26T15:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'past-canceled',
        type: 'scheduledJob',
        status: 'canceled',
        startsAt: '2026-07-26T16:00:00.000Z',
        endsAt: '2026-07-26T17:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'future-canceled',
        type: 'scheduledJob',
        status: 'canceled',
        startsAt: '2026-07-29T14:00:00.000Z',
        endsAt: '2026-07-29T15:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'future-missed',
        type: 'scheduledJob',
        status: 'missed',
        startsAt: '2026-07-29T16:00:00.000Z',
        endsAt: '2026-07-29T17:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'past-stale-scheduled',
        type: 'scheduledJob',
        status: 'scheduled',
        startsAt: '2026-07-26T18:00:00.000Z',
        endsAt: '2026-07-26T19:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'overrunning',
        type: 'scheduledJob',
        status: 'inProgress',
        startsAt: '2026-07-26T20:00:00.000Z',
        endsAt: '2026-07-26T21:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'future-scheduled',
        type: 'scheduledJob',
        status: 'scheduled',
        startsAt: '2026-07-28T14:00:00.000Z',
        endsAt: '2026-07-28T15:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'future-confirmed',
        type: 'scheduledJob',
        status: 'confirmed',
        startsAt: '2026-07-29T14:00:00.000Z',
        endsAt: '2026-07-29T15:00:00.000Z',
        assignedMemberIds: ['owner'],
      },
      {
        ...baseEvent,
        id: 'unassigned-job',
        type: 'scheduledJob',
        assignedMemberIds: [],
      },
      {
        ...baseEvent,
        id: 'nonblocking',
        type: 'custom.nonblocking' as SchedulingEvent['type'],
        assignedMemberIds: ['owner'],
      },
    ]

    expect(
      getBusyAvailabilityIntervals({
        schedulingEvents: events,
        eventTypeSettings: settings,
        workspaceNow,
        rangeStart: workspaceNow,
        rangeEnd,
      }).map((event) => event.sourceEventId),
    ).toEqual(['overrunning', 'future-scheduled', 'future-confirmed'])
  })

  it('limits recurring Busy occurrences to the active range', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      settings: {
        preset: 'service',
        visibleSections: ['calendar', 'teamAvailability'],
      },
    })
    const workspaceNow = new Date('2026-07-27T14:00:00.000Z')
    const rangeEnd = new Date('2026-08-03T14:00:00.000Z')
    const recurring: SchedulingEvent = {
      ...baseEvent,
      id: 'daily-blocking',
      type: 'scheduledJob',
      status: 'scheduled',
      startsAt: '2026-07-28T14:00:00.000Z',
      endsAt: '2026-07-28T15:00:00.000Z',
      assignedMemberIds: ['owner'],
      recurrenceRule: { frequency: 'daily', interval: 1, endType: 'never' },
    }
    const canceledSeries: SchedulingEvent = {
      ...recurring,
      id: 'daily-canceled',
      status: 'canceled',
    }

    const busy = getBusyAvailabilityIntervals({
      schedulingEvents: [recurring, canceledSeries],
      eventTypeSettings: settings,
      workspaceNow,
      rangeStart: workspaceNow,
      rangeEnd,
    })

    expect(busy.map((event) => event.sourceEventId)).toEqual(
      Array.from({ length: 6 }, () => 'daily-blocking'),
    )
    expect(
      busy.every(
        (event) =>
          new Date(event.occurrenceStartsAt).getTime() >=
            workspaceNow.getTime() &&
          new Date(event.occurrenceStartsAt).getTime() <= rangeEnd.getTime(),
      ),
    ).toBe(true)
  })

  it('sorts Busy past ranges newest first by occurrence end time', () => {
    const workspaceNow = new Date('2026-07-27T14:00:00.000Z')
    const oldPast: SchedulingOccurrence = {
      ...baseEvent,
      id: 'old-past',
      sourceEventId: 'old-past',
      occurrenceId: 'old-past:2026-07-25',
      title: 'Older past event',
      status: 'completed',
      startsAt: '2026-07-25T14:00:00.000Z',
      endsAt: '2026-07-25T15:00:00.000Z',
      occurrenceStartsAt: '2026-07-25T14:00:00.000Z',
      occurrenceEndsAt: '2026-07-25T15:00:00.000Z',
      isRecurringOccurrence: false,
    }
    const newPast: SchedulingOccurrence = {
      ...baseEvent,
      id: 'new-past',
      sourceEventId: 'new-past',
      occurrenceId: 'new-past:2026-07-26',
      title: 'Newer past event',
      status: 'completed',
      startsAt: '2026-07-26T14:00:00.000Z',
      endsAt: '2026-07-26T15:30:00.000Z',
      occurrenceStartsAt: '2026-07-26T14:00:00.000Z',
      occurrenceEndsAt: '2026-07-26T15:30:00.000Z',
      isRecurringOccurrence: false,
    }

    expect(
      sortBusyRecords({
        records: [oldPast, newPast],
        rangeMode: 'includePast',
        workspaceNow,
      }).map((event) => event.id),
    ).toEqual(['new-past', 'old-past'])
  })

  it('sorts mixed Busy ranges as current, upcoming, then past newest first', () => {
    const workspaceNow = new Date('2026-07-27T14:00:00.000Z')
    const makeOccurrence = ({
      id,
      status,
      startsAt,
      endsAt,
    }: {
      id: string
      status: SchedulingEvent['status']
      startsAt: string
      endsAt: string
    }): SchedulingOccurrence => ({
      ...baseEvent,
      id,
      sourceEventId: id,
      occurrenceId: `${id}:occurrence`,
      title: id,
      status,
      startsAt,
      endsAt,
      occurrenceStartsAt: startsAt,
      occurrenceEndsAt: endsAt,
      isRecurringOccurrence: false,
    })
    const records = [
      makeOccurrence({
        id: 'older-past',
        status: 'completed',
        startsAt: '2026-07-25T14:00:00.000Z',
        endsAt: '2026-07-25T15:00:00.000Z',
      }),
      makeOccurrence({
        id: 'future-later',
        status: 'scheduled',
        startsAt: '2026-07-29T14:00:00.000Z',
        endsAt: '2026-07-29T15:00:00.000Z',
      }),
      makeOccurrence({
        id: 'current',
        status: 'confirmed',
        startsAt: '2026-07-27T13:30:00.000Z',
        endsAt: '2026-07-27T14:30:00.000Z',
      }),
      makeOccurrence({
        id: 'newer-past',
        status: 'completed',
        startsAt: '2026-07-26T14:00:00.000Z',
        endsAt: '2026-07-26T15:00:00.000Z',
      }),
      makeOccurrence({
        id: 'future-sooner',
        status: 'scheduled',
        startsAt: '2026-07-28T14:00:00.000Z',
        endsAt: '2026-07-28T15:00:00.000Z',
      }),
      makeOccurrence({
        id: 'in-progress',
        status: 'inProgress',
        startsAt: '2026-07-26T14:00:00.000Z',
        endsAt: '2026-07-26T15:00:00.000Z',
      }),
    ]

    expect(
      sortBusyRecords({
        records,
        rangeMode: 'includePast',
        workspaceNow,
      }).map((event) => event.id),
    ).toEqual([
      'in-progress',
      'current',
      'future-sooner',
      'future-later',
      'newer-past',
      'older-past',
    ])
  })

  it('keeps Busy compact on the main page and opens the expanded Busy Schedule', async () => {
    const now = new Date()
    const isoAtOffset = (offsetMs: number) =>
      new Date(now.getTime() + offsetMs).toISOString()
    const hour = 60 * 60 * 1000
    const day = 24 * hour
    renderSchedulingPage({
      section: 'teamAvailability',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'teamAvailability'],
      },
      members: [
        {
          id: 'workspace-member-owner',
          userId: 'owner',
          fullName: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
        {
          id: 'workspace-member-removed',
          userId: 'removed-member',
          fullName: 'Removed User',
          email: 'removed@example.com',
          role: 'member',
          status: 'removed',
        },
      ],
      availability: [
        {
          id: 'office-team-hours',
          workspaceId: 'workspace-teamAvailability',
          kind: 'workingHours',
          memberId: 'team-office',
          memberName: 'Office Team',
          daysOfWeek: [1, 2, 3, 4, 5],
          startsAt: '09:00',
          endsAt: '17:00',
          timezone: 'America/New_York',
        },
      ],
      events: [
        {
          ...baseEvent,
          id: 'past-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Past Busy',
          type: 'scheduledJob',
          status: 'scheduled',
          startsAt: isoAtOffset(-8 * day),
          endsAt: isoAtOffset(-8 * day + hour),
          assignedMemberIds: ['owner'],
        },
        {
          ...baseEvent,
          id: 'overrunning-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'In Progress Busy',
          type: 'scheduledJob',
          status: 'inProgress',
          startsAt: isoAtOffset(-3 * day),
          endsAt: isoAtOffset(-3 * day + hour),
          assignedMemberIds: ['owner'],
        },
        {
          ...baseEvent,
          id: 'future-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Future Busy',
          type: 'scheduledJob',
          status: 'confirmed',
          startsAt: isoAtOffset(hour),
          endsAt: isoAtOffset(2 * hour),
          assignedMemberIds: ['owner'],
        },
        {
          ...baseEvent,
          id: 'second-future-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Second Future Busy',
          type: 'scheduledJob',
          status: 'scheduled',
          startsAt: isoAtOffset(3 * hour),
          endsAt: isoAtOffset(4 * hour),
          assignedMemberIds: ['owner'],
        },
        {
          ...baseEvent,
          id: 'third-future-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Third Future Busy',
          type: 'scheduledJob',
          status: 'scheduled',
          startsAt: isoAtOffset(5 * hour),
          endsAt: isoAtOffset(6 * hour),
          assignedMemberIds: ['owner'],
        },
        {
          ...baseEvent,
          id: 'team-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Team Busy',
          type: 'scheduledJob',
          status: 'scheduled',
          startsAt: isoAtOffset(7 * hour),
          endsAt: isoAtOffset(8 * hour),
          assignedMemberIds: ['team-office'],
        },
        {
          ...baseEvent,
          id: 'past-completed-busy',
          workspaceId: 'workspace-teamAvailability',
          title: 'Past Completed Busy',
          type: 'scheduledJob',
          status: 'completed',
          startsAt: isoAtOffset(-5 * day),
          endsAt: isoAtOffset(-5 * day + hour),
          assignedMemberIds: ['removed-member'],
        },
      ],
    })

    await screen.findAllByRole('heading', { name: 'Team Availability' })
    expect(screen.queryByText('Busy range')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'View all busy time' }),
    ).toBeTruthy()
    expect(screen.queryByText('Past Busy')).toBeNull()
    expect(screen.getByText('In Progress Busy')).toBeTruthy()
    expect(screen.getByText('Future Busy')).toBeTruthy()
    expect(screen.getByText('Second Future Busy')).toBeTruthy()
    expect(screen.queryByText('Third Future Busy')).toBeNull()
    expect(screen.getByText('View all busy time · 2 more')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'View all busy time' }))
    const busyDialog = await screen.findByRole('dialog', {
      name: 'Busy Schedule',
    })
    expect(busyDialog).toBeTruthy()
    expect(screen.getByLabelText('Search')).toBeTruthy()
    expect(screen.getByLabelText('Date range')).toBeTruthy()
    const assigneeSelect = screen.getByLabelText(
      'Assignee',
    ) as HTMLSelectElement
    const assigneeOptionLabels = Array.from(assigneeSelect.options).map(
      (option) => option.textContent,
    )
    expect(assigneeOptionLabels).toContain('All assignees')
    expect(assigneeOptionLabels).toContain('Owner')
    expect(assigneeOptionLabels).toContain('Office Team')
    expect(assigneeOptionLabels).not.toContain('Removed User')
    expect(screen.getByLabelText('Event type')).toBeTruthy()
    expect(screen.getAllByText('Status').length).toBeGreaterThan(1)
    expect(screen.queryByText('Past Completed Busy')).toBeNull()

    fireEvent.change(assigneeSelect, { target: { value: 'team:team-office' } })
    expect(await within(busyDialog).findByText('Team Busy')).toBeTruthy()
    expect(within(busyDialog).queryByText('Future Busy')).toBeNull()
    expect(within(busyDialog).getByText('1 of 5 busy events')).toBeTruthy()
    fireEvent.change(assigneeSelect, { target: { value: 'all' } })

    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: 'includePast' },
    })
    fireEvent.click(await screen.findByLabelText('Completed'))
    expect(
      await within(busyDialog).findByText('Past Completed Busy'),
    ).toBeTruthy()
    expect(
      within(busyDialog).getAllByText('Former member').length,
    ).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'Future Busy' },
    })
    expect(within(busyDialog).getByText('Future Busy')).toBeTruthy()
    expect(within(busyDialog).queryByText('Past Completed Busy')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: /Open busy event Future Busy/ }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Future Busy' }),
    ).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Busy Schedule' })).toBeNull()
    expect(screen.getByText('Scheduled Job')).toBeTruthy()
  })

  it('shows read-only event section guidance and no manual section selector', async () => {
    renderSchedulingPage({
      section: 'scheduledJobs',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'scheduledJobs'],
        sectionLabelOverrides: { scheduledJobs: 'Field Visits' },
      },
    })

    await screen.findAllByRole('heading', { name: 'Field Visits' })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Job' }))
    expect(
      await screen.findByText('Appears in Calendar, Field Visits'),
    ).toBeTruthy()
    expect(screen.queryByText('Choose sections')).toBeNull()
  })

  it('warns before creating an optional event without a linked record and preserves form values', async () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {
        timezone: 'America/New_York',
        preset: 'consultative',
      },
    })
    const capabilities = getWorkspaceSchedulingCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings,
    })
    const created = {
      ...baseEvent,
      id: 'created-standalone-discovery',
      workspaceId: 'workspace-create',
      title: 'Standalone Discovery',
      type: 'discoveryCall',
      linkedRecord: undefined,
      assignedMemberIds: ['member-owner'],
    } satisfies SchedulingEvent
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, event: created }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['discoveryCall'],
        memberOptions: [
          {
            id: 'member-owner',
            label: 'Owner',
            secondary: 'Scheduling',
          },
        ],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Standalone Discovery' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Owner/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    expect(
      await screen.findByText('Schedule without a linked record?'),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }))
    expect(screen.getByDisplayValue('Standalone Discovery')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Schedule Without Link' }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ]
    const payload = JSON.parse(String(requestInit.body))
    expect(payload.event.linkedRecord).toBeNull()
  })

  it('shows privacy-safe external availability preview in the create modal and acknowledges suggestion signals', async () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {
        timezone: 'America/New_York',
        preset: 'consultative',
      },
    })
    const capabilities = getWorkspaceSchedulingCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings,
    })
    const created = {
      ...baseEvent,
      id: 'created-internal-meeting',
      workspaceId: 'workspace-create-external',
      title: 'Team Planning',
      type: 'internalMeeting',
      linkedRecord: undefined,
      assignedMemberIds: ['member-owner'],
    } satisfies SchedulingEvent
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/external-availability/preview')) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              result: {
                members: [
                  {
                    workspaceMemberId: 'member-owner',
                    memberName: 'Owner',
                    highestSeverity: 'suggestion',
                    conflictCount: 1,
                    blockingCount: 0,
                    suggestionCount: 1,
                    totalUnavailableMinutes: 45,
                    conflicts: [
                      {
                        signalId: 'signal-create-suggestion',
                        startsAtUtc: '2026-08-14T13:15:00.000Z',
                        endsAtUtc: '2026-08-14T14:00:00.000Z',
                        provider: 'google',
                        effect: 'suggestion',
                        displayLabel: 'Unavailable',
                      },
                    ],
                  },
                ],
              },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({ ok: true, event: created }),
        }
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create-external',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [{ id: 'member-owner', label: 'Owner' }],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Team Planning' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Owner/ }))

    expect(
      await screen.findByText('External availability conflict'),
    ).toBeTruthy()
    expect(screen.getByText(/Unavailable/)).toBeTruthy()
    expect(screen.queryByText('Secret personal appointment')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('/scheduling/events'),
        ),
      ).toBe(true),
    )
    const createCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/scheduling/events'),
    )
    const payload = JSON.parse(String(createCall?.[1]?.body))
    expect(payload.event.acknowledgedExternalAvailabilitySignalIds).toEqual([
      'signal-create-suggestion',
    ])
    expect(payload.event.externalAvailabilityOverrideReason).toBeUndefined()
  })

  it('shows live external availability preview in the edit drawer and saves acknowledgement metadata', async () => {
    renderSchedulingPage({
      section: 'calendar',
      events: [baseEvent],
      settingsOverride: {
        timezone: 'America/New_York',
        preset: 'consultative',
        defaultCalendarView: 'week',
      },
    })

    fireEvent.click((await screen.findAllByText('Discovery Call'))[0])
    const drawer = await screen.findByRole('dialog', { name: 'Discovery Call' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))

    expect(
      await within(drawer).findByText('External availability conflict'),
    ).toBeTruthy()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Save Changes' }),
    )

    await waitFor(() => {
      const fetchMock = fetch as unknown as {
        mock: { calls: Array<[RequestInfo | URL, RequestInit | undefined]> }
      }
      const eventPatchCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/scheduling/events/event-1') &&
          init?.method === 'PATCH',
      )
      expect(eventPatchCall).toBeTruthy()
      const payload = JSON.parse(String(eventPatchCall?.[1]?.body))
      expect(payload.event.acknowledgedExternalAvailabilitySignalIds).toEqual([
        'signal-owner-preview',
      ])
    })
  })

  it('scopes the no-link warning suppression by user, workspace, and event type', async () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {
        timezone: 'America/New_York',
        preset: 'consultative',
      },
    })
    const capabilities = getWorkspaceSchedulingCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings,
    })
    let createdIndex = 0
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const payload = JSON.parse(String(init.body))
      createdIndex += 1
      return {
        ok: true,
        json: async () => ({
          ok: true,
          event: {
            ...baseEvent,
            id: `created-standalone-${createdIndex}`,
            workspaceId: String(_url).includes('workspace-beta')
              ? 'workspace-beta'
              : 'workspace-alpha',
            title: payload.event.title,
            type: payload.event.type,
            linkedRecord: payload.event.linkedRecord ?? undefined,
            assignedMemberIds: payload.event.assignedMemberIds,
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const renderCreateModal = ({
      workspaceId,
      eventType,
    }: {
      workspaceId: string
      eventType: SchedulingEvent['type']
    }) =>
      render(
        React.createElement(SchedulingCreateModal, {
          workspaceId,
          capabilities,
          settings,
          visibleEventTypes: [eventType],
          memberOptions: [{ id: 'member-owner', label: 'Owner' }],
          recordRefreshKey: 0,
          createLabel: 'Schedule Event',
          initialDate: '2026-08-14',
          onClose: () => undefined,
          onCreated: vi.fn(),
        }),
      )

    const fillAndSubmit = (title: string) => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: title },
      })
      fireEvent.click(screen.getByRole('button', { name: /Owner/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))
    }
    const eventCreateCallCount = () =>
      fetchMock.mock.calls.filter(([url, init]) => {
        const method =
          typeof init === 'object' && init && 'method' in init
            ? String(init.method)
            : ''
        return String(url).includes('/scheduling/events') && method === 'POST'
      }).length

    const first = renderCreateModal({
      workspaceId: 'workspace-alpha',
      eventType: 'discoveryCall',
    })
    fillAndSubmit('Suppressible Discovery')
    expect(
      await screen.findByText('Schedule without a linked record?'),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByLabelText("Don't remind me again for this event type"),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Schedule Without Link' }),
    )
    await waitFor(() => expect(eventCreateCallCount()).toBe(1))
    first.unmount()

    const sameScope = renderCreateModal({
      workspaceId: 'workspace-alpha',
      eventType: 'discoveryCall',
    })
    fillAndSubmit('Suppressed Discovery')
    await waitFor(() => expect(eventCreateCallCount()).toBe(2))
    expect(screen.queryByText('Schedule without a linked record?')).toBeNull()
    sameScope.unmount()

    const differentEventType = renderCreateModal({
      workspaceId: 'workspace-alpha',
      eventType: 'consultation',
    })
    fillAndSubmit('Consultation Still Warns')
    expect(
      await screen.findByText('Schedule without a linked record?'),
    ).toBeTruthy()
    expect(eventCreateCallCount()).toBe(2)
    differentEventType.unmount()

    const differentWorkspace = renderCreateModal({
      workspaceId: 'workspace-beta',
      eventType: 'discoveryCall',
    })
    fillAndSubmit('Workspace Still Warns')
    expect(
      await screen.findByText('Schedule without a linked record?'),
    ).toBeTruthy()
    expect(eventCreateCallCount()).toBe(2)
    differentWorkspace.unmount()

    clerkMockState.userId = 'user-beta'
    const differentUser = renderCreateModal({
      workspaceId: 'workspace-alpha',
      eventType: 'discoveryCall',
    })
    fillAndSubmit('User Still Warns')
    expect(
      await screen.findByText('Schedule without a linked record?'),
    ).toBeTruthy()
    expect(eventCreateCallCount()).toBe(2)
    differentUser.unmount()
  })

  it('blocks required linked-record types and hides links for not-allowed types', async () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {
        timezone: 'America/New_York',
        preset: 'consultative',
      },
    })
    const capabilities = getWorkspaceSchedulingCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['proposalReview'],
        memberOptions: [{ id: 'member-owner', label: 'Owner' }],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Proposal Review' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Owner/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    expect(
      await screen.findByText('Select a linked record for this event type.'),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    unmount()
    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    expect(screen.queryByText('Linked record')).toBeNull()
  })

  it('edits an optional standalone event without requiring or warning for a linked record', async () => {
    renderSchedulingPage({
      section: 'crmMeetings',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'standalone-discovery',
          workspaceId: 'workspace-crmMeetings',
          title: 'Standalone Discovery',
          type: 'discoveryCall',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /Standalone Discovery/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Standalone Discovery Updated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(
        screen.queryByText('Schedule without a linked record?'),
      ).toBeNull(),
    )
    const patchCall = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patchCall).toBeTruthy()
    const payload = JSON.parse(String(patchCall?.[1]?.body))
    expect(payload.event.linkedRecord).toBeNull()
  })

  it('prompts for recurrence scope before editing a materialized recurring occurrence', async () => {
    renderSchedulingPage({
      section: 'calendar',
      events: [
        {
          ...baseEvent,
          id: 'recurring-occurrence-edit',
          workspaceId: 'workspace-calendar',
          title: 'Recurring Scope Edit',
          recurrenceSeriesId: 'series-scope',
          sourceEventId: 'recurring-master',
          occurrenceOriginalAt: '2026-07-27T14:00:00.000Z',
          occurrenceState: 'generated',
        },
      ],
    })

    await clickFirstEventButton(/Recurring Scope Edit/)
    const drawer = await screen.findByRole('dialog', {
      name: 'Recurring Scope Edit',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))

    const scopeDialog = await screen.findByRole('dialog', {
      name: 'Edit recurring event',
    })
    expect(within(scopeDialog).getByText('This occurrence')).toBeTruthy()
    expect(within(scopeDialog).getByText('This and following')).toBeTruthy()
    expect(within(scopeDialog).getByText('Entire series')).toBeTruthy()

    fireEvent.click(
      within(scopeDialog).getByRole('radio', { name: /This and following/ }),
    )
    fireEvent.click(
      within(scopeDialog).getByRole('button', { name: 'Continue to Edit' }),
    )
    expect(screen.getByText('Editing this and following.')).toBeTruthy()
  })

  it('does not show recurrence scope when editing a one-time event', async () => {
    renderSchedulingPage({
      section: 'calendar',
      events: [
        {
          ...baseEvent,
          id: 'one-time-scope-edit',
          workspaceId: 'workspace-calendar',
          title: 'One Time Scope Edit',
          recurrenceSeriesId: undefined,
          recurrenceRule: undefined,
          occurrenceOriginalAt: undefined,
          occurrenceState: undefined,
        },
      ],
    })

    await clickFirstEventButton(/One Time Scope Edit/)
    const drawer = await screen.findByRole('dialog', {
      name: 'One Time Scope Edit',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))

    expect(screen.queryByRole('dialog', { name: 'Edit recurring event' })).toBe(
      null,
    )
    expect(screen.getByLabelText('Title')).toBeTruthy()
  })

  it('keeps completed status changes occurrence-only for recurring occurrences', async () => {
    renderSchedulingPage({
      section: 'calendar',
      events: [
        {
          ...baseEvent,
          id: 'recurring-occurrence-status',
          workspaceId: 'workspace-calendar',
          title: 'Recurring Status Change',
          status: 'inProgress',
          recurrenceSeriesId: 'series-scope',
          sourceEventId: 'recurring-master',
          occurrenceOriginalAt: '2026-07-27T14:00:00.000Z',
          occurrenceState: 'generated',
        },
      ],
    })

    await clickFirstEventButton(/Recurring Status Change/)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Completed' }))

    await waitFor(() => {
      const patchCall = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall).toBeTruthy()
      const payload = JSON.parse(String(patchCall?.[1]?.body))
      expect(payload.status).toBe('completed')
      expect(payload.scope).toBe('thisOccurrence')
    })
    expect(
      screen.queryByRole('dialog', { name: /recurring event/i }),
    ).toBeNull()
  })

  it('warns when removing an existing optional linked record and saves the removal explicitly', async () => {
    renderSchedulingPage({
      section: 'crmMeetings',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'linked-discovery',
          workspaceId: 'workspace-crmMeetings',
          title: 'Linked Discovery',
          type: 'discoveryCall',
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /Linked Discovery/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Record type'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Remove the linked record?')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Link and Save' }),
    )

    await waitFor(() => {
      const patchCall = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall).toBeTruthy()
    })
    const patchCall = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH')
    const payload = JSON.parse(String(patchCall?.[1]?.body))
    expect(payload.event.linkedRecord).toBeNull()
  })

  it('warns before clearing an existing link when changing to a not-allowed event type', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings', 'internalMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'linked-type-change',
          workspaceId: 'workspace-calendar',
          title: 'Linked Type Change',
          type: 'discoveryCall',
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Linked Type Change/)
    const drawer = await screen.findByRole('dialog', {
      name: 'Linked Type Change',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(drawer).getAllByRole('combobox')[0], {
      target: { value: 'internalMeeting' },
    })
    expect(screen.queryByText('Linked record')).toBeNull()

    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Save Changes' }),
    )
    expect(await screen.findByText('Remove the linked record?')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Link and Save' }),
    )

    await waitFor(() => {
      const patchCall = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall).toBeTruthy()
    })
    const patchCall = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH')
    const payload = JSON.parse(String(patchCall?.[1]?.body))
    expect(payload.event.type).toBe('internalMeeting')
    expect(payload.event.linkedRecord).toBeNull()
  })

  it('preserves an edited event duration when Start time changes', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'one-hour-edit',
          workspaceId: 'workspace-calendar',
          title: 'One Hour Edit',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T17:00:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/One Hour Edit/)
    const drawer = await screen.findByRole('dialog', { name: 'One Hour Edit' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))

    const { startInput, endInput } = getDrawerTimeInputs(drawer)
    expect(startInput.value).toBe('12:00')
    expect(endInput.value).toBe('13:00')

    fireEvent.change(startInput, { target: { value: '14:30' } })
    expect(endInput.value).toBe('15:30')
    expect(within(drawer).getByText('Duration: 1 hr')).toBeTruthy()
  })

  it('preserves 45-minute and 90-minute edited durations when Start time changes', async () => {
    const { unmount } = renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'forty-five-edit',
          workspaceId: 'workspace-calendar',
          title: 'Forty Five Edit',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T16:45:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Forty Five Edit/)
    let drawer = await screen.findByRole('dialog', { name: 'Forty Five Edit' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    let timeInputs = getDrawerTimeInputs(drawer)
    fireEvent.change(timeInputs.startInput, {
      target: { value: '14:30' },
    })
    expect(timeInputs.endInput.value).toBe('15:15')
    expect(within(drawer).getByText('Duration: 45 min')).toBeTruthy()
    unmount()

    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'ninety-edit',
          workspaceId: 'workspace-calendar',
          title: 'Ninety Edit',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T17:30:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Ninety Edit/)
    drawer = await screen.findByRole('dialog', { name: 'Ninety Edit' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    timeInputs = getDrawerTimeInputs(drawer)
    fireEvent.change(timeInputs.startInput, {
      target: { value: '14:30' },
    })
    expect(timeInputs.endInput.value).toBe('16:00')
    expect(within(drawer).getByText('Duration: 1 hr 30 min')).toBeTruthy()
  })

  it('uses the latest manually edited duration when Start time changes again', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'custom-duration-edit',
          workspaceId: 'workspace-calendar',
          title: 'Custom Duration Edit',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T17:00:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Custom Duration Edit/)
    const drawer = await screen.findByRole('dialog', {
      name: 'Custom Duration Edit',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    const { startInput, endInput } = getDrawerTimeInputs(drawer)

    fireEvent.change(endInput, { target: { value: '13:30' } })
    expect(within(drawer).getByText('Duration: 1 hr 30 min')).toBeTruthy()
    fireEvent.change(startInput, { target: { value: '14:00' } })
    expect((endInput as HTMLInputElement).value).toBe('15:30')
  })

  it('falls back safely when an existing edit duration is invalid', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'invalid-duration-edit',
          workspaceId: 'workspace-calendar',
          title: 'Invalid Duration Edit',
          type: 'discoveryCall',
          startsAt: '2026-07-27T17:00:00.000Z',
          endsAt: '2026-07-27T16:00:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Invalid Duration Edit/)
    const drawer = await screen.findByRole('dialog', {
      name: 'Invalid Duration Edit',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    const { startInput, endInput } = getDrawerTimeInputs(drawer)
    fireEvent.change(startInput, {
      target: { value: '14:00' },
    })
    expect(endInput.value).toBe('15:00')
  })

  it('keeps optional unlinked edit state as None and clears stale linked-record fields', async () => {
    renderSchedulingPage({
      section: 'crmMeetings',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'none-edit-state',
          workspaceId: 'workspace-crmMeetings',
          title: 'None Edit State',
          type: 'discoveryCall',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /None Edit State/ }),
    )
    const drawer = await screen.findByRole('dialog', {
      name: 'None Edit State',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))

    const recordType = within(drawer).getByLabelText(
      'Record type',
    ) as HTMLSelectElement
    expect(recordType.value).toBe('')
    expect(within(drawer).getByText('Not linked')).toBeTruthy()
    expect(
      within(drawer).queryByText('Schedule without a linked record?'),
    ).toBeNull()

    fireEvent.change(recordType, { target: { value: 'lead' } })
    fireEvent.change(recordType, { target: { value: '' } })
    expect(recordType.value).toBe('')
    expect(
      within(drawer).getByText(
        'This event will remain standalone and can be linked later.',
      ),
    ).toBeTruthy()
  })

  it('uses edit-specific validation copy and keeps time inputs styled for right-edge native icons', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'invalid-edit-copy',
          workspaceId: 'workspace-calendar',
          title: 'Invalid Edit Copy',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T17:00:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/Invalid Edit Copy/)
    const drawer = await screen.findByRole('dialog', {
      name: 'Invalid Edit Copy',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    const { endInput } = getDrawerTimeInputs(drawer)
    expect(endInput.className).toContain('pr-11')

    fireEvent.change(endInput, { target: { value: '11:00' } })
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Save Changes' }),
    )
    expect(
      await within(drawer).findByText(
        'Complete the highlighted fields before saving your changes.',
      ),
    ).toBeTruthy()
    expect(
      within(drawer).getByText('End time must be later than start time.'),
    ).toBeTruthy()
  })

  it('uses a compact All-day edit control and restores valid timed values', async () => {
    renderSchedulingPage({
      section: 'calendar',
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settingsOverride: {
        preset: 'consultative',
        visibleSections: ['calendar', 'crmMeetings'],
      },
      members: [{ id: 'member-owner', fullName: 'Owner' }],
      events: [
        {
          ...baseEvent,
          id: 'all-day-edit-layout',
          workspaceId: 'workspace-calendar',
          title: 'All Day Edit Layout',
          type: 'discoveryCall',
          startsAt: '2026-07-27T16:00:00.000Z',
          endsAt: '2026-07-27T17:00:00.000Z',
          linkedRecord: undefined,
          assignedMemberIds: ['member-owner'],
        },
      ],
    })

    await clickFirstEventButton(/All Day Edit Layout/)
    const drawer = await screen.findByRole('dialog', {
      name: 'All Day Edit Layout',
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit' }))
    const allDay = within(drawer).getByLabelText('All-day event')
    const timezoneButton = within(drawer).getByRole('button', {
      name: /Timezone:/,
    })
    expect(timezoneButton.textContent).toContain('Eastern Time')
    expect(timezoneButton.textContent).toContain('America/New_York')
    expect(timezoneButton.textContent).not.toContain('Change')
    expect(timezoneButton.querySelector('svg')).not.toBeNull()
    const allDayCell = allDay.closest('[data-testid="scheduling-all-day-cell"]')
    expect(allDayCell?.className).toContain('sm:items-start')
    expect(allDayCell?.className).toContain('sm:pl-2')
    expect(allDayCell?.className).toContain('min-h-[4.5rem]')
    expect(
      allDayCell?.querySelector('span[aria-hidden="true"]')?.className,
    ).toContain('sm:block')
    expect(allDay.closest('label')?.className).toContain('min-h-9')
    expect(allDay.closest('label')?.className).not.toContain('rounded-xl')

    fireEvent.click(allDay)
    expect(drawer.querySelectorAll('input[type="time"]')).toHaveLength(0)
    expect(within(drawer).getByText('All day')).toBeTruthy()
    expect(
      within(drawer).getByRole('button', { name: /Timezone:/ }),
    ).toBeTruthy()

    fireEvent.click(allDay)
    const restoredTimeInputs = getDrawerTimeInputs(drawer)
    expect(restoredTimeInputs.startInput.value).toBe('12:00')
    expect(restoredTimeInputs.endInput.value).toBe('13:00')
  })

  it('uses the same compact All-day and timezone controls when creating events', () => {
    const { capabilities, settings } = getSchedulingTestContext()
    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create-layout',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Schedule Event' })
    const allDay = within(dialog).getByLabelText('All-day event')
    const allDayCell = allDay.closest('[data-testid="scheduling-all-day-cell"]')
    expect(allDayCell?.className).toContain('sm:items-start')
    expect(allDayCell?.className).toContain('sm:pl-2')
    expect(allDayCell?.className).toContain('min-h-[4.5rem]')
    expect(
      allDayCell?.querySelector('span[aria-hidden="true"]')?.className,
    ).toContain('sm:block')
    expect(allDay.closest('label')?.className).toContain('min-h-9')
    expect(allDay.closest('label')?.className).not.toContain('rounded-xl')

    const timezoneButton = within(dialog).getByRole('button', {
      name: /Timezone:/,
    })
    expect(timezoneButton.textContent).toContain('Eastern Time')
    expect(timezoneButton.textContent).toContain('America/New_York')
    expect(timezoneButton.textContent).toMatch(/\d{1,2}:\d{2}/)
    expect(timezoneButton.textContent).not.toContain('Change')
    expect(timezoneButton.querySelector('svg')).not.toBeNull()

    fireEvent.keyDown(timezoneButton, { key: ' ' })
    expect(document.querySelector('[data-timezone-menu="true"]')).not.toBeNull()
  })

  it('submits a valid Schedule Event request, closes through parent state, and shows success', async () => {
    renderSchedulingPage({
      section: 'internalMeetings',
      settingsOverride: {
        preset: 'service',
        enabled: true,
        visibleSections: ['calendar', 'internalMeetings'],
      },
    })

    await screen.findAllByRole('heading', { name: 'Internal Meetings' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Schedule Internal Meeting' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Schedule Internal Meeting',
    })
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Leadership Sync' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Schedule Internal Meeting' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Schedule Internal Meeting' }),
      ).toBeNull()
    })
    expect(toast.success).toHaveBeenCalledWith('Event scheduled.')
    expect(
      (await screen.findAllByText('Leadership Sync')).length,
    ).toBeGreaterThan(0)

    const fetchCalls = vi.mocked(fetch).mock.calls
    const createCall = fetchCalls.find(
      ([url, init]) =>
        String(url) ===
          '/api/workspaces/workspace-internalMeetings/scheduling/events' &&
        init?.method === 'POST',
    )
    expect(createCall).toBeTruthy()
    const payload = JSON.parse(String(createCall?.[1]?.body))
    expect(payload.event).toMatchObject({
      title: 'Leadership Sync',
      type: 'internalMeeting',
      status: 'scheduled',
      timezone: 'America/New_York',
      assignedMemberIds: [],
    })
  })

  it('sends workspace-member assignment IDs when scheduling assigned events', async () => {
    const { capabilities, settings } = getSchedulingTestContext()
    const created = {
      ...baseEvent,
      id: 'created-assigned-event',
      workspaceId: 'workspace-create',
      title: 'Assigned Event',
      type: 'internalMeeting',
      assignedMemberIds: ['workspace-member-1'],
    } satisfies SchedulingEvent
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, event: created }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [
          {
            id: 'workspace-member-1',
            label: 'Corbin Wesche',
            secondary: 'Owner',
          },
        ],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Assigned Event' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Corbin Wesche/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ]
    const payload = JSON.parse(String(requestInit.body))
    expect(payload.event.assignedMemberIds).toEqual(['workspace-member-1'])
  })

  it('shows server validation errors in the Schedule Event form', async () => {
    const { capabilities, settings } = getSchedulingTestContext()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'The event could not be scheduled.',
          fieldErrors: {
            title: 'Title is required.',
          },
        }),
      })),
    )

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Server Rejected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    expect(
      await screen.findByText('The event could not be scheduled.'),
    ).toBeTruthy()
    expect(screen.getByText('Title is required.')).toBeTruthy()
    expect(toast.error).toHaveBeenCalledWith(
      'The event could not be scheduled.',
    )
    expect(screen.getByRole('button', { name: 'Schedule Event' })).toBeTruthy()
  })

  it('shows a safe error when the Schedule Event API returns non-JSON', async () => {
    const { capabilities, settings } = getSchedulingTestContext()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => {
          throw new Error('invalid json')
        },
      })),
    )

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Broken Response' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Event' }))

    expect(
      await screen.findByText('The event could not be scheduled. Try again.'),
    ).toBeTruthy()
    expect(toast.error).toHaveBeenCalledWith(
      'The event could not be scheduled. Try again.',
    )
  })

  it('prevents duplicate Schedule Event submissions while a request is in flight', async () => {
    const { capabilities, settings } = getSchedulingTestContext()
    let resolveRequest: (value: unknown) => void = () => undefined
    const created = {
      ...baseEvent,
      id: 'created-slow-event',
      workspaceId: 'workspace-create',
      title: 'Slow Event',
      type: 'internalMeeting',
    } satisfies SchedulingEvent
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-create',
        capabilities,
        settings,
        visibleEventTypes: ['internalMeeting'],
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: vi.fn(),
      }),
    )

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Slow Event' },
    })
    const submitButton = screen.getByRole('button', { name: 'Schedule Event' })
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const savingButton = (await screen.findByRole('button', {
      name: 'Scheduling...',
    })) as HTMLButtonElement
    expect(savingButton.disabled).toBe(true)
    resolveRequest({
      ok: true,
      json: async () => ({ ok: true, event: created }),
    })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Event scheduled.'),
    )
  })

  it('presets the create form date from the displayed Day-view anchor and keeps it editable', () => {
    const { capabilities, settings } = getSchedulingTestContext()
    render(
      React.createElement(SchedulingCreateModal, {
        workspaceId: 'workspace-1',
        capabilities,
        settings,
        visibleEventTypes: capabilities.supportedEventTypes,
        memberOptions: [],
        recordRefreshKey: 0,
        createLabel: 'Schedule Event',
        initialDate: '2026-08-14',
        onClose: () => undefined,
        onCreated: () => undefined,
      }),
    )

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement
    expect(dateInput.value).toBe('2026-08-14')

    fireEvent.change(dateInput, { target: { value: '2026-08-15' } })
    expect(dateInput.value).toBe('2026-08-15')
  })
})
