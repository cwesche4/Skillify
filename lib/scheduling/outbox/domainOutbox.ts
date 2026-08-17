export type SchedulingOutboxTopic =
  | 'scheduling.event.created'
  | 'scheduling.event.updated'
  | 'scheduling.event.status_changed'
  | 'scheduling.event.completed'
  | 'scheduling.event.canceled'
  | 'scheduling.event.deleted'
  | 'scheduling.recurrence_series.created'
  | 'scheduling.recurrence_series.paused'
  | 'scheduling.recurrence_series.resumed'
  | 'scheduling.recurrence_series.canceled'
  | 'scheduling.recurrence.series_updated'
  | 'scheduling.recurrence.series_split'
  | 'scheduling.recurrence.series_deleted'
  | 'scheduling.recurrence.occurrence_canceled'
  | 'scheduling.recurrence.occurrence_deleted'
  | 'scheduling.recurrence.repaired'
  | 'scheduling.availability.changed'
  | 'scheduling.time_off.created'
  | 'scheduling.time_off.updated'
  | 'scheduling.time_off.approved'
  | 'scheduling.availability_exception.created'
  | 'scheduling.availability_exception.updated'
  | 'scheduling.sync.requested'
  | 'scheduling.calendar.connected'
  | 'scheduling.calendar.disconnected'
  | 'scheduling.calendar.sync_completed'
  | 'scheduling.calendar.sync_failed'
  | 'scheduling.provider.conflict_detected'
  | 'scheduling.provider.conflict_resolved'
  | 'scheduling.calendar_policy.updated'
  | 'scheduling.calendar_connection.approval_updated'
  | 'scheduling.calendar_connection.disabled'
  | 'scheduling.calendar_connection.owner_inactive'
  | 'scheduling.personal_calendar.access_policy_updated'
  | 'scheduling.personal_calendar.connection_requested'
  | 'scheduling.personal_calendar.approved'
  | 'scheduling.personal_calendar.rejected'
  | 'scheduling.personal_calendar.disabled'
  | 'scheduling.personal_calendar.reclassification_requested'
  | 'scheduling.personal_calendar.purpose_changed'
  | 'scheduling.personal_calendar.availability_behavior_changed'
  | 'scheduling.personal_calendar.approver_policy_updated'
  | 'scheduling.calendar_connection.classification_required'
  | 'scheduling.calendar_connection.classification_confirmed'
  | 'scheduling.calendar_connection.classification_mismatch'
  | 'scheduling.calendar_connection.approval_requested'
  | 'scheduling.calendar_connection.approved_with_restrictions'
  | 'scheduling.calendar_connection.reclassified'
  | 'scheduling.external_availability.conflict_detected'
  | 'scheduling.external_availability.conflict_acknowledged'
  | 'scheduling.external_availability.conflict_overridden'
  | 'scheduling.reminder.sent'
  | 'scheduling.reminder.failed'
  | 'scheduling.notification.delivered'
  | 'scheduling.notification.failed'
  | 'scheduling.conflict.created'
  | 'scheduling.conflict.resolved'
  | 'scheduling.worker.failure'
  | 'scheduling.worker.recovery'

export type SchedulingOutboxEventInput = {
  workspaceId: string
  topic: SchedulingOutboxTopic
  aggregateType:
    | 'SchedulingEvent'
    | 'SchedulingAvailabilityRecord'
    | 'CalendarConnection'
  aggregateId: string
  payload: Record<string, unknown>
  availableAt?: Date
}

export type SchedulingOutboxEventRecord = SchedulingOutboxEventInput & {
  status: 'pending'
  attempts: 0
  availableAt: Date
  createdAt: Date
}

export function createSchedulingOutboxEvent(
  input: SchedulingOutboxEventInput,
  now = new Date(),
): SchedulingOutboxEventRecord {
  return {
    ...input,
    status: 'pending',
    attempts: 0,
    availableAt: input.availableAt ?? now,
    createdAt: now,
  }
}

export function createSchedulingEventChangedOutboxEvents({
  workspaceId,
  eventId,
  action,
  payload,
}: {
  workspaceId: string
  eventId: string
  action: 'created' | 'updated' | 'status_changed' | 'deleted'
  payload: Record<string, unknown>
}): SchedulingOutboxEventRecord[] {
  return [
    createSchedulingOutboxEvent({
      workspaceId,
      topic: `scheduling.event.${action}`,
      aggregateType: 'SchedulingEvent',
      aggregateId: eventId,
      payload,
    }),
    createSchedulingOutboxEvent({
      workspaceId,
      topic: 'scheduling.sync.requested',
      aggregateType: 'SchedulingEvent',
      aggregateId: eventId,
      payload: {
        reason: action,
        eventId,
      },
    }),
  ]
}
