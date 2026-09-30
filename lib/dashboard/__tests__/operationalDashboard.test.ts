import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  getOperationalDashboardDateBounds,
  loadOperationalDashboard,
} from '@/lib/dashboard/operationalDashboard'

const jobCount = vi.fn()
const jobFindMany = vi.fn()
const leadCount = vi.fn()
const leadFindMany = vi.fn()
const runCount = vi.fn()
const runFindMany = vi.fn()

const db = {
  job: { count: jobCount, findMany: jobFindMany },
  lead: { count: leadCount, findMany: leadFindMany },
  automationRun: { count: runCount, findMany: runFindMany },
} as unknown as Parameters<typeof loadOperationalDashboard>[1]

const baseJob = {
  id: 'job-a',
  workspaceId: 'workspace-a',
  title: 'Spring cleanup',
  customerDisplayName: 'Jordan Customer',
  scheduledStartAt: new Date('2026-03-08T14:00:00.000Z'),
  scheduledEndAt: new Date('2026-03-08T15:00:00.000Z'),
  status: 'SCHEDULED',
  priority: 'NORMAL',
  unableToCompleteReason: null,
  unableToCompleteAt: null,
}

const baseLead = {
  id: 'lead-a',
  workspaceId: 'workspace-a',
  displayName: 'Taylor Lead',
  companyName: null,
  followUpAt: new Date('2026-03-08T16:00:00.000Z'),
  nextStep: 'Call back',
}

const baseInput = {
  workspaceId: 'workspace-a',
  workspaceSlug: 'acme',
  workspaceName: 'Acme Services',
  workspaceMemberId: 'member-a',
  timezone: 'America/New_York',
  now: new Date('2026-03-08T16:00:00.000Z'),
}

describe('operational dashboard data', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uses workspace-local calendar boundaries across daylight-saving changes', () => {
    const bounds = getOperationalDashboardDateBounds({
      now: baseInput.now,
      timezone: baseInput.timezone,
    })

    expect(bounds.todayDateKey).toBe('2026-03-08')
    expect(bounds.todayStart.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(bounds.tomorrowStart.toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })

  it('constructs ordinary, midnight, fall-DST, and non-New-York local days as half-open UTC intervals', () => {
    const cases = [
      {
        now: new Date('2026-01-15T17:00:00.000Z'),
        timezone: 'America/New_York',
        dateKey: '2026-01-15',
        start: '2026-01-15T05:00:00.000Z',
        tomorrow: '2026-01-16T05:00:00.000Z',
      },
      {
        now: new Date('2026-01-15T07:59:59.999Z'),
        timezone: 'America/Los_Angeles',
        dateKey: '2026-01-14',
        start: '2026-01-14T08:00:00.000Z',
        tomorrow: '2026-01-15T08:00:00.000Z',
      },
      {
        now: new Date('2026-01-15T08:00:00.000Z'),
        timezone: 'America/Los_Angeles',
        dateKey: '2026-01-15',
        start: '2026-01-15T08:00:00.000Z',
        tomorrow: '2026-01-16T08:00:00.000Z',
      },
      {
        now: new Date('2026-01-16T07:59:59.999Z'),
        timezone: 'America/Los_Angeles',
        dateKey: '2026-01-15',
        start: '2026-01-15T08:00:00.000Z',
        tomorrow: '2026-01-16T08:00:00.000Z',
      },
      {
        now: new Date('2026-11-01T17:00:00.000Z'),
        timezone: 'America/New_York',
        dateKey: '2026-11-01',
        start: '2026-11-01T04:00:00.000Z',
        tomorrow: '2026-11-02T05:00:00.000Z',
      },
      {
        now: new Date('2026-09-29T12:00:00.000Z'),
        timezone: 'Asia/Tokyo',
        dateKey: '2026-09-29',
        start: '2026-09-28T15:00:00.000Z',
        tomorrow: '2026-09-29T15:00:00.000Z',
      },
    ]

    for (const testCase of cases) {
      const bounds = getOperationalDashboardDateBounds(testCase)
      expect(bounds.todayDateKey).toBe(testCase.dateKey)
      expect(bounds.todayStart.toISOString()).toBe(testCase.start)
      expect(bounds.tomorrowStart.toISOString()).toBe(testCase.tomorrow)
    }
  })

  it('builds the management overview from bounded workspace-scoped queries', async () => {
    jobCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    jobFindMany
      .mockResolvedValueOnce([
        {
          ...baseJob,
          status: 'UNABLE_TO_COMPLETE',
          unableToCompleteReason: 'ACCESS_ISSUE',
          unableToCompleteAt: new Date('2026-03-08T15:00:00.000Z'),
        },
        { ...baseJob, id: 'foreign-job', workspaceId: 'workspace-b' },
      ])
      .mockResolvedValueOnce([baseJob])
      .mockResolvedValueOnce([
        {
          ...baseJob,
          id: 'job-upcoming',
          scheduledStartAt: new Date('2026-03-09T14:00:00.000Z'),
        },
      ])
    leadCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    leadFindMany
      .mockResolvedValueOnce([
        {
          ...baseLead,
          followUpAt: new Date('2026-03-07T16:00:00.000Z'),
        },
        { ...baseLead, id: 'foreign-lead', workspaceId: 'workspace-b' },
      ])
      .mockResolvedValueOnce([baseLead])
    runCount.mockResolvedValue(2)
    runFindMany.mockResolvedValue([
      {
        id: 'run-simple',
        workspaceId: 'workspace-a',
        status: 'FAILED',
        startedAt: new Date('2026-03-08T15:30:00.000Z'),
        automation: {
          id: 'automation-simple',
          name: 'Appointment reminder',
          simpleAutomationInstallation: { id: 'installation-a' },
        },
      },
      {
        id: 'run-advanced',
        workspaceId: 'workspace-a',
        status: 'FAILED',
        startedAt: new Date('2026-03-08T15:00:00.000Z'),
        automation: {
          id: 'automation-advanced',
          name: 'Custom workflow',
          simpleAutomationInstallation: null,
        },
      },
      {
        id: 'foreign-run',
        workspaceId: 'workspace-b',
        status: 'FAILED',
        startedAt: new Date('2026-03-08T14:00:00.000Z'),
        automation: {
          id: 'foreign-automation',
          name: 'Foreign workflow',
          simpleAutomationInstallation: null,
        },
      },
    ])

    const result = await loadOperationalDashboard(
      { ...baseInput, role: 'MANAGER' },
      db,
    )

    expect(result.mode).toBe('management')
    if (result.mode !== 'management') throw new Error('Expected management')
    expect(result.attention.unableJobs).toHaveLength(1)
    expect(result.attention.overdueLeads).toHaveLength(1)
    expect(result.attention.failedAutomations).toHaveLength(2)
    expect(result.attention.failedAutomationsHref).toBe(
      '/dashboard/acme/automations',
    )
    expect(result.today.jobsCount).toBe(1)
    expect(result.today.leadsCount).toBe(1)
    expect(result.upcomingJobs).toHaveLength(1)

    expect(jobFindMany).toHaveBeenCalledTimes(3)
    expect(leadFindMany).toHaveBeenCalledTimes(2)
    expect(runFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-a',
          status: 'FAILED',
          startedAt: {
            gte: new Date('2026-03-01T16:00:00.000Z'),
            lte: new Date('2026-03-08T16:00:00.000Z'),
          },
          automation: { is: { workspaceId: 'workspace-a' } },
        }),
        take: 3,
      }),
    )
    expect(jobFindMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'workspace-a' }),
        take: 5,
      }),
    )
    expect(jobFindMany.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'workspace-a' }),
        take: 7,
      }),
    )

    expect(jobFindMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          workspaceId: 'workspace-a',
          archivedAt: null,
          status: 'UNABLE_TO_COMPLETE',
        },
        orderBy: [{ unableToCompleteAt: 'desc' }, { id: 'asc' }],
        take: 3,
      }),
    )
    expect(leadFindMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-a',
          archivedAt: null,
          convertedCustomerId: null,
          stage: {
            in: ['NEW', 'CONTACTED', 'ESTIMATE_VISIT', 'FOLLOW_UP'],
          },
          followUpAt: { lt: new Date('2026-03-08T05:00:00.000Z') },
        }),
      }),
    )
    expect(leadFindMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          followUpAt: {
            gte: new Date('2026-03-08T05:00:00.000Z'),
            lt: new Date('2026-03-09T04:00:00.000Z'),
          },
        }),
      }),
    )
    expect(jobFindMany.mock.calls[1][0].where).toEqual(
      expect.objectContaining({
        archivedAt: null,
        status: {
          in: ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_ON_CLIENT'],
        },
        scheduledStartAt: {
          gte: new Date('2026-03-08T05:00:00.000Z'),
          lt: new Date('2026-03-09T04:00:00.000Z'),
        },
      }),
    )
    expect(jobFindMany.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
          status: {
            in: ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_ON_CLIENT'],
          },
          scheduledStartAt: {
            gte: new Date('2026-03-09T04:00:00.000Z'),
          },
        }),
        orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
        take: 7,
      }),
    )
  })

  it('keeps exact counts separate from deterministic bounded previews of the same populations', async () => {
    jobCount.mockResolvedValueOnce(5).mockResolvedValueOnce(6)
    jobFindMany
      .mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, index) => ({
          ...baseJob,
          id: `unable-${index}`,
          status: 'UNABLE_TO_COMPLETE',
          unableToCompleteAt: new Date(`2026-03-08T1${5 - index}:00:00.000Z`),
        })),
      )
      .mockResolvedValueOnce(
        Array.from({ length: 5 }, (_, index) => ({
          ...baseJob,
          id: `today-${index}`,
        })),
      )
      .mockResolvedValueOnce(
        Array.from({ length: 7 }, (_, index) => ({
          ...baseJob,
          id: `upcoming-${index}`,
          scheduledStartAt: new Date(
            `2026-03-${String(9 + index).padStart(2, '0')}T14:00:00.000Z`,
          ),
        })),
      )
    leadCount.mockResolvedValueOnce(7).mockResolvedValueOnce(6)
    leadFindMany
      .mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, index) => ({
          ...baseLead,
          id: `overdue-${index}`,
          followUpAt: new Date(`2026-03-0${4 + index}T16:00:00.000Z`),
        })),
      )
      .mockResolvedValueOnce(
        Array.from({ length: 5 }, (_, index) => ({
          ...baseLead,
          id: `due-today-${index}`,
        })),
      )
    runCount.mockResolvedValue(4)
    runFindMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `run-${index}`,
        workspaceId: 'workspace-a',
        status: 'FAILED',
        startedAt: new Date(`2026-03-08T1${5 - index}:00:00.000Z`),
        automation: {
          id: `automation-${index}`,
          name: `Automation ${index}`,
          simpleAutomationInstallation: null,
        },
      })),
    )

    const result = await loadOperationalDashboard(
      { ...baseInput, role: 'OWNER' },
      db,
    )

    if (result.mode !== 'management') throw new Error('Expected management')
    expect(result.attention.unableJobsCount).toBe(5)
    expect(result.attention.unableJobs).toHaveLength(3)
    expect(result.attention.overdueLeadsCount).toBe(7)
    expect(result.attention.overdueLeads).toHaveLength(3)
    expect(result.attention.failedAutomationsCount).toBe(4)
    expect(result.attention.failedAutomations).toHaveLength(3)
    expect(result.today.jobsCount).toBe(6)
    expect(result.today.jobs).toHaveLength(5)
    expect(result.today.leadsCount).toBe(6)
    expect(result.today.leads).toHaveLength(5)
    expect(result.upcomingJobs).toHaveLength(7)
    expect(jobCount.mock.calls.every(([query]) => !('take' in query))).toBe(
      true,
    )
    expect(leadCount.mock.calls.every(([query]) => !('take' in query))).toBe(
      true,
    )
    expect(runCount.mock.calls.every(([query]) => !('take' in query))).toBe(
      true,
    )
    expect(jobCount.mock.calls[0][0].where).toEqual(
      jobFindMany.mock.calls[0][0].where,
    )
    expect(jobCount.mock.calls[1][0].where).toEqual(
      jobFindMany.mock.calls[1][0].where,
    )
    expect(leadCount.mock.calls[0][0].where).toEqual(
      leadFindMany.mock.calls[0][0].where,
    )
    expect(leadCount.mock.calls[1][0].where).toEqual(
      leadFindMany.mock.calls[1][0].where,
    )
    expect(runCount.mock.calls[0][0].where).toEqual(
      runFindMany.mock.calls[0][0].where,
    )
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'serves the management population to %s',
    async (role) => {
      jobCount.mockResolvedValue(0)
      jobFindMany.mockResolvedValue([])
      leadCount.mockResolvedValue(0)
      leadFindMany.mockResolvedValue([])
      runCount.mockResolvedValue(0)
      runFindMany.mockResolvedValue([])

      const result = await loadOperationalDashboard({ ...baseInput, role }, db)

      expect(result.mode).toBe('management')
    },
  )

  it('limits Members to currently executable assigned Jobs and omits management data', async () => {
    jobCount.mockResolvedValue(1)
    jobFindMany.mockResolvedValueOnce([baseJob]).mockResolvedValueOnce([
      {
        ...baseJob,
        id: 'job-upcoming',
        scheduledStartAt: new Date('2026-03-09T14:00:00.000Z'),
      },
    ])

    const result = await loadOperationalDashboard(
      { ...baseInput, role: 'MEMBER' },
      db,
    )

    expect(result.mode).toBe('member')
    expect(result.today.jobs).toHaveLength(1)
    expect(result.upcomingJobs).toHaveLength(1)
    expect(leadCount).not.toHaveBeenCalled()
    expect(runCount).not.toHaveBeenCalled()

    const memberWhere = jobFindMany.mock.calls[0][0].where.AND[0]
    expect(memberWhere).toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        archivedAt: null,
      }),
    )
    expect(JSON.stringify(memberWhere)).toContain('member-a')
    expect(JSON.stringify(memberWhere)).toContain('isActive')
    expect(JSON.stringify(memberWhere)).toContain('archivedAt')
  })

  it('fails an unknown role into the restricted Member query plan', async () => {
    jobCount.mockResolvedValue(0)
    jobFindMany.mockResolvedValue([])

    const result = await loadOperationalDashboard(
      { ...baseInput, role: 'UNKNOWN_ROLE' },
      db,
    )

    expect(result.mode).toBe('member')
    expect(leadCount).not.toHaveBeenCalled()
    expect(runCount).not.toHaveBeenCalled()
  })
})
