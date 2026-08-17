import {
  addDateKeys,
  addMonthsToDateKey,
  combineDateAndTimeInTimezone,
  getDateKeyWeekday,
  getWorkspaceDateKey,
  getWorkspaceTimeInputValue,
  isSchedulingDateKey,
  parseSchedulingDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type { SchedulingRecurrenceRule } from '@/lib/scheduling/types'

export const RECURRENCE_MATERIALIZATION_DAYS_AHEAD = 90
export const RECURRENCE_MATERIALIZATION_DAYS_BEHIND = 30
export const RECURRENCE_MAX_OCCURRENCES_PER_WINDOW = 500

const weekdayRruleValues = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const weekdayLabels = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export type NormalizedSchedulingRecurrence = {
  rule: SchedulingRecurrenceRule
  rrule: string
  summary: string
  localStartDate: SchedulingDateKey
  localStartTime: string
  timezone: string
  durationMinutes: number
  untilUtc?: Date
  occurrenceCount?: number
}

export type SchedulingMaterializedOccurrenceInput = {
  originalStartsAtUtc: Date
  startsAtUtc: Date
  endsAtUtc: Date
  localDate: SchedulingDateKey
  localTime: string
  index: number
}

function assertSupportedTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error('Choose a supported IANA timezone.')
  }
}

function assertTimeInput(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Enter a valid recurrence start time.')
  }
}

function normalizeDaysOfWeek(value?: number[]) {
  if (!value?.length) return undefined
  const days = [...new Set(value)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((first, second) => first - second)
  return days.length ? days : undefined
}

function getFrequencyLabel(rule: SchedulingRecurrenceRule) {
  if (rule.frequency === 'daily') return 'day'
  if (rule.frequency === 'weekly') return 'week'
  if (rule.frequency === 'monthly') return 'month'
  return 'year'
}

export function formatRecurrenceSummary(rule: SchedulingRecurrenceRule) {
  const interval = Math.max(1, rule.interval)
  const unit = getFrequencyLabel(rule)
  const cadence =
    interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
  const weekdaySummary =
    rule.frequency === 'weekly' && rule.daysOfWeek?.length
      ? ` on ${rule.daysOfWeek.map((day) => weekdayLabels[day]).join(', ')}`
      : ''
  if (rule.endType === 'onDate' && rule.endDate) {
    return `${cadence}${weekdaySummary} until ${rule.endDate}`
  }
  if (rule.endType === 'afterOccurrences' && rule.occurrenceCount) {
    return `${cadence}${weekdaySummary} for ${rule.occurrenceCount} occurrences`
  }
  return `${cadence}${weekdaySummary}`
}

function getFrequencyRruleValue(rule: SchedulingRecurrenceRule) {
  if (rule.frequency === 'daily') return 'DAILY'
  if (rule.frequency === 'weekly') return 'WEEKLY'
  if (rule.frequency === 'monthly') return 'MONTHLY'
  return 'YEARLY'
}

function formatUntilForRrule(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export function buildRecurrenceRrule({
  rule,
  untilUtc,
}: {
  rule: SchedulingRecurrenceRule
  untilUtc?: Date
}) {
  const parts = [
    `FREQ=${getFrequencyRruleValue(rule)}`,
    `INTERVAL=${Math.max(1, rule.interval)}`,
  ]
  if (rule.frequency === 'weekly' && rule.daysOfWeek?.length) {
    parts.push(
      `BYDAY=${rule.daysOfWeek.map((day) => weekdayRruleValues[day]).join(',')}`,
    )
  }
  if (rule.endType === 'afterOccurrences' && rule.occurrenceCount) {
    parts.push(`COUNT=${rule.occurrenceCount}`)
  } else if (untilUtc) {
    parts.push(`UNTIL=${formatUntilForRrule(untilUtc)}`)
  }
  return parts.join(';')
}

export function normalizeSchedulingRecurrenceRule({
  rule,
  startsAt,
  endsAt,
  timezone,
}: {
  rule: SchedulingRecurrenceRule
  startsAt: Date | string
  endsAt: Date | string
  timezone: string
}): NormalizedSchedulingRecurrence {
  assertSupportedTimezone(timezone)
  const startInstant =
    typeof startsAt === 'string' ? new Date(startsAt) : startsAt
  const endInstant = typeof endsAt === 'string' ? new Date(endsAt) : endsAt
  if (
    Number.isNaN(startInstant.getTime()) ||
    Number.isNaN(endInstant.getTime())
  ) {
    throw new Error('Enter valid recurrence start and end times.')
  }
  const durationMinutes = Math.round(
    (endInstant.getTime() - startInstant.getTime()) / 60_000,
  )
  if (durationMinutes <= 0) {
    throw new Error('Recurring events must have a duration greater than zero.')
  }

  const localStartDate = getWorkspaceDateKey(startInstant, timezone)
  const localStartTime = getWorkspaceTimeInputValue(startInstant, timezone)
  assertTimeInput(localStartTime)

  const interval = Math.max(1, Number(rule.interval) || 1)
  const normalizedRule: SchedulingRecurrenceRule = {
    frequency: rule.frequency,
    interval,
    daysOfWeek:
      rule.frequency === 'weekly'
        ? (normalizeDaysOfWeek(rule.daysOfWeek) ?? [
            getDateKeyWeekday(localStartDate),
          ])
        : undefined,
    endType: rule.endType ?? 'never',
  }

  if (
    normalizedRule.frequency !== 'daily' &&
    normalizedRule.frequency !== 'weekly' &&
    normalizedRule.frequency !== 'monthly' &&
    normalizedRule.frequency !== 'yearly'
  ) {
    throw new Error('Choose a supported recurrence frequency.')
  }

  let untilUtc: Date | undefined
  if (normalizedRule.endType === 'onDate') {
    if (!rule.endDate || !isSchedulingDateKey(rule.endDate)) {
      throw new Error('Choose a valid recurrence end date.')
    }
    normalizedRule.endDate = rule.endDate
    untilUtc = combineDateAndTimeInTimezone({
      dateKey: rule.endDate,
      time: '23:59',
      timezone,
      milliseconds: 999,
    })
  } else if (normalizedRule.endType === 'afterOccurrences') {
    const occurrenceCount = Number(rule.occurrenceCount)
    if (!Number.isInteger(occurrenceCount) || occurrenceCount < 1) {
      throw new Error('Enter a valid number of recurrence occurrences.')
    }
    normalizedRule.occurrenceCount = occurrenceCount
  } else {
    normalizedRule.endType = 'never'
  }

  return {
    rule: normalizedRule,
    rrule: buildRecurrenceRrule({ rule: normalizedRule, untilUtc }),
    summary: formatRecurrenceSummary(normalizedRule),
    localStartDate,
    localStartTime,
    timezone,
    durationMinutes,
    untilUtc,
    occurrenceCount: normalizedRule.occurrenceCount,
  }
}

function compareDateKeys(first: SchedulingDateKey, second: SchedulingDateKey) {
  return first < second ? -1 : first > second ? 1 : 0
}

function monthDayClamped(dateKey: SchedulingDateKey, monthsToAdd: number) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  const targetFirst = addMonthsToDateKey(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`,
    monthsToAdd,
  )
  const target = parseSchedulingDateKey(targetFirst)
  const lastDay = new Date(
    Date.UTC(target.year, target.month, 0, 12),
  ).getUTCDate()
  return `${String(target.year).padStart(4, '0')}-${String(target.month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function addYearsClamped(dateKey: SchedulingDateKey, yearsToAdd: number) {
  const { year, month, day } = parseSchedulingDateKey(dateKey)
  const lastDay = new Date(
    Date.UTC(year + yearsToAdd, month, 0, 12),
  ).getUTCDate()
  return `${String(year + yearsToAdd).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function isWeeklyDateAllowed({
  dateKey,
  startKey,
  rule,
}: {
  dateKey: SchedulingDateKey
  startKey: SchedulingDateKey
  rule: SchedulingRecurrenceRule
}) {
  const days = rule.daysOfWeek?.length
    ? rule.daysOfWeek
    : [getDateKeyWeekday(startKey)]
  if (!days.includes(getDateKeyWeekday(dateKey))) return false
  const daysBetween =
    (Date.UTC(
      parseSchedulingDateKey(dateKey).year,
      parseSchedulingDateKey(dateKey).month - 1,
      parseSchedulingDateKey(dateKey).day,
    ) -
      Date.UTC(
        parseSchedulingDateKey(startKey).year,
        parseSchedulingDateKey(startKey).month - 1,
        parseSchedulingDateKey(startKey).day,
      )) /
    86_400_000
  const weeksBetween = Math.floor(daysBetween / 7)
  return weeksBetween % Math.max(1, rule.interval) === 0
}

export function generateRecurrenceOccurrences({
  recurrence,
  rangeStart,
  rangeEnd,
}: {
  recurrence: NormalizedSchedulingRecurrence
  rangeStart: Date
  rangeEnd: Date
}): SchedulingMaterializedOccurrenceInput[] {
  const { rule, localStartDate, localStartTime, timezone, durationMinutes } =
    recurrence
  const rangeStartKey = getWorkspaceDateKey(rangeStart, timezone)
  const rangeEndKey = getWorkspaceDateKey(rangeEnd, timezone)
  const occurrences: SchedulingMaterializedOccurrenceInput[] = []
  let candidateDate = localStartDate
  let generatedMatches = 0
  let iteration = 0

  while (
    occurrences.length < RECURRENCE_MAX_OCCURRENCES_PER_WINDOW &&
    iteration < RECURRENCE_MAX_OCCURRENCES_PER_WINDOW * 8
  ) {
    iteration += 1
    if (recurrence.untilUtc) {
      const candidateEndOfDay = combineDateAndTimeInTimezone({
        dateKey: candidateDate,
        time: '23:59',
        timezone,
        milliseconds: 999,
      })
      if (candidateEndOfDay.getTime() > recurrence.untilUtc.getTime()) break
    }

    const isMatch =
      rule.frequency === 'weekly'
        ? isWeeklyDateAllowed({
            dateKey: candidateDate,
            startKey: localStartDate,
            rule,
          })
        : true

    if (isMatch) {
      generatedMatches += 1
      const occurrenceCountReached =
        rule.endType === 'afterOccurrences' &&
        rule.occurrenceCount !== undefined &&
        generatedMatches > rule.occurrenceCount
      if (occurrenceCountReached) break

      if (compareDateKeys(candidateDate, rangeEndKey) > 0) break
      if (compareDateKeys(candidateDate, rangeStartKey) >= 0) {
        const startsAtUtc = combineDateAndTimeInTimezone({
          dateKey: candidateDate,
          time: localStartTime,
          timezone,
        })
        const endsAtUtc = new Date(
          startsAtUtc.getTime() + durationMinutes * 60_000,
        )
        if (startsAtUtc <= rangeEnd && endsAtUtc >= rangeStart) {
          occurrences.push({
            originalStartsAtUtc: startsAtUtc,
            startsAtUtc,
            endsAtUtc,
            localDate: candidateDate,
            localTime: localStartTime,
            index: generatedMatches - 1,
          })
        }
      }
    }

    if (rule.frequency === 'daily') {
      candidateDate = addDateKeys(candidateDate, Math.max(1, rule.interval))
    } else if (rule.frequency === 'weekly') {
      candidateDate = addDateKeys(candidateDate, 1)
    } else if (rule.frequency === 'monthly') {
      candidateDate = monthDayClamped(
        localStartDate,
        generatedMatches > 0
          ? generatedMatches * Math.max(1, rule.interval)
          : Math.max(1, rule.interval),
      )
    } else {
      candidateDate = addYearsClamped(
        localStartDate,
        generatedMatches > 0
          ? generatedMatches * Math.max(1, rule.interval)
          : Math.max(1, rule.interval),
      )
    }
  }

  return occurrences
}
