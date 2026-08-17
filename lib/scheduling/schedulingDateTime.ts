import type { SchedulingCalendarView } from '@/lib/scheduling/types'

export type SchedulingDateKey = string

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

/**
 * Scheduling separates workspace-local calendar dates (`YYYY-MM-DD`),
 * local wall-clock times (`HH:mm`), IANA timezones, and persisted absolute
 * UTC instants. Date-only values should stay as date keys until combined with
 * a local time and timezone.
 */

function partsToDateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isSchedulingDateKey(value: string): value is SchedulingDateKey {
  if (!dateKeyPattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function parseSchedulingDateKey(dateKey: SchedulingDateKey) {
  if (!isSchedulingDateKey(dateKey)) {
    throw new Error(`Invalid scheduling date key: ${dateKey}`)
  }
  const [year, month, day] = dateKey.split('-').map(Number)
  return { year, month, day }
}

export function dateKeyToCalendarDate(dateKey: SchedulingDateKey) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function getCalendarDateKey(date: Date) {
  return partsToDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function getDateKeyUtcDate(dateKey: SchedulingDateKey) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

export function addDateKeys(dateKey: SchedulingDateKey, days: number) {
  const date = getDateKeyUtcDate(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return partsToDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

export function addMonthsToDateKey(dateKey: SchedulingDateKey, months: number) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  date.setUTCMonth(date.getUTCMonth() + months)
  return partsToDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

export function getDateKeyWeekday(dateKey: SchedulingDateKey) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).getUTCDay()
}

export function getStartOfWeekDateKey(
  dateKey: SchedulingDateKey,
  weekStartsOn: 0 | 1,
) {
  const offset = (getDateKeyWeekday(dateKey) - weekStartsOn + 7) % 7
  return addDateKeys(dateKey, -offset)
}

export function getWorkspaceDateParts(date: Date | string, timezone: string) {
  const instant = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(byType.get('year')),
    month: Number(byType.get('month')),
    day: Number(byType.get('day')),
    hour: Number(byType.get('hour')),
    minute: Number(byType.get('minute')),
    second: Number(byType.get('second')),
  }
}

export function getWorkspaceDateKey(date: Date | string, timezone: string) {
  const parts = getWorkspaceDateParts(date, timezone)
  return partsToDateKey(parts.year, parts.month, parts.day)
}

export function getWorkspaceTimeInputValue(
  date: Date | string,
  timezone: string,
) {
  const parts = getWorkspaceDateParts(date, timezone)
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function getWorkspaceNow({
  timezone,
  now = new Date(),
}: {
  timezone: string
  now?: Date
}) {
  const dateKey = getWorkspaceDateKey(now, timezone)
  return {
    instant: now,
    dateKey,
    calendarDate: dateKeyToCalendarDate(dateKey),
  }
}

function getTimezoneOffsetMs(timezone: string, instant: Date) {
  const parts = getWorkspaceDateParts(instant, timezone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return zonedAsUtc - instant.getTime()
}

export function combineDateAndTimeInTimezone({
  dateKey,
  time,
  timezone,
  milliseconds = 0,
}: {
  dateKey: SchedulingDateKey
  time: string
  timezone: string
  milliseconds?: number
}) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  const [hour, minute] = time.split(':').map(Number)
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    milliseconds,
  )
  const firstGuess = new Date(wallClockAsUtc)
  const firstOffset = getTimezoneOffsetMs(timezone, firstGuess)
  const secondGuess = new Date(wallClockAsUtc - firstOffset)
  const secondOffset = getTimezoneOffsetMs(timezone, secondGuess)
  return new Date(wallClockAsUtc - secondOffset)
}

export function getStartOfWorkspaceDay(
  dateKey: SchedulingDateKey,
  timezone: string,
) {
  return combineDateAndTimeInTimezone({ dateKey, time: '00:00', timezone })
}

export function getEndOfWorkspaceDay(
  dateKey: SchedulingDateKey,
  timezone: string,
) {
  const nextDayStart = getStartOfWorkspaceDay(addDateKeys(dateKey, 1), timezone)
  return new Date(nextDayStart.getTime() - 1)
}

export function formatInWorkspaceTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timezone,
  }).format(typeof date === 'string' ? new Date(date) : date)
}

export function isSameWorkspaceDate(
  first: Date | string,
  second: Date | string,
  timezone: string,
) {
  return (
    getWorkspaceDateKey(first, timezone) ===
    getWorkspaceDateKey(second, timezone)
  )
}

export function isTodayInWorkspace(
  date: Date | string,
  timezone: string,
  now = new Date(),
) {
  return (
    getWorkspaceDateKey(date, timezone) === getWorkspaceDateKey(now, timezone)
  )
}

export function getWorkspaceCalendarPeriod({
  view,
  anchorDate,
  weekStartsOn,
  timezone,
}: {
  view: SchedulingCalendarView
  anchorDate: Date
  weekStartsOn: 0 | 1
  timezone: string
}) {
  const anchorKey = getCalendarDateKey(anchorDate)
  let startKey = anchorKey
  let endKey = anchorKey

  if (view === 'week') {
    startKey = getStartOfWeekDateKey(anchorKey, weekStartsOn)
    endKey = addDateKeys(startKey, 6)
  } else if (view === 'month') {
    const { year, month } = parseSchedulingDateKey(anchorKey)
    const monthStartKey = partsToDateKey(year, month, 1)
    const monthEndDate = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0))
    const monthEndKey = partsToDateKey(
      monthEndDate.getUTCFullYear(),
      monthEndDate.getUTCMonth() + 1,
      monthEndDate.getUTCDate(),
    )
    startKey = getStartOfWeekDateKey(monthStartKey, weekStartsOn)
    endKey = addDateKeys(getStartOfWeekDateKey(monthEndKey, weekStartsOn), 6)
  } else if (view === 'agenda') {
    endKey = addDateKeys(anchorKey, 30)
  }

  return {
    start: dateKeyToCalendarDate(startKey),
    end: dateKeyToCalendarDate(endKey),
    startKey,
    endKey,
    rangeStart: getStartOfWorkspaceDay(startKey, timezone),
    rangeEnd: getEndOfWorkspaceDay(endKey, timezone),
  }
}
