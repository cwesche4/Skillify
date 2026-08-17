import { prisma } from '@/lib/db'
import {
  disconnectCalDavConnection,
  inspectCalDavCalendarMappingIntegrity,
  syncCalDavConnection,
} from '@/lib/scheduling/providers/caldavService'
import {
  disconnectGoogleCalendarConnection,
  inspectGoogleCalendarMappingIntegrity,
  syncGoogleCalendarConnection,
} from '@/lib/scheduling/providers/googleService'
import {
  disconnectMicrosoftCalendarConnection,
  inspectMicrosoftCalendarMappingIntegrity,
  syncMicrosoftCalendarConnection,
} from '@/lib/scheduling/providers/microsoftService'
import {
  processDueSchedulingReminders,
  processPendingNotificationDeliveries,
  processSchedulingNotificationOutbox,
  reconcileSchedulingReminders,
} from '@/lib/scheduling/notifications/notificationService'
import {
  changeSchedulingEventStatus,
  changeSchedulingRecurrenceSeriesStatus,
  createSchedulingAvailabilityRecord,
  createSchedulingEvent,
  deleteSchedulingEvent,
  updateSchedulingEvent,
  type SchedulingMutationActor,
} from '@/lib/scheduling/services/schedulingService'
import { schedulingRepository } from '@/lib/scheduling/repository'
import {
  getSchedulingWorkflowActionByNodeId,
  getSchedulingWorkflowConditionByNodeId,
  isSchedulingWorkflowNode,
  type SchedulingWorkflowActionKey,
  type SchedulingWorkflowConditionKey,
} from '@/lib/workflows/schedulingRegistry'
import type { NodeExecutionContext } from '@/lib/automations/executor'

type RuntimeData = Record<string, unknown>

export type SchedulingWorkflowRuntimeResult = {
  output: Record<string, unknown>
  log: string
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function triggerPayloadActor(context: NodeExecutionContext) {
  const payload = context.triggerPayload
  if (!payload || typeof payload !== 'object') return {}
  const actor = (payload as { actor?: unknown }).actor
  return actor && typeof actor === 'object' && !Array.isArray(actor)
    ? (actor as Record<string, unknown>)
    : {}
}

function buildSchedulingActor(
  data: RuntimeData,
  context: NodeExecutionContext,
): SchedulingMutationActor {
  const triggerActor = triggerPayloadActor(context)
  const workspaceId = context.workspaceId
  const actorUserId =
    stringValue(data.actorUserId) ??
    stringValue(triggerActor.userId) ??
    stringValue(context.userProfileId)
  const workspaceMemberId =
    stringValue(data.actorWorkspaceMemberId) ??
    stringValue(data.workspaceMemberId) ??
    stringValue(triggerActor.workspaceMemberId)
  const canManageScheduling =
    booleanValue(data.canManageScheduling) ||
    booleanValue(triggerActor.canManageScheduling)

  if (!workspaceId || !actorUserId || !workspaceMemberId) {
    throw new Error(
      'Scheduling workflow actions require workspace, actor user, and workspace member context.',
    )
  }

  return {
    workspaceId,
    actorUserId,
    workspaceMemberId,
    canManageScheduling,
  }
}

function dataForEventInput(data: RuntimeData) {
  return {
    title: stringValue(data.title) ?? 'Workflow scheduled event',
    type:
      stringValue(data.eventType) ?? stringValue(data.type) ?? 'appointment',
    status: stringValue(data.status) ?? 'scheduled',
    startsAt: stringValue(data.startsAt) ?? stringValue(data.startTime),
    endsAt: stringValue(data.endsAt) ?? stringValue(data.endTime),
    timezone: stringValue(data.timezone) ?? 'UTC',
    allDay: booleanValue(data.allDay),
    location: stringValue(data.location),
    locationType: stringValue(data.locationType) ?? 'none',
    assignedMemberIds: stringValue(data.memberId)
      ? [stringValue(data.memberId) as string]
      : Array.isArray(data.assignedMemberIds)
        ? data.assignedMemberIds.map(String)
        : [],
    linkedRecord:
      stringValue(data.linkedRecordType) &&
      stringValue(data.linkedRecordId) &&
      stringValue(data.linkedRecordLabel)
        ? {
            recordType: stringValue(data.linkedRecordType),
            recordId: stringValue(data.linkedRecordId),
            label: stringValue(data.linkedRecordLabel),
          }
        : undefined,
    recurrenceRule:
      data.recurrenceRule && typeof data.recurrenceRule === 'object'
        ? data.recurrenceRule
        : undefined,
    reminderPolicy:
      data.reminderPolicy && typeof data.reminderPolicy === 'object'
        ? data.reminderPolicy
        : undefined,
  }
}

function dataForAvailabilityInput(
  data: RuntimeData,
  kind: 'timeOff' | 'availabilityException',
) {
  if (kind === 'timeOff') {
    return {
      kind,
      memberId: stringValue(data.memberId) ?? '',
      memberName: stringValue(data.memberName) ?? 'Workspace member',
      category: stringValue(data.category) ?? 'unavailable',
      title: stringValue(data.title),
      reason:
        stringValue(data.reason) ??
        stringValue(data.title) ??
        'Workflow-created time off',
      startsAt: stringValue(data.startsAt) ?? '',
      endsAt: stringValue(data.endsAt) ?? '',
      allDay: booleanValue(data.allDay),
      timezone: stringValue(data.timezone),
      notes: stringValue(data.notes),
    }
  }
  return {
    kind,
    scope: stringValue(data.teamId)
      ? 'team'
      : stringValue(data.memberId)
        ? 'member'
        : 'workspace',
    memberId: stringValue(data.memberId),
    memberName: stringValue(data.memberName),
    teamId: stringValue(data.teamId),
    teamName: stringValue(data.teamName),
    exceptionType: stringValue(data.exceptionType) ?? 'closed',
    title: stringValue(data.title),
    date:
      stringValue(data.date) ?? stringValue(data.startsAt)?.slice(0, 10) ?? '',
    allDayClosed: booleanValue(data.allDayClosed, true),
    startTime: stringValue(data.startTime),
    endTime: stringValue(data.endTime),
    timezone: stringValue(data.timezone),
    recurrenceRule:
      data.recurrenceRule && typeof data.recurrenceRule === 'object'
        ? data.recurrenceRule
        : undefined,
    notes: stringValue(data.notes),
  }
}

function requireString(data: RuntimeData, key: string) {
  const value = stringValue(data[key])
  if (!value) throw new Error(`${key} is required.`)
  return value
}

function providerKey(value: unknown) {
  const provider = stringValue(value)?.toLowerCase()
  if (provider === 'google') return 'google'
  if (provider === 'microsoft' || provider === 'outlook') return 'microsoft'
  if (provider === 'apple' || provider === 'caldav') return 'caldav'
  throw new Error('Choose a supported calendar provider.')
}

async function syncCalendarProvider({
  workspaceId,
  connectionId,
  provider,
  dryRun,
}: {
  workspaceId: string
  connectionId: string
  provider: string
  dryRun?: boolean
}) {
  const workerId = `workflow-${Date.now()}`
  if (provider === 'google') {
    return syncGoogleCalendarConnection({
      workspaceId,
      connectionId,
      workerId,
      dryRun,
    })
  }
  if (provider === 'microsoft') {
    return syncMicrosoftCalendarConnection({
      workspaceId,
      connectionId,
      workerId,
      dryRun,
    })
  }
  return syncCalDavConnection({ workspaceId, connectionId, workerId, dryRun })
}

async function disconnectCalendarProvider({
  workspaceId,
  connectionId,
  provider,
}: {
  workspaceId: string
  connectionId: string
  provider: string
}) {
  if (provider === 'google') {
    return disconnectGoogleCalendarConnection({ workspaceId, connectionId })
  }
  if (provider === 'microsoft') {
    return disconnectMicrosoftCalendarConnection({ workspaceId, connectionId })
  }
  return disconnectCalDavConnection({ workspaceId, connectionId })
}

async function inspectCalendarProvider({
  workspaceId,
  provider,
  repair,
}: {
  workspaceId: string
  provider: string
  repair?: boolean
}) {
  if (provider === 'google') {
    return inspectGoogleCalendarMappingIntegrity({ workspaceId, repair })
  }
  if (provider === 'microsoft') {
    return inspectMicrosoftCalendarMappingIntegrity({ workspaceId, repair })
  }
  return inspectCalDavCalendarMappingIntegrity({ workspaceId, repair })
}

export async function executeSchedulingWorkflowAction({
  registryNodeId,
  data,
  context,
  preview = false,
}: {
  registryNodeId: string
  data: RuntimeData
  context: NodeExecutionContext
  preview?: boolean
}): Promise<SchedulingWorkflowRuntimeResult> {
  const definition = getSchedulingWorkflowActionByNodeId(registryNodeId)
  if (!definition) {
    throw new Error(`Unsupported Scheduling workflow action: ${registryNodeId}`)
  }
  if (preview) {
    return {
      output: {
        scheduling: {
          action: definition.key,
          operation: definition.operation,
          status: 'preview',
        },
      },
      log: `${definition.label} simulated through Scheduling preview.`,
    }
  }

  const actionKey = definition.key as SchedulingWorkflowActionKey
  const workspaceId = context.workspaceId
  if (!workspaceId) throw new Error('Scheduling action requires a workspace.')

  switch (actionKey) {
    case 'create_event': {
      const actor = buildSchedulingActor(data, context)
      const event = await createSchedulingEvent({
        actor,
        input: dataForEventInput(data),
      })
      return {
        output: { event, eventId: event.id },
        log: 'Scheduling event created.',
      }
    }
    case 'update_event': {
      const actor = buildSchedulingActor(data, context)
      const eventId = requireString(data, 'eventId')
      const event = await updateSchedulingEvent({
        actor,
        eventId,
        input: dataForEventInput(data) as never,
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { event, eventId: event?.id ?? eventId },
        log: 'Scheduling event updated.',
      }
    }
    case 'delete_event': {
      const actor = buildSchedulingActor(data, context)
      const eventId = requireString(data, 'eventId')
      await deleteSchedulingEvent({
        actor,
        eventId,
        scope: stringValue(data.scope) as never,
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { eventId, deleted: true },
        log: 'Scheduling event deleted.',
      }
    }
    case 'cancel_event':
    case 'complete_event': {
      const actor = buildSchedulingActor(data, context)
      const eventId = requireString(data, 'eventId')
      const status = actionKey === 'cancel_event' ? 'canceled' : 'completed'
      const event = await changeSchedulingEventStatus({
        actor,
        eventId,
        status,
        scope: stringValue(data.scope) as never,
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { event, eventId, status },
        log: `Scheduling event ${status}.`,
      }
    }
    case 'reschedule_event': {
      const actor = buildSchedulingActor(data, context)
      const eventId = requireString(data, 'eventId')
      const event = await updateSchedulingEvent({
        actor,
        eventId,
        input: {
          startsAt: requireString(data, 'startsAt'),
          endsAt: requireString(data, 'endsAt'),
        },
        scope: stringValue(data.scope) as never,
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { event, eventId },
        log: 'Scheduling event rescheduled.',
      }
    }
    case 'assign_member': {
      const actor = buildSchedulingActor(data, context)
      const eventId = requireString(data, 'eventId')
      const memberId = requireString(data, 'memberId')
      const event = await updateSchedulingEvent({
        actor,
        eventId,
        input: { assignedMemberIds: [memberId] },
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { event, eventId, memberId },
        log: 'Scheduling event member assignment updated.',
      }
    }
    case 'assign_team':
      throw new Error(
        'Scheduling team assignment is not exposed by the Scheduling service yet.',
      )
    case 'pause_series':
    case 'resume_series':
    case 'cancel_series': {
      const actor = buildSchedulingActor(data, context)
      const seriesId = requireString(data, 'seriesId')
      const action =
        actionKey === 'pause_series'
          ? 'pause'
          : actionKey === 'resume_series'
            ? 'resume'
            : 'cancel'
      await changeSchedulingRecurrenceSeriesStatus({
        actor,
        seriesId,
        action,
        idempotencyKey: stringValue(data.idempotencyKey),
      })
      return {
        output: { seriesId, action },
        log: `Scheduling recurrence series ${action}d.`,
      }
    }
    case 'create_time_off':
    case 'create_availability_exception': {
      const actor = buildSchedulingActor(data, context)
      const kind =
        actionKey === 'create_time_off' ? 'timeOff' : 'availabilityException'
      const record = await createSchedulingAvailabilityRecord({
        actor,
        record: dataForAvailabilityInput(data, kind) as never,
      })
      return {
        output: { availability: record, availabilityId: record.id },
        log: `${definition.label} completed.`,
      }
    }
    case 'connect_calendar':
      return {
        output: {
          provider: requireString(data, 'provider'),
          status: 'requiresUserOAuth',
        },
        log: 'Calendar connection requires the provider OAuth/CalDAV connection flow.',
      }
    case 'disconnect_calendar': {
      const provider = providerKey(data.provider)
      const connectionId = requireString(data, 'connectionId')
      const result = await disconnectCalendarProvider({
        workspaceId,
        connectionId,
        provider,
      })
      return {
        output: { provider, connectionId, result },
        log: 'Calendar connection disconnected.',
      }
    }
    case 'sync_calendar':
    case 'retry_provider_sync': {
      const provider = providerKey(data.provider)
      const connectionId = requireString(data, 'connectionId')
      const result = await syncCalendarProvider({
        workspaceId,
        connectionId,
        provider,
      })
      return {
        output: { provider, connectionId, result },
        log: 'Calendar provider sync requested.',
      }
    }
    case 'repair_calendar_mapping': {
      const provider = providerKey(data.provider)
      const result = await inspectCalendarProvider({
        workspaceId,
        provider,
        repair: booleanValue(data.repair, true),
      })
      return {
        output: { provider, result },
        log: 'Calendar mapping repair completed.',
      }
    }
    case 'send_scheduling_notification': {
      const result = await processSchedulingNotificationOutbox({
        workerId: `workflow-${context.automationId ?? 'manual'}`,
        batchSize: Number(data.batchSize ?? 25),
      })
      const deliveries = await processPendingNotificationDeliveries({
        workerId: `workflow-${context.automationId ?? 'manual'}`,
        batchSize: Number(data.batchSize ?? 25),
      })
      return {
        output: { outbox: result, deliveries },
        log: 'Scheduling notification worker processed pending deliveries.',
      }
    }
    case 'send_reminder': {
      const eventId = stringValue(data.eventId)
      if (eventId) {
        await reconcileSchedulingReminders({
          workspaceId,
          eventId,
          reason: 'workflow.action.send_reminder',
        })
      }
      const result = await processDueSchedulingReminders({
        workerId: `workflow-${context.automationId ?? 'manual'}`,
        batchSize: Number(data.batchSize ?? 25),
      })
      return {
        output: { eventId, reminders: result },
        log: 'Scheduling reminders processed.',
      }
    }
    case 'acknowledge_external_availability_conflict':
    case 'override_external_availability_conflict':
      return {
        output: {
          conflictId: requireString(data, 'conflictId'),
          acknowledged:
            actionKey === 'acknowledge_external_availability_conflict',
          overridden: actionKey === 'override_external_availability_conflict',
          reason: stringValue(data.reason),
        },
        log: `${definition.label} recorded for downstream Scheduling conflict handling.`,
      }
    default:
      throw new Error(`Unsupported Scheduling action: ${actionKey}`)
  }
}

export async function evaluateSchedulingWorkflowCondition({
  registryNodeId,
  data,
  context,
}: {
  registryNodeId: string
  data: RuntimeData
  context: NodeExecutionContext
}) {
  const definition = getSchedulingWorkflowConditionByNodeId(registryNodeId)
  if (!definition) {
    throw new Error(
      `Unsupported Scheduling workflow condition: ${registryNodeId}`,
    )
  }
  const workspaceId = context.workspaceId
  if (!workspaceId)
    throw new Error('Scheduling condition requires a workspace.')
  const conditionKey = definition.key as SchedulingWorkflowConditionKey
  const eventId = stringValue(data.eventId)

  if (
    eventId &&
    ['recurring_event', 'one_time_event', 'reminder_enabled'].includes(
      conditionKey,
    )
  ) {
    const event = await schedulingRepository.getEventById({
      workspaceId,
      eventId,
    })
    const matches =
      conditionKey === 'recurring_event'
        ? Boolean(event?.recurrenceSeriesId)
        : conditionKey === 'one_time_event'
          ? Boolean(event && !event.recurrenceSeriesId)
          : Boolean(
              event?.reminderPolicy && event.reminderPolicy.mode !== 'none',
            )
    return {
      matches,
      reason: matches
        ? `${definition.label} matched.`
        : `${definition.label} did not match.`,
    }
  }

  if (
    conditionKey === 'has_time_off' ||
    conditionKey === 'has_availability_exception'
  ) {
    const records = await schedulingRepository.listAvailabilityRecords({
      workspaceId,
      startsBefore: stringValue(data.endsAt)
        ? new Date(stringValue(data.endsAt) as string)
        : undefined,
      endsAfter: stringValue(data.startsAt)
        ? new Date(stringValue(data.startsAt) as string)
        : undefined,
    })
    const kind =
      conditionKey === 'has_time_off' ? 'timeOff' : 'availabilityException'
    const matches = records.some((record) => record.kind === kind)
    return {
      matches,
      reason: matches
        ? `${definition.label} matched.`
        : `${definition.label} did not match.`,
    }
  }

  if (
    [
      'calendar_connected',
      'calendar_healthy',
      'provider_healthy',
      'provider_sync_enabled',
      'personal_calendar_approved',
      'workspace_calendar_approved',
    ].includes(conditionKey)
  ) {
    const provider = stringValue(data.provider)?.toUpperCase()
    const prismaProvider = provider
      ? provider === 'MICROSOFT'
        ? 'OUTLOOK'
        : provider === 'APPLE'
          ? 'APPLE_ICLOUD'
          : provider
      : undefined
    const connection = await prisma.calendarConnection.findFirst({
      where: {
        workspaceId,
        id: stringValue(data.connectionId),
        provider: prismaProvider as never,
        disconnectedAt: null,
      },
    })
    const matches = Boolean(connection)
    return {
      matches,
      reason: matches
        ? 'Calendar provider condition matched.'
        : 'Calendar provider condition did not match.',
    }
  }

  if (conditionKey.includes('conflict')) {
    const conflictId = stringValue(data.conflictId)
    const conflict = conflictId
      ? await prisma.calendarSyncConflict.findFirst({
          where: { workspaceId, id: conflictId },
        })
      : null
    return {
      matches: Boolean(conflict),
      reason: conflict
        ? 'Conflict condition matched.'
        : 'Conflict condition did not match.',
    }
  }

  return {
    matches: false,
    reason: `${definition.label} requires a Scheduling service signal at runtime.`,
  }
}

export function isSchedulingRuntimeNode(
  registryNodeId: string | undefined | null,
) {
  return isSchedulingWorkflowNode(registryNodeId)
}
