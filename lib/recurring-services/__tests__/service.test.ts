import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OperationsPriority,
  RecurringServiceStatus,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import {
  createRecurringServiceService,
  type RecurringServiceStore,
} from '@/lib/recurring-services/service'
import type {
  CreateRecurringServiceData,
  RecurringServiceRecord,
  UpdateRecurringServiceData,
} from '@/lib/recurring-services/types'

const NOW = new Date('2026-09-26T14:00:00.000Z')

function createMemoryStore() {
  let sequence = 0
  const services: RecurringServiceRecord[] = []
  const calls: string[] = []
  const customers = new Set(['ws-a:customer-a', 'ws-b:customer-b'])
  const series = new Map([
    [
      'ws-a:series-a',
      {
        id: 'series-a',
        status: 'ACTIVE' as const,
        eventTypeKey: 'recurringServiceVisit',
        assignments: [
          {
            assignmentType: 'MEMBER' as const,
            workspaceMemberId: 'member-a',
            teamId: null,
          },
        ],
      },
    ],
    [
      'ws-a:series-paused',
      {
        id: 'series-paused',
        status: 'PAUSED' as const,
        eventTypeKey: 'recurringServiceVisit',
        assignments: [
          {
            assignmentType: 'MEMBER' as const,
            workspaceMemberId: 'member-a',
            teamId: null,
          },
        ],
      },
    ],
    [
      'ws-a:series-meeting',
      {
        id: 'series-meeting',
        status: 'ACTIVE' as const,
        eventTypeKey: 'internalMeeting',
        assignments: [
          {
            assignmentType: 'MEMBER' as const,
            workspaceMemberId: 'member-a',
            teamId: null,
          },
        ],
      },
    ],
    [
      'ws-a:series-team',
      {
        id: 'series-team',
        status: 'ACTIVE' as const,
        eventTypeKey: 'recurringServiceVisit',
        assignments: [
          {
            assignmentType: 'TEAM' as const,
            workspaceMemberId: null,
            teamId: 'team-a',
          },
        ],
      },
    ],
    [
      'ws-b:series-b',
      {
        id: 'series-b',
        status: 'ACTIVE' as const,
        eventTypeKey: 'recurringServiceVisit',
        assignments: [
          {
            assignmentType: 'MEMBER' as const,
            workspaceMemberId: 'member-b',
            teamId: null,
          },
        ],
      },
    ],
  ])

  const store: RecurringServiceStore = {
    async getWorkspaceBusinessModel(workspaceId) {
      calls.push('getWorkspaceBusinessModel')
      return workspaceId === 'ws-other'
        ? WorkspaceBusinessModel.DIRECT_SALES
        : WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
    },
    async findActiveCustomer({ workspaceId, customerId }) {
      calls.push('findActiveCustomer')
      return customers.has(`${workspaceId}:${customerId}`)
        ? { id: customerId }
        : null
    },
    async findRecurrenceSeries({ workspaceId, recurrenceSeriesId }) {
      calls.push('findRecurrenceSeries')
      return series.get(`${workspaceId}:${recurrenceSeriesId}`) ?? null
    },
    async findByRecurrenceSeries({ workspaceId, recurrenceSeriesId }) {
      calls.push('findByRecurrenceSeries')
      return (
        services.find(
          (service) =>
            service.workspaceId === workspaceId &&
            service.recurrenceSeriesId === recurrenceSeriesId,
        ) ?? null
      )
    },
    async createRecurringService(data: CreateRecurringServiceData) {
      calls.push('createRecurringService')
      const id = `service-${++sequence}`
      const record: RecurringServiceRecord = {
        id,
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        recurrenceSeriesId: data.recurrenceSeriesId,
        name: data.name,
        description: data.description,
        serviceInstructions: data.serviceInstructions,
        pricePerVisitCents: data.pricePerVisitCents,
        currency: data.currency,
        defaultJobPriority: data.defaultJobPriority,
        status: data.status,
        createdByUserId: data.createdByUserId,
        createdAt: NOW,
        updatedAt: NOW,
        endedAt: null,
        stepTemplates: data.stepTemplates.map((step, index) => ({
          id: `step-${index + 1}`,
          workspaceId: data.workspaceId,
          recurringServiceId: id,
          ...step,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      }
      services.push(record)
      return record
    },
    async findRecurringService({ workspaceId, recurringServiceId }) {
      calls.push('findRecurringService')
      return (
        services.find(
          (service) =>
            service.workspaceId === workspaceId &&
            service.id === recurringServiceId,
        ) ?? null
      )
    },
    async listRecurringServices(workspaceId) {
      calls.push('listRecurringServices')
      return services.filter((service) => service.workspaceId === workspaceId)
    },
    async updateRecurringService({
      workspaceId,
      recurringServiceId,
      data,
    }: {
      workspaceId: string
      recurringServiceId: string
      data: UpdateRecurringServiceData
    }) {
      calls.push('updateRecurringService')
      const service = services.find(
        (candidate) =>
          candidate.workspaceId === workspaceId &&
          candidate.id === recurringServiceId,
      )
      if (!service) return null
      const { stepTemplates, ...fields } = data
      Object.assign(service, fields, { updatedAt: NOW })
      if (stepTemplates) {
        service.stepTemplates = stepTemplates.map((step, index) => ({
          id: `replacement-step-${index + 1}`,
          workspaceId,
          recurringServiceId,
          ...step,
          createdAt: NOW,
          updatedAt: NOW,
        }))
      }
      return service
    },
  }

  return { store, services, series, calls }
}

describe('Recurring Service foundation', () => {
  let memory: ReturnType<typeof createMemoryStore>
  let changeSeriesStatus: ReturnType<
    typeof vi.fn<
      (input: {
        seriesId: string
        action: 'pause' | 'resume' | 'cancel'
      }) => Promise<void>
    >
  >
  let service: ReturnType<typeof createRecurringServiceService>
  const actor = {
    workspaceId: 'ws-a',
    userProfileId: 'profile-manager',
    workspaceMemberId: 'member-manager',
  }

  beforeEach(() => {
    memory = createMemoryStore()
    changeSeriesStatus = vi.fn(async ({ seriesId, action }) => {
      const recurringService = memory.services.find(
        (item) => item.recurrenceSeriesId === seriesId,
      )
      if (!recurringService) return
      recurringService.status =
        action === 'pause'
          ? RecurringServiceStatus.PAUSED
          : action === 'resume'
            ? RecurringServiceStatus.ACTIVE
            : RecurringServiceStatus.ENDED
      recurringService.endedAt = action === 'cancel' ? NOW : null
    })
    service = createRecurringServiceService(memory.store, {
      changeSeriesStatus,
    })
  })

  async function create(overrides: Record<string, unknown> = {}) {
    return service.createRecurringService(actor, {
      customerId: 'customer-a',
      recurrenceSeriesId: 'series-a',
      name: 'Weekly Lawn Maintenance',
      pricePerVisitCents: 7_500,
      defaultSteps: [
        { title: 'Mow front lawn' },
        { title: 'Edge sidewalks' },
        { title: 'Blow hard surfaces' },
      ],
      ...overrides,
    })
  }

  it('creates a durable service for a same-workspace Customer and recurring Scheduling series', async () => {
    const created = await create()

    expect(created).toMatchObject({
      workspaceId: 'ws-a',
      customerId: 'customer-a',
      recurrenceSeriesId: 'series-a',
      status: RecurringServiceStatus.ACTIVE,
      currency: 'USD',
      defaultJobPriority: OperationsPriority.NORMAL,
      createdByUserId: 'profile-manager',
    })
    expect(created.stepTemplates.map((step) => step.sortOrder)).toEqual([
      0, 1, 2,
    ])
    expect(created.stepTemplates.map((step) => step.title)).toEqual([
      'Mow front lawn',
      'Edge sidewalks',
      'Blow hard surfaces',
    ])
  })

  it('rejects cross-workspace Customers and recurrence series', async () => {
    await expect(create({ customerId: 'customer-b' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    })
    await expect(
      create({ recurrenceSeriesId: 'series-b' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    await expect(
      create({ recurrenceSeriesId: 'series-meeting' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('rejects linking a TEAM-assigned series during controlled launch', async () => {
    await expect(
      create({ recurrenceSeriesId: 'series-team' }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message:
        'Recurring Services support member assignments only during controlled launch.',
    })
    expect(memory.services).toHaveLength(0)
  })

  it('enforces one Recurring Service per Scheduling recurrence series', async () => {
    await create()
    await expect(create({ name: 'Duplicate series' })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    })
  })

  it('maps explicit pause, resume, and end transitions to Scheduling lifecycle operations', async () => {
    const created = await create()
    await expect(
      service.changeLifecycle({
        actor,
        recurringServiceId: created.id,
        action: 'pause',
        expectedVersion: 1,
        idempotencyKey: 'pause-1',
      }),
    ).resolves.toMatchObject({ status: RecurringServiceStatus.PAUSED })
    await expect(
      service.changeLifecycle({
        actor,
        recurringServiceId: created.id,
        action: 'resume',
      }),
    ).resolves.toMatchObject({ status: RecurringServiceStatus.ACTIVE })
    await expect(
      service.changeLifecycle({
        actor,
        recurringServiceId: created.id,
        action: 'end',
      }),
    ).resolves.toMatchObject({
      status: RecurringServiceStatus.ENDED,
      endedAt: NOW,
    })
    expect(changeSeriesStatus.mock.calls.map(([call]) => call.action)).toEqual([
      'pause',
      'resume',
      'cancel',
    ])
  })

  it('keeps ENDED terminal while treating exact lifecycle retries idempotently', async () => {
    const created = await create()
    await service.changeLifecycle({
      actor,
      recurringServiceId: created.id,
      action: 'end',
    })
    const callCount = changeSeriesStatus.mock.calls.length
    await expect(
      service.changeLifecycle({
        actor,
        recurringServiceId: created.id,
        action: 'end',
      }),
    ).resolves.toMatchObject({ status: RecurringServiceStatus.ENDED })
    expect(changeSeriesStatus).toHaveBeenCalledTimes(callCount)
    await expect(
      service.changeLifecycle({
        actor,
        recurringServiceId: created.id,
        action: 'resume',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
  })

  it('updates only business template fields and deterministically replaces step templates', async () => {
    const created = await create()
    changeSeriesStatus.mockClear()
    const updated = await service.updateRecurringService(actor, created.id, {
      name: 'Biweekly Lawn Maintenance',
      pricePerVisitCents: 8_000,
      defaultJobPriority: 'HIGH',
      defaultSteps: [
        { title: 'Inspect property' },
        { title: 'Complete lawn service', description: 'Follow site notes.' },
      ],
    })

    expect(updated).toMatchObject({
      name: 'Biweekly Lawn Maintenance',
      pricePerVisitCents: 8_000,
      defaultJobPriority: OperationsPriority.HIGH,
      recurrenceSeriesId: 'series-a',
    })
    expect(updated.stepTemplates.map((step) => step.sortOrder)).toEqual([0, 1])
    expect(changeSeriesStatus).not.toHaveBeenCalled()
    expect(memory.calls).not.toContain('createJob')
    expect(memory.calls).not.toContain('createWorkItem')
  })

  it('fails workspace-scoped reads and updates closed', async () => {
    const created = await create()
    await expect(
      service.getRecurringService('ws-b', created.id),
    ).resolves.toBeNull()
    await expect(
      service.updateRecurringService(
        { ...actor, workspaceId: 'ws-b' },
        created.id,
        { name: 'Foreign edit' },
      ),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})
