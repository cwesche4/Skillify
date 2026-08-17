import { getSchedulingOccurrencesForRange } from '@/lib/scheduling/schedulingCalendar'
import {
  SCHEDULING_EVENT_TYPES,
  getSchedulingEventTypeDefinition,
  type SchedulingEventTypeDefinition,
} from '@/lib/scheduling/schedulingPresetRegistry'
import {
  addDateKeys,
  combineDateAndTimeInTimezone,
  getDateKeyWeekday,
  getEndOfWorkspaceDay,
  getStartOfWorkspaceDay,
  getWorkspaceDateKey,
  getWorkspaceNow,
  parseSchedulingDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import { resolveEffectiveWorkingHours } from '@/lib/scheduling/workingHours'
import type {
  CalendarConnectionStatus,
  CalendarProvider,
  ExternalCalendarConnection,
  SchedulingCapabilities,
  SchedulingEvent,
  SchedulingEventStatus,
  SchedulingEventType,
  SchedulingOccurrence,
  SchedulingSectionKey,
  SchedulingSeries,
  TeamAvailabilityRecord,
  WorkspaceSchedulingCustomEventType,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export type SchedulingKnowledgeIntent =
  | 'findBestMember'
  | 'findBestTeam'
  | 'findAvailableSlot'
  | 'findRecurringSlot'
  | 'explainSchedulingConflict'
  | 'explainAssignment'
  | 'explainUnavailable'
  | 'explainRecommendationChange'
  | 'rescheduleAppointment'
  | 'assignEvent'
  | 'balanceWorkload'

export type SchedulingKnowledgeCapabilityKey =
  | 'supportsAvailability'
  | 'supportsRecommendation'
  | 'supportsExplanation'
  | 'supportsRecurring'
  | 'supportsConflictAnalysis'
  | 'supportsProviderHealth'
  | 'supportsWorkload'
  | 'supportsSnapshots'

export type SchedulingKnowledgeCapability = {
  key: SchedulingKnowledgeCapabilityKey
  label: string
  supported: boolean
  source: 'events' | 'availability' | 'recurrence' | 'providers' | 'settings'
}

export const schedulingKnowledgeCapabilityRegistry: SchedulingKnowledgeCapability[] =
  [
    {
      key: 'supportsAvailability',
      label: 'Availability queries',
      supported: true,
      source: 'availability',
    },
    {
      key: 'supportsRecommendation',
      label: 'Deterministic recommendations',
      supported: true,
      source: 'events',
    },
    {
      key: 'supportsExplanation',
      label: 'Structured explanations',
      supported: true,
      source: 'events',
    },
    {
      key: 'supportsRecurring',
      label: 'Recurring schedule awareness',
      supported: true,
      source: 'recurrence',
    },
    {
      key: 'supportsConflictAnalysis',
      label: 'Conflict analysis',
      supported: true,
      source: 'events',
    },
    {
      key: 'supportsProviderHealth',
      label: 'Calendar provider health',
      supported: true,
      source: 'providers',
    },
    {
      key: 'supportsWorkload',
      label: 'Workload summaries',
      supported: true,
      source: 'events',
    },
    {
      key: 'supportsSnapshots',
      label: 'Deterministic scheduling snapshots',
      supported: true,
      source: 'settings',
    },
  ]

export type SchedulingKnowledgeMember = {
  id: string
  label: string
  role?: string
  status?: string
  teamIds?: string[]
  locationId?: string | null
}

export type SchedulingKnowledgeTeam = {
  id: string
  label: string
  memberIds: string[]
  status?: string
}

export type SchedulingKnowledgeLocation = {
  id: string
  label: string
  status?: string
}

export type SchedulingExternalAvailabilitySignal = {
  id: string
  workspaceId: string
  workspaceMemberId: string
  connectionId?: string
  provider?: CalendarProvider | string
  startsAtUtc: string
  endsAtUtc: string
  effect: 'suggestion' | 'blocking'
  displayLabel?: string
}

export type SchedulingKnowledgeActor = {
  workspaceMemberId?: string
  role?: string
  canViewAllScheduling?: boolean
  visibleMemberIds?: string[]
  visibleTeamIds?: string[]
  visibleLocationIds?: string[]
}

export type SchedulingProviderHealthSnapshot = {
  provider: CalendarProvider | string
  status: CalendarConnectionStatus | 'available' | 'unavailable' | 'error'
  connectionId?: string
  label?: string
  lastSyncedAt?: string
  warnings: string[]
}

export type SchedulingKnowledgeInput = {
  workspace: {
    id: string
    slug?: string
    name?: string
    timezone?: string
  }
  settings: WorkspaceSchedulingSettings
  capabilities?: SchedulingCapabilities
  now?: Date
  actor?: SchedulingKnowledgeActor
  members?: SchedulingKnowledgeMember[]
  teams?: SchedulingKnowledgeTeam[]
  locations?: SchedulingKnowledgeLocation[]
  events?: SchedulingEvent[]
  availability?: TeamAvailabilityRecord[]
  recurringSeries?: SchedulingSeries[]
  externalAvailability?: SchedulingExternalAvailabilitySignal[]
  calendarConnections?: ExternalCalendarConnection[]
}

export type SchedulingExplanationReason = {
  code:
    | 'available'
    | 'working-hours'
    | 'no-conflicts'
    | 'same-location'
    | 'low-workload'
    | 'existing-assignment'
    | 'supports-section'
    | 'recurring-supported'
  label: string
  source: 'workingHours' | 'events' | 'availability' | 'location' | 'registry'
}

export type SchedulingExplanationWarning = {
  code:
    | 'outside-working-hours'
    | 'busy-conflict'
    | 'time-off'
    | 'availability-exception'
    | 'external-availability-conflict'
    | 'overloaded'
    | 'location-mismatch'
    | 'unsupported-section'
    | 'no-assignment'
  label: string
  source:
    | 'workingHours'
    | 'events'
    | 'availability'
    | 'externalAvailability'
    | 'location'
    | 'registry'
  severity: 'info' | 'warning' | 'blocking'
  constraint?: string
  startsAt?: string
  endsAt?: string
  overlap?: string
  whyItMatters?: string
}

export type SchedulingRecommendationConfidence = 'low' | 'medium' | 'high'

export type SchedulingRecommendationCandidate = {
  candidateId: string
  candidateType: 'member' | 'team' | 'location' | 'timeSlot'
  label: string
  /**
   * Deterministic recommendation score on an inclusive 0-100 scale.
   * Confidence is a separate coarse label derived from this score.
   */
  score: number
  confidence: SchedulingRecommendationConfidence
  reasons: SchedulingExplanationReason[]
  warnings: SchedulingExplanationWarning[]
  metadata?: Record<string, unknown>
}

export type SchedulingConflict = {
  id: string
  conflictType:
    | 'busy'
    | 'timeOff'
    | 'availabilityException'
    | 'externalAvailability'
    | 'outsideWorkingHours'
  memberId?: string
  teamId?: string
  sourceId: string
  sourceLabel: string
  startsAt?: string
  endsAt?: string
  severity: 'info' | 'warning' | 'blocking'
  category?:
    | 'eventOverlap'
    | 'timeOffOverlap'
    | 'workingHoursViolation'
    | 'externalBusyOverlap'
    | 'recurrenceCollision'
    | 'assignmentConflict'
    | 'teamClosureConflict'
    | 'informationalAvailabilityBlock'
    | 'duplicateIndicator'
  blocking?: boolean
}

export type SchedulingWorkloadSummary = {
  assigneeId: string
  assigneeType: 'member' | 'team'
  label: string
  eventCount: number
  busyMinutes: number
  inProgressCount: number
  upcomingCount: number
  overloaded: boolean
}

export function normalizeSchedulingConflictFindings(
  conflicts: SchedulingConflict[],
) {
  const byId = new Map<string, SchedulingConflict>()
  for (const conflict of conflicts) {
    const normalized = normalizeSchedulingConflictFinding(conflict)
    byId.set(normalized.id, normalized)
  }
  return [...byId.values()].sort(
    (first, second) =>
      Number(second.blocking) - Number(first.blocking) ||
      (first.startsAt ?? '').localeCompare(second.startsAt ?? '') ||
      first.id.localeCompare(second.id),
  )
}

function normalizeSchedulingConflictFinding(
  conflict: SchedulingConflict,
): SchedulingConflict {
  if (conflict.conflictType === 'busy') {
    return {
      ...conflict,
      category: 'eventOverlap',
      blocking: conflict.severity === 'blocking',
    }
  }
  if (conflict.conflictType === 'outsideWorkingHours') {
    return {
      ...conflict,
      category: 'workingHoursViolation',
      blocking: conflict.severity === 'blocking',
    }
  }
  if (conflict.conflictType === 'externalAvailability') {
    return {
      ...conflict,
      category: 'informationalAvailabilityBlock',
      blocking: false,
      severity:
        conflict.severity === 'blocking' ? 'warning' : conflict.severity,
    }
  }
  if (conflict.conflictType === 'availabilityException') {
    return {
      ...conflict,
      category: 'informationalAvailabilityBlock',
      blocking: false,
      severity:
        conflict.severity === 'blocking' ? 'warning' : conflict.severity,
    }
  }
  return {
    ...conflict,
    category: 'informationalAvailabilityBlock',
    blocking: false,
    severity: conflict.severity === 'blocking' ? 'warning' : conflict.severity,
  }
}

export type SchedulingAvailabilitySummary = {
  assigneeId: string
  assigneeType: 'member' | 'team' | 'location'
  label: string
  rangeStart: string
  rangeEnd: string
  isAvailable: boolean
  workingHoursSource?: string
  conflicts: SchedulingConflict[]
  warnings: SchedulingExplanationWarning[]
}

export type SchedulingContext = {
  workspace: {
    id: string
    slug?: string
    name?: string
    timezone: string
  }
  now: {
    instant: string
    dateKey: SchedulingDateKey
  }
  settings: WorkspaceSchedulingSettings
  capabilities?: SchedulingCapabilities
  policies: {
    weekStartsOn: 0 | 1
    visibleSections: SchedulingSectionKey[]
    calendarConnectionPolicy: WorkspaceSchedulingSettings['calendarConnectionPolicy']
  }
  members: SchedulingKnowledgeMember[]
  teams: SchedulingKnowledgeTeam[]
  locations: SchedulingKnowledgeLocation[]
  eventTypes: ResolvedSchedulingKnowledgeEventType[]
  workingHours: Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>[]
  timeOff: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>[]
  availabilityExceptions: Extract<
    TeamAvailabilityRecord,
    { kind: 'availabilityException' }
  >[]
  events: SchedulingEvent[]
  recurringSeries: SchedulingSeries[]
  externalAvailability: SchedulingExternalAvailabilitySignal[]
  providerHealth: SchedulingProviderHealthSnapshot[]
}

export type SchedulingSnapshot = {
  id: string
  createdAt: string
  workspaceId: string
  timezone: string
  currentDateKey: SchedulingDateKey
  range: {
    start: string
    end: string
  }
  counts: {
    members: number
    teams: number
    locations: number
    events: number
    recurringSeries: number
    workingHours: number
    timeOff: number
    availabilityExceptions: number
    externalAvailabilitySignals: number
    conflicts: number
  }
  providerHealth: SchedulingProviderHealthSnapshot[]
  workload: SchedulingWorkloadSummary[]
  conflicts: SchedulingConflict[]
  readiness: SchedulingReadiness
  fingerprint: string
}

export type SchedulingReadiness = {
  ready: boolean
  warnings: SchedulingExplanationWarning[]
  capabilities: SchedulingKnowledgeCapability[]
}

export type ResolvedSchedulingKnowledgeEventType = Omit<
  SchedulingEventTypeDefinition,
  'key'
> & {
  key: SchedulingEventType | string
  isSystem: boolean
  isVisible: boolean
  isActive: boolean
  sortOrder: number
  supportedLinkedRecordTypes?: string[]
  customType?: WorkspaceSchedulingCustomEventType
}

function activeStatus(status?: string) {
  const normalized = status?.toLowerCase()
  return (
    normalized !== 'inactive' &&
    normalized !== 'removed' &&
    normalized !== 'archived' &&
    normalized !== 'deleted'
  )
}

function roleCanViewAll(role?: string) {
  const normalized = role?.toUpperCase()
  return (
    normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'MANAGER'
  )
}

function normalizeDate(value: Date | string) {
  return typeof value === 'string' ? new Date(value) : value
}

function overlaps(
  start: Date | string,
  end: Date | string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const startMs = normalizeDate(start).getTime()
  const endMs = normalizeDate(end).getTime()
  return (
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    endMs > rangeStart.getTime() &&
    startMs < rangeEnd.getTime()
  )
}

function getAvailabilityExceptionOverlapWindow({
  record,
  rangeStart,
  rangeEnd,
  timezone,
}: {
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>
  rangeStart: Date
  rangeEnd: Date
  timezone: string
}) {
  const startKey = getWorkspaceDateKey(rangeStart, timezone)
  const endKey = getWorkspaceDateKey(rangeEnd, timezone)
  let candidateKey = startKey < record.date ? record.date : startKey
  let iterations = 0

  while (candidateKey <= endKey && iterations < 370) {
    iterations += 1
    if (availabilityExceptionOccursOn(record, candidateKey)) {
      const window = getAvailabilityExceptionWindow(
        record,
        candidateKey,
        timezone,
      )
      if (overlaps(window.startsAt, window.endsAt, rangeStart, rangeEnd)) {
        return { dateKey: candidateKey, ...window }
      }
    }
    candidateKey = addDateKeys(candidateKey, 1)
  }

  return null
}

function getAvailabilityExceptionWindow(
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>,
  dateKey: SchedulingDateKey,
  timezone: string,
) {
  if (record.allDayClosed || !record.startTime || !record.endTime) {
    return {
      startsAt: getStartOfWorkspaceDay(dateKey, timezone),
      endsAt: getEndOfWorkspaceDay(dateKey, timezone),
    }
  }
  const startsAt = combineDateAndTimeInTimezone({
    dateKey,
    time: record.startTime,
    timezone,
  })
  let endsAt = combineDateAndTimeInTimezone({
    dateKey,
    time: record.endTime,
    timezone,
  })
  if (endsAt <= startsAt) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000)
  }
  return { startsAt, endsAt }
}

function availabilityExceptionOccursOn(
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>,
  dateKey: SchedulingDateKey,
) {
  if (dateKey < record.date) return false
  const rule = record.recurrenceRule
  if (!rule) return dateKey === record.date
  if (rule.endType === 'onDate' && rule.endDate && dateKey > rule.endDate)
    return false
  if (
    rule.endType === 'afterOccurrences' &&
    rule.occurrenceCount !== undefined
  ) {
    const occurrenceIndex = countAvailabilityExceptionOccurrencesThrough(
      record,
      dateKey,
    )
    if (occurrenceIndex > rule.occurrenceCount) return false
  }

  const candidate = parseSchedulingDateKey(dateKey)
  const start = parseSchedulingDateKey(record.date)
  const interval = Math.max(1, rule.interval)

  if (rule.frequency === 'daily') {
    return dateKeyDiffDays(record.date, dateKey) % interval === 0
  }
  if (rule.frequency === 'weekly') {
    const allowedDays = rule.daysOfWeek?.length
      ? rule.daysOfWeek
      : [getDateKeyWeekday(record.date)]
    if (!allowedDays.includes(getDateKeyWeekday(dateKey))) return false
    return (
      Math.floor(dateKeyDiffDays(record.date, dateKey) / 7) % interval === 0
    )
  }
  if (rule.frequency === 'monthly') {
    const months =
      (candidate.year - start.year) * 12 + candidate.month - start.month
    return candidate.day === start.day && months >= 0 && months % interval === 0
  }
  const years = candidate.year - start.year
  return (
    candidate.month === start.month &&
    candidate.day === start.day &&
    years >= 0 &&
    years % interval === 0
  )
}

function countAvailabilityExceptionOccurrencesThrough(
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>,
  dateKey: SchedulingDateKey,
) {
  let cursor = record.date
  let count = 0
  let iterations = 0
  while (cursor <= dateKey && iterations < 3700) {
    iterations += 1
    const rule = record.recurrenceRule
    if (!rule) return cursor === dateKey ? 1 : 0
    const endType = rule.endType
    const endDate = rule.endDate
    const boundedRecord = {
      ...record,
      recurrenceRule: {
        ...rule,
        endType: 'never' as const,
        endDate: undefined,
        occurrenceCount: undefined,
      },
    }
    if (endType === 'onDate' && endDate && cursor > endDate) break
    if (availabilityExceptionOccursOn(boundedRecord, cursor)) count += 1
    cursor = addDateKeys(cursor, 1)
  }
  return count
}

function dateKeyDiffDays(
  startKey: SchedulingDateKey,
  endKey: SchedulingDateKey,
) {
  const start = parseSchedulingDateKey(startKey)
  const end = parseSchedulingDateKey(endKey)
  return Math.floor(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      86_400_000,
  )
}

function minutesBetween(start: Date | string, end: Date | string) {
  const startMs = normalizeDate(start).getTime()
  const endMs = normalizeDate(end).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  return Math.max(0, Math.round((endMs - startMs) / 60000))
}

function confidenceForScore(score: number): SchedulingRecommendationConfidence {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

function deterministicFingerprint(value: unknown) {
  return JSON.stringify(value, (_key, child) => {
    if (!child || typeof child !== 'object' || Array.isArray(child))
      return child
    return Object.keys(child as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((next, key) => {
        next[key] = (child as Record<string, unknown>)[key]
        return next
      }, {})
  })
}

function eventAssignmentMatches({
  event,
  memberId,
  teamIds = [],
}: {
  event: SchedulingEvent
  memberId?: string
  teamIds?: string[]
}) {
  if (memberId && event.assignedMemberIds.includes(memberId)) return true
  return teamIds.some((teamId) => event.assignedMemberIds.includes(teamId))
}

function getMemberTeamIds(
  member: SchedulingKnowledgeMember,
  teams: SchedulingKnowledgeTeam[],
) {
  const configured = member.teamIds ?? []
  const reverse = teams
    .filter((team) => team.memberIds.includes(member.id))
    .map((team) => team.id)
  return [...new Set([...configured, ...reverse])]
}

function resolveSchedulingKnowledgeEventType(
  type: SchedulingEventType | string,
  settings: WorkspaceSchedulingSettings,
): ResolvedSchedulingKnowledgeEventType {
  const customType = (settings.customEventTypes ?? []).find(
    (item) => item.key === type,
  )
  if (customType) {
    return {
      key: customType.key,
      label: customType.label,
      description: customType.description ?? 'Workspace custom event type.',
      sections: customType.sectionKeys,
      defaultDurationMinutes: customType.defaultDurationMinutes,
      blocksAvailability: customType.blocksAvailability,
      requiresAssignment: customType.blocksAvailability,
      requiresLinkedRecord:
        customType.linkedRecordRequirement === 'required' ||
        customType.requiresLinkedRecord,
      linkedRecordRequirement:
        customType.linkedRecordRequirement ??
        (customType.requiresLinkedRecord ? 'required' : 'optional'),
      warnWhenUnlinked: customType.warnWhenUnlinked,
      locationRequirement: customType.locationRequirement,
      allowedLocationTypes: customType.allowedLocationTypes,
      defaultLocationType: customType.defaultLocationType,
      allowUndeterminedLocation: customType.allowUndeterminedLocation,
      requiredForCreation: false,
      isSystem: false,
      isVisible: customType.isActive,
      isActive: customType.isActive,
      sortOrder: customType.sortOrder,
      supportedLinkedRecordTypes: customType.supportedLinkedRecordTypes,
      customType,
    }
  }
  const definition = getSchedulingEventTypeDefinition(type)
  const preference = (settings.eventTypePreferences ?? []).find(
    (item) => item.key === definition.key,
  )
  return {
    ...definition,
    defaultDurationMinutes:
      preference?.defaultDurationMinutes ?? definition.defaultDurationMinutes,
    blocksAvailability: definition.blocksAvailability !== false,
    isSystem: true,
    isVisible: preference?.isVisible !== false,
    isActive: preference?.isVisible !== false,
    sortOrder: preference?.sortOrder ?? 0,
  }
}

function getResolvedSchedulingKnowledgeEventTypes(
  settings: WorkspaceSchedulingSettings,
): ResolvedSchedulingKnowledgeEventType[] {
  const systemTypes = (
    Object.keys(SCHEDULING_EVENT_TYPES) as SchedulingEventType[]
  ).map((type) => resolveSchedulingKnowledgeEventType(type, settings))
  const customTypes = (settings.customEventTypes ?? []).map((type) =>
    resolveSchedulingKnowledgeEventType(type.key, settings),
  )
  return [...systemTypes, ...customTypes].sort((first, second) => {
    if (first.isSystem !== second.isSystem) return first.isSystem ? -1 : 1
    return (
      first.sortOrder - second.sortOrder ||
      first.label.localeCompare(second.label)
    )
  })
}

function providerHealthFromConnections(
  connections: ExternalCalendarConnection[] = [],
): SchedulingProviderHealthSnapshot[] {
  return connections
    .map((connection) => ({
      provider: connection.provider,
      status: connection.status,
      connectionId: connection.id,
      lastSyncedAt: connection.lastSyncedAt,
      warnings:
        connection.status === 'error'
          ? ['Calendar connection is in an error state.']
          : connection.status === 'notConnected'
            ? ['Calendar connection is not connected.']
            : [],
    }))
    .sort((first, second) =>
      `${first.provider}:${first.connectionId ?? ''}`.localeCompare(
        `${second.provider}:${second.connectionId ?? ''}`,
      ),
    )
}

function permissionFilter(input: SchedulingKnowledgeInput) {
  const actor = input.actor
  const canViewAll =
    actor?.canViewAllScheduling === true || roleCanViewAll(actor?.role)
  const members = (input.members ?? [])
    .filter((member) => activeStatus(member.status))
    .filter(
      (member) =>
        canViewAll ||
        member.id === actor?.workspaceMemberId ||
        (actor?.visibleMemberIds ?? []).includes(member.id),
    )
    .sort((first, second) => first.label.localeCompare(second.label))
  const visibleMemberIds = new Set(members.map((member) => member.id))
  const explicitTeamIds = new Set(actor?.visibleTeamIds ?? [])
  const teams = (input.teams ?? [])
    .filter((team) => activeStatus(team.status))
    .filter(
      (team) =>
        canViewAll ||
        explicitTeamIds.has(team.id) ||
        team.memberIds.some((memberId) => visibleMemberIds.has(memberId)),
    )
    .sort((first, second) => first.label.localeCompare(second.label))
  const visibleTeamIds = new Set(teams.map((team) => team.id))
  const locations = (input.locations ?? [])
    .filter((location) => activeStatus(location.status))
    .filter(
      (location) =>
        canViewAll ||
        !actor?.visibleLocationIds?.length ||
        actor.visibleLocationIds.includes(location.id),
    )
    .sort((first, second) => first.label.localeCompare(second.label))
  const visibleLocationIds = new Set(locations.map((location) => location.id))
  const events = (input.events ?? [])
    .filter((event) => event.workspaceId === input.workspace.id)
    .filter(
      (event) =>
        canViewAll ||
        event.assignedMemberIds.some(
          (id) => visibleMemberIds.has(id) || visibleTeamIds.has(id),
        ),
    )
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt))
  const availability = (input.availability ?? [])
    .filter((record) => record.workspaceId === input.workspace.id)
    .filter((record) => {
      if (canViewAll) return true
      if (record.kind === 'workingHours') {
        if (
          !record.memberId &&
          !record.workspaceMemberId &&
          !record.teamId &&
          !record.locationId
        )
          return true
        return Boolean(
          (record.workspaceMemberId &&
            visibleMemberIds.has(record.workspaceMemberId)) ||
          (record.memberId &&
            (visibleMemberIds.has(record.memberId) ||
              visibleTeamIds.has(record.memberId))) ||
          (record.teamId && visibleTeamIds.has(record.teamId)) ||
          (record.locationId && visibleLocationIds.has(record.locationId)),
        )
      }
      if (record.kind === 'availabilityException') {
        return Boolean(
          record.scope === 'workspace' ||
          (record.memberId && visibleMemberIds.has(record.memberId)) ||
          (record.teamId && visibleTeamIds.has(record.teamId)),
        )
      }
      return Boolean(
        visibleMemberIds.has(record.memberId) ||
        visibleTeamIds.has(record.memberId),
      )
    })
  const externalAvailability = (input.externalAvailability ?? [])
    .filter((signal) => signal.workspaceId === input.workspace.id)
    .filter(
      (signal) => canViewAll || visibleMemberIds.has(signal.workspaceMemberId),
    )

  return {
    canViewAll,
    members,
    teams,
    locations,
    events,
    availability,
    externalAvailability,
  }
}

function sourceEventForOccurrence(
  occurrence: SchedulingOccurrence,
  events: SchedulingEvent[],
) {
  return (
    events.find((event) => event.id === occurrence.sourceEventId) ?? occurrence
  )
}

function getBusyAvailabilityIntervals({
  events,
  settings,
  rangeStart,
  rangeEnd,
  workspaceNow,
}: {
  events: SchedulingEvent[]
  settings: WorkspaceSchedulingSettings
  rangeStart: Date
  rangeEnd: Date
  workspaceNow: Date
}) {
  const occurrences = getSchedulingOccurrencesForRange({
    events,
    rangeStart: new Date(rangeStart.getTime() - 365 * 24 * 60 * 60 * 1000),
    rangeEnd,
    timezone: settings.timezone,
  })
  const seen = new Set<string>()
  return occurrences
    .filter((occurrence) => {
      if (seen.has(occurrence.occurrenceId)) return false
      seen.add(occurrence.occurrenceId)
      const source = sourceEventForOccurrence(occurrence, events)
      if (!source.assignedMemberIds.length) return false
      if ((source as unknown as { deletedAt?: unknown }).deletedAt) return false
      if (['completed', 'canceled', 'missed'].includes(source.status))
        return false
      const definition = resolveSchedulingKnowledgeEventType(
        source.type,
        settings,
      )
      if (definition.blocksAvailability === false) return false
      const start = new Date(occurrence.occurrenceStartsAt)
      const end = new Date(occurrence.occurrenceEndsAt)
      if (source.status === 'inProgress') return start <= rangeEnd
      return end >= workspaceNow && overlaps(start, end, rangeStart, rangeEnd)
    })
    .sort(
      (first, second) =>
        new Date(first.occurrenceStartsAt).getTime() -
        new Date(second.occurrenceStartsAt).getTime(),
    )
}

function conflictWarning(
  conflict: SchedulingConflict,
): SchedulingExplanationWarning {
  const label =
    conflict.conflictType === 'outsideWorkingHours'
      ? 'Outside configured working hours.'
      : conflict.sourceLabel
  const base = {
    constraint: label,
    startsAt: conflict.startsAt,
    endsAt: conflict.endsAt,
    overlap:
      conflict.startsAt && conflict.endsAt
        ? `${conflict.startsAt} to ${conflict.endsAt}`
        : undefined,
    whyItMatters: whyConflictMatters(conflict),
  }
  if (conflict.conflictType === 'timeOff') {
    return {
      code: 'time-off',
      label,
      source: 'availability',
      severity: 'blocking',
      ...base,
    }
  }
  if (conflict.conflictType === 'availabilityException') {
    return {
      code: 'availability-exception',
      label,
      source: 'availability',
      severity: conflict.severity,
      ...base,
    }
  }
  if (conflict.conflictType === 'externalAvailability') {
    return {
      code: 'external-availability-conflict',
      label,
      source: 'externalAvailability',
      severity: conflict.severity,
      ...base,
    }
  }
  if (conflict.conflictType === 'outsideWorkingHours') {
    return {
      code: 'outside-working-hours',
      label,
      source: 'workingHours',
      severity: 'warning',
      ...base,
    }
  }
  return {
    code: 'busy-conflict',
    label,
    source: 'events',
    severity: 'blocking',
    ...base,
  }
}

function whyConflictMatters(conflict: SchedulingConflict) {
  if (conflict.conflictType === 'outsideWorkingHours') {
    return 'The requested time is outside the configured availability policy.'
  }
  if (conflict.conflictType === 'availabilityException') {
    return 'The requested window overlaps an availability exception.'
  }
  if (conflict.conflictType === 'timeOff') {
    return 'The requested assignee is unavailable during this time.'
  }
  if (conflict.conflictType === 'externalAvailability') {
    return 'An external calendar signal overlaps the requested time.'
  }
  return 'The requested assignee already has a blocking scheduled event in this window.'
}

export class SchedulingKnowledgeService {
  private readonly timezone: string
  private readonly now: Date
  private readonly scoped: ReturnType<typeof permissionFilter>
  private readonly eventTypes: ResolvedSchedulingKnowledgeEventType[]

  constructor(private readonly input: SchedulingKnowledgeInput) {
    this.timezone = input.settings.timezone || input.workspace.timezone || 'UTC'
    this.now = input.now ?? new Date()
    this.scoped = permissionFilter(input)
    this.eventTypes = getResolvedSchedulingKnowledgeEventTypes(input.settings)
  }

  getSchedulingContext(): SchedulingContext {
    const availability = this.scoped.availability
    return {
      workspace: {
        id: this.input.workspace.id,
        slug: this.input.workspace.slug,
        name: this.input.workspace.name,
        timezone: this.timezone,
      },
      now: {
        instant: this.now.toISOString(),
        dateKey: getWorkspaceNow({ timezone: this.timezone, now: this.now })
          .dateKey,
      },
      settings: this.input.settings,
      capabilities: this.input.capabilities,
      policies: {
        weekStartsOn: this.input.settings.weekStartsOn,
        visibleSections: this.input.settings.visibleSections,
        calendarConnectionPolicy: this.input.settings.calendarConnectionPolicy,
      },
      members: this.scoped.members,
      teams: this.scoped.teams,
      locations: this.scoped.locations,
      eventTypes: this.eventTypes,
      workingHours: availability.filter(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'workingHours' }
        > => record.kind === 'workingHours',
      ),
      timeOff: availability.filter(
        (
          record,
        ): record is Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> =>
          record.kind === 'timeOff',
      ),
      availabilityExceptions: availability.filter(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'availabilityException' }
        > => record.kind === 'availabilityException',
      ),
      events: this.scoped.events,
      recurringSeries: (this.input.recurringSeries ?? [])
        .filter((series) => series.workspaceId === this.input.workspace.id)
        .sort((first, second) =>
          first.nextOccurrenceAt.localeCompare(second.nextOccurrenceAt),
        ),
      externalAvailability: this.scoped.externalAvailability,
      providerHealth: providerHealthFromConnections(
        this.input.calendarConnections,
      ),
    }
  }

  getSchedulingSnapshot({
    rangeStart = this.now,
    rangeEnd = new Date(this.now.getTime() + 30 * 24 * 60 * 60 * 1000),
  }: {
    rangeStart?: Date
    rangeEnd?: Date
  } = {}): SchedulingSnapshot {
    const context = this.getSchedulingContext()
    const conflicts = this.getSchedulingConflicts({ rangeStart, rangeEnd })
    const workload = this.getCurrentWorkload({ rangeStart, rangeEnd })
    const readiness = this.getSchedulingReadiness()
    const countPayload = {
      members: context.members.length,
      teams: context.teams.length,
      locations: context.locations.length,
      events: context.events.length,
      recurringSeries: context.recurringSeries.length,
      workingHours: context.workingHours.length,
      timeOff: context.timeOff.length,
      availabilityExceptions: context.availabilityExceptions.length,
      externalAvailabilitySignals: context.externalAvailability.length,
      conflicts: conflicts.length,
    }
    const fingerprint = deterministicFingerprint({
      workspaceId: context.workspace.id,
      timezone: context.workspace.timezone,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      countPayload,
      conflicts: conflicts.map((conflict) => conflict.id),
      workload: workload.map((item) => [
        item.assigneeType,
        item.assigneeId,
        item.eventCount,
        item.busyMinutes,
      ]),
      providerHealth: context.providerHealth,
    })
    return {
      id: `scheduling-snapshot:${context.workspace.id}:${fingerprint.length}:${context.now.dateKey}`,
      createdAt: this.now.toISOString(),
      workspaceId: context.workspace.id,
      timezone: context.workspace.timezone,
      currentDateKey: context.now.dateKey,
      range: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
      counts: countPayload,
      providerHealth: context.providerHealth,
      workload,
      conflicts,
      readiness,
      fingerprint,
    }
  }

  getCapabilityRegistry() {
    return schedulingKnowledgeCapabilityRegistry
  }

  getSupportedIntents(): SchedulingKnowledgeIntent[] {
    return [
      'findBestMember',
      'findBestTeam',
      'findAvailableSlot',
      'findRecurringSlot',
      'explainSchedulingConflict',
      'explainAssignment',
      'explainUnavailable',
      'explainRecommendationChange',
      'rescheduleAppointment',
      'assignEvent',
      'balanceWorkload',
    ]
  }

  getMemberAvailability({
    memberId,
    rangeStart,
    rangeEnd,
  }: {
    memberId: string
    rangeStart: Date
    rangeEnd: Date
  }): SchedulingAvailabilitySummary | null {
    const member = this.scoped.members.find((item) => item.id === memberId)
    if (!member) return null
    const teamIds = getMemberTeamIds(member, this.scoped.teams)
    const effective = resolveEffectiveWorkingHours({
      availability: this.scoped.availability,
      workspaceId: this.input.workspace.id,
      workspaceMemberId: member.id,
      teamIds,
      locationId: member.locationId,
      date: rangeStart,
      timezone: this.timezone,
    })
    const conflicts = this.getSchedulingConflicts({
      memberIds: [member.id],
      teamIds,
      rangeStart,
      rangeEnd,
    })
    if (!effective.isAvailable) {
      conflicts.unshift({
        id: `outside-working-hours:${member.id}:${getWorkspaceDateKey(rangeStart, this.timezone)}`,
        conflictType: 'outsideWorkingHours',
        memberId: member.id,
        sourceId: effective.sourceRecordId ?? 'working-hours',
        sourceLabel: effective.reason ?? 'Outside configured working hours.',
        severity: 'warning',
      })
    }
    const warnings = conflicts.map(conflictWarning)
    return {
      assigneeId: member.id,
      assigneeType: 'member',
      label: member.label,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      isAvailable:
        effective.isAvailable &&
        !conflicts.some((item) => item.severity === 'blocking'),
      workingHoursSource: effective.source,
      conflicts,
      warnings,
    }
  }

  getTeamAvailability({
    teamId,
    rangeStart,
    rangeEnd,
  }: {
    teamId: string
    rangeStart: Date
    rangeEnd: Date
  }): SchedulingAvailabilitySummary | null {
    const team = this.scoped.teams.find((item) => item.id === teamId)
    if (!team) return null
    const memberSummaries = team.memberIds
      .map((memberId) =>
        this.getMemberAvailability({ memberId, rangeStart, rangeEnd }),
      )
      .filter(Boolean) as SchedulingAvailabilitySummary[]
    const conflicts = memberSummaries.flatMap((summary) => summary.conflicts)
    return {
      assigneeId: team.id,
      assigneeType: 'team',
      label: team.label,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      isAvailable: memberSummaries.some((summary) => summary.isAvailable),
      conflicts,
      warnings: conflicts.map(conflictWarning),
    }
  }

  getLocationAvailability({
    locationId,
    rangeStart,
    rangeEnd,
  }: {
    locationId: string
    rangeStart: Date
    rangeEnd: Date
  }): SchedulingAvailabilitySummary | null {
    const location = this.scoped.locations.find(
      (item) => item.id === locationId,
    )
    if (!location) return null
    const locationMembers = this.scoped.members.filter(
      (member) => member.locationId === locationId,
    )
    const conflicts = locationMembers.flatMap((member) =>
      this.getSchedulingConflicts({
        memberIds: [member.id],
        teamIds: getMemberTeamIds(member, this.scoped.teams),
        rangeStart,
        rangeEnd,
      }),
    )
    return {
      assigneeId: location.id,
      assigneeType: 'location',
      label: location.label,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      isAvailable:
        locationMembers.length > 0 &&
        conflicts.every((conflict) => conflict.severity !== 'blocking'),
      conflicts,
      warnings: conflicts.map(conflictWarning),
    }
  }

  getSchedulingConflicts({
    memberIds,
    teamIds = [],
    rangeStart,
    rangeEnd,
  }: {
    memberIds?: string[]
    teamIds?: string[]
    rangeStart: Date
    rangeEnd: Date
  }): SchedulingConflict[] {
    const targetMembers = new Set(
      memberIds ?? this.scoped.members.map((member) => member.id),
    )
    const targetTeams = new Set(teamIds)
    const busy = getBusyAvailabilityIntervals({
      events: this.scoped.events,
      settings: this.input.settings,
      rangeStart,
      rangeEnd,
      workspaceNow: this.now,
    })
      .filter((occurrence) => {
        const source = sourceEventForOccurrence(occurrence, this.scoped.events)
        return source.assignedMemberIds.some(
          (id) => targetMembers.has(id) || targetTeams.has(id),
        )
      })
      .map((occurrence): SchedulingConflict => {
        const source = sourceEventForOccurrence(occurrence, this.scoped.events)
        const memberId = source.assignedMemberIds.find((id) =>
          targetMembers.has(id),
        )
        const teamId = source.assignedMemberIds.find((id) =>
          targetTeams.has(id),
        )
        return {
          id: `busy:${occurrence.occurrenceId}`,
          conflictType: 'busy',
          memberId,
          teamId,
          sourceId: source.id,
          sourceLabel: source.title,
          startsAt: occurrence.occurrenceStartsAt,
          endsAt: occurrence.occurrenceEndsAt,
          severity: source.status === 'inProgress' ? 'warning' : 'blocking',
        }
      })
    const timeOff = this.scoped.availability
      .filter(
        (
          record,
        ): record is Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> =>
          record.kind === 'timeOff',
      )
      .filter(
        (record) =>
          (targetMembers.has(record.memberId) ||
            targetTeams.has(record.memberId)) &&
          overlaps(record.startsAt, record.endsAt, rangeStart, rangeEnd),
      )
      .map(
        (record): SchedulingConflict => ({
          id: `time-off:${record.id}`,
          conflictType: 'timeOff',
          memberId: targetMembers.has(record.memberId)
            ? record.memberId
            : undefined,
          teamId: targetTeams.has(record.memberId)
            ? record.memberId
            : undefined,
          sourceId: record.id,
          sourceLabel: record.title ?? record.reason,
          startsAt: record.startsAt,
          endsAt: record.endsAt,
          severity: 'blocking',
        }),
      )
    const startKey = getWorkspaceDateKey(rangeStart, this.timezone)
    const endKey = getWorkspaceDateKey(rangeEnd, this.timezone)
    const exceptions = this.scoped.availability
      .filter(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'availabilityException' }
        > => record.kind === 'availabilityException',
      )
      .flatMap((record): SchedulingConflict[] => {
        const appliesToRequestedAssignee =
          record.scope === 'workspace' ||
          (record.scope === 'team' &&
            Boolean(record.teamId && targetTeams.has(record.teamId))) ||
          (record.scope === 'member' &&
            Boolean(record.memberId && targetMembers.has(record.memberId)))
        if (!appliesToRequestedAssignee) return []
        const window = getAvailabilityExceptionOverlapWindow({
          record,
          rangeStart,
          rangeEnd,
          timezone: this.timezone,
        })
        if (!window) return []
        return [
          {
            id: `availability-exception:${record.id}:${window.dateKey}`,
            conflictType: 'availabilityException',
            memberId: record.memberId,
            teamId: record.teamId,
            sourceId: record.id,
            sourceLabel:
              record.title ??
              (record.exceptionType === 'closed' ? 'Closed' : 'Custom hours'),
            startsAt: window.startsAt.toISOString(),
            endsAt: window.endsAt.toISOString(),
            severity:
              record.exceptionType === 'closed' ? 'blocking' : 'warning',
          },
        ]
      })
    const external = this.scoped.externalAvailability
      .filter((signal) => targetMembers.has(signal.workspaceMemberId))
      .filter((signal) =>
        overlaps(signal.startsAtUtc, signal.endsAtUtc, rangeStart, rangeEnd),
      )
      .map(
        (signal): SchedulingConflict => ({
          id: `external-availability:${signal.id}`,
          conflictType: 'externalAvailability',
          memberId: signal.workspaceMemberId,
          sourceId: signal.id,
          sourceLabel: signal.displayLabel ?? 'External availability conflict',
          startsAt: signal.startsAtUtc,
          endsAt: signal.endsAtUtc,
          severity: signal.effect === 'blocking' ? 'blocking' : 'warning',
        }),
      )

    return [...busy, ...timeOff, ...exceptions, ...external].sort(
      (first, second) =>
        (first.startsAt ?? '').localeCompare(second.startsAt ?? '') ||
        first.id.localeCompare(second.id),
    )
  }

  getCurrentWorkload({
    rangeStart = this.now,
    rangeEnd = new Date(this.now.getTime() + 30 * 24 * 60 * 60 * 1000),
  }: {
    rangeStart?: Date
    rangeEnd?: Date
  } = {}): SchedulingWorkloadSummary[] {
    const busy = getBusyAvailabilityIntervals({
      events: this.scoped.events,
      settings: this.input.settings,
      rangeStart,
      rangeEnd,
      workspaceNow: this.now,
    })
    const memberSummaries = this.scoped.members.map((member) => {
      const teamIds = getMemberTeamIds(member, this.scoped.teams)
      const memberBusy = busy.filter((occurrence) => {
        const source = sourceEventForOccurrence(occurrence, this.scoped.events)
        return eventAssignmentMatches({
          event: source,
          memberId: member.id,
          teamIds,
        })
      })
      const busyMinutes = memberBusy.reduce(
        (total, occurrence) =>
          total +
          minutesBetween(
            occurrence.occurrenceStartsAt,
            occurrence.occurrenceEndsAt,
          ),
        0,
      )
      return {
        assigneeId: member.id,
        assigneeType: 'member' as const,
        label: member.label,
        eventCount: memberBusy.length,
        busyMinutes,
        inProgressCount: memberBusy.filter(
          (event) => event.status === 'inProgress',
        ).length,
        upcomingCount: memberBusy.filter(
          (event) => new Date(event.occurrenceStartsAt) > this.now,
        ).length,
        overloaded: busyMinutes > 40 * 60 || memberBusy.length >= 12,
      }
    })
    const teamSummaries = this.scoped.teams.map((team) => {
      const teamBusy = busy.filter((occurrence) => {
        const source = sourceEventForOccurrence(occurrence, this.scoped.events)
        return (
          source.assignedMemberIds.includes(team.id) ||
          source.assignedMemberIds.some((id) => team.memberIds.includes(id))
        )
      })
      const busyMinutes = teamBusy.reduce(
        (total, occurrence) =>
          total +
          minutesBetween(
            occurrence.occurrenceStartsAt,
            occurrence.occurrenceEndsAt,
          ),
        0,
      )
      return {
        assigneeId: team.id,
        assigneeType: 'team' as const,
        label: team.label,
        eventCount: teamBusy.length,
        busyMinutes,
        inProgressCount: teamBusy.filter(
          (event) => event.status === 'inProgress',
        ).length,
        upcomingCount: teamBusy.filter(
          (event) => new Date(event.occurrenceStartsAt) > this.now,
        ).length,
        overloaded:
          busyMinutes > Math.max(1, team.memberIds.length) * 40 * 60 ||
          teamBusy.length >= Math.max(1, team.memberIds.length) * 12,
      }
    })
    return [...memberSummaries, ...teamSummaries].sort((first, second) =>
      first.label.localeCompare(second.label),
    )
  }

  getMemberSchedule({
    memberId,
    rangeStart,
    rangeEnd,
  }: {
    memberId: string
    rangeStart: Date
    rangeEnd: Date
  }) {
    const member = this.scoped.members.find((item) => item.id === memberId)
    if (!member) return []
    const teamIds = getMemberTeamIds(member, this.scoped.teams)
    return getSchedulingOccurrencesForRange({
      events: this.scoped.events.filter((event) =>
        eventAssignmentMatches({ event, memberId, teamIds }),
      ),
      rangeStart,
      rangeEnd,
      timezone: this.timezone,
    })
  }

  getTeamSchedule({
    teamId,
    rangeStart,
    rangeEnd,
  }: {
    teamId: string
    rangeStart: Date
    rangeEnd: Date
  }) {
    const team = this.scoped.teams.find((item) => item.id === teamId)
    if (!team) return []
    return getSchedulingOccurrencesForRange({
      events: this.scoped.events.filter(
        (event) =>
          event.assignedMemberIds.includes(team.id) ||
          event.assignedMemberIds.some((id) => team.memberIds.includes(id)),
      ),
      rangeStart,
      rangeEnd,
      timezone: this.timezone,
    })
  }

  getProviderHealth() {
    return providerHealthFromConnections(this.input.calendarConnections)
  }

  getExternalAvailability({
    memberId,
    rangeStart,
    rangeEnd,
  }: {
    memberId?: string
    rangeStart: Date
    rangeEnd: Date
  }) {
    return this.scoped.externalAvailability
      .filter((signal) => !memberId || signal.workspaceMemberId === memberId)
      .filter((signal) =>
        overlaps(signal.startsAtUtc, signal.endsAtUtc, rangeStart, rangeEnd),
      )
      .sort((first, second) =>
        first.startsAtUtc.localeCompare(second.startsAtUtc),
      )
  }

  getTimeOff({
    memberId,
    rangeStart,
    rangeEnd,
  }: {
    memberId?: string
    rangeStart: Date
    rangeEnd: Date
  }) {
    return this.scoped.availability
      .filter(
        (
          record,
        ): record is Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> =>
          record.kind === 'timeOff',
      )
      .filter((record) => !memberId || record.memberId === memberId)
      .filter((record) =>
        overlaps(record.startsAt, record.endsAt, rangeStart, rangeEnd),
      )
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt))
  }

  getAvailabilityExceptions({
    rangeStart,
    rangeEnd,
  }: {
    rangeStart: Date
    rangeEnd: Date
  }) {
    const startKey = getWorkspaceDateKey(rangeStart, this.timezone)
    const endKey = getWorkspaceDateKey(rangeEnd, this.timezone)
    return this.scoped.availability
      .filter(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'availabilityException' }
        > => record.kind === 'availabilityException',
      )
      .filter(
        (record) =>
          record.date <= endKey &&
          (record.recurrenceRule ? true : record.date >= startKey),
      )
      .sort((first, second) => first.date.localeCompare(second.date))
  }

  getRecurringSchedule() {
    return (this.input.recurringSeries ?? [])
      .filter((series) => series.workspaceId === this.input.workspace.id)
      .sort((first, second) =>
        first.nextOccurrenceAt.localeCompare(second.nextOccurrenceAt),
      )
  }

  getTodayAssignments() {
    const today = getWorkspaceDateKey(this.now, this.timezone)
    return this.getUpcomingAssignments({
      rangeStart: getStartOfWorkspaceDay(today, this.timezone),
      rangeEnd: getEndOfWorkspaceDay(today, this.timezone),
    })
  }

  getUpcomingAssignments({
    rangeStart = this.now,
    rangeEnd = new Date(this.now.getTime() + 30 * 24 * 60 * 60 * 1000),
  }: {
    rangeStart?: Date
    rangeEnd?: Date
  } = {}) {
    return getSchedulingOccurrencesForRange({
      events: this.scoped.events,
      rangeStart,
      rangeEnd,
      timezone: this.timezone,
    }).filter(
      (occurrence) =>
        occurrence.assignedMemberIds.length > 0 &&
        !['canceled', 'missed'].includes(occurrence.status),
    )
  }

  getSchedulingReadiness(): SchedulingReadiness {
    const warnings: SchedulingExplanationWarning[] = []
    if (!this.input.settings.enabled) {
      warnings.push({
        code: 'unsupported-section',
        label: 'Scheduling is disabled for this workspace.',
        source: 'registry',
        severity: 'blocking',
      })
    }
    if (!this.scoped.members.length) {
      warnings.push({
        code: 'no-assignment',
        label: 'No visible active members are available for scheduling.',
        source: 'events',
        severity: 'warning',
      })
    }
    return {
      ready: warnings.every((warning) => warning.severity !== 'blocking'),
      warnings,
      capabilities: schedulingKnowledgeCapabilityRegistry,
    }
  }

  recommendMembers({
    rangeStart,
    rangeEnd,
    locationId,
    limit = 5,
  }: {
    rangeStart: Date
    rangeEnd: Date
    locationId?: string | null
    limit?: number
  }): SchedulingRecommendationCandidate[] {
    const workload = new Map(
      this.getCurrentWorkload({ rangeStart, rangeEnd })
        .filter((item) => item.assigneeType === 'member')
        .map((item) => [item.assigneeId, item]),
    )
    const workloadCounts = [...workload.values()].map((item) => item.eventCount)
    const lowestWorkload = workloadCounts.length
      ? Math.min(...workloadCounts)
      : 0
    const highestWorkload = workloadCounts.length
      ? Math.max(...workloadCounts)
      : 0
    return this.scoped.members
      .map((member) => {
        let score = 50
        const reasons: SchedulingExplanationReason[] = []
        const warnings: SchedulingExplanationWarning[] = []
        const scoreBreakdown: Record<string, number> = {
          base: 50,
          availability: 0,
          workload: 0,
          location: 0,
          overtimeRisk: 0,
          recentAssignments: 0,
        }
        const availability = this.getMemberAvailability({
          memberId: member.id,
          rangeStart,
          rangeEnd,
        })
        if (availability?.isAvailable) {
          score += 30
          scoreBreakdown.availability = 30
          reasons.push({
            code: 'available',
            label: 'Available for the requested time.',
            source: 'availability',
          })
        } else {
          score -= 35
          scoreBreakdown.availability = -35
          warnings.push(...(availability?.warnings ?? []))
        }
        const memberWorkload = workload.get(member.id)
        const eventCount = memberWorkload?.eventCount ?? 0
        if (!memberWorkload || eventCount <= 2) {
          const workloadBoost = eventCount === lowestWorkload ? 14 : 8
          score += workloadBoost
          scoreBreakdown.workload = workloadBoost
          reasons.push({
            code: 'low-workload',
            label:
              eventCount === lowestWorkload
                ? 'Lowest visible workload in this planning window.'
                : 'Current workload is low.',
            source: 'events',
          })
        } else if (memberWorkload.overloaded) {
          score -= 20
          scoreBreakdown.workload = -20
          warnings.push({
            code: 'overloaded',
            label: 'Member is already overloaded in this planning window.',
            source: 'events',
            severity: 'warning',
          })
        } else if (
          highestWorkload > lowestWorkload &&
          eventCount === highestWorkload
        ) {
          score -= 6
          scoreBreakdown.workload = -6
        }
        if (locationId && member.locationId === locationId) {
          score += 12
          scoreBreakdown.location = 12
          reasons.push({
            code: 'same-location',
            label: 'Member is associated with the requested location.',
            source: 'location',
          })
        } else if (
          locationId &&
          member.locationId &&
          member.locationId !== locationId
        ) {
          score -= 10
          scoreBreakdown.location = -10
          warnings.push({
            code: 'location-mismatch',
            label: 'Member is associated with a different location.',
            source: 'location',
            severity: 'info',
          })
        }
        if (memberWorkload?.inProgressCount) {
          const penalty = Math.min(12, memberWorkload.inProgressCount * 6)
          score -= penalty
          scoreBreakdown.recentAssignments = -penalty
        }
        if (
          availability?.warnings.some(
            (warning) => warning.code === 'outside-working-hours',
          )
        ) {
          score -= 10
          scoreBreakdown.overtimeRisk = -10
        }
        const normalizedScore = Math.max(0, Math.min(100, score))
        return {
          candidateId: member.id,
          candidateType: 'member' as const,
          label: member.label,
          score: normalizedScore,
          confidence: confidenceForScore(normalizedScore),
          reasons,
          warnings,
          metadata: {
            workload: memberWorkload,
            teamIds: getMemberTeamIds(member, this.scoped.teams),
            scoreBreakdown,
          },
        }
      })
      .sort(
        (first, second) =>
          second.score - first.score || first.label.localeCompare(second.label),
      )
      .slice(0, limit)
  }

  recommendTeams({
    rangeStart,
    rangeEnd,
    limit = 5,
  }: {
    rangeStart: Date
    rangeEnd: Date
    limit?: number
  }): SchedulingRecommendationCandidate[] {
    return this.scoped.teams
      .map((team) => {
        const availability = this.getTeamAvailability({
          teamId: team.id,
          rangeStart,
          rangeEnd,
        })
        const availableMembers = team.memberIds.filter(
          (memberId) =>
            this.getMemberAvailability({ memberId, rangeStart, rangeEnd })
              ?.isAvailable,
        )
        let score = 45 + Math.min(35, availableMembers.length * 15)
        const reasons: SchedulingExplanationReason[] = []
        const warnings: SchedulingExplanationWarning[] = []
        if (availableMembers.length) {
          reasons.push({
            code: 'available',
            label: `${availableMembers.length} team member${availableMembers.length === 1 ? '' : 's'} available.`,
            source: 'availability',
          })
        } else {
          score -= 30
          warnings.push(...(availability?.warnings ?? []))
        }
        const normalizedScore = Math.max(0, Math.min(100, score))
        return {
          candidateId: team.id,
          candidateType: 'team' as const,
          label: team.label,
          score: normalizedScore,
          confidence: confidenceForScore(normalizedScore),
          reasons,
          warnings,
          metadata: { availableMemberIds: availableMembers },
        }
      })
      .sort(
        (first, second) =>
          second.score - first.score || first.label.localeCompare(second.label),
      )
      .slice(0, limit)
  }

  recommendLocations({
    rangeStart,
    rangeEnd,
    limit = 5,
  }: {
    rangeStart: Date
    rangeEnd: Date
    limit?: number
  }): SchedulingRecommendationCandidate[] {
    return this.scoped.locations
      .map((location) => {
        const availability = this.getLocationAvailability({
          locationId: location.id,
          rangeStart,
          rangeEnd,
        })
        const score = availability?.isAvailable ? 80 : 45
        return {
          candidateId: location.id,
          candidateType: 'location' as const,
          label: location.label,
          score,
          confidence: confidenceForScore(score),
          reasons: availability?.isAvailable
            ? [
                {
                  code: 'available' as const,
                  label: 'Location has visible available staff.',
                  source: 'location' as const,
                },
              ]
            : [],
          warnings: availability?.warnings ?? [],
        }
      })
      .sort(
        (first, second) =>
          second.score - first.score || first.label.localeCompare(second.label),
      )
      .slice(0, limit)
  }

  recommendTimeSlots({
    memberId,
    dateKey,
    durationMinutes = 60,
    limit = 5,
  }: {
    memberId: string
    dateKey: SchedulingDateKey
    durationMinutes?: number
    limit?: number
  }): SchedulingRecommendationCandidate[] {
    const member = this.scoped.members.find((item) => item.id === memberId)
    if (!member) return []
    const effective = resolveEffectiveWorkingHours({
      availability: this.scoped.availability,
      workspaceId: this.input.workspace.id,
      workspaceMemberId: member.id,
      teamIds: getMemberTeamIds(member, this.scoped.teams),
      locationId: member.locationId,
      date: dateKey,
      timezone: this.timezone,
    })
    if (!effective.isAvailable || !effective.startTime || !effective.endTime)
      return []
    const slots: SchedulingRecommendationCandidate[] = []
    let cursor = combineDateAndTimeInTimezone({
      dateKey,
      time: effective.startTime,
      timezone: this.timezone,
    })
    const dayEnd = combineDateAndTimeInTimezone({
      dateKey,
      time: effective.endTime,
      timezone: this.timezone,
    })
    while (
      cursor.getTime() + durationMinutes * 60000 <= dayEnd.getTime() &&
      slots.length < limit
    ) {
      const end = new Date(cursor.getTime() + durationMinutes * 60000)
      const availability = this.getMemberAvailability({
        memberId,
        rangeStart: cursor,
        rangeEnd: end,
      })
      const score = availability?.isAvailable ? 90 : 30
      slots.push({
        candidateId: `slot:${cursor.toISOString()}`,
        candidateType: 'timeSlot',
        label: `${cursor.toISOString()} - ${end.toISOString()}`,
        score,
        confidence: confidenceForScore(score),
        reasons: availability?.isAvailable
          ? [
              {
                code: 'available',
                label: 'No deterministic conflicts in this slot.',
                source: 'availability',
              },
            ]
          : [],
        warnings: availability?.warnings ?? [],
        metadata: {
          startsAt: cursor.toISOString(),
          endsAt: end.toISOString(),
          memberId,
        },
      })
      cursor = new Date(
        cursor.getTime() + Math.max(15, durationMinutes) * 60000,
      )
    }
    return slots
  }

  recommendRecurringSlot({
    memberId,
    startDateKey,
    durationMinutes = 60,
  }: {
    memberId: string
    startDateKey: SchedulingDateKey
    durationMinutes?: number
  }) {
    const slots = this.recommendTimeSlots({
      memberId,
      dateKey: startDateKey,
      durationMinutes,
      limit: 3,
    })
    return slots.map((slot) => ({
      ...slot,
      reasons: [
        ...slot.reasons,
        {
          code: 'recurring-supported' as const,
          label: 'Recurring rules are supported by the scheduling engine.',
          source: 'registry' as const,
        },
      ],
    }))
  }

  recommendReassignmentCandidates({
    eventId,
    limit = 5,
  }: {
    eventId: string
    limit?: number
  }) {
    const event = this.scoped.events.find((item) => item.id === eventId)
    if (!event) return []
    return this.recommendMembers({
      rangeStart: new Date(event.startsAt),
      rangeEnd: new Date(event.endsAt),
      locationId:
        event.locationType === 'workspaceLocation' ? event.location : undefined,
      limit,
    }).map((candidate) => ({
      ...candidate,
      warnings: event.assignedMemberIds.includes(candidate.candidateId)
        ? [
            ...candidate.warnings,
            {
              code: 'existing-assignment' as const,
              label: 'This member is already assigned to the event.',
              source: 'events' as const,
              severity: 'info' as const,
            },
          ]
        : candidate.warnings,
    }))
  }

  getSchedulingRecommendations(args: {
    intent: Extract<
      SchedulingKnowledgeIntent,
      | 'findBestMember'
      | 'findBestTeam'
      | 'findAvailableSlot'
      | 'findRecurringSlot'
      | 'balanceWorkload'
    >
    rangeStart?: Date
    rangeEnd?: Date
    memberId?: string
    teamId?: string
    locationId?: string | null
    dateKey?: SchedulingDateKey
    durationMinutes?: number
  }) {
    const rangeStart = args.rangeStart ?? this.now
    const rangeEnd =
      args.rangeEnd ?? new Date(rangeStart.getTime() + 60 * 60000)
    if (args.intent === 'findBestTeam') {
      return this.recommendTeams({ rangeStart, rangeEnd })
    }
    if (args.intent === 'findAvailableSlot' && args.memberId && args.dateKey) {
      return this.recommendTimeSlots({
        memberId: args.memberId,
        dateKey: args.dateKey,
        durationMinutes: args.durationMinutes,
      })
    }
    if (args.intent === 'findRecurringSlot' && args.memberId && args.dateKey) {
      return this.recommendRecurringSlot({
        memberId: args.memberId,
        startDateKey: args.dateKey,
        durationMinutes: args.durationMinutes,
      })
    }
    return this.recommendMembers({
      rangeStart,
      rangeEnd,
      locationId: args.locationId,
    })
  }

  getSchedulingExplanation(candidate: SchedulingRecommendationCandidate) {
    return {
      candidateId: candidate.candidateId,
      candidateType: candidate.candidateType,
      score: candidate.score,
      confidence: candidate.confidence,
      reasons: candidate.reasons,
      warnings: candidate.warnings,
    }
  }
}

export function createSchedulingKnowledgeService(
  input: SchedulingKnowledgeInput,
) {
  return new SchedulingKnowledgeService(input)
}

export function getSchedulingContext(input: SchedulingKnowledgeInput) {
  return createSchedulingKnowledgeService(input).getSchedulingContext()
}

export function getSchedulingSnapshot(
  input: SchedulingKnowledgeInput,
  range?: { rangeStart?: Date; rangeEnd?: Date },
) {
  return createSchedulingKnowledgeService(input).getSchedulingSnapshot(range)
}

export function getSchedulingRecommendations(
  input: SchedulingKnowledgeInput,
  args: Parameters<
    SchedulingKnowledgeService['getSchedulingRecommendations']
  >[0],
) {
  return createSchedulingKnowledgeService(input).getSchedulingRecommendations(
    args,
  )
}

export function getSchedulingExplanation(
  candidate: SchedulingRecommendationCandidate,
) {
  return {
    candidateId: candidate.candidateId,
    candidateType: candidate.candidateType,
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    warnings: candidate.warnings,
  }
}
