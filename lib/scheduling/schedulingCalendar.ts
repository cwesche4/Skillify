import { getSchedulingEventTypeDefinition } from '@/lib/scheduling/schedulingPresetRegistry'
import {
  addDateKeys,
  addMonthsToDateKey,
  dateKeyToCalendarDate,
  getCalendarDateKey,
  getStartOfWeekDateKey,
  getWorkspaceCalendarPeriod,
  isSchedulingDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type {
  SchedulingCalendarView,
  SchedulingEvent,
  SchedulingEventStatus,
  SchedulingEventType,
  SchedulingLinkedRecordType,
  SchedulingOccurrence,
  SchedulingSectionKey,
} from '@/lib/scheduling/types'

export type SchedulingFilters = {
  eventType: 'ALL' | SchedulingEventType
  status: 'ALL' | SchedulingEventStatus
  assignedMemberId: string
  dateRange: 'ALL' | 'UPCOMING' | 'PAST'
  linkedRecordType: 'ALL' | SchedulingLinkedRecordType
  linkState: 'ALL' | 'LINKED' | 'UNLINKED'
  recurrence: 'ALL' | 'RECURRING' | 'ONE_TIME'
  timing: 'ALL' | 'ALL_DAY' | 'TIMED'
  syncState: 'ALL' | NonNullable<SchedulingEvent['externalCalendarState']>
}

export const emptySchedulingFilters: SchedulingFilters = {
  eventType: 'ALL',
  status: 'ALL',
  assignedMemberId: 'ALL',
  dateRange: 'ALL',
  linkedRecordType: 'ALL',
  linkState: 'ALL',
  recurrence: 'ALL',
  timing: 'ALL',
  syncState: 'ALL',
}

const dayMs = 24 * 60 * 60 * 1000
const maxOccurrences = 240

export function toDateKey(date: Date | string) {
  if (typeof date === 'string' && isSchedulingDateKey(date)) return date
  return getCalendarDateKey(typeof date === 'string' ? new Date(date) : date)
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date) {
  const next = startOfDay(date)
  next.setDate(next.getDate() + 1)
  next.setMilliseconds(next.getMilliseconds() - 1)
  return next
}

export function addDays(date: Date, days: number) {
  return dateKeyToCalendarDate(addDateKeys(toDateKey(date), days))
}

export function addMonths(date: Date, months: number) {
  return dateKeyToCalendarDate(addMonthsToDateKey(toDateKey(date), months))
}

export function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1) {
  return dateKeyToCalendarDate(
    getStartOfWeekDateKey(toDateKey(date), weekStartsOn),
  )
}

export function getCalendarPeriod({
  view,
  anchorDate,
  weekStartsOn,
  timezone,
}: {
  view: SchedulingCalendarView
  anchorDate: Date
  weekStartsOn: 0 | 1
  timezone?: string
}) {
  if (timezone) {
    return getWorkspaceCalendarPeriod({
      view,
      anchorDate,
      weekStartsOn,
      timezone,
    })
  }
  if (view === 'day') {
    const start = startOfDay(anchorDate)
    const end = endOfDay(anchorDate)
    return { start, end, rangeStart: start, rangeEnd: end }
  }
  if (view === 'month') {
    const monthStart = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      1,
    )
    const gridStart = startOfWeek(monthStart, weekStartsOn)
    const monthEnd = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth() + 1,
      0,
    )
    const gridEnd = endOfDay(addDays(startOfWeek(monthEnd, weekStartsOn), 6))
    return {
      start: gridStart,
      end: gridEnd,
      rangeStart: gridStart,
      rangeEnd: gridEnd,
    }
  }
  if (view === 'agenda') {
    const start = startOfDay(anchorDate)
    const end = endOfDay(addDays(anchorDate, 30))
    return { start, end, rangeStart: start, rangeEnd: end }
  }
  const weekStart = startOfWeek(anchorDate, weekStartsOn)
  const weekEnd = endOfDay(addDays(weekStart, 6))
  return {
    start: weekStart,
    end: weekEnd,
    rangeStart: weekStart,
    rangeEnd: weekEnd,
  }
}

export function moveCalendarAnchor({
  view,
  anchorDate,
  direction,
}: {
  view: SchedulingCalendarView
  anchorDate: Date
  direction: -1 | 1
}) {
  if (view === 'day') return addDays(anchorDate, direction)
  if (view === 'month') return addMonths(anchorDate, direction)
  if (view === 'agenda') return addDays(anchorDate, direction * 30)
  return addDays(anchorDate, direction * 7)
}

export function isDateInRange(
  date: Date | string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const key =
    typeof date === 'string' && isSchedulingDateKey(date)
      ? date
      : toDateKey(date)
  return key >= toDateKey(rangeStart) && key <= toDateKey(rangeEnd)
}

export function getCalendarDateVisualState({
  date,
  today,
  selectedDate,
  activeRange,
  activeMonth,
}: {
  date: Date
  today: Date
  selectedDate: SchedulingDateKey | null
  activeRange: { start: Date; end: Date }
  activeMonth?: Date
}) {
  const dateKey = toDateKey(date)
  return {
    isToday: dateKey === toDateKey(today),
    isSelected: selectedDate === dateKey,
    isInActiveRange: isDateInRange(date, activeRange.start, activeRange.end),
    isInActiveMonth: activeMonth
      ? date.getMonth() === activeMonth.getMonth() &&
        date.getFullYear() === activeMonth.getFullYear()
      : true,
  }
}

export function formatPeriodLabel({
  view,
  start,
  end,
  anchorDate,
}: {
  view: SchedulingCalendarView
  start: Date
  end: Date
  anchorDate: Date
}) {
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (view === 'day') return date.format(start)
  if (view === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(anchorDate)
  }
  return `${view === 'agenda' ? 'Upcoming: ' : ''}${new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
    },
  ).format(start)} - ${date.format(end)}`
}

export function getScheduleSummaryTitle({
  view,
  anchorDate,
  today,
}: {
  view: SchedulingCalendarView
  anchorDate: Date
  today: Date
}) {
  if (view === 'day') {
    return toDateKey(anchorDate) === toDateKey(today)
      ? "Today's Schedule"
      : 'Day Schedule'
  }
  if (view === 'week') return 'Week Schedule'
  if (view === 'month') {
    return `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(anchorDate)} Schedule`
  }
  return 'Agenda Schedule'
}

export function getScheduleSummaryEmptyMessage(view: SchedulingCalendarView) {
  if (view === 'day') return 'No events on this day.'
  if (view === 'week') return 'No events in this week.'
  if (view === 'month') return 'No events in this month.'
  return 'No events in this agenda range.'
}

export function getUpcomingEventsForVisibleRange({
  occurrences,
  rangeStart,
  rangeEnd,
  now,
  limit,
}: {
  occurrences: SchedulingOccurrence[]
  rangeStart: Date
  rangeEnd: Date
  now: Date
  limit: number
}) {
  const rangeContainsNow = now >= rangeStart && now <= rangeEnd
  return occurrences
    .filter((event) => {
      if (event.status === 'canceled') return false
      const startsAt = new Date(event.startsAt)
      const endsAt = new Date(event.endsAt)
      if (!overlaps(startsAt, endsAt, rangeStart, rangeEnd)) return false
      return !rangeContainsNow || endsAt >= now
    })
    .sort((first, second) => {
      const firstTime = new Date(first.startsAt).getTime()
      const secondTime = new Date(second.startsAt).getTime()
      return firstTime - secondTime
    })
    .slice(0, limit)
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  return start <= rangeEnd && end >= rangeStart
}

function withOccurrence(
  event: SchedulingEvent,
  startsAt: Date,
  endsAt: Date,
  index: number,
): SchedulingOccurrence {
  const materialized = Boolean(
    event.recurrenceSeriesId && event.occurrenceOriginalAt,
  )
  const recurring = Boolean(event.recurrenceRule || materialized)
  const occurrenceId = recurring
    ? materialized
      ? event.id
      : `${event.id}:occurrence:${startsAt.toISOString()}`
    : event.id
  return {
    ...event,
    id: occurrenceId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    occurrenceId,
    sourceEventId: event.sourceEventId ?? event.id,
    occurrenceStartsAt: startsAt.toISOString(),
    occurrenceEndsAt: endsAt.toISOString(),
    isRecurringOccurrence: materialized || (recurring && index > 0),
  }
}

export function getSchedulingOccurrencesForRange({
  events,
  rangeStart,
  rangeEnd,
}: {
  events: SchedulingEvent[]
  rangeStart: Date
  rangeEnd: Date
  timezone?: string
}): SchedulingOccurrence[] {
  const occurrences: SchedulingOccurrence[] = []

  events.forEach((event) => {
    if (
      event.occurrenceState === 'master' ||
      event.occurrenceState === 'canceled' ||
      event.occurrenceState === 'deleted'
    ) {
      return
    }
    const originalStart = new Date(event.startsAt)
    const originalEnd = new Date(event.endsAt)
    const duration = Math.max(
      15 * 60 * 1000,
      originalEnd.getTime() - originalStart.getTime(),
    )
    const rule = event.recurrenceRule
    if (event.recurrenceSeriesId && event.occurrenceOriginalAt) {
      if (overlaps(originalStart, originalEnd, rangeStart, rangeEnd)) {
        occurrences.push(withOccurrence(event, originalStart, originalEnd, 0))
      }
      return
    }
    if (!rule) {
      if (overlaps(originalStart, originalEnd, rangeStart, rangeEnd)) {
        occurrences.push(withOccurrence(event, originalStart, originalEnd, 0))
      }
      return
    }

    let cursor = new Date(originalStart)
    let generated = 0
    let matchedCount = 0
    const originalWeekStart = startOfWeek(originalStart, 0).getTime()
    const endDate = rule.endDate ? endOfDay(new Date(rule.endDate)) : null
    while (generated < maxOccurrences && cursor <= rangeEnd) {
      const cursorEnd = new Date(cursor.getTime() + duration)
      const withinEndDate = !endDate || cursor <= endDate
      const withinCount =
        rule.endType !== 'afterOccurrences' ||
        !rule.occurrenceCount ||
        matchedCount < rule.occurrenceCount
      const weekIntervalAllowed =
        rule.frequency !== 'weekly' ||
        Math.floor(
          (startOfWeek(cursor, 0).getTime() - originalWeekStart) / (dayMs * 7),
        ) %
          Math.max(1, rule.interval) ===
          0
      const dayAllowed =
        rule.frequency !== 'weekly' ||
        ((!rule.daysOfWeek?.length ||
          rule.daysOfWeek.includes(cursor.getDay())) &&
          weekIntervalAllowed)
      if (withinEndDate && withinCount && dayAllowed) {
        matchedCount += 1
        if (overlaps(cursor, cursorEnd, rangeStart, rangeEnd)) {
          occurrences.push(withOccurrence(event, cursor, cursorEnd, generated))
        }
      }
      if (!withinEndDate || !withinCount) break

      generated += 1
      if (rule.frequency === 'daily') {
        cursor = addDays(cursor, Math.max(1, rule.interval))
      } else if (rule.frequency === 'weekly') {
        if (rule.daysOfWeek?.length) {
          cursor = addDays(cursor, 1)
        } else {
          cursor = addDays(cursor, Math.max(1, rule.interval) * 7)
        }
      } else if (rule.frequency === 'monthly') {
        cursor = addMonths(cursor, Math.max(1, rule.interval))
      } else {
        cursor = addYears(cursor, Math.max(1, rule.interval))
      }
    }
  })

  return occurrences.sort(
    (first, second) =>
      new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  )
}

export function eventMatchesSearch(event: SchedulingEvent, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [
    event.title,
    event.description,
    event.location,
    event.status,
    event.linkedRecord?.label,
    event.linkedRecord?.recordType,
    event.assignedMemberIds.join(' '),
    getSchedulingEventTypeDefinition(event.type).label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

export function eventMatchesFilters(
  event: SchedulingEvent,
  filters: SchedulingFilters,
) {
  const now = new Date()
  if (filters.eventType !== 'ALL' && event.type !== filters.eventType)
    return false
  if (filters.status !== 'ALL' && event.status !== filters.status) return false
  if (
    filters.assignedMemberId !== 'ALL' &&
    !event.assignedMemberIds.includes(filters.assignedMemberId)
  ) {
    return false
  }
  if (
    filters.linkedRecordType !== 'ALL' &&
    event.linkedRecord?.recordType !== filters.linkedRecordType
  ) {
    return false
  }
  if (filters.linkState === 'LINKED' && !event.linkedRecord) return false
  if (filters.linkState === 'UNLINKED' && event.linkedRecord) return false
  const recurring = Boolean(event.recurrenceRule || event.recurrenceSeriesId)
  if (filters.recurrence === 'RECURRING' && !recurring) return false
  if (filters.recurrence === 'ONE_TIME' && recurring) return false
  if (filters.timing === 'ALL_DAY' && !event.allDay) return false
  if (filters.timing === 'TIMED' && event.allDay) return false
  if (
    filters.syncState !== 'ALL' &&
    (event.externalCalendarState ?? 'notConnected') !== filters.syncState
  ) {
    return false
  }
  if (filters.dateRange === 'UPCOMING' && new Date(event.endsAt) < now)
    return false
  if (filters.dateRange === 'PAST' && new Date(event.startsAt) >= now)
    return false
  return true
}

export function getActiveFilterCount(filters: SchedulingFilters) {
  return Object.entries(filters).filter(([, value]) => value !== 'ALL').length
}

export function getAllowedStatusTransitions(status: SchedulingEventStatus) {
  if (status === 'scheduled')
    return ['confirmed', 'canceled', 'missed'] as const
  if (status === 'confirmed')
    return ['inProgress', 'canceled', 'missed'] as const
  if (status === 'inProgress') return ['completed', 'canceled'] as const
  return [] as const
}

export function getEventsForSection({
  events,
  section,
}: {
  events: SchedulingEvent[]
  section: SchedulingSectionKey | 'settings'
}) {
  if (section === 'calendar' || section === 'settings') return events
  return events.filter((event) =>
    getSchedulingEventTypeDefinition(event.type).sections.includes(section),
  )
}
