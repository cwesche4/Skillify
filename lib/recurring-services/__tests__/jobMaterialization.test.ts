import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  eventFindMany: vi.fn(),
  jobFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    schedulingEvent: { findMany: mocks.eventFindMany },
    job: { findFirst: mocks.jobFindFirst },
  },
}))

import {
  prismaRecurringJobMaterializationStore,
  reconcileRecurringServiceJobsForSchedulingOutbox,
  type RecurringJobMaterializationStore,
} from '@/lib/recurring-services/jobMaterialization'

const START = new Date('2026-10-05T13:00:00.000Z')
const END = new Date('2026-10-05T14:30:00.000Z')

function schedulingEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'occurrence-1',
    workspaceId: 'workspace-1',
    eventTypeKey: 'recurringServiceVisit',
    recurrenceSeriesId: 'series-1',
    occurrenceOriginalAt: START,
    occurrenceState: 'GENERATED',
    status: 'SCHEDULED',
    startsAtUtc: START,
    endsAtUtc: END,
    deletedAt: null,
    recurrenceSeries: { workspaceId: 'workspace-1', status: 'ACTIVE' },
    assignments: [
      {
        assignmentType: 'MEMBER',
        workspaceMemberId: 'member-1',
        teamId: null,
      },
    ],
    ...overrides,
  }
}

function recurringService(overrides: Record<string, unknown> = {}) {
  return {
    id: 'service-1',
    workspaceId: 'workspace-1',
    recurrenceSeriesId: 'series-1',
    customerId: 'customer-1',
    name: 'Weekly Lawn Maintenance',
    description: 'Keep the property maintained.',
    serviceInstructions: 'Close the rear gate after service.',
    pricePerVisitCents: 6500,
    currency: 'USD',
    defaultJobPriority: 'HIGH',
    status: 'ACTIVE',
    createdByUserId: 'profile-1',
    customer: {
      displayName: 'Ramirez Residence',
      archivedAt: null,
    },
    stepTemplates: [
      {
        id: 'template-1',
        title: 'Mow lawn',
        description: 'Front and rear lawn.',
        sortOrder: 0,
      },
      {
        id: 'template-2',
        title: 'Blow hard surfaces',
        description: null,
        sortOrder: 1,
      },
    ],
    ...overrides,
  }
}

function transaction(
  input: {
    source?: { recurrenceSeriesId: string | null } | null
    event?: ReturnType<typeof schedulingEvent> | null
    serviceReference?: { id: string } | null
    service?: ReturnType<typeof recurringService> | null
    existingJob?: { id: string } | null
    members?: Array<{ id: string }>
    teams?: Array<{ id: string; name: string }>
  } = {},
) {
  const source =
    input.source === undefined
      ? { recurrenceSeriesId: 'series-1' }
      : input.source
  const event = input.event === undefined ? schedulingEvent() : input.event
  const serviceReference =
    input.serviceReference === undefined
      ? { id: 'service-1' }
      : input.serviceReference
  const service =
    input.service === undefined ? recurringService() : input.service
  const eventFindFirst = vi
    .fn()
    .mockResolvedValueOnce(source)
    .mockResolvedValueOnce(event)
  const serviceFindFirst = vi
    .fn()
    .mockResolvedValueOnce(serviceReference)
    .mockResolvedValueOnce(service)
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce(
        serviceReference ? [{ id: serviceReference.id }] : [],
      )
      .mockResolvedValueOnce(event ? [{ id: event.id }] : []),
    schedulingEvent: { findFirst: eventFindFirst },
    recurringService: { findFirst: serviceFindFirst },
    job: {
      findFirst: vi.fn(async () => input.existingJob ?? null),
      create: vi.fn(async (_input: unknown) => ({ id: 'job-1' })),
    },
    workspaceMember: {
      findMany: vi.fn(async ({ where }: any) => {
        const available = input.members ?? [{ id: 'member-1' }]
        return available.filter((member) => where.id.in.includes(member.id))
      }),
    },
    workspaceTeam: {
      findMany: vi.fn(async ({ where }: any) => {
        const available = input.teams ?? [{ id: 'team-1', name: 'Crew One' }]
        return available.filter((team) => where.id.in.includes(team.id))
      }),
    },
    revenueTransaction: { create: vi.fn() },
    domainOutboxEvent: { create: vi.fn() },
  }
}

describe('Recurring Service occurrence Job materialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.jobFindFirst.mockResolvedValue(null)
  })

  it('atomically snapshots an eligible occurrence into one scheduled Job and ordered Job Steps', async () => {
    const tx = transaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result).toEqual({ outcome: 'created', jobId: 'job-1' })
    expect(tx.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        recurringServiceId: 'service-1',
        schedulingEventId: 'occurrence-1',
        title: 'Weekly Lawn Maintenance',
        description: 'Keep the property maintained.',
        serviceInstructionsSnapshot: 'Close the rear gate after service.',
        status: 'SCHEDULED',
        priority: 'HIGH',
        customerId: 'customer-1',
        customerDisplayName: 'Ramirez Residence',
        valueCents: 6500,
        currency: 'USD',
        scheduledStartAt: START,
        scheduledEndAt: END,
        assigneeMemberId: 'member-1',
        assignments: {
          create: [
            {
              workspaceId: 'workspace-1',
              assignmentType: 'MEMBER',
              workspaceMemberId: 'member-1',
              teamId: null,
              roleLabel: null,
              displaySnapshot: null,
            },
          ],
        },
        workItems: {
          create: [
            expect.objectContaining({
              kind: 'JOB_STEP',
              title: 'Mow lawn',
              description: 'Front and rear lawn.',
              status: 'OPEN',
              priority: 'HIGH',
              sortOrder: 0,
            }),
            expect.objectContaining({
              kind: 'JOB_STEP',
              title: 'Blow hard surfaces',
              sortOrder: 1,
            }),
          ],
        },
      }),
      select: { id: true },
    })
    const jobInput = tx.job.create.mock.calls[0]?.[0] as {
      data: { workItems: { create: Array<{ kind: string }> } }
    }
    expect(
      jobInput.data.workItems.create.every(
        (item: { kind: string }) => item.kind === 'JOB_STEP',
      ),
    ).toBe(true)
    expect(tx.revenueTransaction.create).not.toHaveBeenCalled()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('snapshots a Team principal without inventing a primary member', async () => {
    const tx = transaction({
      event: schedulingEvent({
        assignments: [
          {
            assignmentType: 'TEAM',
            workspaceMemberId: null,
            teamId: 'team-1',
          },
        ],
      }),
      service: recurringService({ stepTemplates: [] }),
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
      workspaceId: 'workspace-1',
      occurrenceId: 'occurrence-1',
    })

    expect(tx.workspaceMember.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', id: { in: [] } },
      select: { id: true },
    })
    expect(tx.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeMemberId: null,
          assignments: {
            create: [
              {
                workspaceId: 'workspace-1',
                assignmentType: 'TEAM',
                workspaceMemberId: null,
                teamId: 'team-1',
                roleLabel: null,
                displaySnapshot: 'Crew One',
              },
            ],
          },
          workItems: { create: [] },
        }),
      }),
    )
  })

  it('preserves multiple mixed Scheduling principals and clears the compatibility mirror', async () => {
    const tx = transaction({
      event: schedulingEvent({
        assignments: [
          {
            assignmentType: 'MEMBER',
            workspaceMemberId: 'member-1',
            teamId: null,
            roleLabel: 'Lead',
            displaySnapshot: 'Alex',
          },
          {
            assignmentType: 'MEMBER',
            workspaceMemberId: 'member-2',
            teamId: null,
            roleLabel: null,
            displaySnapshot: 'Sam',
          },
          {
            assignmentType: 'TEAM',
            workspaceMemberId: null,
            teamId: 'team-1',
            roleLabel: 'Support',
            displaySnapshot: null,
          },
        ],
      }),
      members: [{ id: 'member-1' }, { id: 'member-2' }],
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
      workspaceId: 'workspace-1',
      occurrenceId: 'occurrence-1',
    })

    expect(tx.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeMemberId: null,
          assignments: {
            create: expect.arrayContaining([
              expect.objectContaining({
                assignmentType: 'MEMBER',
                workspaceMemberId: 'member-1',
                roleLabel: 'Lead',
              }),
              expect.objectContaining({
                assignmentType: 'MEMBER',
                workspaceMemberId: 'member-2',
              }),
              expect.objectContaining({
                assignmentType: 'TEAM',
                teamId: 'team-1',
                displaySnapshot: 'Crew One',
              }),
            ]),
          },
        }),
      }),
    )
  })

  it('fails closed when a Scheduling principal is outside the workspace', async () => {
    const tx = transaction({ members: [] })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      }),
    ).rejects.toThrow(
      'Scheduling occurrence assignment is outside the active workspace.',
    )
    expect(tx.job.create).not.toHaveBeenCalled()
  })

  it.each([
    [
      'both MEMBER and TEAM targets',
      [
        {
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-1',
          teamId: 'team-1',
        },
      ],
    ],
    [
      'a duplicate principal',
      [
        {
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-1',
          teamId: null,
        },
        {
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-1',
          teamId: null,
        },
      ],
    ],
  ])('rejects %s before Job creation', async (_label, assignments) => {
    const tx = transaction({ event: schedulingEvent({ assignments }) })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      }),
    ).rejects.toThrow(
      'Scheduling occurrence contains an invalid assignment target.',
    )
    expect(tx.job.create).not.toHaveBeenCalled()
  })

  it.each([
    ['recurrence master', schedulingEvent({ occurrenceState: 'MASTER' })],
    ['canceled occurrence', schedulingEvent({ status: 'CANCELED' })],
    ['deleted occurrence', schedulingEvent({ deletedAt: START })],
    [
      'cross-workspace series relationship',
      schedulingEvent({
        recurrenceSeries: { workspaceId: 'workspace-2', status: 'ACTIVE' },
      }),
    ],
  ])('does not create a Job for an ineligible %s', async (_label, event) => {
    const tx = transaction({ event })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result).toEqual({
      outcome: 'ineligible',
      reason: 'NOT_RECURRING_SERVICE_OCCURRENCE',
    })
    expect(tx.job.create).not.toHaveBeenCalled()
  })

  it('fails closed when the occurrence is not in the expected workspace', async () => {
    const tx = transaction({ source: null })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'workspace-2-occurrence',
      })

    expect(result).toEqual({
      outcome: 'ineligible',
      reason: 'EVENT_NOT_FOUND',
    })
    expect(tx.job.create).not.toHaveBeenCalled()
  })

  it('does not create new work for an ended service', async () => {
    const tx = transaction({ service: recurringService({ status: 'ENDED' }) })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result).toEqual({ outcome: 'ineligible', reason: 'SERVICE_ENDED' })
    expect(tx.job.create).not.toHaveBeenCalled()
  })

  it('materializes an already-existing occurrence for a paused service', async () => {
    const tx = transaction({ service: recurringService({ status: 'PAUSED' }) })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result.outcome).toBe('created')
  })

  it('reuses an existing Job without refreshing its immutable snapshot or steps', async () => {
    const tx = transaction({ existingJob: { id: 'job-existing' } })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result).toEqual({ outcome: 'existing', jobId: 'job-existing' })
    expect(tx.job.create).not.toHaveBeenCalled()
    expect(tx.recurringService.findFirst).toHaveBeenCalledTimes(1)
  })

  it('treats a concurrent unique-constraint winner as the idempotent result', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate occurrence Job', {
        code: 'P2002',
        clientVersion: '7.1.0',
      }),
    )
    mocks.jobFindFirst.mockResolvedValue({ id: 'job-winner' })

    const result =
      await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
        workspaceId: 'workspace-1',
        occurrenceId: 'occurrence-1',
      })

    expect(result).toEqual({ outcome: 'existing', jobId: 'job-winner' })
  })

  it('maps an in-progress occurrence only at initial creation', async () => {
    const tx = transaction({
      event: schedulingEvent({ status: 'IN_PROGRESS' }),
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await prismaRecurringJobMaterializationStore.ensureJobForOccurrence({
      workspaceId: 'workspace-1',
      occurrenceId: 'occurrence-1',
    })

    expect(tx.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    )
  })
})

describe('Recurring Service materialization signal routing', () => {
  it('processes distinct occurrence IDs exactly once and no unrelated work', async () => {
    const ensureJobForOccurrence = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'created', jobId: 'job-1' })
      .mockResolvedValueOnce({ outcome: 'existing', jobId: 'job-2' })
    const store: RecurringJobMaterializationStore = {
      listOccurrenceIds: vi.fn(),
      ensureJobForOccurrence,
    }

    const result = await reconcileRecurringServiceJobsForSchedulingOutbox(
      {
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        payload: {
          seriesId: 'series-1',
          materializedOccurrenceIds: [
            'occurrence-1',
            'occurrence-1',
            'occurrence-2',
          ],
        },
      },
      store,
    )

    expect(result).toEqual({
      examined: 2,
      created: 1,
      existing: 1,
      ineligible: 0,
    })
    expect(ensureJobForOccurrence).toHaveBeenCalledTimes(2)
  })

  it('performs bounded series reconciliation for occurrences that predate the link', async () => {
    const store: RecurringJobMaterializationStore = {
      listOccurrenceIds: vi.fn(async () => [
        'occurrence-existing-1',
        'occurrence-existing-2',
      ]),
      ensureJobForOccurrence: vi.fn(async () => ({
        outcome: 'created' as const,
        jobId: 'job-created',
      })),
    }

    const result = await reconcileRecurringServiceJobsForSchedulingOutbox(
      {
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        payload: {
          seriesId: 'series-1',
          recurringServiceId: 'service-1',
          recurringServiceReconciliation: true,
        },
      },
      store,
    )

    expect(store.listOccurrenceIds).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      seriesId: 'series-1',
      limit: 500,
    })
    expect(result).toMatchObject({ examined: 2, created: 2 })
  })

  it('ignores unrelated Scheduling topics', async () => {
    const store: RecurringJobMaterializationStore = {
      listOccurrenceIds: vi.fn(),
      ensureJobForOccurrence: vi.fn(),
    }

    const result = await reconcileRecurringServiceJobsForSchedulingOutbox(
      {
        workspaceId: 'workspace-1',
        topic: 'scheduling.event.updated',
        payload: { eventId: 'occurrence-1' },
      },
      store,
    )

    expect(result.examined).toBe(0)
    expect(store.ensureJobForOccurrence).not.toHaveBeenCalled()
  })
})
