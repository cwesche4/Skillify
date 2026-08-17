import {
  addDateKeys,
  combineDateAndTimeInTimezone,
  getWorkspaceDateKey,
  getWorkspaceTimeInputValue,
} from '@/lib/scheduling/schedulingDateTime'
import { normalizeSchedulingTimezone } from '@/lib/scheduling/schedulingTimezones'
import type {
  MemberSchedulingNotificationPreferences,
  SchedulingNotificationCategory,
  SchedulingNotificationChannel,
  SchedulingNotificationPriority,
  SchedulingQuietHours,
  WorkspaceSchedulingNotificationPreferences,
} from '@/lib/scheduling/types'

export type ResolvedSchedulingNotificationPreference = {
  categoryEnabled: boolean
  inAppEnabled: boolean
  emailEnabled: boolean
  quietHoursPolicy: 'deliver' | 'defer'
  timezone: string
  reason?: string
}

export const defaultWorkspaceSchedulingNotificationPreferences: WorkspaceSchedulingNotificationPreferences =
  {
    schedulingEnabled: true,
    inAppEnabled: true,
    emailEnabled: false,
    defaultReminders: [
      {
        offsetMinutes: 30,
        channel: 'inApp',
        recipientGroup: 'assignedMembers',
      },
    ],
    externalAttendeesEnabled: false,
    linkedClientsEnabled: false,
    organizerCopiesEnabled: true,
    deliveryFailureAlertsEnabled: true,
  }

export function resolveSchedulingNotificationPreference({
  workspacePreferences = defaultWorkspaceSchedulingNotificationPreferences,
  memberPreferences,
  category,
  channel,
  recipientType,
  workspaceTimezone,
}: {
  workspacePreferences?: WorkspaceSchedulingNotificationPreferences
  memberPreferences?: MemberSchedulingNotificationPreferences | null
  category: SchedulingNotificationCategory
  channel?: SchedulingNotificationChannel
  recipientType: 'workspaceMember' | 'externalAttendee' | 'linkedContact'
  workspaceTimezone: string
}): ResolvedSchedulingNotificationPreference {
  const timezone = normalizeSchedulingTimezone({
    timezone: memberPreferences?.timezone,
    workspaceTimezone,
    fallbackTimezone: workspaceTimezone,
  })
  if (workspacePreferences.schedulingEnabled === false) {
    return {
      categoryEnabled: false,
      inAppEnabled: false,
      emailEnabled: false,
      quietHoursPolicy: 'deliver',
      timezone,
      reason: 'workspaceNotificationsDisabled',
    }
  }
  if (
    recipientType === 'externalAttendee' &&
    !workspacePreferences.externalAttendeesEnabled
  ) {
    return {
      categoryEnabled: false,
      inAppEnabled: false,
      emailEnabled: false,
      quietHoursPolicy: 'deliver',
      timezone,
      reason: 'externalAttendeesDisabled',
    }
  }
  if (
    recipientType === 'linkedContact' &&
    !workspacePreferences.linkedClientsEnabled
  ) {
    return {
      categoryEnabled: false,
      inAppEnabled: false,
      emailEnabled: false,
      quietHoursPolicy: 'deliver',
      timezone,
      reason: 'linkedClientsDisabled',
    }
  }
  const workspaceCategory = workspacePreferences.categorySettings?.[category]
  const memberCategory = memberPreferences?.categorySettings?.[category]
  const categoryEnabled =
    memberCategory?.enabled ??
    workspaceCategory?.enabled ??
    memberPreferences?.schedulingEnabled ??
    true
  if (!categoryEnabled) {
    return {
      categoryEnabled: false,
      inAppEnabled: false,
      emailEnabled: false,
      quietHoursPolicy: 'deliver',
      timezone,
      reason: 'categoryDisabled',
    }
  }
  const inAppEnabled =
    channel === 'email'
      ? false
      : (memberCategory?.inAppEnabled ??
        workspaceCategory?.inAppEnabled ??
        memberPreferences?.inAppEnabled ??
        workspacePreferences.inAppEnabled)
  const emailEnabled =
    channel === 'inApp'
      ? false
      : (memberCategory?.emailEnabled ??
        workspaceCategory?.emailEnabled ??
        memberPreferences?.emailEnabled ??
        workspacePreferences.emailEnabled)
  return {
    categoryEnabled,
    inAppEnabled: Boolean(inAppEnabled),
    emailEnabled: Boolean(emailEnabled),
    quietHoursPolicy: 'defer',
    timezone,
  }
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isInQuietHours({
  localTime,
  quietHours,
}: {
  localTime: string
  quietHours: SchedulingQuietHours
}) {
  const current = timeToMinutes(localTime)
  const start = timeToMinutes(quietHours.startTime)
  const end = timeToMinutes(quietHours.endTime)
  if (start === end) return true
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}

export function resolveQuietHoursDelivery({
  intendedDeliveryUtc,
  eventStartUtc,
  recipientTimezone,
  quietHours,
  priority,
}: {
  intendedDeliveryUtc: Date
  eventStartUtc?: Date | null
  recipientTimezone: string
  quietHours?: SchedulingQuietHours | null
  priority: SchedulingNotificationPriority
}):
  | { action: 'deliverNow'; bypassReason?: string }
  | { action: 'defer'; deferUntilUtc: Date }
  | { action: 'skip'; reason: string } {
  if (!quietHours?.enabled) return { action: 'deliverNow' }
  const timezone = normalizeSchedulingTimezone({
    timezone: quietHours.timezone ?? recipientTimezone,
    fallbackTimezone: 'UTC',
  })
  if (
    priority === 'urgent' ||
    (priority === 'high' && quietHours.allowUrgentBypass)
  ) {
    return { action: 'deliverNow', bypassReason: 'urgentBypass' }
  }
  const localTime = getWorkspaceTimeInputValue(intendedDeliveryUtc, timezone)
  if (!isInQuietHours({ localTime, quietHours })) {
    return { action: 'deliverNow' }
  }

  const localDate = getWorkspaceDateKey(intendedDeliveryUtc, timezone)
  const start = timeToMinutes(quietHours.startTime)
  const end = timeToMinutes(quietHours.endTime)
  const current = timeToMinutes(localTime)
  const deferDate =
    start > end && current >= start ? addDateKeys(localDate, 1) : localDate
  const deferUntilUtc = combineDateAndTimeInTimezone({
    dateKey: deferDate,
    time: quietHours.endTime,
    timezone,
  })
  if (eventStartUtc && deferUntilUtc >= eventStartUtc) {
    return {
      action: 'skip',
      reason: 'quietHoursWouldMissEvent',
    }
  }
  return { action: 'defer', deferUntilUtc }
}
