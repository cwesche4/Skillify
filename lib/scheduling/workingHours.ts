import {
  dateKeyToCalendarDate,
  getWorkspaceDateKey,
  parseSchedulingDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type {
  TeamAvailabilityRecord,
  WorkingHoursScheduleMode,
  WorkingHoursScope,
} from '@/lib/scheduling/types'

export type WorkingHoursRecord = Extract<
  TeamAvailabilityRecord,
  { kind: 'workingHours' }
>

export type WorkingHoursEntityOption = {
  id: string
  label: string
  secondary?: string
}

export type WorkingHoursScopeOption = {
  key: WorkingHoursScope
  label: string
  enabled: boolean
  helperText?: string
}

export type EffectiveWorkingHoursResult = {
  source:
    | 'workspace'
    | 'location'
    | 'team'
    | 'member'
    | 'exception'
    | 'timeOff'
    | 'none'
  sourceRecordId?: string
  daysOfWeek?: number[]
  startTime?: string
  endTime?: string
  isAvailable: boolean
  reason?: string
}

const defaultDaysOfWeek = [1, 2, 3, 4, 5]
const locationIdPrefix = 'location:'

export const workingHoursScopeLabels: Record<WorkingHoursScope, string> = {
  workspace: 'Entire business',
  location: 'Location',
  team: 'Team',
  member: 'Member',
}

export function resolveWorkingHoursScopeOptions({
  activeMembers = [],
  activeTeams = [],
  activeLocations = [],
  initialScope,
}: {
  activeMembers?: WorkingHoursEntityOption[]
  activeTeams?: WorkingHoursEntityOption[]
  activeLocations?: WorkingHoursEntityOption[]
  initialScope?: WorkingHoursScope | null
}): WorkingHoursScopeOption[] {
  const options: WorkingHoursScopeOption[] = [
    {
      key: 'workspace',
      label: workingHoursScopeLabels.workspace,
      enabled: true,
    },
  ]

  if (activeLocations.length > 0 || initialScope === 'location') {
    options.push({
      key: 'location',
      label: workingHoursScopeLabels.location,
      enabled: activeLocations.length > 0,
      helperText: activeLocations.length
        ? undefined
        : 'No business locations are available.',
    })
  }

  if (activeTeams.length > 0 || initialScope === 'team') {
    options.push({
      key: 'team',
      label: workingHoursScopeLabels.team,
      enabled: activeTeams.length > 0,
      helperText: activeTeams.length
        ? undefined
        : 'No teams are available. Create a team from Members to configure Team Hours.',
    })
  }

  if (activeMembers.length > 0 || initialScope === 'member') {
    options.push({
      key: 'member',
      label: workingHoursScopeLabels.member,
      enabled: activeMembers.length > 0,
      helperText: activeMembers.length
        ? undefined
        : 'No active members are available.',
    })
  }

  return options
}

export function getLocationStorageId(locationId: string) {
  return `${locationIdPrefix}${locationId}`
}

export function normalizeStoredWorkingHoursScope(record: WorkingHoursRecord): {
  scope: WorkingHoursScope
  locationId?: string | null
  teamId?: string | null
  workspaceMemberId?: string | null
} {
  if (record.scope) {
    return {
      scope: record.scope,
      locationId: record.locationId ?? null,
      teamId: record.teamId ?? null,
      workspaceMemberId: record.workspaceMemberId ?? record.memberId ?? null,
    }
  }
  if (record.teamId?.startsWith(locationIdPrefix)) {
    return {
      scope: 'location',
      locationId: record.teamId.slice(locationIdPrefix.length),
      teamId: null,
      workspaceMemberId: null,
    }
  }
  if (record.teamId) {
    return {
      scope: 'team',
      teamId: record.teamId,
      locationId: null,
      workspaceMemberId: null,
    }
  }
  if (!record.memberId) {
    return {
      scope: 'workspace',
      locationId: null,
      teamId: null,
      workspaceMemberId: null,
    }
  }
  if (record.memberId.startsWith('team-')) {
    return {
      scope: 'team',
      teamId: record.memberId,
      locationId: null,
      workspaceMemberId: null,
    }
  }
  if (record.memberId.startsWith(locationIdPrefix)) {
    return {
      scope: 'location',
      locationId: record.memberId.slice(locationIdPrefix.length),
      teamId: null,
      workspaceMemberId: null,
    }
  }
  return {
    scope: 'member',
    workspaceMemberId: record.workspaceMemberId ?? record.memberId,
    locationId: null,
    teamId: null,
  }
}

export function normalizeWorkingHoursRecord(
  record: WorkingHoursRecord,
): WorkingHoursRecord & {
  scope: WorkingHoursScope
  scheduleMode: WorkingHoursScheduleMode
} {
  const scoped = normalizeStoredWorkingHoursScope(record)
  const entityName =
    scoped.scope === 'workspace'
      ? 'Business Hours'
      : scoped.scope === 'location'
        ? (record.locationName ?? record.memberName ?? 'Location Hours')
        : scoped.scope === 'team'
          ? (record.teamName ?? record.memberName ?? 'Team Hours')
          : (record.memberName ?? 'Member Hours')
  return {
    ...record,
    scope: scoped.scope,
    locationId: scoped.locationId ?? null,
    locationName:
      scoped.scope === 'location'
        ? (record.locationName ?? record.memberName ?? entityName)
        : (record.locationName ?? null),
    teamId: scoped.teamId ?? null,
    teamName:
      scoped.scope === 'team'
        ? (record.teamName ?? record.memberName ?? entityName)
        : (record.teamName ?? null),
    workspaceMemberId: scoped.workspaceMemberId ?? null,
    memberId:
      scoped.scope === 'workspace'
        ? ''
        : scoped.scope === 'location'
          ? getLocationStorageId(scoped.locationId ?? '')
          : scoped.scope === 'team'
            ? (scoped.teamId ?? '')
            : (scoped.workspaceMemberId ?? record.memberId ?? ''),
    memberName: entityName,
    scheduleMode: record.scheduleMode ?? 'custom',
    daysOfWeek: record.daysOfWeek ?? defaultDaysOfWeek,
    startsAt: record.startsAt ?? '09:00',
    endsAt: record.endsAt ?? '17:00',
  }
}

export function getWorkingHoursDisplayName(record: WorkingHoursRecord) {
  const normalized = normalizeWorkingHoursRecord(record)
  if (normalized.scope === 'workspace') return 'Business Hours'
  if (normalized.scope === 'location') {
    return normalized.locationName ?? normalized.memberName ?? 'Location Hours'
  }
  if (normalized.scope === 'team') {
    return normalized.teamName ?? normalized.memberName ?? 'Team Hours'
  }
  return normalized.memberName ?? 'Member Hours'
}

export function getWorkingHoursScopeLabel(scope: WorkingHoursScope) {
  return workingHoursScopeLabels[scope]
}

export function getWorkingHoursScopeSummary(record: WorkingHoursRecord) {
  return getWorkingHoursScopeLabel(normalizeWorkingHoursRecord(record).scope)
}

export function getInheritedWorkingHoursSource({
  record,
  workingHours,
  teamIds = [],
  locationId,
}: {
  record: WorkingHoursRecord
  workingHours: WorkingHoursRecord[]
  teamIds?: string[]
  locationId?: string | null
}) {
  const normalizedRecord = normalizeWorkingHoursRecord(record)
  const candidates = workingHours
    .map(normalizeWorkingHoursRecord)
    .filter(
      (item) =>
        item.id !== normalizedRecord.id &&
        item.scheduleMode !== 'inherit' &&
        item.workspaceId === normalizedRecord.workspaceId,
    )

  if (normalizedRecord.scope === 'member') {
    const team =
      normalizedRecord.teamId || teamIds.length
        ? candidates.find(
            (item) =>
              item.scope === 'team' &&
              [normalizedRecord.teamId, ...teamIds]
                .filter(Boolean)
                .includes(item.teamId ?? ''),
          )
        : null
    if (team) return team
    const location = locationId
      ? candidates.find(
          (item) => item.scope === 'location' && item.locationId === locationId,
        )
      : null
    if (location) return location
    return candidates.find((item) => item.scope === 'workspace') ?? null
  }
  if (
    normalizedRecord.scope === 'team' ||
    normalizedRecord.scope === 'location'
  ) {
    return candidates.find((item) => item.scope === 'workspace') ?? null
  }
  return null
}

function dateMatchesEffectiveRange({
  record,
  date,
}: {
  record: WorkingHoursRecord
  date?: SchedulingDateKey
}) {
  if (!date) return true
  if (record.effectiveFrom && date < record.effectiveFrom.slice(0, 10))
    return false
  if (record.effectiveUntil && date > record.effectiveUntil.slice(0, 10))
    return false
  return true
}

function recordAppliesToContext({
  record,
  workspaceMemberId,
  teamIds,
  locationId,
}: {
  record: WorkingHoursRecord
  workspaceMemberId?: string | null
  teamIds: string[]
  locationId?: string | null
}) {
  const normalized = normalizeWorkingHoursRecord(record)
  if (normalized.scope === 'workspace') return true
  if (normalized.scope === 'location')
    return normalized.locationId === locationId
  if (normalized.scope === 'team')
    return Boolean(normalized.teamId && teamIds.includes(normalized.teamId))
  return normalized.workspaceMemberId === workspaceMemberId
}

function getWeekday(date?: SchedulingDateKey) {
  if (!date) return null
  return dateKeyToCalendarDate(date).getDay()
}

function exceptionAppliesOnDate({
  record,
  date,
}: {
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>
  date: SchedulingDateKey
}) {
  if (record.date === date) return true
  const rule = record.recurrenceRule
  if (!rule || date < record.date) return false
  if (rule.endType === 'onDate' && rule.endDate && date > rule.endDate)
    return false
  const original = parseSchedulingDateKey(record.date)
  const target = parseSchedulingDateKey(date)
  if (rule.frequency === 'weekly') {
    const days = rule.daysOfWeek?.length
      ? rule.daysOfWeek
      : [dateKeyToCalendarDate(record.date).getDay()]
    if (!days.includes(dateKeyToCalendarDate(date).getDay())) return false
    const weeks = Math.floor(
      (dateKeyToCalendarDate(date).getTime() -
        dateKeyToCalendarDate(record.date).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    )
    return weeks % Math.max(1, rule.interval) === 0
  }
  if (rule.frequency === 'monthly') {
    const months =
      (target.year - original.year) * 12 + (target.month - original.month)
    return (
      target.day === original.day &&
      months >= 0 &&
      months % Math.max(1, rule.interval) === 0
    )
  }
  if (rule.frequency === 'yearly') {
    const years = target.year - original.year
    return (
      target.month === original.month &&
      target.day === original.day &&
      years >= 0 &&
      years % Math.max(1, rule.interval) === 0
    )
  }
  const days = Math.floor(
    (dateKeyToCalendarDate(date).getTime() -
      dateKeyToCalendarDate(record.date).getTime()) /
      (24 * 60 * 60 * 1000),
  )
  return days >= 0 && days % Math.max(1, rule.interval) === 0
}

export function resolveEffectiveWorkingHours({
  availability,
  workingHours,
  workspaceId,
  workspaceMemberId,
  teamIds = [],
  locationId,
  date,
  timezone,
}: {
  availability?: TeamAvailabilityRecord[]
  workingHours?: WorkingHoursRecord[]
  workspaceId: string
  workspaceMemberId?: string | null
  teamIds?: string[]
  locationId?: string | null
  date?: SchedulingDateKey | Date | string
  timezone: string
}): EffectiveWorkingHoursResult {
  const dateKey =
    typeof date === 'string'
      ? date.slice(0, 10)
      : date
        ? getWorkspaceDateKey(date, timezone)
        : undefined
  const allAvailability = availability ?? workingHours ?? []
  const normalHours = (workingHours ?? allAvailability)
    .filter(
      (record): record is WorkingHoursRecord =>
        record.kind === 'workingHours' && record.workspaceId === workspaceId,
    )
    .map(normalizeWorkingHoursRecord)
    .filter((record) => dateMatchesEffectiveRange({ record, date: dateKey }))

  if (dateKey) {
    const timeOff = allAvailability.find((record) => {
      if (record.kind !== 'timeOff' || record.workspaceId !== workspaceId)
        return false
      if (
        workspaceMemberId &&
        record.memberId !== workspaceMemberId &&
        !teamIds.includes(record.memberId)
      ) {
        return false
      }
      const starts = getWorkspaceDateKey(record.startsAt, timezone)
      const ends = getWorkspaceDateKey(record.endsAt, timezone)
      return starts <= dateKey && ends >= dateKey
    })
    if (timeOff) {
      return {
        source: 'timeOff',
        sourceRecordId: timeOff.id,
        isAvailable: false,
        reason: `${timeOff.memberName} is unavailable.`,
      }
    }

    const exception = allAvailability
      .filter(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'availabilityException' }
        > => record.kind === 'availabilityException',
      )
      .find((record) => {
        if (
          record.workspaceId !== workspaceId ||
          !exceptionAppliesOnDate({ record, date: dateKey })
        ) {
          return false
        }
        if (record.scope === 'workspace') return true
        if (record.scope === 'team') {
          return Boolean(record.teamId && teamIds.includes(record.teamId))
        }
        return record.memberId === workspaceMemberId
      })
    if (exception) {
      return {
        source: 'exception',
        sourceRecordId: exception.id,
        startTime:
          exception.exceptionType === 'customHours'
            ? exception.startTime
            : undefined,
        endTime:
          exception.exceptionType === 'customHours'
            ? exception.endTime
            : undefined,
        isAvailable:
          exception.exceptionType === 'customHours' && !exception.allDayClosed,
        reason:
          exception.exceptionType === 'customHours'
            ? 'Availability exception custom hours apply.'
            : 'Availability exception closes this date.',
      }
    }
  }

  const priority: WorkingHoursScope[] = [
    'member',
    'team',
    'location',
    'workspace',
  ]
  const source = priority
    .flatMap((scope) =>
      normalHours.filter(
        (record) =>
          record.scope === scope &&
          record.scheduleMode !== 'inherit' &&
          recordAppliesToContext({
            record,
            workspaceMemberId,
            teamIds,
            locationId,
          }),
      ),
    )
    .at(0)

  if (!source) {
    return {
      source: 'none',
      isAvailable: false,
      reason: 'No configured availability.',
    }
  }

  const weekday = getWeekday(dateKey)
  const isAvailable =
    weekday === null ? true : (source.daysOfWeek ?? []).includes(weekday)
  return {
    source: source.scope,
    sourceRecordId: source.id,
    daysOfWeek: source.daysOfWeek,
    startTime: source.startsAt,
    endTime: source.endsAt,
    isAvailable,
    reason: isAvailable ? undefined : 'Outside configured working days.',
  }
}
