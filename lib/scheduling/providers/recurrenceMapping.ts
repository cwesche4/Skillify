import type { ProviderEventPayload } from '@/lib/scheduling/providers/types'
import type {
  SchedulingEvent,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

type RRuleParts = Record<string, string>

function dateToGoogleUtc(value: string) {
  return value.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function weekdayToRRule(day: number) {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day] ?? 'MO'
}

function frequencyToRRule(frequency: SchedulingRecurrenceRule['frequency']) {
  const map: Record<SchedulingRecurrenceRule['frequency'], string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  }
  return map[frequency]
}

export function mapSkillifyRecurrenceToRRule(
  rule?: SchedulingRecurrenceRule | null,
) {
  if (!rule) return undefined
  const parts: RRuleParts = {
    FREQ: frequencyToRRule(rule.frequency),
  }
  if (rule.interval && rule.interval > 1) {
    parts.INTERVAL = String(rule.interval)
  }
  if (rule.daysOfWeek?.length) {
    parts.BYDAY = rule.daysOfWeek.map(weekdayToRRule).join(',')
  }
  if (rule.endType === 'onDate' && rule.endDate) {
    parts.UNTIL = dateToGoogleUtc(new Date(rule.endDate).toISOString())
  }
  if (rule.endType === 'afterOccurrences' && rule.occurrenceCount) {
    parts.COUNT = String(rule.occurrenceCount)
  }
  return `RRULE:${Object.entries(parts)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')}`
}

export function mapSchedulingEventToGooglePayload(
  event: SchedulingEvent,
  calendarId: string,
): ProviderEventPayload {
  const recurrenceRule = mapSkillifyRecurrenceToRRule(event.recurrenceRule)
  return {
    calendarId,
    title: event.title,
    description: event.description,
    startsAtUtc: event.startsAt,
    endsAtUtc: event.endsAt,
    timezone: event.timezone,
    allDay: event.allDay,
    location:
      event.locationLabel ??
      event.locationAddress ??
      event.meetingUrl ??
      event.location,
    recurrenceRule,
    recurrence: recurrenceRule ? [recurrenceRule] : undefined,
    visibility:
      event.externalCalendarState === 'notConnected' ? 'default' : undefined,
    raw: {
      skillifyEventId: event.id,
      recurrenceSeriesId: event.recurrenceSeriesId,
      occurrenceOriginalAt: event.occurrenceOriginalAt,
      occurrenceState: event.occurrenceState,
      linkedRecord: event.linkedRecord,
      assignedMemberIds: event.assignedMemberIds,
    },
  }
}

export function getGoogleRecurrenceFingerprint(payload: ProviderEventPayload) {
  return JSON.stringify({
    recurrence: payload.recurrence ?? [],
    recurringEventId: payload.recurringEventId ?? null,
    originalStartTime: payload.originalStartTime ?? null,
  })
}
