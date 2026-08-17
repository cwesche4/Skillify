import {
  SchedulingNotificationCategory as PrismaSchedulingNotificationCategory,
  SchedulingNotificationChannel as PrismaSchedulingNotificationChannel,
  SchedulingNotificationDeliveryStatus as PrismaSchedulingNotificationDeliveryStatus,
  SchedulingNotificationPriority as PrismaSchedulingNotificationPriority,
  SchedulingReminderStatus as PrismaSchedulingReminderStatus,
} from '@prisma/client'

import type {
  SchedulingNotificationCategory,
  SchedulingNotificationChannel,
  SchedulingNotificationPriority,
  SchedulingReminderStatus,
} from '@/lib/scheduling/types'

export const schedulingNotificationCategories: SchedulingNotificationCategory[] =
  [
    'eventCreated',
    'assignment',
    'reassignment',
    'eventUpdated',
    'rescheduled',
    'canceled',
    'completed',
    'missed',
    'reminder',
    'recurringSeriesChanged',
    'recurringSeriesCanceled',
    'timeOff',
    'availabilityException',
    'conflict',
    'deliveryFailure',
  ]

export const retryDelaysMs = [
  0,
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
]
export const notificationWorkerLeaseMs = 5 * 60_000
export const reminderWorkerLeaseMs = 5 * 60_000
export const deliveryWorkerLeaseMs = 5 * 60_000
export const maxNotificationWorkerAttempts = 5
export const maxDeliveryAttempts = 5
export const reminderPastDueGraceMs = 10 * 60_000

export function notificationCategoryToPrisma(
  category: SchedulingNotificationCategory,
) {
  const map: Record<
    SchedulingNotificationCategory,
    PrismaSchedulingNotificationCategory
  > = {
    eventCreated: PrismaSchedulingNotificationCategory.EVENT_CREATED,
    assignment: PrismaSchedulingNotificationCategory.ASSIGNMENT,
    reassignment: PrismaSchedulingNotificationCategory.REASSIGNMENT,
    eventUpdated: PrismaSchedulingNotificationCategory.EVENT_UPDATED,
    rescheduled: PrismaSchedulingNotificationCategory.RESCHEDULED,
    canceled: PrismaSchedulingNotificationCategory.CANCELED,
    completed: PrismaSchedulingNotificationCategory.COMPLETED,
    missed: PrismaSchedulingNotificationCategory.MISSED,
    reminder: PrismaSchedulingNotificationCategory.REMINDER,
    recurringSeriesChanged:
      PrismaSchedulingNotificationCategory.RECURRING_SERIES_CHANGED,
    recurringSeriesCanceled:
      PrismaSchedulingNotificationCategory.RECURRING_SERIES_CANCELED,
    timeOff: PrismaSchedulingNotificationCategory.TIME_OFF,
    availabilityException:
      PrismaSchedulingNotificationCategory.AVAILABILITY_EXCEPTION,
    conflict: PrismaSchedulingNotificationCategory.CONFLICT,
    deliveryFailure: PrismaSchedulingNotificationCategory.DELIVERY_FAILURE,
  }
  return map[category]
}

export function notificationCategoryFromPrisma(
  category: PrismaSchedulingNotificationCategory,
): SchedulingNotificationCategory {
  const map: Record<
    PrismaSchedulingNotificationCategory,
    SchedulingNotificationCategory
  > = {
    EVENT_CREATED: 'eventCreated',
    ASSIGNMENT: 'assignment',
    REASSIGNMENT: 'reassignment',
    EVENT_UPDATED: 'eventUpdated',
    RESCHEDULED: 'rescheduled',
    CANCELED: 'canceled',
    COMPLETED: 'completed',
    MISSED: 'missed',
    REMINDER: 'reminder',
    RECURRING_SERIES_CHANGED: 'recurringSeriesChanged',
    RECURRING_SERIES_CANCELED: 'recurringSeriesCanceled',
    TIME_OFF: 'timeOff',
    AVAILABILITY_EXCEPTION: 'availabilityException',
    CONFLICT: 'conflict',
    DELIVERY_FAILURE: 'deliveryFailure',
  }
  return map[category]
}

export function notificationPriorityToPrisma(
  priority: SchedulingNotificationPriority,
) {
  const map: Record<
    SchedulingNotificationPriority,
    PrismaSchedulingNotificationPriority
  > = {
    low: PrismaSchedulingNotificationPriority.LOW,
    normal: PrismaSchedulingNotificationPriority.NORMAL,
    high: PrismaSchedulingNotificationPriority.HIGH,
    urgent: PrismaSchedulingNotificationPriority.URGENT,
  }
  return map[priority]
}

export function notificationChannelToPrisma(
  channel: SchedulingNotificationChannel,
) {
  const map: Record<
    SchedulingNotificationChannel,
    PrismaSchedulingNotificationChannel
  > = {
    inApp: PrismaSchedulingNotificationChannel.IN_APP,
    email: PrismaSchedulingNotificationChannel.EMAIL,
    sms: PrismaSchedulingNotificationChannel.SMS,
    push: PrismaSchedulingNotificationChannel.PUSH,
  }
  return map[channel]
}

export function notificationChannelFromPrisma(
  channel: PrismaSchedulingNotificationChannel,
): SchedulingNotificationChannel {
  const map: Record<
    PrismaSchedulingNotificationChannel,
    SchedulingNotificationChannel
  > = {
    IN_APP: 'inApp',
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
  }
  return map[channel]
}

export function deliveryStatusToPrisma(
  status:
    | 'pending'
    | 'deferred'
    | 'processing'
    | 'sent'
    | 'delivered'
    | 'failed'
    | 'permanentlyFailed'
    | 'canceled'
    | 'skipped',
) {
  const map = {
    pending: PrismaSchedulingNotificationDeliveryStatus.PENDING,
    deferred: PrismaSchedulingNotificationDeliveryStatus.DEFERRED,
    processing: PrismaSchedulingNotificationDeliveryStatus.PROCESSING,
    sent: PrismaSchedulingNotificationDeliveryStatus.SENT,
    delivered: PrismaSchedulingNotificationDeliveryStatus.DELIVERED,
    failed: PrismaSchedulingNotificationDeliveryStatus.FAILED,
    permanentlyFailed:
      PrismaSchedulingNotificationDeliveryStatus.PERMANENTLY_FAILED,
    canceled: PrismaSchedulingNotificationDeliveryStatus.CANCELED,
    skipped: PrismaSchedulingNotificationDeliveryStatus.SKIPPED,
  } as const
  return map[status]
}

export function reminderStatusToPrisma(status: SchedulingReminderStatus) {
  const map: Record<SchedulingReminderStatus, PrismaSchedulingReminderStatus> =
    {
      scheduled: PrismaSchedulingReminderStatus.SCHEDULED,
      processing: PrismaSchedulingReminderStatus.PROCESSING,
      sent: PrismaSchedulingReminderStatus.SENT,
      canceled: PrismaSchedulingReminderStatus.CANCELED,
      skipped: PrismaSchedulingReminderStatus.SKIPPED,
      failed: PrismaSchedulingReminderStatus.FAILED,
      permanentlyFailed: PrismaSchedulingReminderStatus.PERMANENTLY_FAILED,
    }
  return map[status]
}

export function getRetryDelayMs(attempts: number) {
  return retryDelaysMs[
    Math.min(Math.max(attempts, 0), retryDelaysMs.length - 1)
  ]
}

export function getSchedulingNotificationCategoryLabel(
  category: SchedulingNotificationCategory,
) {
  const labels: Record<SchedulingNotificationCategory, string> = {
    eventCreated: 'Event created',
    assignment: 'Assignment',
    reassignment: 'Reassignment',
    eventUpdated: 'Event updated',
    rescheduled: 'Rescheduled',
    canceled: 'Canceled',
    completed: 'Completed',
    missed: 'Missed',
    reminder: 'Reminder',
    recurringSeriesChanged: 'Recurring schedule changed',
    recurringSeriesCanceled: 'Recurring schedule canceled',
    timeOff: 'Time off',
    availabilityException: 'Availability exception',
    conflict: 'Conflict',
    deliveryFailure: 'Delivery failure',
  }
  return labels[category]
}

export function isUserFacingSchedulingOutboxTopic(topic: string) {
  if (topic === 'scheduling.sync.requested') return false
  if (topic === 'scheduling.recurrence.repaired') return false
  return topic.startsWith('scheduling.')
}

export function categoryFromSchedulingOutboxTopic(
  topic: string,
  payload: Record<string, unknown>,
): SchedulingNotificationCategory | null {
  if (!isUserFacingSchedulingOutboxTopic(topic)) return null
  if (topic === 'scheduling.event.created') return 'assignment'
  if (topic === 'scheduling.event.canceled') return 'canceled'
  if (topic === 'scheduling.event.completed') return 'completed'
  if (topic === 'scheduling.event.status_changed') {
    if (payload.to === 'missed') return 'missed'
    return 'eventUpdated'
  }
  if (topic === 'scheduling.event.updated') {
    return payload.rescheduled === true ? 'rescheduled' : 'eventUpdated'
  }
  if (topic === 'scheduling.recurrence.series_split') {
    return 'recurringSeriesChanged'
  }
  if (topic.includes('series_canceled') || topic.includes('series.canceled')) {
    return 'recurringSeriesCanceled'
  }
  if (topic.includes('canceled')) return 'canceled'
  if (topic.includes('series_updated') || topic.includes('series.updated')) {
    return 'recurringSeriesChanged'
  }
  if (topic.includes('availability')) return 'availabilityException'
  return null
}

export function priorityForSchedulingCategory(
  category: SchedulingNotificationCategory,
): SchedulingNotificationPriority {
  if (
    category === 'canceled' ||
    category === 'missed' ||
    category === 'conflict' ||
    category === 'deliveryFailure'
  ) {
    return 'high'
  }
  return 'normal'
}

export function buildSchedulingActionUrl({
  workspaceSlug,
  eventId,
  seriesId,
  section,
}: {
  workspaceSlug: string
  eventId?: string | null
  seriesId?: string | null
  section?: 'calendar' | 'recurringServices' | 'teamAvailability'
}) {
  if (section === 'teamAvailability') {
    return `/dashboard/${workspaceSlug}/scheduling/team-availability`
  }
  if (section === 'recurringServices' && seriesId) {
    return `/dashboard/${workspaceSlug}/scheduling/recurring-services?seriesId=${encodeURIComponent(seriesId)}`
  }
  const params = new URLSearchParams()
  if (eventId) params.set('eventId', eventId)
  if (seriesId) params.set('seriesId', seriesId)
  const suffix = params.toString()
  return `/dashboard/${workspaceSlug}/scheduling/calendar${suffix ? `?${suffix}` : ''}`
}
