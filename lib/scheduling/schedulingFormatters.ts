import { getSchedulingEventTypeDefinition } from '@/lib/scheduling/schedulingPresetRegistry'
import { getRecordTypeDisplayName } from '@/lib/workspace-records/recordTypeDisplay'
import type { WorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'
import {
  formatInWorkspaceTimezone,
  parseSchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type {
  SchedulingEvent,
  SchedulingEventStatus,
  SchedulingEventType,
  SchedulingLinkedRecordType,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

export const schedulingStatusLabels: Record<SchedulingEventStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  inProgress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled',
  missed: 'Missed',
}

export const linkedRecordTypeLabels: Record<
  SchedulingLinkedRecordType,
  string
> = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  sale: 'Sale',
  client: 'Client',
  serviceRequest: 'Service Request',
  customer: 'Customer',
  order: 'Order',
  fulfillment: 'Fulfillment',
  product: 'Product',
  job: 'Scheduled Job',
}

export function formatSchedulingEventType(type: SchedulingEventType) {
  return getSchedulingEventTypeDefinition(type).label
}

export function formatLinkedRecordType(
  type: SchedulingLinkedRecordType,
  terminology?: WorkspaceRecordTerminology,
) {
  if (type === 'client' || type === 'serviceRequest') {
    return getRecordTypeDisplayName({ recordType: type, terminology })
  }
  return linkedRecordTypeLabels[type] ?? humanizeToken(type)
}

export function formatExternalCalendarState(
  state: SchedulingEvent['externalCalendarState'],
) {
  if (state === 'pending') return 'Pending sync'
  if (state === 'synced') return 'Synced'
  if (state === 'error') return 'Sync issue'
  if (state === 'conflict') return 'Sync conflict'
  return 'Not connected'
}

export function formatDateOnly(value: string, timezone?: string) {
  return formatInWorkspaceTimezone(value, timezone ?? 'UTC', {
    dateStyle: 'full',
  })
}

export function formatDateTime(value: string, timezone?: string) {
  return formatInWorkspaceTimezone(value, timezone ?? 'UTC', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTimeOnly(value: string, timezone?: string) {
  return formatInWorkspaceTimezone(value, timezone ?? 'UTC', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRecurrenceSummary(
  rule: SchedulingRecurrenceRule | null,
  date: string,
  weekdayLabels: string[],
) {
  if (!rule) return 'Does not repeat'
  const interval = rule.interval > 1 ? `${rule.interval} ` : ''
  const unit =
    rule.frequency === 'daily'
      ? rule.interval === 1
        ? 'day'
        : 'days'
      : rule.frequency === 'weekly'
        ? rule.interval === 1
          ? 'week'
          : 'weeks'
        : rule.frequency === 'monthly'
          ? rule.interval === 1
            ? 'month'
            : 'months'
          : rule.interval === 1
            ? 'year'
            : 'years'
  const weekly =
    rule.frequency === 'weekly' && rule.daysOfWeek?.length
      ? ` on ${rule.daysOfWeek.map((day) => weekdayLabels[day]).join(', ')}`
      : ''
  const monthly =
    rule.frequency === 'monthly'
      ? ` on day ${parseSchedulingDateKey(date).day}`
      : ''
  const yearly =
    rule.frequency === 'yearly'
      ? ` on ${new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
        }).format(new Date(`${date}T12:00:00`))}`
      : ''
  const end =
    rule.endType === 'onDate' && rule.endDate
      ? ` until ${new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(`${rule.endDate}T12:00:00`))}`
      : rule.endType === 'afterOccurrences' && rule.occurrenceCount
        ? ` for ${rule.occurrenceCount} occurrences`
        : ''
  return `Repeats every ${interval}${unit}${weekly}${monthly}${yearly}${end}`
}

export function humanizeToken(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
