import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeSchedulingWorkflowAction } from '@/lib/workflows/schedulingRuntime'
import {
  createSchedulingTriggerPayload,
  matchesSchedulingTriggerFilters,
  schedulingWorkflowActions,
  schedulingWorkflowConditions,
  schedulingWorkflowTemplates,
  schedulingWorkflowTriggers,
} from '@/lib/workflows/schedulingRegistry'
import {
  getWorkflowNodeDefinition,
  searchWorkflowNodes,
} from '@/lib/workflows/nodeRegistry'
import { validateWorkflowNodeConfig } from '@/lib/workflows/nodeValidation'
import { searchWorkflowVariables } from '@/lib/workflows/variableRegistry'
import { createBuilderStarterPreviewDraft } from '@/lib/workflows/previewDrafts'

const createSchedulingEventMock = vi.fn()
const updateSchedulingEventMock = vi.fn()
const deleteSchedulingEventMock = vi.fn()
const changeSchedulingEventStatusMock = vi.fn()
const changeSchedulingRecurrenceSeriesStatusMock = vi.fn()
const createSchedulingAvailabilityRecordMock = vi.fn()
const syncGoogleMock = vi.fn()
const disconnectGoogleMock = vi.fn()
const inspectGoogleMock = vi.fn()
const processOutboxMock = vi.fn()
const processRemindersMock = vi.fn()
const processDeliveriesMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    calendarConnection: {
      findFirst: vi.fn(),
    },
    calendarSyncConflict: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/scheduling/services/schedulingService', () => ({
  createSchedulingEvent: (...args: unknown[]) =>
    createSchedulingEventMock(...args),
  updateSchedulingEvent: (...args: unknown[]) =>
    updateSchedulingEventMock(...args),
  deleteSchedulingEvent: (...args: unknown[]) =>
    deleteSchedulingEventMock(...args),
  changeSchedulingEventStatus: (...args: unknown[]) =>
    changeSchedulingEventStatusMock(...args),
  changeSchedulingRecurrenceSeriesStatus: (...args: unknown[]) =>
    changeSchedulingRecurrenceSeriesStatusMock(...args),
  createSchedulingAvailabilityRecord: (...args: unknown[]) =>
    createSchedulingAvailabilityRecordMock(...args),
}))

vi.mock('@/lib/scheduling/providers/googleService', () => ({
  syncGoogleCalendarConnection: (...args: unknown[]) => syncGoogleMock(...args),
  disconnectGoogleCalendarConnection: (...args: unknown[]) =>
    disconnectGoogleMock(...args),
  inspectGoogleCalendarMappingIntegrity: (...args: unknown[]) =>
    inspectGoogleMock(...args),
}))

vi.mock('@/lib/scheduling/providers/microsoftService', () => ({
  syncMicrosoftCalendarConnection: vi.fn(),
  disconnectMicrosoftCalendarConnection: vi.fn(),
  inspectMicrosoftCalendarMappingIntegrity: vi.fn(),
}))

vi.mock('@/lib/scheduling/providers/caldavService', () => ({
  syncCalDavConnection: vi.fn(),
  disconnectCalDavConnection: vi.fn(),
  inspectCalDavCalendarMappingIntegrity: vi.fn(),
}))

vi.mock('@/lib/scheduling/notifications/notificationService', () => ({
  processSchedulingNotificationOutbox: (...args: unknown[]) =>
    processOutboxMock(...args),
  processDueSchedulingReminders: (...args: unknown[]) =>
    processRemindersMock(...args),
  processPendingNotificationDeliveries: (...args: unknown[]) =>
    processDeliveriesMock(...args),
  reconcileSchedulingReminders: vi.fn(),
}))

vi.mock('@/lib/scheduling/repository', () => ({
  schedulingRepository: {
    getEventById: vi.fn(),
    listAvailabilityRecords: vi.fn(),
  },
}))

const runtimeContext = {
  workspaceId: 'workspace_1',
  automationId: 'automation_1',
  userProfileId: 'user_1',
  depth: 0,
  triggerPayload: {
    actor: {
      userId: 'user_1',
      workspaceMemberId: 'member_1',
      canManageScheduling: true,
    },
  },
}

describe('Workflow Builder Scheduling integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSchedulingEventMock.mockResolvedValue({
      id: 'evt_1',
      title: 'Created by workflow',
    })
    updateSchedulingEventMock.mockResolvedValue({
      id: 'evt_1',
      title: 'Updated by workflow',
    })
    changeSchedulingEventStatusMock.mockResolvedValue({
      id: 'evt_1',
      status: 'completed',
    })
    createSchedulingAvailabilityRecordMock.mockResolvedValue({
      id: 'availability_1',
    })
    syncGoogleMock.mockResolvedValue({ ok: true, processed: 1 })
    disconnectGoogleMock.mockResolvedValue({
      ok: true,
      value: { disconnected: true },
    })
    inspectGoogleMock.mockResolvedValue({ findings: [], repaired: 0 })
    processOutboxMock.mockResolvedValue({ processed: 1 })
    processRemindersMock.mockResolvedValue({ sent: 1 })
    processDeliveriesMock.mockResolvedValue({ sent: 1 })
  })

  it('registers the requested Scheduling trigger, action, and condition nodes', () => {
    expect(schedulingWorkflowTriggers).toHaveLength(35)
    expect(schedulingWorkflowActions).toHaveLength(22)
    expect(schedulingWorkflowConditions).toHaveLength(17)

    for (const trigger of schedulingWorkflowTriggers) {
      const definition = getWorkflowNodeDefinition(trigger.nodeId)
      expect(definition).toMatchObject({
        category: 'Scheduling',
        canBeTrigger: true,
        connectionRole: 'trigger',
      })
      expect(definition?.outputs.some((port) => port.id === 'event.id')).toBe(
        true,
      )
    }

    for (const action of schedulingWorkflowActions) {
      const definition = getWorkflowNodeDefinition(action.nodeId)
      expect(definition).toMatchObject({
        category: 'Scheduling',
        canBeAction: true,
        connectionRole: 'action',
      })
      expect(definition?.documentation).toContain('Scheduling services')
    }

    for (const condition of schedulingWorkflowConditions) {
      const definition = getWorkflowNodeDefinition(condition.nodeId)
      expect(definition).toMatchObject({
        category: 'Scheduling',
        canBeAction: true,
        connectionRole: 'logic',
      })
      expect(definition?.branchHandles).toEqual(['match', 'fallback'])
    }
  })

  it('keeps Scheduling nodes searchable by calendar, provider, reminder, conflict, and recurrence terms', () => {
    expect(
      searchWorkflowNodes('calendar').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
    expect(
      searchWorkflowNodes('outlook').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
    expect(
      searchWorkflowNodes('caldav').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
    expect(
      searchWorkflowNodes('reminder').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
    expect(
      searchWorkflowNodes('conflict').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
    expect(
      searchWorkflowNodes('recurrence').some((node) =>
        node.id.startsWith('scheduling.'),
      ),
    ).toBe(true)
  })

  it('standardizes Scheduling trigger payloads without provider secrets', () => {
    const payload = createSchedulingTriggerPayload({
      workspaceId: 'workspace_1',
      topic: 'scheduling.event.created',
      aggregateType: 'SchedulingEvent',
      aggregateId: 'evt_1',
      payload: {
        actorUserId: 'user_1',
        actorWorkspaceMemberId: 'member_1',
        event: {
          id: 'evt_1',
          title: 'Proposal Review',
          status: 'scheduled',
          type: 'appointment',
        },
        provider: {
          name: 'google',
          calendarId: 'cal_1',
          accessToken: 'secret-token',
        },
        linkedRecord: { type: 'client', id: 'client_1' },
        assignment: { memberId: 'member_2' },
      },
      createdAt: '2026-07-30T14:00:00.000Z',
    })

    expect(payload.workspace.id).toBe('workspace_1')
    expect(payload.event?.id).toBe('evt_1')
    expect(payload.actor?.workspaceMemberId).toBe('member_1')
    expect(payload.providerMetadata?.name).toBe('google')
    expect(JSON.stringify(payload)).not.toContain('secret-token')
  })

  it('matches Scheduling outbox topics and configured trigger filters', () => {
    const trigger = schedulingWorkflowTriggers.find(
      (item) => item.key === 'event.created',
    )
    expect(trigger).toBeTruthy()
    const payload = createSchedulingTriggerPayload({
      workspaceId: 'workspace_1',
      topic: 'scheduling.event.created',
      payload: {
        event: { id: 'evt_1', type: 'appointment', status: 'scheduled' },
        provider: { name: 'google' },
        assignment: { memberId: 'member_1' },
      },
    })

    expect(
      matchesSchedulingTriggerFilters({
        trigger: trigger!,
        topic: 'scheduling.event.created',
        payload,
        config: {
          providers: ['google'],
          statuses: ['scheduled'],
          memberId: 'member_1',
        },
      }),
    ).toBe(true)
    expect(
      matchesSchedulingTriggerFilters({
        trigger: trigger!,
        topic: 'scheduling.event.created',
        payload,
        config: { providers: ['microsoft'] },
      }),
    ).toBe(false)
  })

  it('exposes Scheduling variables and starter templates', () => {
    expect(searchWorkflowVariables('Event ID')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'scheduling.event_id',
          category: 'Scheduling',
        }),
      ]),
    )
    expect(searchWorkflowVariables('External Availability Signal')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'scheduling.external_availability_signal_id',
        }),
      ]),
    )
    expect(
      schedulingWorkflowTemplates.map((template) => template.title),
    ).toEqual(
      expect.arrayContaining([
        'Notify dispatcher when technician unavailable',
        'Calendar repair workflow',
      ]),
    )
  })

  it('builds Scheduling starter drafts with Scheduling registry node IDs', () => {
    const draft = createBuilderStarterPreviewDraft(
      'Scheduling',
      'Notify Customer When Event Rescheduled',
    )
    expect(draft.category).toBe('Scheduling')
    expect(draft.nodes[0].data).toMatchObject({
      __registryNodeId: 'scheduling.trigger.event_rescheduled',
      triggerKey: 'event.rescheduled',
    })
    expect(draft.nodes[1].data).toMatchObject({
      __registryNodeId: 'scheduling.action.send_scheduling_notification',
      actionKey: 'send_scheduling_notification',
    })
  })

  it('validates required Scheduling action fields from registry metadata', () => {
    const result = validateWorkflowNodeConfig(
      'scheduling.action.create_event',
      {},
    )
    expect(result.status).toBe('error')
    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'title',
          message: 'Title is required.',
        }),
        expect.objectContaining({
          field: 'eventType',
          message: 'Event type is required.',
        }),
        expect.objectContaining({
          field: 'startsAt',
          message: 'Start time is required.',
        }),
        expect.objectContaining({
          field: 'endsAt',
          message: 'End time is required.',
        }),
        expect.objectContaining({
          field: 'timezone',
          message: 'Timezone is required.',
        }),
      ]),
    )
  })

  it('dispatches Create Event through the Scheduling service with actor permissions', async () => {
    const result = await executeSchedulingWorkflowAction({
      registryNodeId: 'scheduling.action.create_event',
      data: {
        title: 'Proposal Review',
        eventType: 'appointment',
        startsAt: '2026-07-30T14:00:00.000Z',
        endsAt: '2026-07-30T15:00:00.000Z',
        timezone: 'America/New_York',
        memberId: 'member_2',
      },
      context: runtimeContext,
    })

    expect(createSchedulingEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          workspaceId: 'workspace_1',
          actorUserId: 'user_1',
          workspaceMemberId: 'member_1',
          canManageScheduling: true,
        }),
        input: expect.objectContaining({
          title: 'Proposal Review',
          type: 'appointment',
          assignedMemberIds: ['member_2'],
        }),
      }),
    )
    expect(result.output.eventId).toBe('evt_1')
  })

  it('dispatches provider sync and mapping repair through provider services', async () => {
    await executeSchedulingWorkflowAction({
      registryNodeId: 'scheduling.action.sync_calendar',
      data: { provider: 'google', connectionId: 'connection_1' },
      context: runtimeContext,
    })
    await executeSchedulingWorkflowAction({
      registryNodeId: 'scheduling.action.repair_calendar_mapping',
      data: { provider: 'google', repair: true },
      context: runtimeContext,
    })

    expect(syncGoogleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_1',
        connectionId: 'connection_1',
      }),
    )
    expect(inspectGoogleMock).toHaveBeenCalledWith({
      workspaceId: 'workspace_1',
      repair: true,
    })
  })

  it('refuses to run Scheduling mutations without Scheduling actor permission context', async () => {
    await expect(
      executeSchedulingWorkflowAction({
        registryNodeId: 'scheduling.action.create_event',
        data: {
          title: 'Proposal Review',
          eventType: 'appointment',
          startsAt: '2026-07-30T14:00:00.000Z',
          endsAt: '2026-07-30T15:00:00.000Z',
          timezone: 'America/New_York',
        },
        context: {
          workspaceId: 'workspace_1',
          automationId: 'automation_1',
          userProfileId: 'user_1',
          depth: 0,
          triggerPayload: {},
        },
      }),
    ).rejects.toThrow(/workspace member context/)
  })
})
