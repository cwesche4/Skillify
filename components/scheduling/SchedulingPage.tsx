'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  CalendarDays,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ListFilter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Unplug,
  Users,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ConfigurationQuickAdd } from '@/components/ui/ConfigurationQuickAdd'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { WorkspaceLocationForm } from '@/components/workspace-structure/WorkspaceLocationForm'
import { WorkspaceTeamForm } from '@/components/workspace-structure/WorkspaceTeamForm'
import {
  ExternalAvailabilityConflictSummary,
  useExternalAvailabilityPreview,
} from '@/components/scheduling/ExternalAvailabilityPreview'
import { SchedulingAIPanel } from '@/components/scheduling/SchedulingAIPanel'
import type { SchedulingAIContextPayload } from '@/lib/ai/scheduling/customerSchedulingAI'
import { cn } from '@/lib/utils'
import {
  canAccessSchedulingSection,
  getWorkspaceSchedulingCapabilities,
} from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import {
  mergeSchedulingVisibility,
  normalizeSchedulingSettings,
} from '@/lib/scheduling/normalizeSchedulingSettings'
import {
  getSchedulingEventTypeDefinition,
  getSchedulingSectionDefinition,
  getSchedulingSectionLabel,
  sanitizeSchedulingSectionLabel,
  SCHEDULING_PRESETS,
} from '@/lib/scheduling/schedulingPresetRegistry'
import { schedulingSettingsChangedEvent } from '@/lib/scheduling/settingsEvents'
import type { SchedulingApiErrorBody } from '@/lib/scheduling/apiResponses'
import {
  normalizeSchedulingLinkedRecord,
  resolveSchedulingLinkedRecordRule,
  shouldWarnWhenSchedulingWithoutLinkedRecord,
  validateSchedulingLinkedRecord,
} from '@/lib/scheduling/linkedRecordRules'
import {
  formatSchedulingLocationType,
  getSchedulingLocationDisplay,
  normalizeSchedulingLocation,
  normalizeSchedulingLocationType,
  resolveSchedulingLocationRule,
  schedulingLocationTypes,
  validateSchedulingLocation,
} from '@/lib/scheduling/locationRules'
import { getLinkedRecordNavigationTarget } from '@/lib/scheduling/linkedRecordNavigation'
import {
  formatDateOnly,
  formatDateTime,
  formatExternalCalendarState,
  formatLinkedRecordType,
  formatRecurrenceSummary as formatSchedulingRecurrenceSummary,
  formatTimeOnly,
  schedulingStatusLabels,
} from '@/lib/scheduling/schedulingFormatters'
import {
  getAllowedRecurrenceScopes,
  isRecurringOccurrence,
  recurrenceScopeLabel,
  shouldPromptForRecurrenceScope,
} from '@/lib/scheduling/recurrenceScope'
import {
  addDays,
  emptySchedulingFilters,
  eventMatchesFilters,
  eventMatchesSearch,
  formatPeriodLabel,
  getCalendarDateVisualState,
  getActiveFilterCount,
  getAllowedStatusTransitions,
  getCalendarPeriod,
  getScheduleSummaryEmptyMessage,
  getScheduleSummaryTitle,
  getSchedulingOccurrencesForRange,
  getUpcomingEventsForVisibleRange,
  isDateInRange,
  moveCalendarAnchor,
  startOfDay,
  toDateKey,
  type SchedulingFilters,
} from '@/lib/scheduling/schedulingCalendar'
import {
  getSchedulingLinkedRecordOptions,
  getSupportedLinkedRecordTypes,
  normalizeSchedulingMemberOptions,
  type SchedulingMemberOption,
} from '@/lib/scheduling/schedulingWorkspaceData'
import {
  getInheritedWorkingHoursSource,
  getWorkingHoursDisplayName,
  getWorkingHoursScopeLabel,
  getWorkingHoursScopeSummary,
  normalizeWorkingHoursRecord,
  resolveEffectiveWorkingHours,
  resolveWorkingHoursScopeOptions,
  type WorkingHoursEntityOption,
} from '@/lib/scheduling/workingHours'
import {
  combineDateAndTimeInTimezone,
  dateKeyToCalendarDate,
  formatInWorkspaceTimezone,
  getCalendarDateKey,
  getDateKeyWeekday,
  getWorkspaceDateKey,
  getWorkspaceNow,
  getWorkspaceTimeInputValue,
  isSchedulingDateKey,
  parseSchedulingDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import {
  filterSchedulingTimezoneOptions,
  getSchedulingTimezoneOption,
  isSupportedSchedulingTimezone,
} from '@/lib/scheduling/schedulingTimezones'
import type {
  SchedulingCalendarView,
  SchedulingCapabilities,
  SchedulingEvent,
  SchedulingFormErrorKey,
  SchedulingEventStatus,
  SchedulingEventType,
  SchedulingLinkedRecordRequirement,
  SchedulingLinkedRecordType,
  SchedulingLocationRequirement,
  SchedulingLocationType,
  SchedulingNotificationCategory,
  SchedulingNotificationCategorySettings,
  SchedulingQuietHours,
  SchedulingOccurrence,
  SchedulingOccurrenceState,
  SchedulingRecurrenceActionScope,
  SchedulingRecurrenceRule,
  SchedulingReminderInput,
  SchedulingRecurringAction,
  SchedulingSeries,
  SchedulingSectionKey,
  TeamAvailabilityRecord,
  TimeOffCategory,
  WorkingHoursScheduleMode,
  WorkingHoursScope,
  MemberSchedulingNotificationPreferences,
  WorkspaceSchedulingNotificationPreferences,
  WorkspaceSchedulingCustomEventType,
  WorkspaceCalendarConnectionPolicy,
  CalendarConnectionPurpose,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'
import type {
  WorkspaceLocationSummary,
  WorkspaceTeamSummary,
} from '@/lib/workspaceStructure/types'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  getWorkspaceRecordTerminologyForBusinessModel,
  type WorkspaceRecordTerminology,
} from '@/lib/workspaces/workspacePresentation'
import { workspaceCrmRecordsChangedEvent } from '@/lib/workspace-records/previewEvents'
import {
  commercePreviewCustomersChangedEvent,
  commercePreviewFulfillmentsChangedEvent,
  commercePreviewOrdersChangedEvent,
  commercePreviewProductsChangedEvent,
} from '@/lib/commerce/previewCommerceStorage'

type SchedulingPageProps = {
  workspaceId: string
  workspaceSlug: string
  businessModel: WorkspaceBusinessModel | string
  initialCapabilities: SchedulingCapabilities
  initialSettings?: WorkspaceSchedulingSettings
  initialEvents?: SchedulingEvent[]
  initialSeries?: SchedulingSeries[]
  initialAvailability?: TeamAvailabilityRecord[]
  section: SchedulingSectionKey | 'settings'
  canManage: boolean
  schedulingAIEnabled?: boolean
}

const BUSY_PREVIEW_LIMIT = 3
type SchedulingWarningPreferenceKey =
  | 'scheduleWithoutLinkedRecord'
  | 'scheduleWithUndeterminedLocation'

function schedulingWarningPreferenceStorageKey({
  workspaceId,
  userId,
  eventType,
  warningKey,
}: {
  workspaceId: string
  userId: string
  eventType: string
  warningKey: SchedulingWarningPreferenceKey
}) {
  return `skillify:scheduling-warning:${workspaceId}:${userId}:${eventType}:${warningKey}`
}

function isSchedulingWarningSuppressed({
  workspaceId,
  userId,
  eventType,
  warningKey,
}: {
  workspaceId: string
  userId: string
  eventType: string
  warningKey: SchedulingWarningPreferenceKey
}) {
  if (typeof window === 'undefined') return false
  return (
    window.localStorage.getItem(
      schedulingWarningPreferenceStorageKey({
        workspaceId,
        userId,
        eventType,
        warningKey,
      }),
    ) === '1'
  )
}

function suppressSchedulingWarning({
  workspaceId,
  userId,
  eventType,
  warningKey,
}: {
  workspaceId: string
  userId: string
  eventType: string
  warningKey: SchedulingWarningPreferenceKey
}) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    schedulingWarningPreferenceStorageKey({
      workspaceId,
      userId,
      eventType,
      warningKey,
    }),
    '1',
  )
}

function shouldWarnWhenSchedulingWithUndeterminedLocation({
  eventType,
  settings,
  locationType,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  locationType: SchedulingLocationType
}) {
  const rule = resolveSchedulingLocationRule({ eventType, settings })
  return (
    locationType === 'toBeDetermined' &&
    rule.requirement === 'required' &&
    rule.allowUndeterminedLocation
  )
}

const viewLabels: Record<SchedulingCalendarView, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  agenda: 'Agenda',
}

function useCurrentMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])
  return now
}

type SchedulingCreateDateSource =
  | 'explicit'
  | 'selectedDate'
  | 'anchorDate'
  | 'workspaceToday'

type SchedulingCreateDateResolution = {
  dateKey: SchedulingDateKey
  source: SchedulingCreateDateSource
  repairedInvalidValue: boolean
}

function coerceSchedulingDateKey(value: unknown): SchedulingDateKey | null {
  return typeof value === 'string' && isSchedulingDateKey(value) ? value : null
}

function getSafeCalendarDateKey(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return null
  const dateKey = getCalendarDateKey(date)
  return isSchedulingDateKey(dateKey) ? dateKey : null
}

function reportSchedulingCreateDateRepair({
  entryPoint,
  explicitDateKey,
  selectedDate,
  anchorDate,
  timezone,
  resolution,
}: {
  entryPoint: string
  explicitDateKey?: unknown
  selectedDate?: unknown
  anchorDate?: Date | null
  timezone: string
  resolution: SchedulingCreateDateResolution
}) {
  if (
    process.env.NODE_ENV === 'production' ||
    !resolution.repairedInvalidValue
  ) {
    return
  }
  console.warn('[SCHEDULING CREATE DATE FALLBACK]', {
    entryPoint,
    explicitDateKey,
    selectedDate,
    anchorDate:
      anchorDate && !Number.isNaN(anchorDate.getTime())
        ? anchorDate.toISOString()
        : null,
    timezone,
    resolvedDateKey: resolution.dateKey,
    source: resolution.source,
  })
}

export function resolveSchedulingCreateInitialDate({
  explicitDateKey,
  selectedDate,
  anchorDate,
  timezone,
  now,
  entryPoint,
}: {
  explicitDateKey?: unknown
  selectedDate?: unknown
  anchorDate?: Date | null
  timezone: string
  now: Date
  entryPoint: string
}): SchedulingCreateDateResolution {
  const explicit = coerceSchedulingDateKey(explicitDateKey)
  const selected = coerceSchedulingDateKey(selectedDate)
  const anchor = getSafeCalendarDateKey(anchorDate)
  const workspaceToday = getWorkspaceDateKey(now, timezone)
  const resolution = explicit
    ? {
        dateKey: explicit,
        source: 'explicit' as const,
        repairedInvalidValue: false,
      }
    : selected
      ? {
          dateKey: selected,
          source: 'selectedDate' as const,
          repairedInvalidValue:
            explicitDateKey != null && explicitDateKey !== '',
        }
      : anchor
        ? {
            dateKey: anchor,
            source: 'anchorDate' as const,
            repairedInvalidValue:
              (explicitDateKey != null && explicitDateKey !== '') ||
              (selectedDate != null && selectedDate !== ''),
          }
        : {
            dateKey: workspaceToday,
            source: 'workspaceToday' as const,
            repairedInvalidValue:
              (explicitDateKey != null && explicitDateKey !== '') ||
              (selectedDate != null && selectedDate !== ''),
          }

  reportSchedulingCreateDateRepair({
    entryPoint,
    explicitDateKey,
    selectedDate,
    anchorDate,
    timezone,
    resolution,
  })

  return resolution
}

function formatWindow(event: SchedulingEvent, timezone = event.timezone) {
  if (event.allDay) return 'All day'
  return `${formatDateTime(event.startsAt, timezone)} - ${formatTimeOnly(event.endsAt, timezone)}`
}

function getEventSchedulingAIContext({
  event,
  memberOptions,
  settings,
}: {
  event: SchedulingEvent
  memberOptions: SchedulingMemberOption[]
  settings: WorkspaceSchedulingSettings
}): SchedulingAIContextPayload {
  const memberLabelById = new Map(
    memberOptions.map((member) => [member.id, member.label]),
  )
  const references: SchedulingAIContextPayload['references'] = [
    { kind: 'event', id: event.id, label: event.title },
    ...event.assignedMemberIds.map((memberId) => ({
      kind: 'technician' as const,
      id: memberId,
      label: memberLabelById.get(memberId) ?? humanizeMemberId(memberId),
    })),
  ]
  if (event.locationType === 'workspaceLocation' && event.location) {
    references.push({
      kind: 'location',
      id: event.location,
      label: event.locationLabel ?? event.location,
    })
  }
  return {
    entryPoint: 'event',
    label: `${event.title} · ${formatWindow(event)}`,
    references,
    calendar: {
      dateKey: getWorkspaceDateKey(event.startsAt, settings.timezone),
      rangeStart: event.startsAt,
      rangeEnd: event.endsAt,
    },
  }
}

function getWorkspaceTimeFormat(settings: WorkspaceSchedulingSettings) {
  return settings.timeFormat ?? '12hour'
}

function formatClockTime(value: string, settings: WorkspaceSchedulingSettings) {
  if (!isValidTimeValue(value)) return value
  if (getWorkspaceTimeFormat(settings) === '24hour') return value
  const [hours, minutes] = value.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

function formatClockRange({
  startTime,
  endTime,
  settings,
}: {
  startTime: string
  endTime: string
  settings: WorkspaceSchedulingSettings
}) {
  return `${formatClockTime(startTime, settings)}-${formatClockTime(endTime, settings)}`
}

function formatAvailabilityDateRange({
  startsAt,
  endsAt,
  timezone,
}: {
  startsAt: string
  endsAt: string
  timezone: string
}) {
  const startKey = getWorkspaceDateKey(startsAt, timezone)
  const endKey = getWorkspaceDateKey(endsAt, timezone)
  const start = formatInWorkspaceTimezone(startsAt, timezone, {
    month: 'short',
    day: 'numeric',
  })
  if (startKey === endKey) return start
  const end = formatInWorkspaceTimezone(endsAt, timezone, {
    month: 'short',
    day: 'numeric',
  })
  return `${start}-${end}`
}

function getReadableTimezoneLabel(timezone: string) {
  const option = getSchedulingTimezoneOption(timezone)
  return `${option.label} (${option.value})`
}

function getTimeOffTitle(
  record: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
) {
  if (record.title?.trim()) return record.title.trim()
  if (record.category) {
    return (
      timeOffCategories.find((item) => item.value === record.category)?.label ??
      record.reason
    )
  }
  return record.reason || 'Unavailable'
}

function formatTimeOffSummary({
  record,
  settings,
}: {
  record: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>
  settings: WorkspaceSchedulingSettings
}) {
  const timezone = record.timezone ?? settings.timezone
  const dateRange = formatAvailabilityDateRange({
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    timezone,
  })
  const timeRange = record.allDay
    ? 'All day'
    : `${formatTimeOnly(record.startsAt, timezone)}-${formatTimeOnly(record.endsAt, timezone)}`
  return `${record.memberName} · ${dateRange} · ${timeRange}`
}

function formatWorkingHoursSummary({
  record,
  settings,
  workingHours = [record],
}: {
  record: Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>
  settings: WorkspaceSchedulingSettings
  workingHours?: Array<
    Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>
  >
}) {
  const normalized = normalizeWorkingHoursRecord(record)
  const scope = getWorkingHoursScopeSummary(normalized)
  if (normalized.scheduleMode === 'inherit') {
    const inherited = getInheritedWorkingHoursSource({
      record: normalized,
      workingHours,
    })
    const displayName = inherited ? getWorkingHoursDisplayName(inherited) : ''
    const inheritedName = displayName
      ? displayName.toLowerCase().endsWith('hours')
        ? displayName
        : `${displayName} hours`
      : 'inherited hours'
    return `${scope} · Uses ${inheritedName}`
  }
  return `${scope} · ${(normalized.daysOfWeek ?? [])
    .map((day) => weekdayLabels[day])
    .join(', ')} · ${formatClockRange({
    startTime: normalized.startsAt ?? '09:00',
    endTime: normalized.endsAt ?? '17:00',
    settings,
  })}`
}

function getExceptionTitle(
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>,
) {
  if (record.title?.trim()) return record.title.trim()
  return record.exceptionType === 'closed'
    ? 'Workspace closed'
    : 'Special hours'
}

function formatAvailabilityExceptionSummary({
  record,
  settings,
}: {
  record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>
  settings: WorkspaceSchedulingSettings
}) {
  const scope =
    record.scope === 'workspace'
      ? 'Workspace'
      : (record.memberName ?? record.teamName ?? 'Team')
  const date = formatInWorkspaceTimezone(
    `${record.date}T12:00:00`,
    settings.timezone,
    {
      month: 'short',
      day: 'numeric',
    },
  )
  const recurrence = record.recurrenceRule ? ' · Repeats' : ''
  if (record.exceptionType === 'closed' || record.allDayClosed) {
    return `${scope} closed · ${date}${recurrence}`
  }
  return `${scope} · ${date} · ${formatClockRange({
    startTime: record.startTime ?? '09:00',
    endTime: record.endTime ?? '17:00',
    settings,
  })}${recurrence}`
}

function humanizeMemberId(value: string) {
  return value
    .replace(/^team-/, 'Team ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatMemberIds(ids: string[], memberLabelById: Map<string, string>) {
  if (!ids.length) return 'Unassigned'
  return ids
    .map((id) => memberLabelById.get(id) ?? humanizeMemberId(id))
    .join(', ')
}

type BusyAssigneeOption = {
  type: 'member' | 'team'
  id: string
  value: string
  label: string
  secondaryLabel?: string
}

function getBusyAssigneeOptions({
  memberOptions,
  availability,
}: {
  memberOptions: SchedulingMemberOption[]
  availability: TeamAvailabilityRecord[]
}): BusyAssigneeOption[] {
  const members = memberOptions
    .filter((member) => member.id && member.label)
    .map((member) => ({
      type: 'member' as const,
      id: member.id,
      value: `member:${member.id}`,
      label: member.label,
      secondaryLabel: member.secondary,
    }))
  const teams = new Map<string, BusyAssigneeOption>()
  availability.forEach((record) => {
    const team =
      record.kind === 'availabilityException'
        ? record.teamId
          ? {
              id: record.teamId,
              label: record.teamName ?? humanizeMemberId(record.teamId),
            }
          : null
        : record.memberId?.startsWith('team-')
          ? {
              id: record.memberId,
              label: record.memberName ?? humanizeMemberId(record.memberId),
            }
          : null
    if (!team || teams.has(team.id)) return
    teams.set(team.id, {
      type: 'team',
      id: team.id,
      value: `team:${team.id}`,
      label: team.label,
    })
  })
  return [
    ...members.sort((first, second) => first.label.localeCompare(second.label)),
    ...Array.from(teams.values()).sort((first, second) =>
      first.label.localeCompare(second.label),
    ),
  ]
}

function parseBusyAssigneeFilter(value: string) {
  const [type, ...rest] = value.split(':')
  const id = rest.join(':')
  if ((type === 'member' || type === 'team') && id) return { type, id }
  return null
}

function busyEventMatchesAssigneeFilter(
  event: Pick<SchedulingEvent, 'assignedMemberIds'>,
  filterValue: string,
) {
  const parsed = parseBusyAssigneeFilter(filterValue)
  if (!parsed) return true
  return event.assignedMemberIds.includes(parsed.id)
}

function formatBusyAssigneeIds(
  ids: string[],
  assigneeLabelById: Map<string, string>,
) {
  if (!ids.length) return 'Unassigned'
  return ids
    .map(
      (id) =>
        assigneeLabelById.get(id) ??
        (id.startsWith('team-') ? 'Former team' : 'Former member'),
    )
    .join(', ')
}

type ResolvedSchedulingEventType = {
  key: SchedulingEventType
  label: string
  description: string
  sections: SchedulingSectionKey[]
  defaultDurationMinutes?: number
  blocksAvailability: boolean
  requiresAssignment: boolean
  requiresLinkedRecord: boolean
  linkedRecordRequirement: SchedulingLinkedRecordRequirement
  warnWhenUnlinked: boolean
  requiresLocation: boolean
  locationRequirement: SchedulingLocationRequirement
  allowedLocationTypes: SchedulingLocationType[]
  defaultLocationType: SchedulingLocationType
  allowUndeterminedLocation: boolean
  requiredForCreation: boolean
  supportedLinkedRecordTypes?: SchedulingLinkedRecordType[]
  isSystem: boolean
  isVisible: boolean
  sortOrder: number
  customType?: WorkspaceSchedulingCustomEventType
}

const defaultEventDurationMinutes = 60

function formatMinutesDuration(minutes?: number) {
  const resolved =
    minutes && minutes > 0 ? Math.round(minutes) : defaultEventDurationMinutes
  if (resolved < 60) return `${resolved} min`
  const hours = Math.floor(resolved / 60)
  const remainder = resolved % 60
  return remainder
    ? `${hours} hr${hours === 1 ? '' : 's'} ${remainder} min`
    : `${hours} hr${hours === 1 ? '' : 's'}`
}

function addMinutesToTime(time: string, minutes: number) {
  if (!isValidTimeValue(time)) return time
  const total = Math.min(
    23 * 60 + 59,
    minutesFromTime(time) + Math.max(5, minutes),
  )
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function getPositiveTimeDurationMinutes(startTime: string, endTime: string) {
  if (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)) return null
  const minutes = minutesFromTime(endTime) - minutesFromTime(startTime)
  return minutes > 0 ? minutes : null
}

function getEventDurationMinutes(event: SchedulingEvent) {
  if (event.allDay) return null
  const startsAt = new Date(event.startsAt).getTime()
  const endsAt = new Date(event.endsAt).getTime()
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return null
  const minutes = Math.round((endsAt - startsAt) / 60000)
  return minutes > 0 ? minutes : null
}

function resolveCustomEventType(
  type: SchedulingEventType | string,
  settings: WorkspaceSchedulingSettings,
) {
  return (settings.customEventTypes ?? []).find(
    (customType) => customType.key === type,
  )
}

function resolveSchedulingEventTypeDefinition(
  type: SchedulingEventType | string,
  settings: WorkspaceSchedulingSettings,
): ResolvedSchedulingEventType {
  const customType = resolveCustomEventType(type, settings)
  if (customType) {
    const locationRule = resolveSchedulingLocationRule({
      eventType: type,
      settings,
    })
    const linkedRecordRequirement =
      customType.linkedRecordRequirement ??
      (customType.requiresLinkedRecord
        ? 'required'
        : customType.supportedLinkedRecordTypes.length
          ? 'optional'
          : 'notAllowed')
    return {
      key: customType.key as SchedulingEventType,
      label: customType.label,
      description: customType.description ?? 'Workspace custom event type.',
      sections: customType.sectionKeys,
      defaultDurationMinutes: customType.defaultDurationMinutes,
      blocksAvailability: customType.blocksAvailability,
      requiresAssignment: customType.blocksAvailability,
      requiresLinkedRecord: linkedRecordRequirement === 'required',
      linkedRecordRequirement,
      warnWhenUnlinked:
        customType.warnWhenUnlinked ??
        (linkedRecordRequirement === 'optional' &&
          customType.supportedLinkedRecordTypes.length > 0),
      requiresLocation: locationRule.requirement === 'required',
      locationRequirement: locationRule.requirement,
      allowedLocationTypes: locationRule.allowedLocationTypes,
      defaultLocationType: locationRule.defaultLocationType,
      allowUndeterminedLocation: locationRule.allowUndeterminedLocation,
      requiredForCreation: false,
      supportedLinkedRecordTypes: customType.supportedLinkedRecordTypes,
      isSystem: false,
      isVisible: customType.isActive,
      sortOrder: customType.sortOrder,
      customType,
    }
  }
  const definition = getSchedulingEventTypeDefinition(type)
  const locationRule = resolveSchedulingLocationRule({
    eventType: type,
    settings,
  })
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    sections: definition.sections,
    defaultDurationMinutes: definition.defaultDurationMinutes,
    blocksAvailability: definition.blocksAvailability !== false,
    requiresAssignment: definition.requiresAssignment === true,
    requiresLinkedRecord:
      resolveSchedulingLinkedRecordRule({ eventType: type, settings })
        .requirement === 'required',
    linkedRecordRequirement: resolveSchedulingLinkedRecordRule({
      eventType: type,
      settings,
    }).requirement,
    warnWhenUnlinked: resolveSchedulingLinkedRecordRule({
      eventType: type,
      settings,
    }).warnWhenUnlinked,
    requiresLocation: locationRule.requirement === 'required',
    locationRequirement: locationRule.requirement,
    allowedLocationTypes: locationRule.allowedLocationTypes,
    defaultLocationType: locationRule.defaultLocationType,
    allowUndeterminedLocation: locationRule.allowUndeterminedLocation,
    requiredForCreation: definition.requiredForCreation === true,
    isSystem: true,
    isVisible: true,
    sortOrder: 0,
  }
}

function getResolvedEventTypes({
  capabilities,
  settings,
}: {
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
}) {
  const preferences = new Map(
    (settings.eventTypePreferences ?? []).map((preference) => [
      preference.key,
      preference,
    ]),
  )
  const systemTypes = capabilities.supportedEventTypes.map((type, index) => {
    const preference = preferences.get(type)
    const definition = getSchedulingEventTypeDefinition(type)
    return {
      ...resolveSchedulingEventTypeDefinition(type, settings),
      isVisible: preference?.isVisible !== false,
      sortOrder: preference?.sortOrder ?? index,
      defaultDurationMinutes:
        preference?.defaultDurationMinutes ?? definition.defaultDurationMinutes,
    }
  })
  const customTypes = (settings.customEventTypes ?? [])
    .filter((customType) =>
      customType.presetScope.includes(capabilities.preset),
    )
    .map((customType, index) => ({
      ...resolveSchedulingEventTypeDefinition(customType.key, settings),
      sortOrder:
        capabilities.supportedEventTypes.length + customType.sortOrder + index,
    }))
  return [...systemTypes, ...customTypes].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  )
}

function getResolvedVisibleEventTypeKeys({
  capabilities,
  settings,
}: {
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
}) {
  return getResolvedEventTypes({ capabilities, settings })
    .filter((type) => type.isVisible)
    .map((type) => type.key)
}

function getEventTypeLabel(
  type: SchedulingEventType | string,
  settings: WorkspaceSchedulingSettings,
) {
  return resolveSchedulingEventTypeDefinition(type, settings).label
}

function schedulingStatusLabel(status: SchedulingEventStatus | 'pending') {
  if (status === 'pending') return 'Pending'
  return schedulingStatusLabels[status] ?? status
}

function formatEventTypeSectionGuidance({
  type,
  settings,
}: {
  type: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
}) {
  const sections = resolveSchedulingEventTypeDefinition(type, settings).sections
  if (!sections.length) return 'Appears in Calendar'
  return `Appears in ${sections
    .map((sectionKey) =>
      getSchedulingSectionLabel({
        sectionKey,
        settings,
        preferShort: true,
      }),
    )
    .join(', ')}`
}

function eventTypeBelongsToSectionWithSettings({
  type,
  section,
  settings,
}: {
  type: SchedulingEventType | string
  section: SchedulingSectionKey
  settings: WorkspaceSchedulingSettings
}) {
  return resolveSchedulingEventTypeDefinition(type, settings).sections.includes(
    section,
  )
}

function getEventsForSectionWithSettings({
  events,
  section,
  settings,
}: {
  events: SchedulingEvent[]
  section: SchedulingSectionKey | 'settings'
  settings: WorkspaceSchedulingSettings
}) {
  if (section === 'calendar' || section === 'settings') return events
  return events.filter((event) =>
    eventTypeBelongsToSectionWithSettings({
      type: event.type,
      section,
      settings,
    }),
  )
}

function getPrimaryButtonLabel(capabilities: SchedulingCapabilities) {
  if (capabilities.preset === 'consultative') return 'Schedule Meeting'
  if (capabilities.preset === 'service') return 'New Appointment'
  return 'New Schedule Item'
}

function getSchedulingActionLabel({
  capabilities,
  section,
}: {
  capabilities: SchedulingCapabilities
  section: SchedulingSectionKey
}) {
  if (section === 'calendar') return 'Schedule Event'
  if (section === 'appointments') return 'Schedule Appointment'
  if (section === 'crmMeetings') return 'Schedule Meeting'
  if (section === 'scheduledJobs') return 'Schedule Job'
  if (section === 'internalMeetings') return 'Schedule Internal Meeting'
  if (section === 'pickupDelivery') return 'Schedule Pickup'
  if (section === 'teamAvailability') return 'Add Time Off'
  if (section === 'recurringServices') return 'Add Recurring Service'
  if (section === 'recurringDeliveries') return 'Add Recurring Delivery'
  return getPrimaryButtonLabel(capabilities)
}

function getDefaultEventTypeForSection({
  section,
  capabilities,
  visibleEventTypes,
  settings,
}: {
  section: SchedulingSectionKey | 'settings'
  capabilities: SchedulingCapabilities
  visibleEventTypes: SchedulingEventType[]
  settings: WorkspaceSchedulingSettings
}) {
  const typeOptions = visibleEventTypes.length
    ? visibleEventTypes
    : capabilities.supportedEventTypes
  if (section === 'calendar' || section === 'settings') {
    return typeOptions[0] ?? 'internalMeeting'
  }
  return (
    typeOptions.find((type) =>
      resolveSchedulingEventTypeDefinition(type, settings).sections.includes(
        section,
      ),
    ) ??
    typeOptions[0] ??
    'internalMeeting'
  )
}

function createQuickCustomSchedulingEventType({
  workspaceId,
  label,
  settings,
  capabilities,
}: {
  workspaceId: string
  label: string
  settings: WorkspaceSchedulingSettings
  capabilities: SchedulingCapabilities
}): {
  settings?: WorkspaceSchedulingSettings
  eventType?: SchedulingEventType
  error?: string
} {
  const normalizedLabel = label.replace(/\s+/g, ' ').trim()
  if (normalizedLabel.length < 2 || normalizedLabel.length > 60) {
    return { error: 'Use a clear event type name between 2 and 60 characters.' }
  }
  const customTypes = settings.customEventTypes ?? []
  if (
    customTypes.some(
      (customType) =>
        customType.label.toLowerCase() === normalizedLabel.toLowerCase(),
    )
  ) {
    return { error: 'An event type with that name already exists.' }
  }
  const slug =
    normalizedLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'custom-event'
  const existingKeys = new Set([
    ...capabilities.supportedEventTypes,
    ...customTypes.map((customType) => customType.key),
  ])
  let key = `custom.${slug}`
  let counter = 2
  while (existingKeys.has(key as SchedulingEventType)) {
    key = `custom.${slug}-${counter}`
    counter += 1
  }
  const now = new Date().toISOString()
  const sectionKeys = [
    'calendar',
    ...capabilities.visibleSections
      .filter((sectionKey) => sectionKey !== 'calendar')
      .slice(0, 1),
  ] as SchedulingSectionKey[]
  const customType: WorkspaceSchedulingCustomEventType = {
    id: `custom-event-type-${Date.now().toString(36)}`,
    workspaceId,
    key,
    label: normalizedLabel,
    description: 'Workspace custom event type.',
    presetScope: [capabilities.preset],
    sectionKeys,
    defaultDurationMinutes: defaultEventDurationMinutes,
    blocksAvailability: true,
    requiresLinkedRecord: false,
    supportedLinkedRecordTypes: getSupportedLinkedRecordTypes(capabilities),
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'videoMeeting', 'phoneCall', 'other'],
    defaultLocationType: 'none',
    allowUndeterminedLocation: false,
    isActive: true,
    isSystem: false,
    sortOrder: customTypes.length,
    createdAt: now,
    updatedAt: now,
  }
  return {
    settings: {
      ...settings,
      customEventTypes: [...customTypes, customType],
    },
    eventType: key as SchedulingEventType,
  }
}

function getDefaultRepeatForSection(
  section: SchedulingSectionKey | 'settings',
) {
  return section === 'recurringServices' || section === 'recurringDeliveries'
    ? 'weekly'
    : 'none'
}

function capabilitySummary(capabilities: SchedulingCapabilities) {
  if (capabilities.preset === 'commerce') {
    return 'Commerce scheduling keeps pickup windows, delivery windows, installations, and product events organized without pretending external calendars are connected.'
  }
  if (capabilities.preset === 'consultative') {
    return 'Consultative scheduling connects sales conversations, proposal reviews, project meetings, and team availability to your CRM flow.'
  }
  return 'Service scheduling coordinates appointments, scheduled jobs, recurring service visits, and team availability for field or local service teams.'
}

function getVisibleEventTypes({
  capabilities,
  settings,
}: {
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
}) {
  return getResolvedVisibleEventTypeKeys({ capabilities, settings })
}

export function SchedulingPage({
  workspaceId,
  workspaceSlug,
  businessModel,
  initialCapabilities,
  initialSettings,
  initialEvents = [],
  initialSeries = [],
  initialAvailability = [],
  section,
  canManage,
  schedulingAIEnabled = false,
}: SchedulingPageProps) {
  const [settings, setSettings] = useState<WorkspaceSchedulingSettings>(() =>
    normalizeSchedulingSettings({
      businessModel,
      settings: initialSettings ?? {
        enabled: initialCapabilities.enabled,
        preset: initialCapabilities.preset,
        visibleSections: initialCapabilities.visibleSections,
      },
    }),
  )
  const currentInstant = useCurrentMinute()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<SchedulingCalendarView>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(
    () => getWorkspaceNow({ timezone: 'America/New_York' }).calendarDate,
  )
  const [filters, setFilters] = useState<SchedulingFilters>(
    emptySchedulingFilters,
  )
  const [events, setEvents] = useState<SchedulingEvent[]>(initialEvents)
  const [series, setSeries] = useState<SchedulingSeries[]>(initialSeries)
  const [selectedDate, setSelectedDate] = useState<SchedulingDateKey | null>(
    null,
  )
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<
    string | null
  >(null)
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<
    string | null
  >(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialDate, setCreateInitialDate] =
    useState<SchedulingDateKey | null>(null)
  const [createInitialType, setCreateInitialType] =
    useState<SchedulingEventType | null>(null)
  const [createInitialRepeat, setCreateInitialRepeat] = useState('none')
  const [timeOffOpen, setTimeOffOpen] = useState(false)
  const [editingTimeOffId, setEditingTimeOffId] = useState<string | null>(null)
  const [workingHoursOpen, setWorkingHoursOpen] = useState(false)
  const [editingWorkingHoursId, setEditingWorkingHoursId] = useState<
    string | null
  >(null)
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(
    null,
  )
  const [settingsLoaded, setSettingsLoaded] = useState(true)
  const [memberOptions, setMemberOptions] = useState<SchedulingMemberOption[]>(
    [],
  )
  const [workingHoursTeamOptions, setWorkingHoursTeamOptions] = useState<
    WorkingHoursEntityOption[]
  >([])
  const [workingHoursLocationOptions, setWorkingHoursLocationOptions] =
    useState<WorkingHoursEntityOption[]>([])
  const [availability, setAvailability] =
    useState<TeamAvailabilityRecord[]>(initialAvailability)
  const [recordRefreshKey, setRecordRefreshKey] = useState(0)
  const [schedulingAIContext, setSchedulingAIContext] =
    useState<SchedulingAIContextPayload | null>(null)

  useEffect(() => {
    const saved = normalizeSchedulingSettings({
      businessModel,
      settings: initialSettings ?? {
        enabled: initialCapabilities.enabled,
        preset: initialCapabilities.preset,
        visibleSections: initialCapabilities.visibleSections,
      },
    })
    const routeAwareSettings =
      section !== 'settings' &&
      initialCapabilities.supportedSections.includes(section) &&
      !saved.visibleSections.includes(section)
        ? mergeSchedulingVisibility({
            current: saved,
            nextVisibleSections: [...saved.visibleSections, section],
            supportedSections: initialCapabilities.supportedSections,
          })
        : saved
    setSettings(routeAwareSettings)
    setView(routeAwareSettings.defaultCalendarView)
    setAnchorDate(
      getWorkspaceNow({ timezone: routeAwareSettings.timezone }).calendarDate,
    )
    setSelectedDate(null)
    setSettingsLoaded(true)
    setEvents(initialEvents)
    setSeries(initialSeries)
    setAvailability(initialAvailability)
  }, [
    businessModel,
    initialAvailability,
    initialCapabilities,
    initialEvents,
    initialSeries,
    initialSettings,
    section,
    workspaceId,
  ])

  const capabilities = useMemo(
    () =>
      getWorkspaceSchedulingCapabilities({
        businessModel,
        settings,
      }),
    [businessModel, settings],
  )
  const recordTerminology = useMemo(
    () => getWorkspaceRecordTerminologyForBusinessModel(businessModel),
    [businessModel],
  )
  const refreshSchedulingData = async () => {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/scheduling/events`,
      {
        cache: 'no-store',
      },
    )
    if (!response.ok) throw new Error('Scheduling records unavailable')
    const data = (await response.json()) as {
      settings?: WorkspaceSchedulingSettings
      events?: SchedulingEvent[]
      series?: SchedulingSeries[]
      availability?: TeamAvailabilityRecord[]
    }
    if (data.settings) setSettings(data.settings)
    setEvents(data.events ?? [])
    setSeries(data.series ?? [])
    setAvailability(data.availability ?? [])
  }

  useEffect(() => {
    if (!settingsLoaded) return
    refreshSchedulingData().catch(() => {
      setEvents(initialEvents)
      setAvailability(initialAvailability)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, workspaceId, capabilities.preset, settings.timezone])

  useEffect(() => {
    let cancelled = false
    async function loadMembers() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Members unavailable')
        const data = (await response.json()) as {
          members?: Array<{
            id?: string | null
            userId?: string | null
            fullName?: string | null
            email?: string | null
            role?: string | null
            status?: string | null
            removedAt?: string | null
          }>
        }
        if (!cancelled) {
          setMemberOptions(normalizeSchedulingMemberOptions(data.members ?? []))
        }
      } catch {
        if (!cancelled) setMemberOptions([])
      }
    }
    loadMembers()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    let cancelled = false
    async function loadWorkingHoursEntities() {
      try {
        const [teamsResponse, locationsResponse] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/teams`, { cache: 'no-store' }),
          fetch(`/api/workspaces/${workspaceId}/locations`, {
            cache: 'no-store',
          }),
        ])
        const [teamsData, locationsData] = await Promise.all([
          teamsResponse.ok ? teamsResponse.json() : Promise.resolve({}),
          locationsResponse.ok ? locationsResponse.json() : Promise.resolve({}),
        ])
        if (cancelled) return
        setWorkingHoursTeamOptions(
          ((teamsData as { teams?: WorkspaceTeamSummary[] }).teams ?? [])
            .filter((team) => team.isActive)
            .map((team) => ({
              id: team.id,
              label: team.name,
              secondary: `${team.members.length} member${
                team.members.length === 1 ? '' : 's'
              }`,
            })),
        )
        setWorkingHoursLocationOptions(
          (
            (locationsData as { locations?: WorkspaceLocationSummary[] })
              .locations ?? []
          )
            .filter((location) => location.isActive)
            .map((location) => ({
              id: location.id,
              label: location.name,
              secondary:
                location.city || location.region
                  ? [location.city, location.region].filter(Boolean).join(', ')
                  : (location.timezone ?? undefined),
            })),
        )
      } catch {
        if (!cancelled) {
          setWorkingHoursTeamOptions([])
          setWorkingHoursLocationOptions([])
        }
      }
    }
    loadWorkingHoursEntities()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    const refreshRecords = () => setRecordRefreshKey((current) => current + 1)
    window.addEventListener(workspaceCrmRecordsChangedEvent, refreshRecords)
    window.addEventListener(
      commercePreviewCustomersChangedEvent,
      refreshRecords,
    )
    window.addEventListener(commercePreviewOrdersChangedEvent, refreshRecords)
    window.addEventListener(
      commercePreviewFulfillmentsChangedEvent,
      refreshRecords,
    )
    window.addEventListener(commercePreviewProductsChangedEvent, refreshRecords)
    window.addEventListener('storage', refreshRecords)
    return () => {
      window.removeEventListener(
        workspaceCrmRecordsChangedEvent,
        refreshRecords,
      )
      window.removeEventListener(
        commercePreviewCustomersChangedEvent,
        refreshRecords,
      )
      window.removeEventListener(
        commercePreviewOrdersChangedEvent,
        refreshRecords,
      )
      window.removeEventListener(
        commercePreviewFulfillmentsChangedEvent,
        refreshRecords,
      )
      window.removeEventListener(
        commercePreviewProductsChangedEvent,
        refreshRecords,
      )
      window.removeEventListener('storage', refreshRecords)
    }
  }, [])
  const visibleSections = capabilities.visibleSections.map((sectionKey) => ({
    ...getSchedulingSectionDefinition(sectionKey),
    label: getSchedulingSectionLabel({ sectionKey, settings }),
    shortLabel: getSchedulingSectionLabel({
      sectionKey,
      settings,
      preferShort: true,
    }),
  }))
  const activeDefinition =
    section === 'settings'
      ? null
      : {
          ...getSchedulingSectionDefinition(section),
          label: getSchedulingSectionLabel({ sectionKey: section, settings }),
          shortLabel: getSchedulingSectionLabel({
            sectionKey: section,
            settings,
            preferShort: true,
          }),
        }
  const createActionLabel =
    section === 'settings'
      ? getPrimaryButtonLabel(capabilities)
      : getSchedulingActionLabel({ capabilities, section })
  const canAccess =
    section === 'settings' || canAccessSchedulingSection(capabilities, section)
  const visibleEventTypes = useMemo(
    () => getVisibleEventTypes({ capabilities, settings }),
    [capabilities, settings],
  )
  const filteredEvents = useMemo(
    () =>
      getEventsForSectionWithSettings({ events, section, settings }).filter(
        (event) =>
          eventMatchesSearch(event, query) &&
          eventMatchesFilters(event, filters),
      ),
    [events, filters, query, section, settings],
  )
  const selectedEvent = selectedEventId
    ? (events.find((event) => event.id === selectedEventId) ?? null)
    : null
  const selectedAvailability = selectedAvailabilityId
    ? (availability.find((record) => record.id === selectedAvailabilityId) ??
      null)
    : null
  const activeCalendarPeriod = useMemo(
    () =>
      getCalendarPeriod({
        view,
        anchorDate,
        weekStartsOn: settings.weekStartsOn,
        timezone: settings.timezone,
      }),
    [anchorDate, settings.timezone, settings.weekStartsOn, view],
  )
  const editingTimeOff = editingTimeOffId
    ? (availability.find(
        (
          record,
        ): record is Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> =>
          record.id === editingTimeOffId && record.kind === 'timeOff',
      ) ?? null)
    : null
  const editingWorkingHours = editingWorkingHoursId
    ? (availability.find(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'workingHours' }
        > =>
          record.id === editingWorkingHoursId && record.kind === 'workingHours',
      ) ?? null)
    : null
  const editingException = editingExceptionId
    ? (availability.find(
        (
          record,
        ): record is Extract<
          TeamAvailabilityRecord,
          { kind: 'availabilityException' }
        > =>
          record.id === editingExceptionId &&
          record.kind === 'availabilityException',
      ) ?? null)
    : null

  const updateCalendarAnchor = (nextAnchorDate: Date, nextView = view) => {
    const nextPeriod = getCalendarPeriod({
      view: nextView,
      anchorDate: nextAnchorDate,
      weekStartsOn: settings.weekStartsOn,
      timezone: settings.timezone,
    })
    setAnchorDate(nextAnchorDate)
    setSelectedDate((current) =>
      current && isDateInRange(current, nextPeriod.start, nextPeriod.end)
        ? current
        : null,
    )
  }

  const updateCalendarView = (nextView: SchedulingCalendarView) => {
    const nextPeriod = getCalendarPeriod({
      view: nextView,
      anchorDate,
      weekStartsOn: settings.weekStartsOn,
      timezone: settings.timezone,
    })
    setView(nextView)
    setSelectedDate((current) =>
      current && isDateInRange(current, nextPeriod.start, nextPeriod.end)
        ? current
        : null,
    )
  }

  const resetCalendarToToday = (today: Date) => {
    setAnchorDate(today)
    setSelectedDate(null)
    if (!selectedEventId) {
      setSelectedOccurrenceId(null)
    }
  }

  const persistSettings = (nextSettings: WorkspaceSchedulingSettings) => {
    const previousTimezone = settings.timezone
    const saved = normalizeSchedulingSettings({
      businessModel,
      settings: nextSettings,
    })
    setSettings(saved)
    setView(saved.defaultCalendarView)
    if (saved.timezone !== previousTimezone) {
      setAnchorDate(
        getWorkspaceNow({ timezone: saved.timezone, now: currentInstant })
          .calendarDate,
      )
      setSelectedDate(null)
    }
    fetch(`/api/workspaces/${workspaceId}/scheduling/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: saved }),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Scheduling settings could not be saved.')
        const data = (await response.json()) as {
          settings?: WorkspaceSchedulingSettings
        }
        if (data.settings) {
          setSettings(data.settings)
          window.dispatchEvent(
            new CustomEvent(schedulingSettingsChangedEvent, {
              detail: { workspaceId },
            }),
          )
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Scheduling settings could not be saved.',
        )
      })
  }

  const openCalendarDateInDayView = (date: Date) => {
    setSelectedDate(toDateKey(date))
    setAnchorDate(date)
    setView('day')
    setSelectedEventId(null)
    setSelectedOccurrenceId(null)
  }

  const openCreateForSection = (dateKey: SchedulingDateKey | null = null) => {
    if (section === 'teamAvailability') {
      setTimeOffOpen(true)
      return
    }
    const initialDateResolution = resolveSchedulingCreateInitialDate({
      explicitDateKey: dateKey,
      selectedDate: dateKey ? selectedDate : undefined,
      anchorDate: dateKey ? anchorDate : null,
      timezone: settings.timezone,
      now: currentInstant,
      entryPoint: dateKey ? 'calendar-date-action' : 'section-create-action',
    })
    setCreateInitialDate(initialDateResolution.dateKey)
    setCreateInitialType(
      getDefaultEventTypeForSection({
        section,
        capabilities,
        visibleEventTypes,
        settings,
      }),
    )
    setCreateInitialRepeat(getDefaultRepeatForSection(section))
    setCreateOpen(true)
  }

  const quickAddEventType = (label: string) => {
    if (!canManage) {
      return { error: 'You do not have permission to manage event types.' }
    }
    const result = createQuickCustomSchedulingEventType({
      workspaceId,
      label,
      settings,
      capabilities,
    })
    if (result.settings) {
      persistSettings(result.settings)
    }
    return result.eventType
      ? { label: result.eventType }
      : { error: result.error ?? 'Event type could not be created.' }
  }

  const eventTypesSettingsHref = `/dashboard/${workspaceSlug}/scheduling/settings#event-types`

  const openSchedulingAI = (context: SchedulingAIContextPayload) => {
    setSchedulingAIContext(context)
  }

  const currentSectionAIContext = (): SchedulingAIContextPayload => ({
    entryPoint: section === 'teamAvailability' ? 'teamAvailability' : 'section',
    label: activeDefinition?.label ?? 'Scheduling',
    section,
    references: [
      {
        kind: 'workspace',
        id: workspaceId,
        label: activeDefinition?.label ?? 'Scheduling',
      },
    ],
    calendar: {
      view,
      dateKey: getCalendarDateKey(anchorDate),
      rangeStart: activeCalendarPeriod.rangeStart.toISOString(),
      rangeEnd: activeCalendarPeriod.rangeEnd.toISOString(),
    },
  })

  const currentCalendarAIContext = (): SchedulingAIContextPayload => ({
    entryPoint: 'calendar',
    label: `${viewLabels[view]} calendar · ${formatPeriodLabel({
      view,
      start: activeCalendarPeriod.start,
      end: activeCalendarPeriod.end,
      anchorDate,
    })}`,
    section: 'calendar',
    references: [
      { kind: 'workspace', id: workspaceId, label: 'Scheduling calendar' },
      {
        kind: 'calendar',
        id: `calendar:${view}`,
        label: `${viewLabels[view]} calendar`,
      },
    ],
    calendar: {
      view,
      dateKey: selectedDate ?? getCalendarDateKey(anchorDate),
      rangeStart: activeCalendarPeriod.rangeStart.toISOString(),
      rangeEnd: activeCalendarPeriod.rangeEnd.toISOString(),
    },
  })

  if (!settingsLoaded) {
    return (
      <DashboardShell>
        <PageHeader
          title="Scheduling"
          description="Loading workspace scheduling settings..."
        />
      </DashboardShell>
    )
  }

  if (section !== 'settings' && !canAccess) {
    return (
      <DashboardShell>
        <PageHeader
          title="Scheduling section hidden"
          description="This Scheduling section is hidden or unsupported for the current workspace preset."
          actions={
            <Button asChild variant="outline">
              <Link href={`/dashboard/${workspaceSlug}/scheduling/calendar`}>
                Back to Calendar
              </Link>
            </Button>
          }
        />
      </DashboardShell>
    )
  }

  if (section === 'settings') {
    return (
      <SchedulingSettings
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        capabilities={capabilities}
        settings={settings}
        events={events}
        canManage={canManage}
        memberOptions={memberOptions}
        onSave={persistSettings}
      />
    )
  }
  return (
    <DashboardShell>
      <PageHeader
        title={activeDefinition?.label ?? 'Scheduling'}
        description={capabilitySummary(capabilities)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                openCreateForSection()
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {createActionLabel}
            </Button>
            {schedulingAIEnabled ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  openSchedulingAI(
                    section === 'calendar'
                      ? currentCalendarAIContext()
                      : currentSectionAIContext(),
                  )
                }
                leftIcon={<Bot className="h-4 w-4" />}
              >
                Ask Scheduling AI
              </Button>
            ) : null}
            {canManage ? (
              <Link
                href={`/dashboard/${workspaceSlug}/scheduling/settings`}
                className="focus-visible:ring-brand-primary/70 border-app bg-app-surface-raised text-app-primary hover:bg-app-surface-hover inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition hover:border-cyan-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)] dark:border-slate-600 dark:bg-slate-900 dark:text-neutral-100 dark:hover:border-cyan-300/45 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
              >
                <Settings className="h-4 w-4" />
                Scheduling Settings
              </Link>
            ) : null}
          </div>
        }
      />

      <SchedulingTabs
        workspaceSlug={workspaceSlug}
        sections={visibleSections}
        activeSection={section}
      />

      {section === 'calendar' ? (
        <CalendarWorkspace
          view={view}
          events={filteredEvents}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={visibleEventTypes}
          anchorDate={anchorDate}
          selectedDate={selectedDate}
          setAnchorDate={updateCalendarAnchor}
          onTodayClick={resetCalendarToToday}
          setView={updateCalendarView}
          currentInstant={currentInstant}
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          memberOptions={memberOptions}
          onOpenDateInDayView={openCalendarDateInDayView}
          onCreateForDate={(dateKey) => {
            openCreateForSection(dateKey)
          }}
          onOpenEvent={(event) => {
            setSelectedEventId(
              event.recurrenceSeriesId ? event.id : event.sourceEventId,
            )
            setSelectedOccurrenceId(event.occurrenceId)
          }}
          onOpenSchedulingAI={
            schedulingAIEnabled
              ? () => openSchedulingAI(currentCalendarAIContext())
              : undefined
          }
        />
      ) : section === 'recurringServices' ||
        section === 'recurringDeliveries' ? (
        <RecurringWorkspace
          section={section}
          settings={settings}
          series={series}
          capabilities={capabilities}
          visibleEventTypes={visibleEventTypes}
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          memberOptions={memberOptions}
        />
      ) : section === 'teamAvailability' ? (
        <TeamAvailabilityWorkspace
          events={events.filter(
            (event) =>
              eventMatchesSearch(event, query) &&
              eventMatchesFilters(event, filters),
          )}
          availability={availability}
          settings={settings}
          memberOptions={memberOptions}
          onAddWorkingHours={() => setWorkingHoursOpen(true)}
          onAddException={() => setExceptionOpen(true)}
          onOpenAvailability={(record) => setSelectedAvailabilityId(record.id)}
          onOpenEvent={(event) => {
            if ('sourceEventId' in event && 'occurrenceId' in event) {
              setSelectedEventId(
                event.recurrenceSeriesId
                  ? String(event.id)
                  : String(event.sourceEventId),
              )
              setSelectedOccurrenceId(String(event.occurrenceId))
              return
            }
            setSelectedEventId(event.id)
            setSelectedOccurrenceId(null)
          }}
          onOpenSchedulingAI={
            schedulingAIEnabled
              ? () =>
                  openSchedulingAI({
                    ...currentSectionAIContext(),
                    entryPoint: 'teamAvailability',
                    label: 'Team Availability',
                  })
              : undefined
          }
        />
      ) : (
        <SectionWorkspace
          section={section}
          settings={settings}
          events={filteredEvents}
          capabilities={capabilities}
          visibleEventTypes={visibleEventTypes}
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          memberOptions={memberOptions}
          onOpenEvent={(event) => {
            setSelectedEventId(event.id)
            setSelectedOccurrenceId(null)
          }}
        />
      )}

      {createOpen ? (
        <SchedulingCreateModal
          workspaceId={workspaceId}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={visibleEventTypes}
          memberOptions={memberOptions}
          recordRefreshKey={recordRefreshKey}
          availability={availability}
          createLabel={createActionLabel}
          initialDate={createInitialDate}
          initialEventType={createInitialType}
          initialRepeat={createInitialRepeat}
          eventTypesSettingsHref={eventTypesSettingsHref}
          onCreateEventType={quickAddEventType}
          recordTerminology={recordTerminology}
          onClose={() => {
            setCreateOpen(false)
            setCreateInitialDate(null)
            setCreateInitialType(null)
            setCreateInitialRepeat('none')
          }}
          onCreated={(event) => {
            setCreateOpen(false)
            setCreateInitialDate(null)
            setCreateInitialType(null)
            setCreateInitialRepeat('none')
            setEvents((current) =>
              current.some((existing) => existing.id === event.id)
                ? current.map((existing) =>
                    existing.id === event.id ? event : existing,
                  )
                : [...current, event],
            )
            refreshSchedulingData().catch(() => undefined)
            setSelectedEventId(event.id)
            setSelectedOccurrenceId(null)
          }}
        />
      ) : null}
      {timeOffOpen ? (
        <TimeOffModal
          workspaceId={workspaceId}
          settings={settings}
          memberOptions={memberOptions}
          onClose={() => setTimeOffOpen(false)}
          onCreated={(record) => {
            setTimeOffOpen(false)
            refreshSchedulingData().catch(() => undefined)
            setSelectedAvailabilityId(record.id)
          }}
        />
      ) : null}
      {editingTimeOff ? (
        <TimeOffModal
          workspaceId={workspaceId}
          settings={settings}
          memberOptions={memberOptions}
          initialRecord={editingTimeOff}
          onClose={() => setEditingTimeOffId(null)}
          onCreated={(record) => {
            setEditingTimeOffId(null)
            refreshSchedulingData().catch(() => undefined)
            setSelectedAvailabilityId(record.id)
          }}
        />
      ) : null}
      {workingHoursOpen || editingWorkingHours ? (
        <WorkingHoursModal
          workspaceId={workspaceId}
          settings={settings}
          memberOptions={memberOptions}
          teamOptions={workingHoursTeamOptions}
          locationOptions={workingHoursLocationOptions}
          onCreateTeam={(team) => {
            const option = {
              id: team.id,
              label: team.name,
              secondary: `${team.members.length} member${
                team.members.length === 1 ? '' : 's'
              }`,
            }
            setWorkingHoursTeamOptions((current) => [
              option,
              ...current.filter((item) => item.id !== option.id),
            ])
            return option
          }}
          onCreateLocation={(location) => {
            const option = {
              id: location.id,
              label: location.name,
              secondary:
                location.city || location.region
                  ? [location.city, location.region].filter(Boolean).join(', ')
                  : (location.timezone ?? undefined),
            }
            setWorkingHoursLocationOptions((current) => [
              option,
              ...current.filter((item) => item.id !== option.id),
            ])
            return option
          }}
          initialRecord={editingWorkingHours}
          onClose={() => {
            setWorkingHoursOpen(false)
            setEditingWorkingHoursId(null)
          }}
          onSaved={(record) => {
            setWorkingHoursOpen(false)
            setEditingWorkingHoursId(null)
            refreshSchedulingData().catch(() => undefined)
            setSelectedAvailabilityId(record.id)
          }}
        />
      ) : null}
      {exceptionOpen || editingException ? (
        <AvailabilityExceptionModal
          workspaceId={workspaceId}
          settings={settings}
          memberOptions={memberOptions}
          initialRecord={editingException}
          onClose={() => {
            setExceptionOpen(false)
            setEditingExceptionId(null)
          }}
          onSaved={(record) => {
            setExceptionOpen(false)
            setEditingExceptionId(null)
            refreshSchedulingData().catch(() => undefined)
            setSelectedAvailabilityId(record.id)
          }}
        />
      ) : null}
      {selectedEvent ? (
        <SchedulingEventDrawer
          event={selectedEvent}
          occurrenceId={selectedOccurrenceId}
          workspaceSlug={workspaceSlug}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={visibleEventTypes}
          memberOptions={memberOptions}
          recordRefreshKey={recordRefreshKey}
          eventTypesSettingsHref={eventTypesSettingsHref}
          onCreateEventType={quickAddEventType}
          recordTerminology={recordTerminology}
          onClose={() => {
            setSelectedEventId(null)
            setSelectedOccurrenceId(null)
          }}
          onChanged={() => {
            refreshSchedulingData().catch(() => undefined)
          }}
          onAskAI={
            schedulingAIEnabled
              ? () =>
                  openSchedulingAI(
                    getEventSchedulingAIContext({
                      event: selectedEvent,
                      memberOptions,
                      settings,
                    }),
                  )
              : undefined
          }
        />
      ) : null}
      {selectedAvailability ? (
        <SchedulingAvailabilityDrawer
          record={selectedAvailability}
          settings={settings}
          onEdit={() => {
            setSelectedAvailabilityId(null)
            if (selectedAvailability.kind === 'timeOff')
              setEditingTimeOffId(selectedAvailability.id)
            if (selectedAvailability.kind === 'workingHours')
              setEditingWorkingHoursId(selectedAvailability.id)
            if (selectedAvailability.kind === 'availabilityException')
              setEditingExceptionId(selectedAvailability.id)
          }}
          onDeleted={() => {
            refreshSchedulingData().catch(() => undefined)
            setSelectedAvailabilityId(null)
          }}
          onClose={() => setSelectedAvailabilityId(null)}
        />
      ) : null}
      <SchedulingAIPanel
        workspaceId={workspaceId}
        open={Boolean(schedulingAIContext)}
        context={schedulingAIContext}
        onOpenEvent={(eventId) => {
          setSelectedEventId(eventId)
          setSchedulingAIContext(null)
        }}
        onClose={() => setSchedulingAIContext(null)}
      />
    </DashboardShell>
  )
}

function SchedulingTabs({
  workspaceSlug,
  sections,
  activeSection,
}: {
  workspaceSlug: string
  sections: Array<{
    key: SchedulingSectionKey
    shortLabel: string
    route: string
  }>
  activeSection: SchedulingSectionKey
}) {
  return (
    <div className="relative z-0 mb-5 flex flex-wrap gap-2 overflow-visible pb-1">
      {sections.map((section) => (
        <Link
          key={section.key}
          href={`/dashboard/${workspaceSlug}${section.route}`}
          title={section.shortLabel}
          className={cn(
            'max-w-full shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
            activeSection === section.key
              ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300/60 dark:bg-cyan-300/10 dark:text-cyan-100'
              : 'border-app bg-app-surface-raised text-app-secondary hover:bg-app-surface-hover hover:text-app-primary hover:border-cyan-500/35 dark:border-slate-700 dark:bg-slate-900/50 dark:text-neutral-300 dark:hover:border-cyan-300/35 dark:hover:bg-cyan-300/[0.05] dark:hover:text-white',
          )}
        >
          {section.shortLabel}
        </Link>
      ))}
    </div>
  )
}

export function CalendarWorkspace({
  view,
  setView,
  events,
  capabilities,
  settings,
  visibleEventTypes,
  anchorDate,
  selectedDate,
  setAnchorDate,
  onTodayClick,
  query,
  setQuery,
  filters,
  setFilters,
  memberOptions,
  currentInstant,
  onOpenDateInDayView,
  onCreateForDate,
  onOpenEvent,
  onOpenSchedulingAI,
}: {
  view: SchedulingCalendarView
  setView: (view: SchedulingCalendarView) => void
  events: SchedulingEvent[]
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  visibleEventTypes: SchedulingEventType[]
  anchorDate: Date
  selectedDate: SchedulingDateKey | null
  setAnchorDate: (date: Date) => void
  onTodayClick: (date: Date) => void
  currentInstant: Date
  query: string
  setQuery: (query: string) => void
  filters: SchedulingFilters
  setFilters: (filters: SchedulingFilters) => void
  memberOptions: SchedulingMemberOption[]
  onOpenDateInDayView: (date: Date) => void
  onCreateForDate: (dateKey: SchedulingDateKey) => void
  onOpenEvent: (event: SchedulingOccurrence) => void
  onOpenSchedulingAI?: () => void
}) {
  const workspaceNow = getWorkspaceNow({
    timezone: settings.timezone,
    now: currentInstant,
  })
  const period = getCalendarPeriod({
    view,
    anchorDate,
    weekStartsOn: settings.weekStartsOn,
    timezone: settings.timezone,
  })
  const occurrences = useMemo(
    () =>
      getSchedulingOccurrencesForRange({
        events,
        rangeStart: period.rangeStart,
        rangeEnd: period.rangeEnd,
        timezone: settings.timezone,
      }),
    [events, period.rangeEnd, period.rangeStart, settings.timezone],
  )
  const upcoming = getUpcomingEventsForVisibleRange({
    occurrences,
    rangeStart: period.rangeStart,
    rangeEnd: period.rangeEnd,
    now: currentInstant,
    limit: view === 'month' ? 7 : 5,
  })
  const summaryTitle = getScheduleSummaryTitle({
    view,
    anchorDate,
    today: workspaceNow.calendarDate,
  })
  const summaryEmptyMessage = getScheduleSummaryEmptyMessage(view)
  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Previous period"
              onClick={() =>
                setAnchorDate(
                  moveCalendarAnchor({ view, anchorDate, direction: -1 }),
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTodayClick(workspaceNow.calendarDate)}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Next period"
              onClick={() =>
                setAnchorDate(
                  moveCalendarAnchor({ view, anchorDate, direction: 1 }),
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-app-primary text-sm font-semibold">
              {formatPeriodLabel({
                view,
                start: period.start,
                end: period.end,
                anchorDate,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSchedulingAI ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenSchedulingAI}
                leftIcon={<Bot className="h-4 w-4" />}
              >
                Ask Scheduling AI
              </Button>
            ) : null}
            {Object.entries(viewLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as SchedulingCalendarView)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  view === key
                    ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300/60 dark:bg-cyan-300/10 dark:text-cyan-100'
                    : 'border-app bg-app-surface-raised text-app-secondary hover:bg-app-surface-hover hover:text-app-primary hover:border-cyan-500/35 dark:border-slate-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-slate-900 dark:hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SchedulingSearch
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={visibleEventTypes}
          events={events}
          memberOptions={memberOptions}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="border-app flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-app-primary text-sm font-semibold">
                {viewLabels[view]} calendar
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-xs">
                External calendar sync is not connected yet.
              </p>
            </div>
            {view === 'day' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-center sm:w-auto"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => onCreateForDate(getCalendarDateKey(anchorDate))}
              >
                Schedule Event
              </Button>
            ) : null}
          </div>
          <CalendarView
            view={view}
            anchorDate={anchorDate}
            selectedDate={selectedDate}
            todayDate={workspaceNow.calendarDate}
            timezone={settings.timezone}
            periodStart={period.start}
            periodEnd={period.end}
            occurrences={occurrences}
            weekStartsOn={settings.weekStartsOn}
            onOpenEvent={onOpenEvent}
            onSelectDate={onOpenDateInDayView}
          />
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="text-app-primary text-sm font-semibold">
              {summaryTitle}
            </h2>
            <EventList
              events={upcoming}
              timezone={settings.timezone}
              onOpenEvent={onOpenEvent}
              emptyMessage={summaryEmptyMessage}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setView('agenda')}
            >
              View agenda
            </Button>
          </Card>
          <Card className="p-4">
            <h2 className="text-app-primary text-sm font-semibold">
              Event types
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleEventTypes.map((type) => (
                <Badge key={type} variant="blue">
                  {getEventTypeLabel(type, settings)}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SchedulingSearch({
  query,
  setQuery,
  filters,
  setFilters,
  capabilities,
  settings,
  visibleEventTypes,
  events,
  memberOptions,
}: {
  query: string
  setQuery: (query: string) => void
  filters: SchedulingFilters
  setFilters: (filters: SchedulingFilters) => void
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  visibleEventTypes: SchedulingEventType[]
  events: SchedulingEvent[]
  memberOptions: SchedulingMemberOption[]
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeCount = getActiveFilterCount(filters)
  const assignedMembers = Array.from(
    new Set(events.flatMap((event) => event.assignedMemberIds)),
  ).sort()
  const memberLabelById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.label])),
    [memberOptions],
  )
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schedule, linked records, or locations..."
            className="pl-9 pr-9"
            aria-label="Search schedule"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear scheduling search"
              onClick={() => setQuery('')}
              className="text-app-secondary hover:bg-app-surface-hover hover:text-app-primary absolute right-2 top-1/2 rounded-lg p-1 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </Button>
      </div>
      {activeCount ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters)
            .filter(([, value]) => value !== 'ALL')
            .map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilters({ ...filters, [key]: 'ALL' })}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-700 hover:bg-cyan-500/15 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100 dark:hover:bg-cyan-300/15"
              >
                {String(value)} ×
              </button>
            ))}
        </div>
      ) : null}
      {filtersOpen ? (
        <div className="border-app bg-app-surface-raised grid gap-3 rounded-2xl border p-3 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-950/80 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Event type"
            value={filters.eventType}
            onChange={(value) =>
              setFilters({
                ...filters,
                eventType: value as SchedulingFilters['eventType'],
              })
            }
          >
            <option value="ALL">All types</option>
            {visibleEventTypes.map((type) => (
              <option key={type} value={type}>
                {getEventTypeLabel(type, settings)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) =>
              setFilters({
                ...filters,
                status: value as SchedulingFilters['status'],
              })
            }
          >
            <option value="ALL">All statuses</option>
            {Object.entries(schedulingStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Assigned"
            value={filters.assignedMemberId}
            onChange={(value) =>
              setFilters({ ...filters, assignedMemberId: value })
            }
          >
            <option value="ALL">Anyone</option>
            {assignedMembers.map((member) => (
              <option key={member} value={member}>
                {memberLabelById.get(member) ?? humanizeMemberId(member)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Linked record"
            value={filters.linkedRecordType}
            onChange={(value) =>
              setFilters({
                ...filters,
                linkedRecordType:
                  value as SchedulingFilters['linkedRecordType'],
              })
            }
          >
            <option value="ALL">Any linked record</option>
            {getSupportedLinkedRecordTypes(capabilities).map((recordType) => (
              <option key={recordType} value={recordType}>
                {formatLinkedRecordType(recordType)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Link state"
            value={filters.linkState}
            onChange={(value) =>
              setFilters({
                ...filters,
                linkState: value as SchedulingFilters['linkState'],
              })
            }
          >
            <option value="ALL">Linked or unlinked</option>
            <option value="LINKED">Has linked record</option>
            <option value="UNLINKED">No linked record</option>
          </FilterSelect>
          <FilterSelect
            label="Repeat"
            value={filters.recurrence}
            onChange={(value) =>
              setFilters({
                ...filters,
                recurrence: value as SchedulingFilters['recurrence'],
              })
            }
          >
            <option value="ALL">One-time or recurring</option>
            <option value="RECURRING">Recurring</option>
            <option value="ONE_TIME">One-time</option>
          </FilterSelect>
          <FilterSelect
            label="Timing"
            value={filters.timing}
            onChange={(value) =>
              setFilters({
                ...filters,
                timing: value as SchedulingFilters['timing'],
              })
            }
          >
            <option value="ALL">All-day or timed</option>
            <option value="ALL_DAY">All-day</option>
            <option value="TIMED">Timed</option>
          </FilterSelect>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setFilters(emptySchedulingFilters)}
            >
              Clear all
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
      </span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Select>
    </label>
  )
}

type CalendarDateViewMode = 'month' | 'day' | 'week'

function getCalendarTodayTreatment({
  mode,
  isToday,
  isInActiveMonth = true,
}: {
  mode: CalendarDateViewMode
  isToday: boolean
  isInActiveMonth?: boolean
}) {
  if (!isToday) {
    return {
      cell: '',
      dateNumber:
        !isInActiveMonth && mode === 'month'
          ? 'text-neutral-text-secondary'
          : '',
      badge: 'hidden',
    }
  }
  return {
    cell: '',
    dateNumber:
      mode === 'month' && !isInActiveMonth
        ? 'bg-cyan-300/10 text-cyan-100/75'
        : 'bg-cyan-300/18 text-cyan-100',
    badge:
      mode === 'day'
        ? 'shrink-0 rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100'
        : 'shrink-0 rounded-full bg-cyan-300/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-100/90',
  }
}

export function CalendarView({
  view,
  anchorDate,
  selectedDate,
  todayDate,
  timezone,
  periodStart,
  periodEnd,
  occurrences,
  weekStartsOn,
  onOpenEvent,
  onSelectDate,
}: {
  view: SchedulingCalendarView
  anchorDate: Date
  selectedDate: SchedulingDateKey | null
  todayDate: Date
  timezone: string
  periodStart: Date
  periodEnd: Date
  occurrences: SchedulingOccurrence[]
  weekStartsOn: 0 | 1
  onOpenEvent: (event: SchedulingOccurrence) => void
  onSelectDate: (date: Date) => void
}) {
  if (view === 'agenda') {
    return (
      <AgendaView
        occurrences={occurrences}
        timezone={timezone}
        onOpenEvent={onOpenEvent}
      />
    )
  }
  if (view === 'month') {
    const days = Array.from({ length: 42 }, (_, index) =>
      addDays(periodStart, index),
    )
    return (
      <div className="grid min-h-[520px] gap-px bg-slate-800/80 p-px sm:grid-cols-7">
        {days.map((day) => {
          const dayKey = getCalendarDateKey(day)
          const dayEvents = eventsForDay(occurrences, day, timezone)
          const visual = getCalendarDateVisualState({
            date: day,
            today: todayDate,
            selectedDate,
            activeRange: { start: periodStart, end: periodEnd },
            activeMonth: anchorDate,
          })
          const todayTreatment = getCalendarTodayTreatment({
            mode: 'month',
            isToday: visual.isToday,
            isInActiveMonth: visual.isInActiveMonth,
          })
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              aria-current={visual.isToday ? 'date' : undefined}
              aria-label={`${new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }).format(day)}${visual.isToday ? ', today' : ''}`}
              data-calendar-date={dayKey}
              data-calendar-today={visual.isToday ? 'true' : undefined}
              data-calendar-selected={visual.isSelected ? 'true' : undefined}
              onClick={() => onSelectDate(day)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectDate(day)
                }
              }}
              className={cn(
                'cursor-pointer',
                'flex min-h-28 flex-col bg-slate-950/90 p-2 text-left transition hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                !visual.isInActiveMonth && 'bg-slate-950/70 opacity-65',
                visual.isToday &&
                  !visual.isSelected &&
                  'shadow-[0_0_16px_rgba(34,211,238,0.10)] ring-1 ring-inset ring-cyan-300/30',
                visual.isSelected &&
                  'shadow-[0_0_14px_rgba(96,165,250,0.10)] ring-1 ring-inset ring-blue-300/50',
                todayTreatment.cell,
              )}
            >
              <div
                className="flex h-7 shrink-0 items-start justify-start"
                data-month-day-header="true"
              >
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold text-neutral-200',
                    todayTreatment.dateNumber,
                    visual.isSelected &&
                      !visual.isToday &&
                      'bg-blue-300/12 text-blue-100',
                    visual.isToday &&
                      visual.isSelected &&
                      'bg-cyan-300/25 text-white',
                  )}
                >
                  {parseSchedulingDateKey(dayKey).day}
                </span>
              </div>
              <div
                className="mt-1 space-y-1 overflow-hidden"
                data-month-day-events="true"
              >
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill
                    key={event.occurrenceId}
                    event={event}
                    compact
                    timezone={timezone}
                    onOpenEvent={onOpenEvent}
                  />
                ))}
                {dayEvents.length > 3 ? (
                  <span className="text-[11px] text-cyan-200">
                    + {dayEvents.length - 3} more
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  const days =
    view === 'day'
      ? [startOfDay(anchorDate)]
      : Array.from({ length: 7 }, (_, index) => addDays(periodStart, index))
  return (
    <div
      className={cn(
        'grid min-h-[420px] gap-px bg-slate-800/80 p-px',
        view === 'week' && 'sm:grid-cols-7',
      )}
    >
      {days.map((day) => {
        const dayKey = getCalendarDateKey(day)
        const dayEvents = eventsForDay(occurrences, day, timezone)
        const visual = getCalendarDateVisualState({
          date: day,
          today: todayDate,
          selectedDate,
          activeRange: { start: periodStart, end: periodEnd },
        })
        const todayTreatment = getCalendarTodayTreatment({
          mode: view === 'day' ? 'day' : 'week',
          isToday: visual.isToday,
        })
        const heading = new Intl.DateTimeFormat('en-US', {
          weekday: view === 'day' ? 'long' : 'short',
          month: view === 'day' ? 'long' : undefined,
        }).format(day)
        return (
          <div
            key={day.toISOString()}
            aria-current={visual.isToday ? 'date' : undefined}
            data-calendar-date={dayKey}
            data-calendar-today={visual.isToday ? 'true' : undefined}
            data-calendar-selected={visual.isSelected ? 'true' : undefined}
            onClick={view === 'week' ? () => onSelectDate(day) : undefined}
            className={cn(
              'relative min-h-36 bg-slate-950/90 p-3',
              view === 'week' &&
                'cursor-pointer transition hover:bg-slate-900/90',
              visual.isToday &&
                view === 'week' &&
                !visual.isSelected &&
                'shadow-[0_0_16px_rgba(34,211,238,0.10)] ring-1 ring-inset ring-cyan-300/30',
              visual.isSelected &&
                'shadow-[0_0_14px_rgba(96,165,250,0.10)] ring-1 ring-inset ring-blue-300/50',
              todayTreatment.cell,
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {visual.isToday && view === 'week' ? (
                <button
                  type="button"
                  className="bg-cyan-300/12 hover:bg-cyan-300/16 inline-flex max-w-full shrink-0 items-center justify-center gap-1 rounded-full border border-cyan-300/30 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100 transition hover:border-cyan-200/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  aria-label={`${new Intl.DateTimeFormat('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  }).format(day)}, today`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectDate(day)
                  }}
                >
                  <span>{heading}</span>
                  <span>{parseSchedulingDateKey(dayKey).day}</span>
                </button>
              ) : (
                <>
                  {view === 'week' ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-left transition hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      aria-label={`Open ${new Intl.DateTimeFormat('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      }).format(day)} in Day view`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectDate(day)
                      }}
                    >
                      <span className="text-neutral-text-secondary text-xs font-medium">
                        {heading}
                      </span>
                      <span
                        className={cn(
                          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-neutral-200',
                          todayTreatment.dateNumber,
                        )}
                      >
                        {parseSchedulingDateKey(dayKey).day}
                      </span>
                    </button>
                  ) : (
                    <>
                      <p className="text-neutral-text-secondary text-xs font-medium">
                        {heading}
                      </p>
                      <span
                        className={cn(
                          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-neutral-200',
                          todayTreatment.dateNumber,
                        )}
                      >
                        {parseSchedulingDateKey(dayKey).day}
                      </span>
                    </>
                  )}
                  {visual.isToday ? (
                    <span className={todayTreatment.badge}>Today</span>
                  ) : null}
                </>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <EventPill
                    key={event.occurrenceId}
                    event={event}
                    timezone={timezone}
                    onOpenEvent={onOpenEvent}
                  />
                ))
              ) : (
                <p className="text-neutral-text-secondary rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-sm">
                  No events
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgendaView({
  occurrences,
  timezone,
  onOpenEvent,
}: {
  occurrences: SchedulingOccurrence[]
  timezone: string
  onOpenEvent: (event: SchedulingOccurrence) => void
}) {
  if (!occurrences.length) {
    return (
      <div className="text-neutral-text-secondary px-4 py-12 text-center text-sm">
        No agenda records in this period.
      </div>
    )
  }
  const grouped = occurrences.reduce<Map<string, SchedulingOccurrence[]>>(
    (map, event) => {
      const key = getWorkspaceDateKey(event.startsAt, timezone)
      map.set(key, [...(map.get(key) ?? []), event])
      return map
    },
    new Map(),
  )
  return (
    <div className="divide-y divide-slate-800">
      {Array.from(grouped.entries()).map(([date, events]) => (
        <div
          key={date}
          className="grid gap-3 px-4 py-4 md:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <p className="text-sm font-semibold text-neutral-100">
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(dateKeyToCalendarDate(date))}
          </p>
          <div className="space-y-2">
            {events.map((event) => (
              <EventPill
                key={event.occurrenceId}
                event={event}
                timezone={timezone}
                onOpenEvent={onOpenEvent}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function sameDay(first: Date, second: Date) {
  return startOfDay(first).getTime() === startOfDay(second).getTime()
}

function eventsForDay(
  events: SchedulingOccurrence[],
  day: Date,
  timezone: string,
) {
  const dayKey = getCalendarDateKey(day)
  return events.filter(
    (event) => getWorkspaceDateKey(event.startsAt, timezone) === dayKey,
  )
}

function SectionWorkspace({
  section,
  settings,
  events,
  capabilities,
  visibleEventTypes,
  query,
  setQuery,
  filters,
  setFilters,
  memberOptions,
  onOpenEvent,
}: {
  section: SchedulingSectionKey
  settings: WorkspaceSchedulingSettings
  events: SchedulingEvent[]
  capabilities: SchedulingCapabilities
  visibleEventTypes: SchedulingEventType[]
  query: string
  setQuery: (query: string) => void
  filters: SchedulingFilters
  setFilters: (filters: SchedulingFilters) => void
  memberOptions: SchedulingMemberOption[]
  onOpenEvent: (event: SchedulingEvent | SchedulingOccurrence) => void
}) {
  const definition = getSchedulingSectionDefinition(section)
  const sectionLabel = getSchedulingSectionLabel({
    sectionKey: section,
    settings,
  })
  const sectionFilterEventTypes = visibleEventTypes.filter((type) =>
    eventTypeBelongsToSectionWithSettings({ type, section, settings }),
  )
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <h2 className="text-app-primary text-sm font-semibold">
          {sectionLabel}
        </h2>
        <p className="text-app-secondary text-sm">{definition.description}</p>
        <SchedulingSearch
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={sectionFilterEventTypes}
          events={events}
          memberOptions={memberOptions}
        />
      </Card>
      <Card className="overflow-hidden">
        <div className="text-app-secondary border-app grid grid-cols-4 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
          <span>Schedule</span>
          <span>Record</span>
          <span>Team</span>
          <span>Status</span>
        </div>
        {events.length ? (
          events.map((event) => (
            <ScheduleRow
              key={event.id}
              event={event}
              settings={settings}
              memberOptions={memberOptions}
              onOpenEvent={onOpenEvent}
            />
          ))
        ) : (
          <EmptyScheduleState
            title={getSectionEmptyTitle(section)}
            actionLabel={getSchedulingActionLabel({ capabilities, section })}
          />
        )}
      </Card>
    </div>
  )
}

function RecurringWorkspace({
  section,
  settings,
  series,
  capabilities,
  visibleEventTypes,
  query,
  setQuery,
  filters,
  setFilters,
  memberOptions,
}: {
  section: SchedulingSectionKey
  settings: WorkspaceSchedulingSettings
  series: SchedulingSeries[]
  capabilities: SchedulingCapabilities
  visibleEventTypes: SchedulingEventType[]
  query: string
  setQuery: (query: string) => void
  filters: SchedulingFilters
  setFilters: (filters: SchedulingFilters) => void
  memberOptions: SchedulingMemberOption[]
}) {
  const relevantSeries = series.filter((item) =>
    section === 'recurringDeliveries'
      ? item.eventType === 'recurringDelivery'
      : item.eventType === 'recurringServiceVisit',
  )
  const filteredSeries = relevantSeries.filter(
    (item) =>
      seriesMatchesSearch(item, query) && seriesMatchesFilters(item, filters),
  )
  const title = getSchedulingSectionLabel({ sectionKey: section, settings })
  const definition = getSchedulingSectionDefinition(section)
  const sectionFilterEventTypes = visibleEventTypes.filter((type) =>
    eventTypeBelongsToSectionWithSettings({ type, section, settings }),
  )
  const searchEvents = relevantSeries.map((item) =>
    seriesToFilterEvent(item, settings.timezone),
  )
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <h2 className="text-app-primary text-sm font-semibold">{title}</h2>
        <p className="text-app-secondary text-sm">{definition.description}</p>
        <p className="text-app-secondary text-sm">
          Series are modeled separately from individual calendar occurrences.
        </p>
        <SchedulingSearch
          query={query}
          setQuery={setQuery}
          filters={filters}
          setFilters={setFilters}
          capabilities={capabilities}
          settings={settings}
          visibleEventTypes={sectionFilterEventTypes}
          events={searchEvents}
          memberOptions={memberOptions}
        />
      </Card>
      <Card className="overflow-hidden">
        <div className="text-app-secondary border-app grid gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] md:grid-cols-5">
          <span className="md:col-span-2">Plan</span>
          <span>Frequency</span>
          <span>Next visit</span>
          <span>Status</span>
        </div>
        {filteredSeries.length ? (
          filteredSeries.map((item) => (
            <div
              key={item.id}
              className="border-app grid gap-3 border-b px-4 py-4 md:grid-cols-5"
            >
              <div className="md:col-span-2">
                <p className="text-app-primary font-medium">{item.title}</p>
                <p className="text-app-secondary text-sm">
                  {item.linkedRecord?.label}
                </p>
              </div>
              <p className="text-app-primary text-sm">
                Every{' '}
                {item.recurrenceRule.interval === 1
                  ? ''
                  : item.recurrenceRule.interval}{' '}
                {item.recurrenceRule.frequency}
              </p>
              <p className="text-app-primary text-sm">
                Next: {formatDateTime(item.nextOccurrenceAt)}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="green">{item.status}</Badge>
                <Button type="button" size="xs" variant="outline" disabled>
                  View series later
                </Button>
              </div>
            </div>
          ))
        ) : (
          <EmptyScheduleState
            title={getSectionEmptyTitle(section)}
            actionLabel={getSchedulingActionLabel({ capabilities, section })}
          />
        )}
      </Card>
    </div>
  )
}

function getSectionEmptyTitle(section: SchedulingSectionKey) {
  if (section === 'scheduledJobs') return 'No scheduled jobs yet.'
  if (section === 'recurringServices') return 'No recurring service plans yet.'
  if (section === 'recurringDeliveries')
    return 'No recurring delivery series yet.'
  if (section === 'internalMeetings') return 'No internal meetings scheduled.'
  if (section === 'appointments') return 'No appointments scheduled.'
  if (section === 'crmMeetings') return 'No sales meetings scheduled.'
  return 'No schedule records yet.'
}

function seriesToFilterEvent(
  series: SchedulingSeries,
  timezone: string,
): SchedulingEvent {
  return {
    id: series.id,
    workspaceId: series.workspaceId,
    title: series.title,
    type: series.eventType,
    status: 'scheduled',
    startsAt: series.nextOccurrenceAt,
    endsAt: series.nextOccurrenceAt,
    allDay: false,
    timezone,
    assignedMemberIds: series.assignedMemberIds,
    linkedRecord: series.linkedRecord,
    recurrenceRule: series.recurrenceRule,
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
  }
}

function seriesMatchesSearch(series: SchedulingSeries, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [
    series.title,
    series.status,
    series.linkedRecord?.label,
    series.linkedRecord?.recordType,
    series.assignedMemberIds.join(' '),
    getSchedulingEventTypeDefinition(series.eventType).label,
    series.recurrenceRule.frequency,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

function seriesMatchesFilters(
  series: SchedulingSeries,
  filters: SchedulingFilters,
) {
  if (filters.eventType !== 'ALL' && series.eventType !== filters.eventType)
    return false
  if (
    filters.assignedMemberId !== 'ALL' &&
    !series.assignedMemberIds.includes(filters.assignedMemberId)
  ) {
    return false
  }
  if (
    filters.linkedRecordType !== 'ALL' &&
    series.linkedRecord?.recordType !== filters.linkedRecordType
  ) {
    return false
  }
  if (filters.linkState === 'LINKED' && !series.linkedRecord) return false
  if (filters.linkState === 'UNLINKED' && series.linkedRecord) return false
  if (filters.recurrence === 'ONE_TIME') return false
  if (filters.timing === 'ALL_DAY') return false
  if (filters.syncState !== 'ALL') return false
  return true
}

function TeamAvailabilityWorkspace({
  events,
  availability,
  settings,
  memberOptions,
  onAddWorkingHours,
  onAddException,
  onOpenAvailability,
  onOpenEvent,
  onOpenSchedulingAI,
}: {
  events: SchedulingEvent[]
  availability: TeamAvailabilityRecord[]
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  onAddWorkingHours: () => void
  onAddException: () => void
  onOpenAvailability: (record: TeamAvailabilityRecord) => void
  onOpenEvent: (event: SchedulingEvent) => void
  onOpenSchedulingAI?: () => void
}) {
  const { user } = useUser()
  const preferenceUserId = user?.id ?? 'anonymous'
  const currentInstant = useCurrentMinute()
  const [busyScheduleOpen, setBusyScheduleOpen] = useState(false)
  const busyRange = getTeamAvailabilityPlanningRange({
    mode: 'currentUpcoming',
    workspaceNow: currentInstant,
    timezone: settings.timezone,
  })
  const memberLabelById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.label])),
    [memberOptions],
  )
  const workingHours = availability
    .filter(
      (
        record,
      ): record is Extract<TeamAvailabilityRecord, { kind: 'workingHours' }> =>
        record.kind === 'workingHours',
    )
    .map(normalizeWorkingHoursRecord)
  const timeOff = availability.filter(
    (record): record is Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> =>
      record.kind === 'timeOff',
  )
  const blocked = availability.filter(
    (
      record,
    ): record is Extract<TeamAvailabilityRecord, { kind: 'blockedTime' }> =>
      record.kind === 'blockedTime',
  )
  const exceptions = availability.filter(
    (
      record,
    ): record is Extract<
      TeamAvailabilityRecord,
      { kind: 'availabilityException' }
    > => record.kind === 'availabilityException',
  )
  const busyEvents = getBusyAvailabilityIntervals({
    schedulingEvents: events,
    eventTypeSettings: settings,
    workspaceNow: currentInstant,
    rangeStart: busyRange.start,
    rangeEnd: busyRange.end,
  })
  const busyPreviewEvents = busyEvents.slice(0, BUSY_PREVIEW_LIMIT)
  const remainingBusyCount = Math.max(
    0,
    busyEvents.length - busyPreviewEvents.length,
  )
  const visibleTimeOff = timeOff.filter((record) =>
    availabilityRecordOverlapsRange({
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      rangeStart: busyRange.start,
      rangeEnd: busyRange.end,
    }),
  )
  const visibleBlocked = blocked.filter((record) =>
    availabilityRecordOverlapsRange({
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      rangeStart: busyRange.start,
      rangeEnd: busyRange.end,
    }),
  )
  const visibleExceptions = exceptions.filter((record) =>
    availabilityExceptionOccursInRange({
      record,
      rangeStart: busyRange.start,
      rangeEnd: busyRange.end,
      timezone: settings.timezone,
    }),
  )
  const openBusySchedule = () => setBusyScheduleOpen(true)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        {onOpenSchedulingAI ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenSchedulingAI}
            leftIcon={<Bot className="h-4 w-4" />}
          >
            Ask Scheduling AI
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddWorkingHours}
        >
          Add Working Hours
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddException}
        >
          Add Availability Exception
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-4">
        <AvailabilityCard title="Working hours">
          {workingHours.length ? (
            workingHours.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onOpenAvailability(record)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <p className="text-sm font-medium text-neutral-100">
                  {getWorkingHoursDisplayName(record)}
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {formatWorkingHoursSummary({
                    record,
                    settings,
                    workingHours,
                  })}
                </p>
              </button>
            ))
          ) : (
            <div className="text-neutral-text-secondary rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-3 text-sm">
              <p>No Business Hours configured.</p>
              <p className="mt-1 text-xs">
                Add Working Hours and choose Entire business to create the
                baseline schedule.
              </p>
            </div>
          )}
          {workingHours.some((record) => record.scope === 'workspace') &&
          !workingHours.some((record) => record.scope !== 'workspace') ? (
            <p className="text-neutral-text-secondary px-1 text-xs">
              No additional Working Hours overrides.
            </p>
          ) : null}
        </AvailabilityCard>
        <AvailabilityCard
          title="Busy"
          action={
            <button
              type="button"
              onClick={openBusySchedule}
              className="text-neutral-text-secondary inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label="View all busy time"
              title="View all busy time"
            >
              <ListFilter className="h-4 w-4" />
            </button>
          }
        >
          {busyEvents.length ? (
            busyPreviewEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onOpenEvent(event)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <p className="text-sm font-medium text-neutral-100">
                  {event.title}
                </p>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  {formatMemberIds(event.assignedMemberIds, memberLabelById)} ·{' '}
                  {formatDateOnly(event.startsAt, settings.timezone)} ·{' '}
                  {formatTimeOnly(event.startsAt, settings.timezone)}-
                  {formatTimeOnly(event.endsAt, settings.timezone)}
                </p>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  {event.status === 'inProgress'
                    ? 'In progress'
                    : schedulingStatusLabels[event.status]}
                </p>
              </button>
            ))
          ) : (
            <p className="text-neutral-text-secondary text-sm">
              No current or upcoming busy events.
            </p>
          )}
          {remainingBusyCount > 0 ? (
            <button
              type="button"
              onClick={openBusySchedule}
              className="w-full rounded-xl border border-dashed border-slate-700 px-3 py-2 text-center text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              View all busy time · {remainingBusyCount} more
            </button>
          ) : (
            <button
              type="button"
              onClick={openBusySchedule}
              className="text-neutral-text-secondary w-full rounded-xl border border-dashed border-slate-800 px-3 py-2 text-center text-sm font-medium transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              View all busy time
            </button>
          )}
        </AvailabilityCard>
        <AvailabilityCard title="Time off">
          {[...visibleTimeOff, ...visibleBlocked].map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onOpenAvailability(record)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              <p className="text-sm font-medium text-neutral-100">
                {record.kind === 'timeOff'
                  ? getTimeOffTitle(record)
                  : record.title}
              </p>
              <p className="text-neutral-text-secondary text-xs">
                {record.kind === 'timeOff'
                  ? formatTimeOffSummary({ record, settings })
                  : `${record.memberName} · ${formatDateTime(record.startsAt, settings.timezone)}-${formatTimeOnly(record.endsAt, settings.timezone)}`}
              </p>
            </button>
          ))}
          {[...visibleTimeOff, ...visibleBlocked].length ? null : (
            <p className="text-neutral-text-secondary text-sm">
              No current or upcoming time off.
            </p>
          )}
        </AvailabilityCard>
        <AvailabilityCard title="Exceptions">
          {visibleExceptions.length ? (
            visibleExceptions.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onOpenAvailability(record)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <p className="text-sm font-medium text-neutral-100">
                  {getExceptionTitle(record)}
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {formatAvailabilityExceptionSummary({ record, settings })}
                </p>
              </button>
            ))
          ) : (
            <p className="text-neutral-text-secondary text-sm">
              No holiday or special-hours exceptions.
            </p>
          )}
        </AvailabilityCard>
      </div>
      {busyScheduleOpen ? (
        <BusyScheduleDrawer
          events={events}
          availability={availability}
          settings={settings}
          memberOptions={memberOptions}
          onClose={() => setBusyScheduleOpen(false)}
          onOpenEvent={(event) => {
            setBusyScheduleOpen(false)
            onOpenEvent(event)
          }}
        />
      ) : null}
    </div>
  )
}

function BusyScheduleDrawer({
  events,
  availability,
  settings,
  memberOptions,
  onClose,
  onOpenEvent,
}: {
  events: SchedulingEvent[]
  availability: TeamAvailabilityRecord[]
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  onClose: () => void
  onOpenEvent: (event: SchedulingOccurrence) => void
}) {
  const currentInstant = useCurrentMinute()
  const defaultCustomStart = getWorkspaceDateKey(
    currentInstant,
    settings.timezone,
  )
  const defaultCustomEnd = getWorkspaceDateKey(
    new Date(currentInstant.getTime() + 30 * 24 * 60 * 60 * 1000),
    settings.timezone,
  )
  const [rangeMode, setRangeMode] =
    useState<TeamAvailabilityRangeMode>('currentUpcoming')
  const [customRangeStart, setCustomRangeStart] = useState(defaultCustomStart)
  const [customRangeEnd, setCustomRangeEnd] = useState(defaultCustomEnd)
  const [query, setQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [statusFilters, setStatusFilters] = useState<BusyStatusFilter[]>([
    'scheduled',
    'confirmed',
    'inProgress',
    'pending',
  ])
  const assigneeOptions = useMemo(
    () => getBusyAssigneeOptions({ memberOptions, availability }),
    [availability, memberOptions],
  )
  const assigneeLabelById = useMemo(
    () =>
      new Map(assigneeOptions.map((assignee) => [assignee.id, assignee.label])),
    [assigneeOptions],
  )
  const range = getTeamAvailabilityPlanningRange({
    mode: rangeMode,
    workspaceNow: currentInstant,
    timezone: settings.timezone,
    customStart: customRangeStart,
    customEnd: customRangeEnd,
  })
  const rangeRows = getBusyScheduleRows({
    schedulingEvents: events,
    eventTypeSettings: settings,
    workspaceNow: currentInstant,
    rangeStart: range.start,
    rangeEnd: range.end,
    statusFilters,
    rangeMode,
  })
  useEffect(() => {
    if (
      assigneeFilter !== 'all' &&
      !assigneeOptions.some((assignee) => assignee.value === assigneeFilter)
    ) {
      setAssigneeFilter('all')
    }
  }, [assigneeFilter, assigneeOptions])
  const eventTypeFilterOptions = useMemo(() => {
    const types = new Map<string, string>()
    rangeRows.forEach((event) => {
      const definition = resolveSchedulingEventTypeDefinition(
        event.type,
        settings,
      )
      if (definition.blocksAvailability)
        types.set(String(event.type), definition.label)
    })
    return Array.from(types, ([key, label]) => ({ key, label })).sort(
      (first, second) => first.label.localeCompare(second.label),
    )
  }, [rangeRows, settings])
  const memberAssigneeOptions = assigneeOptions.filter(
    (assignee) => assignee.type === 'member',
  )
  const teamAssigneeOptions = assigneeOptions.filter(
    (assignee) => assignee.type === 'team',
  )
  const filteredRows = rangeRows.filter((event) => {
    if (
      assigneeFilter !== 'all' &&
      !busyEventMatchesAssigneeFilter(event, assigneeFilter)
    ) {
      return false
    }
    if (eventTypeFilter !== 'all' && String(event.type) !== eventTypeFilter) {
      return false
    }
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return true
    const haystack = [
      event.title,
      formatBusyAssigneeIds(event.assignedMemberIds, assigneeLabelById),
      getEventTypeLabel(event.type, settings),
      event.location ?? '',
      event.linkedRecord?.label ?? '',
      schedulingStatusLabel(event.status),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })
  const showingFilteredCount =
    filteredRows.length !== rangeRows.length ||
    query.trim() ||
    assigneeFilter !== 'all' ||
    eventTypeFilter !== 'all'
  const statusOptions: Array<{ value: BusyStatusFilter; label: string }> = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'inProgress', label: 'In Progress' },
    { value: 'pending', label: 'Pending' },
    ...(rangeMode === 'includePast'
      ? [
          { value: 'completed' as BusyStatusFilter, label: 'Completed' },
          { value: 'canceled' as BusyStatusFilter, label: 'Canceled' },
          { value: 'missed' as BusyStatusFilter, label: 'Missed' },
        ]
      : []),
  ]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleStatus = (status: BusyStatusFilter) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    )
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Busy Schedule"
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl lg:w-[58rem]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Team Availability
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-50">
              Busy Schedule
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Assigned events that currently consume team availability.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close Busy Schedule"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_12rem]">
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Search
              </span>
              <div className="relative">
                <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search busy events"
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Date range
              </span>
              <Select
                value={rangeMode}
                onChange={(event) =>
                  setRangeMode(event.target.value as TeamAvailabilityRangeMode)
                }
              >
                <option value="currentUpcoming">Current & upcoming</option>
                <option value="next7">Next 7 days</option>
                <option value="next30">Next 30 days</option>
                <option value="custom">Custom range</option>
                <option value="includePast">Include past</option>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Assignee
              </span>
              <Select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="all">All assignees</option>
                {memberAssigneeOptions.length ? (
                  <optgroup label="Members">
                    {memberAssigneeOptions.map((assignee) => (
                      <option key={assignee.value} value={assignee.value}>
                        {assignee.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {teamAssigneeOptions.length ? (
                  <optgroup label="Teams">
                    {teamAssigneeOptions.map((assignee) => (
                      <option key={assignee.value} value={assignee.value}>
                        {assignee.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Event type
              </span>
              <Select
                value={eventTypeFilter}
                onChange={(event) => setEventTypeFilter(event.target.value)}
              >
                <option value="all">All event types</option>
                {eventTypeFilterOptions.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {rangeMode === 'custom' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  Start date
                </span>
                <Input
                  type="date"
                  value={customRangeStart}
                  onChange={(event) => setCustomRangeStart(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  End date
                </span>
                <Input
                  type="date"
                  value={customRangeEnd}
                  onChange={(event) => setCustomRangeEnd(event.target.value)}
                />
              </label>
            </div>
          ) : null}
          <fieldset className="mt-3">
            <legend className="text-neutral-text-secondary text-xs font-medium">
              Status
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <label
                  key={status.value}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/55 px-3 py-1.5 text-xs text-neutral-100"
                >
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(status.value)}
                    onChange={() => toggleStatus(status.value)}
                    className="h-3.5 w-3.5 accent-cyan-300"
                  />
                  {status.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-neutral-text-secondary mt-3 text-xs">
            {showingFilteredCount
              ? `${filteredRows.length} of ${rangeRows.length} busy events`
              : `${rangeRows.length} busy ${rangeRows.length === 1 ? 'event' : 'events'}`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filteredRows.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <div className="text-neutral-text-secondary hidden grid-cols-[minmax(12rem,1.4fr)_1fr_8rem_9rem_10rem_8rem] gap-3 border-b border-slate-800 bg-slate-900/65 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] lg:grid">
                <span>Event</span>
                <span>Assignee</span>
                <span>Date</span>
                <span>Time</span>
                <span>Event type</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-slate-800">
                {filteredRows.map((event) => (
                  <button
                    key={event.occurrenceId}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 lg:grid-cols-[minmax(12rem,1.4fr)_1fr_8rem_9rem_10rem_8rem] lg:items-center lg:gap-3"
                    aria-label={`Open busy event ${event.title}`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-neutral-100">
                        {event.title}
                      </span>
                      {event.location || event.linkedRecord?.label ? (
                        <span className="text-neutral-text-secondary mt-1 block text-xs">
                          {[event.location, event.linkedRecord?.label]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm text-neutral-200">
                      {formatBusyAssigneeIds(
                        event.assignedMemberIds,
                        assigneeLabelById,
                      )}
                    </span>
                    <span className="text-neutral-text-secondary text-sm">
                      {formatInWorkspaceTimezone(
                        event.occurrenceStartsAt,
                        settings.timezone,
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </span>
                    <span className="text-neutral-text-secondary text-sm">
                      {formatTimeOnly(
                        event.occurrenceStartsAt,
                        settings.timezone,
                      )}
                      -
                      {formatTimeOnly(
                        event.occurrenceEndsAt,
                        settings.timezone,
                      )}
                    </span>
                    <span className="text-neutral-text-secondary text-sm">
                      {getEventTypeLabel(event.type, settings)}
                    </span>
                    <span className="text-neutral-text-secondary text-sm">
                      {schedulingStatusLabel(event.status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-neutral-text-secondary rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center text-sm">
              No busy events in this range.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

type TeamAvailabilityRangeMode =
  | 'currentUpcoming'
  | 'next7'
  | 'next30'
  | 'custom'
  | 'includePast'

type BusyStatusFilter = SchedulingEventStatus | 'pending'

function getTeamAvailabilityPlanningRange({
  mode,
  workspaceNow,
  timezone,
  customStart,
  customEnd,
}: {
  mode: TeamAvailabilityRangeMode
  workspaceNow: Date
  timezone: string
  customStart?: SchedulingDateKey
  customEnd?: SchedulingDateKey
}) {
  if (
    mode === 'custom' &&
    typeof customStart === 'string' &&
    typeof customEnd === 'string' &&
    isSchedulingDateKey(customStart) &&
    isSchedulingDateKey(customEnd)
  ) {
    const orderedStart = customStart <= customEnd ? customStart : customEnd
    const orderedEnd = customStart <= customEnd ? customEnd : customStart
    return {
      start: combineDateAndTimeInTimezone({
        dateKey: orderedStart,
        time: '00:00',
        timezone,
      }),
      end: new Date(
        combineDateAndTimeInTimezone({
          dateKey: orderedEnd,
          time: '00:00',
          timezone,
        }).getTime() +
          24 * 60 * 60 * 1000 -
          1,
      ),
    }
  }
  const days = mode === 'next7' ? 7 : 30
  const start =
    mode === 'includePast'
      ? new Date(workspaceNow.getTime() - 90 * 24 * 60 * 60 * 1000)
      : workspaceNow
  return {
    start,
    end: new Date(workspaceNow.getTime() + days * 24 * 60 * 60 * 1000),
  }
}

function availabilityRecordOverlapsRange({
  startsAt,
  endsAt,
  rangeStart,
  rangeEnd,
}: {
  startsAt: string
  endsAt: string
  rangeStart: Date
  rangeEnd: Date
}) {
  return (
    new Date(endsAt).getTime() >= rangeStart.getTime() &&
    new Date(startsAt).getTime() <= rangeEnd.getTime()
  )
}

function availabilityExceptionOccursInRange({
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
  let cursor = record.date > startKey ? record.date : startKey
  let checked = 0
  while (cursor <= endKey && checked < 400) {
    if (availabilityExceptionAppliesOnDate({ record, date: cursor }))
      return true
    cursor = toDateKey(addDays(dateKeyToCalendarDate(cursor), 1))
    checked += 1
  }
  return false
}

export function doesSchedulingEventConsumeAvailability({
  event,
  occurrence,
  workspaceNow,
  rangeStart,
  rangeEnd,
  eventTypeSettings,
}: {
  event: SchedulingEvent
  occurrence: SchedulingOccurrence
  workspaceNow: Date
  rangeStart: Date
  rangeEnd: Date
  eventTypeSettings: WorkspaceSchedulingSettings
}) {
  if (!event.assignedMemberIds.length) return false
  if (
    !resolveSchedulingEventTypeDefinition(event.type, eventTypeSettings)
      .blocksAvailability
  ) {
    return false
  }
  if ((event as any).deletedAt) return false
  if (
    event.status === 'completed' ||
    event.status === 'canceled' ||
    event.status === 'missed'
  ) {
    return false
  }
  const occurrenceStart = new Date(occurrence.occurrenceStartsAt).getTime()
  const occurrenceEnd = new Date(occurrence.occurrenceEndsAt).getTime()
  if (event.status === 'inProgress') {
    return occurrenceStart <= rangeEnd.getTime()
  }
  if (
    event.status !== 'scheduled' &&
    event.status !== 'confirmed' &&
    event.status !== ('pending' as SchedulingEventStatus)
  ) {
    return false
  }
  const effectiveStart = Math.max(rangeStart.getTime(), workspaceNow.getTime())
  return (
    occurrenceEnd >= effectiveStart && occurrenceStart <= rangeEnd.getTime()
  )
}

export function getBusyAvailabilityIntervals({
  schedulingEvents,
  eventTypeSettings,
  workspaceNow = new Date(),
  rangeStart = workspaceNow,
  rangeEnd = new Date(workspaceNow.getTime() + 30 * 24 * 60 * 60 * 1000),
}: {
  schedulingEvents: SchedulingEvent[]
  eventTypeSettings: WorkspaceSchedulingSettings
  workspaceNow?: Date
  rangeStart?: Date
  rangeEnd?: Date
}) {
  const seen = new Set<string>()
  const occurrenceRangeStart = new Date(
    rangeStart.getTime() - 365 * 24 * 60 * 60 * 1000,
  )
  return getSchedulingOccurrencesForRange({
    events: schedulingEvents,
    rangeStart: occurrenceRangeStart,
    rangeEnd,
    timezone: eventTypeSettings.timezone,
  })
    .filter((occurrence) => {
      if (seen.has(occurrence.occurrenceId)) return false
      seen.add(occurrence.occurrenceId)
      const sourceEvent =
        schedulingEvents.find(
          (event) => event.id === occurrence.sourceEventId,
        ) ?? occurrence
      return doesSchedulingEventConsumeAvailability({
        event: sourceEvent,
        occurrence,
        workspaceNow,
        rangeStart,
        rangeEnd,
        eventTypeSettings,
      })
    })
    .sort((first, second) =>
      compareBusyRecords({
        first,
        second,
        rangeMode: 'currentUpcoming',
        workspaceNow,
      }),
    )
}

function getBusyScheduleRows({
  schedulingEvents,
  eventTypeSettings,
  workspaceNow = new Date(),
  rangeStart = workspaceNow,
  rangeEnd = new Date(workspaceNow.getTime() + 30 * 24 * 60 * 60 * 1000),
  statusFilters,
  rangeMode,
}: {
  schedulingEvents: SchedulingEvent[]
  eventTypeSettings: WorkspaceSchedulingSettings
  workspaceNow?: Date
  rangeStart?: Date
  rangeEnd?: Date
  statusFilters: BusyStatusFilter[]
  rangeMode: TeamAvailabilityRangeMode
}) {
  const selectedStatuses = new Set<string>(statusFilters)
  const seen = new Set<string>()
  const occurrenceRangeStart = new Date(
    rangeStart.getTime() - 365 * 24 * 60 * 60 * 1000,
  )
  return getSchedulingOccurrencesForRange({
    events: schedulingEvents,
    rangeStart: occurrenceRangeStart,
    rangeEnd,
    timezone: eventTypeSettings.timezone,
  })
    .filter((occurrence) => {
      if (seen.has(occurrence.occurrenceId)) return false
      seen.add(occurrence.occurrenceId)
      const sourceEvent =
        schedulingEvents.find(
          (event) => event.id === occurrence.sourceEventId,
        ) ?? occurrence
      if (!sourceEvent.assignedMemberIds.length) return false
      if ((sourceEvent as any).deletedAt) return false
      if (!selectedStatuses.has(String(sourceEvent.status))) return false
      if (
        !resolveSchedulingEventTypeDefinition(
          sourceEvent.type,
          eventTypeSettings,
        ).blocksAvailability
      ) {
        return false
      }
      if (sourceEvent.status === 'inProgress') {
        return (
          new Date(occurrence.occurrenceStartsAt).getTime() <=
          rangeEnd.getTime()
        )
      }
      return (
        new Date(occurrence.occurrenceEndsAt).getTime() >=
          rangeStart.getTime() &&
        new Date(occurrence.occurrenceStartsAt).getTime() <= rangeEnd.getTime()
      )
    })
    .sort((first, second) =>
      compareBusyRecords({ first, second, rangeMode, workspaceNow }),
    )
}

export function sortBusyRecords({
  records,
  rangeMode,
  workspaceNow,
}: {
  records: SchedulingOccurrence[]
  rangeMode: TeamAvailabilityRangeMode
  workspaceNow: Date
}) {
  return [...records].sort((first, second) =>
    compareBusyRecords({ first, second, rangeMode, workspaceNow }),
  )
}

function compareBusyRecords({
  first,
  second,
  rangeMode,
  workspaceNow,
}: {
  first: SchedulingOccurrence
  second: SchedulingOccurrence
  rangeMode: TeamAvailabilityRangeMode
  workspaceNow: Date
}) {
  const now = workspaceNow.getTime()
  const firstClass = classifyBusyRecord(first, now)
  const secondClass = classifyBusyRecord(second, now)
  if (firstClass.group !== secondClass.group) {
    return firstClass.group - secondClass.group
  }
  if (firstClass.group === 3 || rangeMode === 'includePast') {
    const firstPast = firstClass.end < now && first.status !== 'inProgress'
    const secondPast = secondClass.end < now && second.status !== 'inProgress'
    if (firstPast && secondPast) return secondClass.end - firstClass.end
  }
  return firstClass.start - secondClass.start
}

function classifyBusyRecord(record: SchedulingOccurrence, now: number) {
  const start = getBusyOccurrenceStartTime(record)
  const end = getBusyOccurrenceEndTime(record)
  const isInProgress = record.status === 'inProgress'
  const isCurrent = start <= now && end >= now
  const isPast = end < now && !isInProgress
  const isFuture = start > now
  const group = isInProgress ? 0 : isCurrent ? 1 : isFuture ? 2 : isPast ? 3 : 4
  return { start, end, group }
}

function getBusyOccurrenceStartTime(record: SchedulingOccurrence) {
  const start = new Date(record.occurrenceStartsAt).getTime()
  if (Number.isFinite(start)) return start
  const fallback = new Date(record.startsAt).getTime()
  return Number.isFinite(fallback) ? fallback : 0
}

function getBusyOccurrenceEndTime(record: SchedulingOccurrence) {
  const end = new Date(record.occurrenceEndsAt).getTime()
  if (Number.isFinite(end)) return end
  const fallback = new Date(record.endsAt).getTime()
  return Number.isFinite(fallback)
    ? fallback
    : getBusyOccurrenceStartTime(record)
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function AvailabilityCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
        {action}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  )
}

function SchedulingAvailabilityDrawer({
  record,
  settings,
  onEdit,
  onDeleted,
  onClose,
}: {
  record: TeamAvailabilityRecord
  settings: WorkspaceSchedulingSettings
  onEdit: () => void
  onDeleted: () => void
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmDeleteRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmDelete) {
          setConfirmDelete(false)
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmDelete, onClose])

  useEffect(() => {
    if (confirmDelete) confirmDeleteRef.current?.focus()
  }, [confirmDelete])

  const title =
    record.kind === 'workingHours'
      ? 'Working Hours'
      : record.kind === 'timeOff'
        ? 'Time Off'
        : record.kind === 'availabilityException'
          ? 'Availability Exception'
          : 'Blocked Time'
  const deleteLabel =
    record.kind === 'timeOff'
      ? 'Delete Time Off'
      : record.kind === 'workingHours'
        ? 'Delete Working Hours'
        : record.kind === 'availabilityException'
          ? 'Delete Exception'
          : 'Delete Blocked Time'
  const rows: Array<[string, string]> =
    record.kind === 'workingHours'
      ? (() => {
          const workingHours = normalizeWorkingHoursRecord(record)
          return [
            ['Record type', 'Working Hours'],
            ['Scope', getWorkingHoursScopeLabel(workingHours.scope)],
            ['Applies to', getWorkingHoursDisplayName(workingHours)],
            [
              'Schedule',
              workingHours.scheduleMode === 'inherit'
                ? 'Uses inherited hours'
                : 'Custom schedule',
            ],
            ...(workingHours.scheduleMode === 'inherit'
              ? []
              : ([
                  [
                    'Days',
                    (workingHours.daysOfWeek ?? [])
                      .map((day) => weekdayLabels[day])
                      .join(', '),
                  ],
                  [
                    'Time',
                    formatClockRange({
                      startTime: workingHours.startsAt ?? '09:00',
                      endTime: workingHours.endsAt ?? '17:00',
                      settings,
                    }),
                  ],
                ] as Array<[string, string]>)),
            [
              'Timezone',
              getReadableTimezoneLabel(
                workingHours.timezone ?? settings.timezone,
              ),
            ],
            ['Effective from', workingHours.effectiveFrom ?? 'Not set'],
            ['Effective until', workingHours.effectiveUntil ?? 'Not set'],
          ]
        })()
      : record.kind === 'timeOff'
        ? [
            ['Record type', 'Time Off'],
            ['Member', record.memberName],
            [
              'Category',
              record.category
                ? (timeOffCategories.find(
                    (item) => item.value === record.category,
                  )?.label ?? record.category)
                : 'Time Off',
            ],
            ['Title or reason', record.title ?? record.reason],
            [
              'Date',
              formatAvailabilityDateRange({
                startsAt: record.startsAt,
                endsAt: record.endsAt,
                timezone: record.timezone ?? settings.timezone,
              }),
            ],
            [
              'Time',
              record.allDay
                ? 'All day'
                : `${formatTimeOnly(record.startsAt, record.timezone ?? settings.timezone)}-${formatTimeOnly(record.endsAt, record.timezone ?? settings.timezone)}`,
            ],
            [
              'Timezone',
              getReadableTimezoneLabel(record.timezone ?? settings.timezone),
            ],
            ['Notes', record.notes ?? 'None'],
            ['Created by', record.createdByUserId ?? 'Workspace'],
            [
              'Created',
              record.createdAt
                ? formatDateTime(
                    record.createdAt,
                    record.timezone ?? settings.timezone,
                  )
                : 'Not set',
            ],
            [
              'Updated',
              record.updatedAt
                ? formatDateTime(
                    record.updatedAt,
                    record.timezone ?? settings.timezone,
                  )
                : 'Not set',
            ],
          ]
        : record.kind === 'availabilityException'
          ? [
              [
                'Record type',
                record.exceptionType === 'closed'
                  ? 'Closed holiday'
                  : 'Special hours',
              ],
              [
                'Scope',
                record.scope === 'workspace'
                  ? 'Workspace'
                  : (record.memberName ?? record.teamName ?? 'Team'),
              ],
              ['Title', getExceptionTitle(record)],
              [
                'Date',
                formatInWorkspaceTimezone(
                  `${record.date}T12:00:00`,
                  settings.timezone,
                  { dateStyle: 'full' },
                ),
              ],
              [
                'Time',
                record.exceptionType === 'closed' || record.allDayClosed
                  ? 'Closed all day'
                  : formatClockRange({
                      startTime: record.startTime ?? '09:00',
                      endTime: record.endTime ?? '17:00',
                      settings,
                    }),
              ],
              [
                'Timezone',
                getReadableTimezoneLabel(record.timezone ?? settings.timezone),
              ],
              [
                'Repeat',
                formatSchedulingRecurrenceSummary(
                  record.recurrenceRule ?? null,
                  record.date,
                  weekdayLabels,
                ),
              ],
              ['Notes', record.notes ?? 'None'],
              [
                'Created',
                formatDateTime(
                  record.createdAt,
                  record.timezone ?? settings.timezone,
                ),
              ],
              [
                'Updated',
                formatDateTime(
                  record.updatedAt,
                  record.timezone ?? settings.timezone,
                ),
              ],
            ]
          : [
              ['Record type', 'Blocked Time'],
              ['Member', record.memberName],
              ['Title', record.title],
              [
                'Time',
                `${formatDateTime(record.startsAt, settings.timezone)}-${formatTimeOnly(record.endsAt, settings.timezone)}`,
              ],
            ]

  const deleteRecord = async () => {
    const response = await fetch(
      `/api/workspaces/${record.workspaceId}/scheduling/availability/${record.id}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      toast.error(data.error ?? 'Availability record could not be deleted.')
      return
    }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl sm:w-[30rem]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Team Availability
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close availability details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-3">
          {record.kind !== 'blockedTime' ? (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
        {confirmDelete ? (
          <div
            ref={confirmDeleteRef}
            tabIndex={-1}
            className="border-b border-rose-300/25 bg-rose-500/[0.06] px-5 py-4 outline-none"
          >
            <p className="text-sm font-medium text-rose-100">
              {record.kind === 'timeOff'
                ? 'Delete this time-off record?'
                : record.kind === 'workingHours'
                  ? 'Delete these Working Hours?'
                  : `Delete this ${title.toLowerCase()} record?`}
            </p>
            <p className="mt-1 text-xs text-rose-100/75">
              {record.kind === 'timeOff'
                ? `${record.memberName} will be shown as available during this period after it is removed.`
                : record.kind === 'workingHours'
                  ? 'This schedule will stop overriding inherited hours. The business, location, team, or member will fall back to the next applicable schedule.'
                  : 'This only removes the availability record. Existing scheduling events are not changed.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
              >
                Keep{' '}
                {record.kind === 'timeOff'
                  ? 'Time Off'
                  : record.kind === 'workingHours'
                    ? 'Working Hours'
                    : 'Record'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={deleteRecord}
              >
                {deleteLabel}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DetailGrid rows={rows} />
          <p className="text-neutral-text-secondary mt-4 rounded-xl border border-slate-800 bg-slate-900/35 p-3 text-sm">
            Working Hours define normal recurring availability. Time Off
            represents a member&apos;s unavailable time. Blocked Time remains a
            calendar event for quick scheduling holds.
          </p>
        </div>
      </aside>
    </div>
  )
}

const timeOffCategories: Array<{ value: TimeOffCategory; label: string }> = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'other', label: 'Other' },
]

function TimeOffModal({
  workspaceId,
  settings,
  memberOptions,
  initialRecord,
  onClose,
  onCreated,
}: {
  workspaceId: string
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  initialRecord?: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> | null
  onClose: () => void
  onCreated: (
    record: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
  ) => void
}) {
  const currentInstant = useCurrentMinute()
  const defaultDate = getWorkspaceDateKey(currentInstant, settings.timezone)
  const fallbackMember = memberOptions[0] ?? {
    id: 'owner',
    label: 'Owner',
    email: '',
    role: 'owner',
  }
  const timeOffMemberOptions = [
    ...(initialRecord
      ? [
          {
            id: initialRecord.memberId,
            label: initialRecord.memberName,
            email: '',
            role: 'member',
          },
        ]
      : []),
    fallbackMember,
    ...memberOptions,
  ].filter(
    (member, index, members) =>
      member.id && members.findIndex((item) => item.id === member.id) === index,
  )
  const recordTimezone = initialRecord?.timezone ?? settings.timezone
  const [memberId, setMemberId] = useState(
    initialRecord?.memberId ?? fallbackMember.id,
  )
  const [category, setCategory] = useState<TimeOffCategory>(
    initialRecord?.category ?? 'unavailable',
  )
  const [title, setTitle] = useState(initialRecord?.title ?? '')
  const [startDate, setStartDate] = useState(
    initialRecord
      ? getWorkspaceDateKey(initialRecord.startsAt, recordTimezone)
      : defaultDate,
  )
  const [endDate, setEndDate] = useState(
    initialRecord
      ? getWorkspaceDateKey(initialRecord.endsAt, recordTimezone)
      : defaultDate,
  )
  const [allDay, setAllDay] = useState(initialRecord?.allDay ?? true)
  const [startTime, setStartTime] = useState(
    initialRecord
      ? getWorkspaceTimeInputValue(initialRecord.startsAt, recordTimezone)
      : '09:00',
  )
  const [endTime, setEndTime] = useState(
    initialRecord
      ? getWorkspaceTimeInputValue(initialRecord.endsAt, recordTimezone)
      : '17:00',
  )
  const [notes, setNotes] = useState(initialRecord?.notes ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!memberId) {
      setError('Choose a team member.')
      return
    }
    if (!isSchedulingDateKey(startDate) || !isSchedulingDateKey(endDate)) {
      setError('Choose a valid date range.')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    if (!allDay) {
      if (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)) {
        setError('Enter valid start and end times.')
        return
      }
      if (
        startDate === endDate &&
        minutesFromTime(endTime) <= minutesFromTime(startTime)
      ) {
        setError('End time must be later than start time.')
        return
      }
    }
    const selectedMember =
      timeOffMemberOptions.find((member) => member.id === memberId) ??
      fallbackMember
    const startsAt = combineDateAndTimeInTimezone({
      dateKey: startDate,
      time: allDay ? '00:00' : startTime,
      timezone: settings.timezone,
    }).toISOString()
    const endsAt = allDay
      ? new Date(
          combineDateAndTimeInTimezone({
            dateKey: endDate,
            time: '00:00',
            timezone: settings.timezone,
          }).getTime() +
            24 * 60 * 60 * 1000 -
            1,
        ).toISOString()
      : combineDateAndTimeInTimezone({
          dateKey: endDate,
          time: endTime,
          timezone: settings.timezone,
        }).toISOString()
    const categoryLabel =
      timeOffCategories.find((item) => item.value === category)?.label ??
      'Time Off'
    const record = {
      kind: 'timeOff' as const,
      memberId,
      memberName: selectedMember.label,
      category,
      title: title.trim() || undefined,
      reason: title.trim() || categoryLabel,
      startsAt,
      endsAt,
      allDay,
      timezone: settings.timezone,
      notes: notes.trim() || undefined,
      createdByUserId: selectedMember.id,
      createdAt: initialRecord?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const response = await fetch(
      initialRecord
        ? `/api/workspaces/${workspaceId}/scheduling/availability/${initialRecord.id}`
        : `/api/workspaces/${workspaceId}/scheduling/availability`,
      {
        method: initialRecord ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      setError(data.error ?? 'Time off could not be saved.')
      return
    }
    const data = (await response.json()) as { record?: TeamAvailabilityRecord }
    if (data.record?.kind === 'timeOff') onCreated(data.record)
  }
  const dialogTitle = initialRecord ? 'Edit Time Off' : 'Add Time Off'
  const submitLabel = initialRecord ? 'Save Changes' : 'Add Time Off'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        onSubmit={submit}
        className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">
              {dialogTitle}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Time Off is saved as team availability, not a customer or CRM
              event.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label={`Close ${dialogTitle}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-x-4 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {error ? (
            <p className="rounded-xl border border-rose-400/35 bg-rose-500/[0.08] p-3 text-sm text-rose-100 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Team member
            </span>
            <Select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              {timeOffMemberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Category
            </span>
            <Select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as TimeOffCategory)
              }
            >
              {timeOffCategories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Timezone
            </span>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-neutral-100">
              {getReadableTimezoneLabel(settings.timezone)}
            </div>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Optional title or reason
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Start date
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              End date
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
              className="h-4 w-4 accent-cyan-300"
            />
            <span className="text-sm text-neutral-100">All-day time off</span>
          </label>
          {!allDay ? (
            <>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  Start time
                </span>
                <Input
                  type="time"
                  value={startTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  End time
                </span>
                <Input
                  type="time"
                  value={endTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Notes
            </span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional internal availability notes."
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </footer>
      </form>
    </div>
  )
}

function WorkingHoursModal({
  workspaceId,
  settings,
  memberOptions,
  teamOptions,
  locationOptions,
  onCreateTeam,
  onCreateLocation,
  initialRecord,
  onClose,
  onSaved,
}: {
  workspaceId: string
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  teamOptions: WorkingHoursEntityOption[]
  locationOptions: WorkingHoursEntityOption[]
  onCreateTeam?: (team: WorkspaceTeamSummary) => WorkingHoursEntityOption
  onCreateLocation?: (
    location: WorkspaceLocationSummary,
  ) => WorkingHoursEntityOption
  initialRecord?: Extract<
    TeamAvailabilityRecord,
    { kind: 'workingHours' }
  > | null
  onClose: () => void
  onSaved: (
    record: Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
  ) => void
}) {
  const normalizedInitial = initialRecord
    ? normalizeWorkingHoursRecord(initialRecord)
    : null
  const fallbackMember = memberOptions[0] ?? {
    id: 'owner',
    label: 'Owner',
    email: '',
    role: 'owner',
  }
  const legacyTeamOption =
    normalizedInitial?.scope === 'team' && normalizedInitial.teamId
      ? {
          id: normalizedInitial.teamId,
          label: `${normalizedInitial.teamName ?? normalizedInitial.memberName ?? 'Team Hours'} (unavailable)`,
        }
      : null
  const legacyLocationOption =
    normalizedInitial?.scope === 'location' && normalizedInitial.locationId
      ? {
          id: normalizedInitial.locationId,
          label: `${normalizedInitial.locationName ?? normalizedInitial.memberName ?? 'Location Hours'} (unavailable)`,
        }
      : null
  const resolvedTeamOptions = [
    ...(legacyTeamOption &&
    !teamOptions.some((option) => option.id === legacyTeamOption.id)
      ? [legacyTeamOption]
      : []),
    ...teamOptions,
  ]
  const resolvedLocationOptions = [
    ...(legacyLocationOption &&
    !locationOptions.some((option) => option.id === legacyLocationOption.id)
      ? [legacyLocationOption]
      : []),
    ...locationOptions,
  ]
  const fallbackTeam = resolvedTeamOptions[0] ?? null
  const fallbackLocation = resolvedLocationOptions[0] ?? null
  const [scope, setScope] = useState<WorkingHoursScope>(
    normalizedInitial?.scope ?? 'workspace',
  )
  const [scheduleMode, setScheduleMode] = useState<WorkingHoursScheduleMode>(
    normalizedInitial?.scheduleMode ?? 'custom',
  )
  const [workspaceMemberId, setWorkspaceMemberId] = useState(
    normalizedInitial?.workspaceMemberId ?? fallbackMember.id,
  )
  const [teamId, setTeamId] = useState(
    normalizedInitial?.teamId ?? fallbackTeam?.id ?? '',
  )
  const [locationId, setLocationId] = useState(
    normalizedInitial?.locationId ?? fallbackLocation?.id ?? '',
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    normalizedInitial?.daysOfWeek ?? [1, 2, 3, 4, 5],
  )
  const [startTime, setStartTime] = useState(
    normalizedInitial?.startsAt ?? '09:00',
  )
  const [endTime, setEndTime] = useState(normalizedInitial?.endsAt ?? '17:00')
  const [effectiveFrom, setEffectiveFrom] = useState(
    normalizedInitial?.effectiveFrom ?? '',
  )
  const [effectiveUntil, setEffectiveUntil] = useState(
    normalizedInitial?.effectiveUntil ?? '',
  )
  const [quickCreateMode, setQuickCreateMode] = useState<
    'team' | 'location' | null
  >(null)
  const [error, setError] = useState('')
  const dialogTitle = initialRecord ? 'Edit Working Hours' : 'Add Working Hours'
  const availableScopeOptions = resolveWorkingHoursScopeOptions({
    activeMembers: memberOptions,
    activeTeams: teamOptions,
    activeLocations: locationOptions,
    initialScope: normalizedInitial?.scope,
  })
  const selectableScopeOptions = availableScopeOptions.filter(
    (option) => option.enabled || option.key === normalizedInitial?.scope,
  )
  const customScheduleRequired =
    scope === 'workspace' || scheduleMode === 'custom'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort(),
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (scope === 'location' && !locationId) {
      setError('Choose a workspace location.')
      return
    }
    if (scope === 'team' && !teamId) {
      setError('Choose a workspace team.')
      return
    }
    if (scope === 'member' && !workspaceMemberId) {
      setError('Choose a team member.')
      return
    }
    if (customScheduleRequired && !daysOfWeek.length) {
      setError('Choose at least one weekday.')
      return
    }
    if (
      customScheduleRequired &&
      (!isValidTimeValue(startTime) || !isValidTimeValue(endTime))
    ) {
      setError('Enter valid start and end times.')
      return
    }
    if (
      customScheduleRequired &&
      minutesFromTime(endTime) <= minutesFromTime(startTime)
    ) {
      setError('End time must be later than start time.')
      return
    }
    if (effectiveFrom && !isSchedulingDateKey(effectiveFrom)) {
      setError('Enter a valid effective start date.')
      return
    }
    if (effectiveUntil && !isSchedulingDateKey(effectiveUntil)) {
      setError('Enter a valid effective end date.')
      return
    }
    if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
      setError('Effective until cannot be before effective from.')
      return
    }
    const member =
      memberOptions.find((option) => option.id === workspaceMemberId) ??
      fallbackMember
    const team =
      resolvedTeamOptions.find((option) => option.id === teamId) ?? fallbackTeam
    const location =
      resolvedLocationOptions.find((option) => option.id === locationId) ??
      fallbackLocation
    const displayName =
      scope === 'workspace'
        ? 'Business Hours'
        : scope === 'location'
          ? (location?.label ?? 'Location Hours')
          : scope === 'team'
            ? (team?.label ?? 'Team Hours')
            : member.label
    const changes = {
      kind: 'workingHours' as const,
      scope,
      locationId: scope === 'location' ? locationId : null,
      locationName: scope === 'location' ? displayName : null,
      teamId: scope === 'team' ? teamId : null,
      teamName: scope === 'team' ? displayName : null,
      workspaceMemberId: scope === 'member' ? workspaceMemberId : null,
      memberId:
        scope === 'workspace'
          ? ''
          : scope === 'location'
            ? `location:${locationId}`
            : scope === 'team'
              ? teamId
              : workspaceMemberId,
      memberName: displayName,
      scheduleMode: scope === 'workspace' ? 'custom' : scheduleMode,
      daysOfWeek: customScheduleRequired ? daysOfWeek : [],
      startsAt: customScheduleRequired ? startTime : undefined,
      endsAt: customScheduleRequired ? endTime : undefined,
      timezone: settings.timezone,
      effectiveFrom: effectiveFrom || undefined,
      effectiveUntil: effectiveUntil || undefined,
    }
    const response = await fetch(
      initialRecord
        ? `/api/workspaces/${workspaceId}/scheduling/availability/${initialRecord.id}`
        : `/api/workspaces/${workspaceId}/scheduling/availability`,
      {
        method: initialRecord ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: changes }),
      },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      setError(data.error ?? 'Working hours could not be saved.')
      return
    }
    const data = (await response.json()) as { record?: TeamAvailabilityRecord }
    if (data.record?.kind === 'workingHours') onSaved(data.record)
  }

  if (quickCreateMode) {
    const quickCreateTitle =
      quickCreateMode === 'team' ? 'Create Team' : 'Add Business Location'
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setQuickCreateMode(null)
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={quickCreateTitle}
          className="flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-50">
                {quickCreateTitle}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {quickCreateMode === 'team'
                  ? 'Create a real workspace team, then continue these Working Hours.'
                  : 'Create a real business location, then continue these Working Hours.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuickCreateMode(null)}
              className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
              aria-label={`Back to ${dialogTitle}`}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">
            {quickCreateMode === 'team' ? (
              <WorkspaceTeamForm
                workspaceId={workspaceId}
                members={memberOptions.map((member) => ({
                  id: member.id,
                  label: member.label,
                  email: member.secondary,
                }))}
                submitLabel="Create Team"
                onCancel={() => setQuickCreateMode(null)}
                onSaved={(team) => {
                  const option = onCreateTeam?.(team) ?? {
                    id: team.id,
                    label: team.name,
                  }
                  setScope('team')
                  setTeamId(option.id)
                  setQuickCreateMode(null)
                }}
              />
            ) : (
              <WorkspaceLocationForm
                workspaceId={workspaceId}
                workspaceTimezone={settings.timezone}
                submitLabel="Add Location"
                onCancel={() => setQuickCreateMode(null)}
                onSaved={(location) => {
                  const option = onCreateLocation?.(location) ?? {
                    id: location.id,
                    label: location.name,
                  }
                  setScope('location')
                  setLocationId(option.id)
                  setQuickCreateMode(null)
                }}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        onSubmit={submit}
        className="flex max-h-[min(640px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">
              {dialogTitle}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Working Hours define normal recurring availability.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label={`Close ${dialogTitle}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-x-4 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {error ? (
            <p className="rounded-xl border border-rose-400/35 bg-rose-500/[0.08] p-3 text-sm text-rose-100 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Applies to
            </span>
            <Select
              aria-label="Applies to"
              value={scope}
              onChange={(event) => {
                const nextScope = event.target.value as WorkingHoursScope
                setScope(nextScope)
                if (nextScope === 'workspace') setScheduleMode('custom')
              }}
              disabled={Boolean(initialRecord)}
            >
              {selectableScopeOptions.map((item) => (
                <option
                  key={item.key}
                  value={item.key}
                  disabled={!item.enabled}
                >
                  {item.label}
                </option>
              ))}
            </Select>
            {!teamOptions.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-text-secondary">
                  No teams are available.
                </span>
                <button
                  type="button"
                  className="font-medium text-cyan-200 hover:text-cyan-100"
                  onClick={() => setQuickCreateMode('team')}
                >
                  Create team
                </button>
              </div>
            ) : null}
            {!locationOptions.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-text-secondary">
                  No business locations are available.
                </span>
                <button
                  type="button"
                  className="font-medium text-cyan-200 hover:text-cyan-100"
                  onClick={() => setQuickCreateMode('location')}
                >
                  Add location
                </button>
              </div>
            ) : null}
            {initialRecord ? (
              <p className="text-neutral-text-secondary text-xs">
                Scope is locked after creation. Create a new record to move
                hours to another scope.
              </p>
            ) : null}
          </label>
          {scope === 'location' ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Location
              </span>
              <Select
                aria-label="Location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                {resolvedLocationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {scope === 'team' ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Team
              </span>
              <Select
                aria-label="Team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {resolvedTeamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {scope === 'member' ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Member
              </span>
              <Select
                aria-label="Member"
                value={workspaceMemberId}
                onChange={(event) => setWorkspaceMemberId(event.target.value)}
              >
                {[
                  fallbackMember,
                  ...memberOptions.filter(
                    (member) => member.id !== fallbackMember.id,
                  ),
                ].map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {scope !== 'workspace' ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Schedule
              </span>
              <Select
                aria-label="Schedule"
                value={scheduleMode}
                onChange={(event) =>
                  setScheduleMode(
                    event.target.value as WorkingHoursScheduleMode,
                  )
                }
              >
                <option value="inherit">Use inherited hours</option>
                <option value="custom">Custom schedule</option>
              </Select>
            </label>
          ) : null}
          {customScheduleRequired ? (
            <>
              <div className="sm:col-span-2">
                <p className="text-neutral-text-secondary text-xs font-medium">
                  Days of week
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weekdayLabels.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium',
                        daysOfWeek.includes(index)
                          ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                          : 'border-slate-700 text-neutral-300 hover:bg-slate-900',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  Start time
                </span>
                <Input
                  type="time"
                  value={startTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  End time
                </span>
                <Input
                  type="time"
                  value={endTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/35 px-3 py-2 text-sm text-neutral-100 sm:col-span-2">
              This record uses the next broader applicable schedule instead of
              storing copied hours.
            </div>
          )}
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Effective from
            </span>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Effective until
            </span>
            <Input
              type="date"
              value={effectiveUntil}
              onChange={(event) => setEffectiveUntil(event.target.value)}
            />
          </label>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-neutral-100 sm:col-span-2">
            Timezone: {getReadableTimezoneLabel(settings.timezone)}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {initialRecord ? 'Save Changes' : 'Add Working Hours'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

function AvailabilityExceptionModal({
  workspaceId,
  settings,
  memberOptions,
  initialRecord,
  onClose,
  onSaved,
}: {
  workspaceId: string
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  initialRecord?: Extract<
    TeamAvailabilityRecord,
    { kind: 'availabilityException' }
  > | null
  onClose: () => void
  onSaved: (
    record: Extract<TeamAvailabilityRecord, { kind: 'availabilityException' }>,
  ) => void
}) {
  const currentInstant = useCurrentMinute()
  const defaultDate = getWorkspaceDateKey(currentInstant, settings.timezone)
  const fallbackMember = memberOptions[0] ?? {
    id: 'owner',
    label: 'Owner',
    email: '',
    role: 'owner',
  }
  const [scope, setScope] = useState<'workspace' | 'member'>(
    initialRecord?.scope === 'member' ? 'member' : 'workspace',
  )
  const [memberId, setMemberId] = useState(
    initialRecord?.memberId ?? fallbackMember.id,
  )
  const [exceptionType, setExceptionType] = useState<'closed' | 'customHours'>(
    initialRecord?.exceptionType ?? 'closed',
  )
  const [title, setTitle] = useState(initialRecord?.title ?? '')
  const [date, setDate] = useState(initialRecord?.date ?? defaultDate)
  const [startTime, setStartTime] = useState(
    initialRecord?.startTime ?? '09:00',
  )
  const [endTime, setEndTime] = useState(initialRecord?.endTime ?? '13:00')
  const initialRepeat =
    initialRecord?.recurrenceRule?.frequency === 'yearly'
      ? 'annually'
      : initialRecord?.recurrenceRule?.frequency === 'weekly'
        ? 'weekly'
        : initialRecord?.recurrenceRule?.frequency === 'monthly'
          ? 'monthly'
          : 'none'
  const [repeat, setRepeat] = useState(initialRepeat)
  const [customInterval, setCustomInterval] = useState(
    initialRecord?.recurrenceRule?.interval ?? 1,
  )
  const [customFrequency, setCustomFrequency] = useState<
    'daily' | 'weekly' | 'monthly'
  >(
    initialRecord?.recurrenceRule?.frequency === 'daily' ||
      initialRecord?.recurrenceRule?.frequency === 'weekly' ||
      initialRecord?.recurrenceRule?.frequency === 'monthly'
      ? initialRecord.recurrenceRule.frequency
      : 'weekly',
  )
  const [customWeekdays, setCustomWeekdays] = useState<number[]>(
    initialRecord?.recurrenceRule?.daysOfWeek?.length
      ? initialRecord.recurrenceRule.daysOfWeek
      : [getDateKeyWeekday(initialRecord?.date ?? defaultDate)],
  )
  const [customEndType, setCustomEndType] = useState<
    'never' | 'onDate' | 'afterOccurrences'
  >(initialRecord?.recurrenceRule?.endType ?? 'never')
  const [customEndDate, setCustomEndDate] = useState(
    initialRecord?.recurrenceRule?.endDate ?? '',
  )
  const [customCount, setCustomCount] = useState(
    initialRecord?.recurrenceRule?.occurrenceCount ?? 6,
  )
  const [notes, setNotes] = useState(initialRecord?.notes ?? '')
  const [error, setError] = useState('')
  const dialogTitle = initialRecord
    ? 'Edit Availability Exception'
    : 'Add Availability Exception'
  const recurrenceRule = buildRecurrenceRule({
    repeat,
    date,
    customInterval,
    customFrequency,
    customWeekdays,
    customEndType,
    customEndDate,
    customCount,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isSchedulingDateKey(date)) {
      setError('Choose a valid date.')
      return
    }
    if (exceptionType === 'customHours') {
      if (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)) {
        setError('Enter valid start and end times.')
        return
      }
      if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
        setError('End time must be later than start time.')
        return
      }
    }
    const member =
      memberOptions.find((option) => option.id === memberId) ?? fallbackMember
    const now = new Date().toISOString()
    const changes = {
      kind: 'availabilityException' as const,
      scope,
      memberId: scope === 'member' ? memberId : undefined,
      memberName: scope === 'member' ? member.label : undefined,
      exceptionType,
      title: title.trim() || undefined,
      date,
      allDayClosed: exceptionType === 'closed',
      startTime: exceptionType === 'customHours' ? startTime : undefined,
      endTime: exceptionType === 'customHours' ? endTime : undefined,
      timezone: settings.timezone,
      recurrenceRule: recurrenceRule ?? undefined,
      notes: notes.trim() || undefined,
      createdAt: initialRecord?.createdAt ?? now,
      updatedAt: now,
    }
    const response = await fetch(
      initialRecord
        ? `/api/workspaces/${workspaceId}/scheduling/availability/${initialRecord.id}`
        : `/api/workspaces/${workspaceId}/scheduling/availability`,
      {
        method: initialRecord ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: changes }),
      },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      setError(data.error ?? 'Availability exception could not be saved.')
      return
    }
    const data = (await response.json()) as { record?: TeamAvailabilityRecord }
    if (data.record?.kind === 'availabilityException') onSaved(data.record)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        onSubmit={submit}
        className="flex max-h-[min(640px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">
              {dialogTitle}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Exceptions override normal Working Hours only for the selected
              date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label={`Close ${dialogTitle}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-x-4 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {error ? (
            <p className="rounded-xl border border-rose-400/35 bg-rose-500/[0.08] p-3 text-sm text-rose-100 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Exception type
            </span>
            <Select
              value={exceptionType}
              onChange={(event) =>
                setExceptionType(event.target.value as typeof exceptionType)
              }
            >
              <option value="closed">Holiday / closure</option>
              <option value="customHours">Special hours</option>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Scope
            </span>
            <Select
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
            >
              <option value="workspace">Workspace</option>
              <option value="member">Member</option>
            </Select>
          </label>
          {scope === 'member' ? (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Team member
              </span>
              <Select
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                {[
                  fallbackMember,
                  ...memberOptions.filter(
                    (member) => member.id !== fallbackMember.id,
                  ),
                ].map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Title
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                exceptionType === 'closed'
                  ? 'Independence Day'
                  : 'Christmas Eve'
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Date
            </span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          {exceptionType === 'customHours' ? (
            <>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  Start time
                </span>
                <Input
                  type="time"
                  value={startTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  End time
                </span>
                <Input
                  type="time"
                  value={endTime}
                  className="pr-10 [color-scheme:dark]"
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Repeat
            </span>
            <Select
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="annually">Annually</option>
              <option value="custom">Custom</option>
            </Select>
          </label>
          {repeat === 'custom' ? (
            <CustomRecurrenceEditor
              interval={customInterval}
              setInterval={setCustomInterval}
              frequency={customFrequency}
              setFrequency={setCustomFrequency}
              weekdays={customWeekdays}
              setWeekdays={setCustomWeekdays}
              endType={customEndType}
              setEndType={setCustomEndType}
              endDate={customEndDate}
              setEndDate={setCustomEndDate}
              occurrenceCount={customCount}
              setOccurrenceCount={setCustomCount}
              summary={formatSchedulingRecurrenceSummary(
                recurrenceRule ?? null,
                date,
                weekdayLabels,
              )}
            />
          ) : recurrenceRule ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-2 text-sm text-neutral-200 sm:col-span-2">
              {formatSchedulingRecurrenceSummary(
                recurrenceRule,
                date,
                weekdayLabels,
              )}
            </p>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Notes
            </span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {initialRecord ? 'Save Changes' : 'Add Exception'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

function ScheduleRow({
  event,
  settings,
  memberOptions,
  onOpenEvent,
}: {
  event: SchedulingEvent
  settings: WorkspaceSchedulingSettings
  memberOptions: SchedulingMemberOption[]
  onOpenEvent: (event: SchedulingEvent) => void
}) {
  const memberLabelById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.label])),
    [memberOptions],
  )
  return (
    <button
      type="button"
      onClick={() => onOpenEvent(event)}
      className="border-app hover:bg-app-surface-hover grid w-full grid-cols-4 gap-3 border-b px-4 py-4 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:border-slate-800 dark:hover:bg-slate-900/45"
    >
      <div>
        <p className="text-app-primary font-medium">{event.title}</p>
        <p className="text-app-secondary">{formatWindow(event)}</p>
      </div>
      <div>
        <p className="text-app-primary">
          {getEventTypeLabel(event.type, settings)}
        </p>
        <p className="text-app-secondary">
          {event.linkedRecord
            ? `${event.linkedRecord.label} · ${formatLinkedRecordType(event.linkedRecord.recordType)}`
            : 'Not linked'}
        </p>
      </div>
      <p className="text-app-primary">
        {formatMemberIds(event.assignedMemberIds, memberLabelById)}
      </p>
      <Badge variant={event.status === 'completed' ? 'green' : 'blue'}>
        {schedulingStatusLabels[event.status]}
      </Badge>
    </button>
  )
}

function EventList({
  events,
  timezone,
  onOpenEvent,
  emptyMessage = 'No schedule records yet.',
}: {
  events: SchedulingOccurrence[]
  timezone: string
  onOpenEvent: (event: SchedulingOccurrence) => void
  emptyMessage?: string
}) {
  if (!events.length) {
    return (
      <p className="text-neutral-text-secondary mt-3 text-sm">{emptyMessage}</p>
    )
  }
  return (
    <div className="mt-3 space-y-3">
      {events.map((event) => (
        <button
          key={event.occurrenceId}
          type="button"
          onClick={() => onOpenEvent(event)}
          className="border-app bg-app-surface-raised hover:bg-app-surface-hover w-full rounded-xl border p-3 text-left transition hover:border-cyan-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-cyan-300/35 dark:hover:bg-cyan-300/[0.04]"
        >
          <p className="text-app-primary text-sm font-medium">{event.title}</p>
          <p className="text-app-secondary mt-1 flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatWindow(event, timezone)}
          </p>
          {event.location ? (
            <p className="text-app-secondary mt-1 flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {event.location}
            </p>
          ) : null}
        </button>
      ))}
    </div>
  )
}

function EventPill({
  event,
  compact,
  timezone,
  onOpenEvent,
}: {
  event: SchedulingOccurrence
  compact?: boolean
  timezone: string
  onOpenEvent: (event: SchedulingOccurrence) => void
}) {
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation()
        onOpenEvent(event)
      }}
      className="w-full rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-2 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      title={`${event.title} · ${formatWindow(event, timezone)}`}
    >
      <p className="truncate text-xs font-semibold text-cyan-100">
        {event.title}
      </p>
      {!compact ? (
        <p className="mt-1 truncate text-[11px] text-cyan-100/70">
          {new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone,
          }).format(new Date(event.startsAt))}{' '}
          · {getSchedulingEventTypeDefinition(event.type).label}
          {event.recurrenceRule ? ' · Repeats' : ''}
        </p>
      ) : null}
    </button>
  )
}

function EmptyScheduleState({
  title = 'No schedule records yet',
  actionLabel,
  capabilities,
}: {
  title?: string
  actionLabel?: string
  capabilities?: SchedulingCapabilities
}) {
  const label =
    actionLabel ??
    (capabilities ? getPrimaryButtonLabel(capabilities) : 'schedule record')
  return (
    <div className="px-4 py-12 text-center">
      <CalendarDays className="mx-auto h-8 w-8 text-cyan-600/70 dark:text-cyan-200/60" />
      <h3 className="text-app-primary mt-3 text-sm font-semibold">{title}</h3>
      <p className="text-app-secondary mx-auto mt-1 max-w-md text-sm">
        Use {label.toLowerCase()} when you are ready. External calendar sync is
        not connected yet.
      </p>
    </div>
  )
}

const durationOptions = [
  { label: 'System default', value: 'system' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '45 min', value: '45' },
  { label: '1 hr', value: '60' },
  { label: '1 hr 30 min', value: '90' },
  { label: '2 hr', value: '120' },
  { label: 'Custom', value: 'custom' },
] as const

const durationPresetValues = new Set(['15', '30', '45', '60', '90', '120'])

function splitDurationMinutes(minutes: number) {
  const safeMinutes =
    Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 60
  return {
    hours: Math.floor(safeMinutes / 60),
    minutes: safeMinutes % 60,
  }
}

function DurationPreferenceControl({
  value,
  systemDefaultMinutes,
  disabled,
  onChange,
}: {
  value?: number
  systemDefaultMinutes: number
  disabled?: boolean
  onChange: (value: number | undefined) => void
}) {
  const normalizedValue = value && value > 0 ? Math.round(value) : undefined
  const [isEditingCustom, setIsEditingCustom] = useState(
    Boolean(
      normalizedValue && !durationPresetValues.has(String(normalizedValue)),
    ),
  )
  const selectValue = isEditingCustom
    ? 'custom'
    : normalizedValue
      ? durationPresetValues.has(String(normalizedValue))
        ? String(normalizedValue)
        : 'custom'
      : 'system'
  const initialCustom = splitDurationMinutes(
    normalizedValue ?? systemDefaultMinutes,
  )
  const [customHours, setCustomHours] = useState(initialCustom.hours)
  const [customMinutes, setCustomMinutes] = useState(initialCustom.minutes)
  const [customError, setCustomError] = useState('')
  useEffect(() => {
    if (!normalizedValue || durationPresetValues.has(String(normalizedValue)))
      return
    setIsEditingCustom(true)
    const next = splitDurationMinutes(normalizedValue)
    setCustomHours(next.hours)
    setCustomMinutes(next.minutes)
  }, [normalizedValue])

  const applyCustomDuration = (hours: number, minutes: number) => {
    const nextHours = Number.isFinite(hours)
      ? Math.max(0, Math.floor(hours))
      : 0
    const nextMinutes = Number.isFinite(minutes)
      ? Math.max(0, Math.floor(minutes))
      : 0
    if (nextHours > 24) {
      setCustomError('Use 24 hours or less.')
      return
    }
    if (nextMinutes > 59) {
      setCustomError('Minutes must be between 0 and 59.')
      return
    }
    const total = nextHours * 60 + nextMinutes
    if (total < 5) {
      setCustomError('Use at least 5 minutes.')
      return
    }
    setCustomError('')
    onChange(total)
  }

  const customTotalMinutes = customHours * 60 + customMinutes
  return (
    <div className="space-y-1">
      <span className="text-neutral-text-secondary text-xs font-medium">
        Default duration
      </span>
      <Select
        value={selectValue}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value
          if (next === 'system') {
            setIsEditingCustom(false)
            onChange(undefined)
          } else if (next === 'custom') {
            setIsEditingCustom(true)
          } else {
            setIsEditingCustom(false)
            onChange(Number(next))
          }
        }}
      >
        {durationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === 'system'
              ? `System default — ${formatMinutesDuration(systemDefaultMinutes)}`
              : option.label}
          </option>
        ))}
      </Select>
      {selectValue === 'custom' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-neutral-text-secondary text-xs font-medium">
            Custom duration
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-[11px]">
                Hours
              </span>
              <Input
                type="number"
                min={0}
                max={24}
                step={1}
                value={customHours}
                disabled={disabled}
                aria-invalid={Boolean(customError)}
                onChange={(event) => {
                  const hours = Number(event.target.value)
                  setCustomHours(hours)
                  applyCustomDuration(hours, customMinutes)
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-[11px]">
                Minutes
              </span>
              <Input
                type="number"
                min={0}
                max={59}
                step={1}
                value={customMinutes}
                disabled={disabled}
                aria-invalid={Boolean(customError)}
                onChange={(event) => {
                  const minutes = Number(event.target.value)
                  setCustomMinutes(minutes)
                  applyCustomDuration(customHours, minutes)
                }}
              />
            </label>
          </div>
          {customError ? (
            <p className="mt-2 text-[11px] text-rose-300">{customError}</p>
          ) : (
            <p className="text-neutral-text-secondary mt-2 text-[11px]">
              Resolved duration: {formatMinutesDuration(customTotalMinutes)}
            </p>
          )}
        </div>
      ) : null}
      <p className="text-neutral-text-secondary text-[11px]">
        {selectValue === 'system'
          ? "Uses Skillify's default for this event type."
          : 'Overrides the system default for this workspace.'}
      </p>
    </div>
  )
}

function CustomEventTypeCard({
  customType,
  settings,
  capabilities,
  canManage,
  isEditing,
  draft,
  error,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDelete,
}: {
  customType: WorkspaceSchedulingCustomEventType
  settings: WorkspaceSchedulingSettings
  capabilities: SchedulingCapabilities
  canManage: boolean
  isEditing: boolean
  draft: WorkspaceSchedulingCustomEventType | null
  error: string
  setDraft: (draft: WorkspaceSchedulingCustomEventType | null) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onDelete: () => void
}) {
  const currentDraft = draft ?? customType
  const toggleSection = (section: SchedulingSectionKey) => {
    const nextSections = currentDraft.sectionKeys.includes(section)
      ? currentDraft.sectionKeys.filter((item) => item !== section)
      : [...currentDraft.sectionKeys, section]
    setDraft({ ...currentDraft, sectionKeys: nextSections })
  }
  const toggleLinkedRecordType = (recordType: SchedulingLinkedRecordType) => {
    const nextTypes = currentDraft.supportedLinkedRecordTypes.includes(
      recordType,
    )
      ? currentDraft.supportedLinkedRecordTypes.filter(
          (item) => item !== recordType,
        )
      : [...currentDraft.supportedLinkedRecordTypes, recordType]
    setDraft({ ...currentDraft, supportedLinkedRecordTypes: nextTypes })
  }
  const locationRequirement = currentDraft.locationRequirement ?? 'optional'
  const allowUndeterminedLocation =
    currentDraft.allowUndeterminedLocation === true &&
    locationRequirement !== 'notAllowed'
  const rawAllowedLocationTypes: SchedulingLocationType[] = currentDraft
    .allowedLocationTypes?.length
    ? currentDraft.allowedLocationTypes
    : ['none']
  const policyAllowedLocationTypes = rawAllowedLocationTypes.filter(
    (type) => allowUndeterminedLocation || type !== 'toBeDetermined',
  )
  const requiredAllowedLocationTypes = policyAllowedLocationTypes.filter(
    (type) => type !== 'none',
  )
  const allowedLocationTypes: SchedulingLocationType[] =
    locationRequirement === 'notAllowed'
      ? ['none']
      : locationRequirement === 'optional'
        ? policyAllowedLocationTypes.includes('none')
          ? policyAllowedLocationTypes
          : ['none', ...policyAllowedLocationTypes]
        : requiredAllowedLocationTypes.length
          ? requiredAllowedLocationTypes
          : ['physicalAddress']
  const defaultLocationType = normalizeSchedulingLocationType(
    currentDraft.defaultLocationType,
  )
  const setLocationRequirement = (
    nextRequirement: SchedulingLocationRequirement,
  ) => {
    if (nextRequirement === 'notAllowed') {
      setDraft({
        ...currentDraft,
        locationRequirement: 'notAllowed',
        allowUndeterminedLocation: false,
        allowedLocationTypes: ['none'],
        defaultLocationType: 'none',
      })
      return
    }
    const nextAllowUndeterminedLocation = currentDraft.allowUndeterminedLocation
    const nextAllowed = allowedLocationTypes.filter(
      (type) => nextRequirement === 'optional' || type !== 'none',
    )
    const resolvedAllowed = nextAllowed.length
      ? nextAllowed
      : nextRequirement === 'required'
        ? (['physicalAddress'] as SchedulingLocationType[])
        : (['none', 'videoMeeting'] as SchedulingLocationType[])
    setDraft({
      ...currentDraft,
      locationRequirement: nextRequirement,
      allowUndeterminedLocation: nextAllowUndeterminedLocation,
      allowedLocationTypes: resolvedAllowed,
      defaultLocationType: resolvedAllowed.includes(defaultLocationType)
        ? defaultLocationType
        : (resolvedAllowed[0] ?? 'none'),
    })
  }
  const toggleLocationType = (type: SchedulingLocationType) => {
    if (locationRequirement === 'notAllowed') return
    if (type === 'none' && locationRequirement === 'required') return
    if (type === 'toBeDetermined' && !allowUndeterminedLocation) return
    const nextAllowed = allowedLocationTypes.includes(type)
      ? allowedLocationTypes.filter((item) => item !== type)
      : [...allowedLocationTypes, type]
    const resolvedAllowed = nextAllowed.length
      ? nextAllowed
      : locationRequirement === 'required'
        ? (['physicalAddress'] as SchedulingLocationType[])
        : (['none'] as SchedulingLocationType[])
    setDraft({
      ...currentDraft,
      allowedLocationTypes: resolvedAllowed,
      defaultLocationType: resolvedAllowed.includes(defaultLocationType)
        ? defaultLocationType
        : (resolvedAllowed[0] ?? 'none'),
    })
  }
  const setAllowUndeterminedLocation = (allow: boolean) => {
    const nextAllowed = allow
      ? allowedLocationTypes.includes('toBeDetermined')
        ? allowedLocationTypes
        : ([
            'toBeDetermined',
            ...allowedLocationTypes,
          ] as SchedulingLocationType[])
      : allowedLocationTypes.filter((type) => type !== 'toBeDetermined')
    setDraft({
      ...currentDraft,
      allowUndeterminedLocation: allow,
      allowedLocationTypes: nextAllowed.length ? nextAllowed : ['none'],
      defaultLocationType:
        !allow && defaultLocationType === 'toBeDetermined'
          ? (nextAllowed.find((type) => type !== 'none') ?? 'none')
          : defaultLocationType,
    })
  }
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition',
        customType.isActive
          ? 'border-cyan-300/35 bg-cyan-300/[0.04]'
          : 'border-slate-800 bg-slate-950/50 opacity-80',
      )}
    >
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Name
              </span>
              <Input
                value={currentDraft.label}
                onChange={(event) =>
                  setDraft({ ...currentDraft, label: event.target.value })
                }
              />
            </label>
            <DurationPreferenceControl
              value={currentDraft.defaultDurationMinutes}
              systemDefaultMinutes={defaultEventDurationMinutes}
              disabled={!canManage}
              onChange={(minutes) =>
                setDraft({
                  ...currentDraft,
                  defaultDurationMinutes: minutes,
                })
              }
            />
          </div>
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Description
            </span>
            <Textarea
              value={currentDraft.description ?? ''}
              onChange={(event) =>
                setDraft({
                  ...currentDraft,
                  description: event.target.value,
                })
              }
            />
          </label>
          <div>
            <p className="text-neutral-text-secondary text-xs font-medium">
              Sections
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {capabilities.supportedSections.map((sectionKey) => (
                <button
                  key={sectionKey}
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    currentDraft.sectionKeys.includes(sectionKey)
                      ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                      : 'border-slate-700 text-neutral-300 hover:border-cyan-300/35 hover:bg-slate-900',
                  )}
                >
                  {getSchedulingSectionLabel({
                    sectionKey,
                    settings,
                    preferShort: true,
                  })}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
              <input
                type="checkbox"
                checked={currentDraft.blocksAvailability}
                onChange={(event) =>
                  setDraft({
                    ...currentDraft,
                    blocksAvailability: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-cyan-300"
              />
              <span className="text-sm text-neutral-100">
                Blocks availability
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
              <input
                type="checkbox"
                checked={currentDraft.requiresLinkedRecord}
                onChange={(event) =>
                  setDraft({
                    ...currentDraft,
                    requiresLinkedRecord: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-cyan-300"
              />
              <span className="text-sm text-neutral-100">
                Requires linked record
              </span>
            </label>
          </div>
          <div>
            <p className="text-neutral-text-secondary text-xs font-medium">
              Supported linked records
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {getSupportedLinkedRecordTypes(capabilities).map((recordType) => (
                <button
                  key={recordType}
                  type="button"
                  onClick={() => toggleLinkedRecordType(recordType)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    currentDraft.supportedLinkedRecordTypes.includes(recordType)
                      ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                      : 'border-slate-700 text-neutral-300 hover:border-cyan-300/35 hover:bg-slate-900',
                  )}
                >
                  {formatLinkedRecordType(recordType)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Location requirement
              </span>
              <Select
                value={locationRequirement}
                onChange={(event) =>
                  setLocationRequirement(
                    event.target.value as SchedulingLocationRequirement,
                  )
                }
              >
                <option value="notAllowed">Not used</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Default location type
              </span>
              <Select
                value={
                  allowedLocationTypes.includes(defaultLocationType)
                    ? defaultLocationType
                    : (allowedLocationTypes[0] ?? 'none')
                }
                disabled={locationRequirement === 'notAllowed'}
                onChange={(event) =>
                  setDraft({
                    ...currentDraft,
                    defaultLocationType: event.target
                      .value as SchedulingLocationType,
                  })
                }
              >
                {allowedLocationTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatSchedulingLocationType(type)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={allowUndeterminedLocation}
                disabled={locationRequirement === 'notAllowed'}
                onChange={(event) =>
                  setAllowUndeterminedLocation(event.target.checked)
                }
                className="h-4 w-4 accent-cyan-300 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-100">
                Allow To be determined
              </span>
            </label>
            <div className="sm:col-span-2">
              <p className="text-neutral-text-secondary text-xs font-medium">
                Allowed location types
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {schedulingLocationTypes.map((type) => {
                  const disabled =
                    locationRequirement === 'notAllowed' ||
                    (type === 'none' && locationRequirement === 'required') ||
                    (type === 'toBeDetermined' && !allowUndeterminedLocation)
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLocationType(type)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                        allowedLocationTypes.includes(type)
                          ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                          : 'border-slate-700 text-neutral-300 hover:border-cyan-300/35 hover:bg-slate-900',
                      )}
                    >
                      {formatSchedulingLocationType(type)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
            <input
              type="checkbox"
              checked={currentDraft.isActive}
              onChange={(event) =>
                setDraft({ ...currentDraft, isActive: event.target.checked })
              }
              className="h-4 w-4 accent-cyan-300"
            />
            <span className="text-sm text-neutral-100">
              Available for new events
            </span>
          </label>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" onClick={onSave}>
              Save
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-neutral-100">
                  {customType.label}
                </p>
                <Badge variant="blue">Custom</Badge>
                <Badge variant={customType.isActive ? 'green' : 'slate'}>
                  {customType.isActive ? 'Active' : 'Hidden'}
                </Badge>
              </div>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {customType.description ?? 'Workspace custom event type.'}
              </p>
              <p className="text-neutral-text-secondary mt-2 text-xs">
                Appears in{' '}
                {customType.sectionKeys
                  .map((sectionKey) =>
                    getSchedulingSectionLabel({
                      sectionKey,
                      settings,
                      preferShort: true,
                    }),
                  )
                  .join(', ')}
              </p>
              <div className="text-neutral-text-secondary mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <span>
                  Default duration:{' '}
                  {formatMinutesDuration(customType.defaultDurationMinutes)}
                </span>
                <span>
                  Blocks availability:{' '}
                  {customType.blocksAvailability ? 'Yes' : 'No'}
                </span>
                <span>
                  Linked record:{' '}
                  {customType.requiresLinkedRecord ? 'Required' : 'Optional'}
                </span>
                <span>
                  Supported records:{' '}
                  {customType.supportedLinkedRecordTypes.length
                    ? customType.supportedLinkedRecordTypes
                        .map((recordType) => formatLinkedRecordType(recordType))
                        .join(', ')
                    : 'None'}
                </span>
                <span>
                  Location:{' '}
                  {customType.locationRequirement === 'notAllowed'
                    ? 'Not used'
                    : customType.locationRequirement === 'required'
                      ? 'Required'
                      : 'Optional'}
                </span>
                <span>
                  Location types:{' '}
                  {customType.allowedLocationTypes?.length
                    ? customType.allowedLocationTypes
                        .map(formatSchedulingLocationType)
                        .join(', ')
                    : 'None'}
                </span>
                <span>
                  Unresolved location:{' '}
                  {customType.allowUndeterminedLocation
                    ? 'Allowed'
                    : 'Not allowed'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!canManage || !canMoveUp}
                onClick={onMoveUp}
              >
                Up
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!canManage || !canMoveDown}
                onClick={onMoveDown}
              >
                Down
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!canManage}
                onClick={onEdit}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!canManage}
                onClick={onToggle}
              >
                {customType.isActive ? 'Hide' : 'Show'}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="danger"
                disabled={!canManage}
                onClick={onDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SchedulingSettings({
  workspaceId,
  workspaceSlug,
  capabilities,
  settings,
  events,
  canManage,
  memberOptions,
  onSave,
}: {
  workspaceId: string
  workspaceSlug: string
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  events: SchedulingEvent[]
  canManage: boolean
  memberOptions: SchedulingMemberOption[]
  onSave: (settings: WorkspaceSchedulingSettings) => void
}) {
  const currentInstant = useCurrentMinute()
  const preset = SCHEDULING_PRESETS[capabilities.preset]
  const [customTypeName, setCustomTypeName] = useState('')
  const [customTypeDescription, setCustomTypeDescription] = useState('')
  const [customTypeDuration, setCustomTypeDuration] = useState(60)
  const [editingCustomTypeId, setEditingCustomTypeId] = useState<string | null>(
    null,
  )
  const [customTypeDraft, setCustomTypeDraft] =
    useState<WorkspaceSchedulingCustomEventType | null>(null)
  const [customTypeError, setCustomTypeError] = useState('')
  const [editingSectionLabel, setEditingSectionLabel] =
    useState<SchedulingSectionKey | null>(null)
  const [sectionLabelDraft, setSectionLabelDraft] = useState('')
  const [sectionLabelError, setSectionLabelError] = useState('')
  const toggleSection = (section: SchedulingSectionKey) => {
    if (!canManage || section === 'calendar') return
    const next = settings.visibleSections.includes(section)
      ? settings.visibleSections.filter((item) => item !== section)
      : [...settings.visibleSections, section]
    onSave(
      mergeSchedulingVisibility({
        current: settings,
        nextVisibleSections: next,
        supportedSections: capabilities.supportedSections,
      }),
    )
  }
  const eventTypePreferences = useMemo(() => {
    const saved = new Map(
      (settings.eventTypePreferences ?? []).map((preference) => [
        preference.key,
        preference,
      ]),
    )
    return capabilities.supportedEventTypes
      .map((type, index) => ({
        key: type,
        isVisible: saved.get(type)?.isVisible !== false,
        sortOrder: saved.get(type)?.sortOrder ?? index,
        defaultDurationMinutes: saved.get(type)?.defaultDurationMinutes,
      }))
      .sort((first, second) => first.sortOrder - second.sortOrder)
  }, [capabilities.supportedEventTypes, settings.eventTypePreferences])

  const saveEventTypePreferences = (
    nextPreferences: WorkspaceSchedulingSettings['eventTypePreferences'],
  ) => {
    onSave({ ...settings, eventTypePreferences: nextPreferences })
  }

  const toggleEventType = (type: SchedulingEventType) => {
    if (!canManage) return
    saveEventTypePreferences(
      eventTypePreferences.map((preference) =>
        preference.key === type
          ? { ...preference, isVisible: !preference.isVisible }
          : preference,
      ),
    )
  }

  const moveEventType = (type: SchedulingEventType, direction: -1 | 1) => {
    if (!canManage) return
    const index = eventTypePreferences.findIndex(
      (preference) => preference.key === type,
    )
    const targetIndex = index + direction
    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= eventTypePreferences.length
    )
      return
    const next = [...eventTypePreferences]
    const [item] = next.splice(index, 1)
    next.splice(targetIndex, 0, item)
    saveEventTypePreferences(
      next.map((preference, sortOrder) => ({ ...preference, sortOrder })),
    )
  }

  const updateDefaultDuration = (
    type: SchedulingEventType,
    minutes?: number,
  ) => {
    if (!canManage) return
    saveEventTypePreferences(
      eventTypePreferences.map((preference) =>
        preference.key === type
          ? {
              ...preference,
              defaultDurationMinutes:
                minutes && minutes > 0 ? Math.round(minutes) : undefined,
            }
          : preference,
      ),
    )
  }

  const optionalSystemEventTypes = eventTypePreferences.filter(
    (preference) =>
      !getSchedulingEventTypeDefinition(preference.key).requiredForCreation,
  )
  const optionalCustomEventTypes = settings.customEventTypes ?? []
  const hasVisibleOptionalEventTypes =
    optionalSystemEventTypes.some((preference) => preference.isVisible) ||
    optionalCustomEventTypes.some((customType) => customType.isActive)
  const bulkEventTypeActionLabel = hasVisibleOptionalEventTypes
    ? 'Hide All'
    : 'Show All'

  const hideOptionalEventTypes = () => {
    if (!canManage) return
    const previousPreferences = settings.eventTypePreferences
    const previousCustomTypes = settings.customEventTypes
    onSave({
      ...settings,
      eventTypePreferences: eventTypePreferences.map((preference) => ({
        ...preference,
        isVisible: getSchedulingEventTypeDefinition(preference.key)
          .requiredForCreation
          ? true
          : false,
      })),
      customEventTypes: (settings.customEventTypes ?? []).map((customType) => ({
        ...customType,
        isActive: false,
        updatedAt: new Date().toISOString(),
      })),
    })
    toast('Optional event types hidden.', {
      action: {
        label: 'Undo',
        onClick: () =>
          onSave({
            ...settings,
            eventTypePreferences: previousPreferences,
            customEventTypes: previousCustomTypes,
          }),
      },
    })
  }

  const showOptionalEventTypes = () => {
    if (!canManage) return
    onSave({
      ...settings,
      eventTypePreferences: eventTypePreferences.map((preference) => ({
        ...preference,
        isVisible: true,
      })),
      customEventTypes: (settings.customEventTypes ?? []).map((customType) => ({
        ...customType,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })),
    })
    toast.success('Optional event types shown.')
  }

  const runBulkEventTypeVisibilityAction = () => {
    if (hasVisibleOptionalEventTypes) {
      hideOptionalEventTypes()
    } else {
      showOptionalEventTypes()
    }
  }

  const addCustomEventType = () => {
    if (!canManage || !customTypeName.trim()) return
    const now = new Date().toISOString()
    const customTypes = settings.customEventTypes ?? []
    const label = customTypeName.trim()
    const customType: WorkspaceSchedulingCustomEventType = {
      id: `custom-event-type-${Date.now().toString(36)}`,
      workspaceId,
      key: `custom.${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`,
      label,
      description: customTypeDescription.trim() || undefined,
      presetScope: [capabilities.preset],
      sectionKeys: [
        'calendar',
        ...capabilities.visibleSections
          .filter((section) => section !== 'calendar')
          .slice(0, 2),
      ],
      defaultDurationMinutes:
        customTypeDuration > 0 ? customTypeDuration : undefined,
      blocksAvailability: true,
      requiresLinkedRecord: false,
      supportedLinkedRecordTypes: getSupportedLinkedRecordTypes(capabilities),
      locationRequirement: 'optional',
      allowedLocationTypes: ['none', 'videoMeeting', 'phoneCall', 'other'],
      defaultLocationType: 'none',
      allowUndeterminedLocation: false,
      isActive: true,
      isSystem: false,
      sortOrder: customTypes.length,
      createdAt: now,
      updatedAt: now,
    }
    onSave({
      ...settings,
      customEventTypes: [...customTypes, customType],
    })
    setCustomTypeName('')
    setCustomTypeDescription('')
    setCustomTypeDuration(60)
  }

  const startEditingCustomType = (
    customType: WorkspaceSchedulingCustomEventType,
  ) => {
    setEditingCustomTypeId(customType.id)
    setCustomTypeDraft({ ...customType })
    setCustomTypeError('')
  }

  const cancelEditingCustomType = () => {
    setEditingCustomTypeId(null)
    setCustomTypeDraft(null)
    setCustomTypeError('')
  }

  const saveCustomEventType = () => {
    if (!canManage || !customTypeDraft) return
    const label = customTypeDraft.label.replace(/\s+/g, ' ').trim()
    if (label.length < 2 || label.length > 60) {
      setCustomTypeError(
        'Use a clear event type name between 2 and 60 characters.',
      )
      return
    }
    const sectionKeys = customTypeDraft.sectionKeys.filter((sectionKey) =>
      capabilities.supportedSections.includes(sectionKey),
    )
    const locationRequirement =
      customTypeDraft.locationRequirement ?? 'optional'
    const allowUndeterminedLocation =
      customTypeDraft.allowUndeterminedLocation === true &&
      locationRequirement !== 'notAllowed'
    const allowedLocationTypes =
      locationRequirement === 'notAllowed'
        ? (['none'] as SchedulingLocationType[])
        : (customTypeDraft.allowedLocationTypes ?? []).filter(
            (type): type is SchedulingLocationType =>
              schedulingLocationTypes.includes(
                type as SchedulingLocationType,
              ) &&
              (locationRequirement === 'optional' || type !== 'none') &&
              (allowUndeterminedLocation || type !== 'toBeDetermined'),
          )
    const normalizedAllowedLocationTypes =
      allowedLocationTypes.length > 0
        ? allowedLocationTypes
        : locationRequirement === 'required'
          ? (['physicalAddress'] as SchedulingLocationType[])
          : (['none'] as SchedulingLocationType[])
    const defaultLocationType = normalizedAllowedLocationTypes.includes(
      normalizeSchedulingLocationType(customTypeDraft.defaultLocationType),
    )
      ? normalizeSchedulingLocationType(customTypeDraft.defaultLocationType)
      : (normalizedAllowedLocationTypes[0] ?? 'none')
    const now = new Date().toISOString()
    onSave({
      ...settings,
      customEventTypes: (settings.customEventTypes ?? []).map((customType) =>
        customType.id === customTypeDraft.id
          ? {
              ...customType,
              ...customTypeDraft,
              key: customType.key,
              label,
              sectionKeys: sectionKeys.length ? sectionKeys : ['calendar'],
              locationRequirement,
              allowUndeterminedLocation,
              allowedLocationTypes: normalizedAllowedLocationTypes,
              defaultLocationType,
              updatedAt: now,
            }
          : customType,
      ),
    })
    cancelEditingCustomType()
  }

  const toggleCustomEventType = (
    customType: WorkspaceSchedulingCustomEventType,
  ) => {
    if (!canManage) return
    onSave({
      ...settings,
      customEventTypes: (settings.customEventTypes ?? []).map((item) =>
        item.id === customType.id
          ? {
              ...item,
              isActive: !item.isActive,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    })
  }

  const moveCustomEventType = (
    customType: WorkspaceSchedulingCustomEventType,
    direction: -1 | 1,
  ) => {
    if (!canManage) return
    const customTypes = [...(settings.customEventTypes ?? [])].sort(
      (first, second) => first.sortOrder - second.sortOrder,
    )
    const index = customTypes.findIndex((item) => item.id === customType.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= customTypes.length)
      return
    const [item] = customTypes.splice(index, 1)
    customTypes.splice(targetIndex, 0, item)
    onSave({
      ...settings,
      customEventTypes: customTypes.map((item, sortOrder) => ({
        ...item,
        sortOrder,
        updatedAt: new Date().toISOString(),
      })),
    })
  }

  const deleteCustomEventType = (
    customType: WorkspaceSchedulingCustomEventType,
  ) => {
    if (!canManage) return
    const used = events.some(
      (event) => event.type === (customType.key as SchedulingEventType),
    )
    if (used) {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(
          'This event type is used by existing schedule records. Hide it from new events while keeping historical records readable?',
        )
      ) {
        return
      }
      onSave({
        ...settings,
        customEventTypes: (settings.customEventTypes ?? []).map((item) =>
          item.id === customType.id
            ? { ...item, isActive: false, updatedAt: new Date().toISOString() }
            : item,
        ),
      })
      return
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete ${customType.label}? This cannot be undone.`)
    ) {
      return
    }
    onSave({
      ...settings,
      customEventTypes: (settings.customEventTypes ?? []).filter(
        (item) => item.id !== customType.id,
      ),
    })
  }

  const startEditingSectionLabel = (section: SchedulingSectionKey) => {
    setEditingSectionLabel(section)
    setSectionLabelDraft(
      getSchedulingSectionLabel({ sectionKey: section, settings }),
    )
    setSectionLabelError('')
  }

  const cancelEditingSectionLabel = () => {
    setEditingSectionLabel(null)
    setSectionLabelDraft('')
    setSectionLabelError('')
  }

  const saveSectionLabel = (section: SchedulingSectionKey) => {
    if (!canManage) return
    const label = sanitizeSchedulingSectionLabel(sectionLabelDraft)
    if (!label) {
      setSectionLabelError(
        'Use 2-40 letters or numbers. Avoid symbols-only names.',
      )
      return
    }
    const definition = getSchedulingSectionDefinition(section)
    const nextOverrides = { ...(settings.sectionLabelOverrides ?? {}) }
    if (label === definition.label || label === definition.shortLabel) {
      delete nextOverrides[section]
    } else {
      nextOverrides[section] = label
    }
    onSave({
      ...settings,
      sectionLabelOverrides: Object.keys(nextOverrides).length
        ? nextOverrides
        : undefined,
    })
    cancelEditingSectionLabel()
  }

  const resetSectionLabel = (section: SchedulingSectionKey) => {
    if (!canManage) return
    const nextOverrides = { ...(settings.sectionLabelOverrides ?? {}) }
    delete nextOverrides[section]
    onSave({
      ...settings,
      sectionLabelOverrides: Object.keys(nextOverrides).length
        ? nextOverrides
        : undefined,
    })
    cancelEditingSectionLabel()
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Scheduling Settings"
        description="Control which scheduling sections are visible for this workspace. Presets recommend defaults; they do not permanently lock your workflow."
        actions={
          <Button asChild variant="outline">
            <Link href={`/dashboard/${workspaceSlug}/scheduling/calendar`}>
              Back to Calendar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="relative z-20 space-y-4 overflow-visible p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                Scheduling module
              </p>
              <h2 className="mt-2 text-lg font-semibold text-neutral-50">
                {preset.label}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {preset.description}
              </p>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <span>
                <span className="block text-sm font-medium text-neutral-100">
                  Enable Scheduling
                </span>
                <span className="text-neutral-text-secondary block text-sm">
                  Hide or show the Scheduling module for this workspace.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={!canManage}
                onChange={(event) =>
                  onSave({ ...settings, enabled: event.target.checked })
                }
                className="h-5 w-5 accent-cyan-300"
              />
            </label>
          </Card>

          <Card className="relative z-0 p-5">
            <h2 className="text-sm font-semibold text-neutral-100">
              Visible sections
            </h2>
            <div className="mt-4 grid gap-3">
              {capabilities.supportedSections.map((section) => {
                const definition = getSchedulingSectionDefinition(section)
                const checked = settings.visibleSections.includes(section)
                const resolvedLabel = getSchedulingSectionLabel({
                  sectionKey: section,
                  settings,
                })
                const isEditing = editingSectionLabel === section
                return (
                  <div
                    key={section}
                    className={cn(
                      'rounded-2xl border p-4 transition',
                      checked
                        ? 'border-cyan-300/45 bg-cyan-300/[0.06]'
                        : 'border-slate-800 bg-slate-950/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-100">
                          {resolvedLabel}
                        </p>
                        <p className="text-neutral-text-secondary mt-1 text-sm">
                          {definition.description}
                        </p>
                        {settings.sectionLabelOverrides?.[section] ? (
                          <p className="mt-2 text-xs text-cyan-100/80">
                            Default name: {definition.label}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {canManage ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => startEditingSectionLabel(section)}
                          >
                            Edit name
                          </Button>
                        ) : null}
                        {section === 'calendar' ? (
                          <Badge
                            variant="slate"
                            title="Calendar cannot be hidden."
                          >
                            Required
                          </Badge>
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={`Show ${resolvedLabel}`}
                            checked={checked}
                            disabled={!canManage}
                            onChange={() => toggleSection(section)}
                            className="h-5 w-5 accent-cyan-300"
                          />
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <label className="space-y-1">
                            <span className="text-neutral-text-secondary text-xs font-medium">
                              Workspace display name
                            </span>
                            <Input
                              value={sectionLabelDraft}
                              onChange={(event) => {
                                setSectionLabelDraft(event.target.value)
                                setSectionLabelError('')
                              }}
                              maxLength={40}
                              aria-invalid={Boolean(sectionLabelError)}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="xs"
                              onClick={() => saveSectionLabel(section)}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={cancelEditingSectionLabel}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => resetSectionLabel(section)}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                        {sectionLabelError ? (
                          <p className="mt-2 text-xs text-rose-300">
                            {sectionLabelError}
                          </p>
                        ) : (
                          <p className="text-neutral-text-secondary mt-2 text-xs">
                            This changes how the section is named in this
                            workspace. It does not change its underlying
                            behavior.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">
                  Event types
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-sm">
                  Manage which scheduling event types appear for this workspace.
                  System keys stay stable for historical events.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="min-w-[5.75rem] whitespace-nowrap px-3.5"
                    onClick={runBulkEventTypeVisibilityAction}
                  >
                    {bulkEventTypeActionLabel}
                  </Button>
                ) : (
                  <Badge variant="slate">View only</Badge>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {eventTypePreferences.map((preference, index) => {
                const definition = getSchedulingEventTypeDefinition(
                  preference.key,
                )
                return (
                  <div
                    key={preference.key}
                    className={cn(
                      'rounded-2xl border p-4 transition',
                      preference.isVisible
                        ? 'border-cyan-300/35 bg-cyan-300/[0.04]'
                        : 'border-slate-800 bg-slate-950/50 opacity-75',
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-100">
                          {definition.label}
                        </p>
                        <p className="text-neutral-text-secondary mt-1 text-sm">
                          {definition.description}
                        </p>
                        <p className="text-neutral-text-secondary mt-2 text-xs">
                          Appears in{' '}
                          {definition.sections
                            .map((sectionKey) =>
                              getSchedulingSectionLabel({
                                sectionKey,
                                settings,
                                preferShort: true,
                              }),
                            )
                            .join(', ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={!canManage || index === 0}
                          onClick={() => moveEventType(preference.key, -1)}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={
                            !canManage ||
                            index === eventTypePreferences.length - 1
                          }
                          onClick={() => moveEventType(preference.key, 1)}
                        >
                          Down
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={!canManage}
                          onClick={() => toggleEventType(preference.key)}
                        >
                          {preference.isVisible ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 max-w-xs">
                      <DurationPreferenceControl
                        value={preference.defaultDurationMinutes}
                        systemDefaultMinutes={
                          getSchedulingEventTypeDefinition(preference.key)
                            .defaultDurationMinutes ??
                          defaultEventDurationMinutes
                        }
                        disabled={!canManage}
                        onChange={(minutes) =>
                          updateDefaultDuration(preference.key, minutes)
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                Custom event types
              </h3>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Create workspace-specific event types for your scheduling
                workflow.
              </p>
              {(settings.customEventTypes ?? []).length ? (
                <div className="mt-4 space-y-3">
                  {[...(settings.customEventTypes ?? [])]
                    .sort((first, second) => first.sortOrder - second.sortOrder)
                    .map((customType, index, customTypes) => (
                      <CustomEventTypeCard
                        key={customType.id}
                        customType={customType}
                        settings={settings}
                        capabilities={capabilities}
                        canManage={canManage}
                        isEditing={editingCustomTypeId === customType.id}
                        draft={
                          editingCustomTypeId === customType.id
                            ? customTypeDraft
                            : null
                        }
                        error={
                          editingCustomTypeId === customType.id
                            ? customTypeError
                            : ''
                        }
                        setDraft={setCustomTypeDraft}
                        onEdit={() => startEditingCustomType(customType)}
                        onSave={saveCustomEventType}
                        onCancel={cancelEditingCustomType}
                        onToggle={() => toggleCustomEventType(customType)}
                        onMoveUp={() => moveCustomEventType(customType, -1)}
                        onMoveDown={() => moveCustomEventType(customType, 1)}
                        canMoveUp={index > 0}
                        canMoveDown={index < customTypes.length - 1}
                        onDelete={() => deleteCustomEventType(customType)}
                      />
                    ))}
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_7rem]">
                <Input
                  value={customTypeName}
                  disabled={!canManage}
                  onChange={(event) => setCustomTypeName(event.target.value)}
                  placeholder="Custom event name"
                />
                <Input
                  type="number"
                  min={1}
                  value={customTypeDuration}
                  disabled={!canManage}
                  onChange={(event) =>
                    setCustomTypeDuration(Number(event.target.value))
                  }
                  placeholder="Duration minutes"
                  aria-label="Default duration in minutes"
                />
                <Button
                  type="button"
                  disabled={!canManage || !customTypeName.trim()}
                  onClick={addCustomEventType}
                >
                  Add Type
                </Button>
              </div>
              <Textarea
                value={customTypeDescription}
                disabled={!canManage}
                onChange={(event) =>
                  setCustomTypeDescription(event.target.value)
                }
                placeholder="Optional description"
                className="mt-3"
              />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-neutral-100">
              Calendar preferences
            </h2>
            <label className="block space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Default view
              </span>
              <Select
                value={settings.defaultCalendarView}
                disabled={!canManage}
                onChange={(event) =>
                  onSave({
                    ...settings,
                    defaultCalendarView: event.target
                      .value as SchedulingCalendarView,
                  })
                }
              >
                {Object.entries(viewLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Week starts on
              </span>
              <Select
                value={String(settings.weekStartsOn)}
                disabled={!canManage}
                onChange={(event) =>
                  onSave({
                    ...settings,
                    weekStartsOn: event.target.value === '1' ? 1 : 0,
                  })
                }
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-neutral-text-secondary text-xs font-medium">
                Timezone
              </span>
              <TimezoneSelector
                value={settings.timezone}
                disabled={!canManage}
                currentInstant={currentInstant}
                onChange={(timezone) => onSave({ ...settings, timezone })}
              />
            </label>
          </Card>

          <SchedulingNotificationSettingsCards
            workspaceId={workspaceId}
            settings={settings}
            canManage={canManage}
          />

          <CalendarConnectionPolicyCard
            settings={settings}
            canManage={canManage}
            memberOptions={memberOptions}
            onSave={onSave}
          />

          {canManage ? (
            <CalendarConnectionApprovalsInbox workspaceId={workspaceId} />
          ) : null}

          <GoogleCalendarSettingsCard
            workspaceId={workspaceId}
            canManage={canManage}
            providerSlug="google"
            providerTitle="Google Calendar"
            externalName="Google"
          />

          <GoogleCalendarSettingsCard
            workspaceId={workspaceId}
            canManage={canManage}
            providerSlug="microsoft"
            providerTitle="Microsoft Outlook"
            externalName="Outlook"
          />

          <CalDavCalendarSettingsCard
            workspaceId={workspaceId}
            canManage={canManage}
            platform="apple"
            providerTitle="Apple Calendar"
          />

          <CalDavCalendarSettingsCard
            workspaceId={workspaceId}
            canManage={canManage}
            platform="generic"
            providerTitle="Generic CalDAV"
          />
        </div>
      </div>
    </DashboardShell>
  )
}

function CalendarPolicyToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3',
        disabled && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-cyan-300"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-neutral-100">
          {label}
        </span>
        <span className="text-neutral-text-secondary mt-0.5 block text-xs leading-5">
          {description}
        </span>
      </span>
    </label>
  )
}

function CalendarConnectionPolicyCard({
  settings,
  canManage,
  memberOptions,
  onSave,
}: {
  settings: WorkspaceSchedulingSettings
  canManage: boolean
  memberOptions: SchedulingMemberOption[]
  onSave: (settings: WorkspaceSchedulingSettings) => void
}) {
  const policy = settings.calendarConnectionPolicy
  const updatePolicy = (patch: Partial<WorkspaceCalendarConnectionPolicy>) => {
    onSave({
      ...settings,
      calendarConnectionPolicy: {
        ...policy,
        ...patch,
      },
    })
  }
  const memberDependentDisabled = !canManage || !policy.allowMemberConnections
  const toggleListValue = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value]

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-100">
          Calendar connection policy
        </h2>
        <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
          Set workspace-wide rules for personal and shared calendar accounts.
          Google Calendar and Microsoft Outlook use these same rules.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          Member connections
        </p>
        <CalendarPolicyToggle
          label="Allow members to connect personal calendars"
          description="Members can request their own Google or Outlook connection when enabled."
          checked={policy.allowMemberConnections}
          disabled={!canManage}
          onChange={(checked) =>
            updatePolicy({ allowMemberConnections: checked })
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <CalendarPolicyToggle
            label="Allow multiple accounts per member"
            description="Members may connect more than one account per provider."
            checked={policy.allowMultipleAccountsPerMember}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowMultipleAccountsPerMember: checked })
            }
          />
          <CalendarPolicyToggle
            label="Require admin approval"
            description="Personal OAuth can complete, but sync waits for approval."
            checked={policy.requireMemberConnectionApproval}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ requireMemberConnectionApproval: checked })
            }
          />
          <CalendarPolicyToggle
            label="Include member calendars in availability"
            description="Approved personal calendars can contribute busy-only availability."
            checked={policy.includeMemberCalendarsInBusy}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ includeMemberCalendarsInBusy: checked })
            }
          />
          <CalendarPolicyToggle
            label="Allow admins to disable member connections"
            description="Admins can pause a member-owned connection without deleting credentials."
            checked={policy.allowAdminDisableMemberConnections}
            disabled={!canManage}
            onChange={(checked) =>
              updatePolicy({ allowAdminDisableMemberConnections: checked })
            }
          />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div>
          <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
            Personal calendars
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
            Personal calendars are optional availability signals. They never
            become official Time Off.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Availability
          </span>
          <Select
            value={policy.personalCalendarMode}
            disabled={memberDependentDisabled}
            onChange={(event) =>
              updatePolicy({
                personalCalendarMode: event.target
                  .value as WorkspaceCalendarConnectionPolicy['personalCalendarMode'],
              })
            }
          >
            {personalCalendarModeLabels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        {policy.personalCalendarMode === 'SELECTED_MEMBERS' ? (
          <div className="space-y-2">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Approved members
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {memberOptions.map((member) => (
                <CalendarPolicyToggle
                  key={member.id}
                  label={member.label}
                  description={member.secondary ?? 'Workspace member'}
                  checked={policy.personalCalendarAllowedMemberIds.includes(
                    member.id,
                  )}
                  disabled={memberDependentDisabled}
                  onChange={() =>
                    updatePolicy({
                      personalCalendarAllowedMemberIds: toggleListValue(
                        policy.personalCalendarAllowedMemberIds,
                        member.id,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
        {policy.personalCalendarMode === 'SELECTED_ROLES' ? (
          <div className="space-y-2">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Approved roles
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {workspaceRoleOptions.map((role) => (
                <CalendarPolicyToggle
                  key={role.value}
                  label={role.label}
                  description="May request personal calendar access."
                  checked={policy.personalCalendarAllowedRoleKeys.includes(
                    role.value,
                  )}
                  disabled={memberDependentDisabled}
                  onChange={() =>
                    updatePolicy({
                      personalCalendarAllowedRoleKeys: toggleListValue(
                        policy.personalCalendarAllowedRoleKeys,
                        role.value,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <CalendarPolicyToggle
            label="Allow owner personal calendar when otherwise off"
            description="Lets the workspace owner use one personal calendar without opening access to all admins."
            checked={policy.ownerPersonalCalendarAllowed}
            disabled={!canManage}
            onChange={(checked) =>
              updatePolicy({ ownerPersonalCalendarAllowed: checked })
            }
          />
          <CalendarPolicyToggle
            label="Require personal-calendar approval"
            description="Sync and availability impact wait for an eligible approver."
            checked={policy.personalCalendarApprovalRequired}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ personalCalendarApprovalRequired: checked })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Who can approve
            </span>
            <Select
              value={policy.personalCalendarApproverMode}
              disabled={memberDependentDisabled}
              onChange={(event) =>
                updatePolicy({
                  personalCalendarApproverMode: event.target
                    .value as WorkspaceCalendarConnectionPolicy['personalCalendarApproverMode'],
                })
              }
            >
              {personalApproverModeLabels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <CalendarPolicyToggle
            label="Allow self-approval"
            description="Approvers may approve their own personal-calendar request."
            checked={policy.allowPersonalCalendarSelfApproval}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowPersonalCalendarSelfApproval: checked })
            }
          />
        </div>
        {policy.personalCalendarApproverMode === 'SELECTED_MEMBERS' ? (
          <div className="space-y-2">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Approver members
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {memberOptions.map((member) => (
                <CalendarPolicyToggle
                  key={member.id}
                  label={member.label}
                  description={member.secondary ?? 'Workspace member'}
                  checked={policy.personalCalendarApproverMemberIds.includes(
                    member.id,
                  )}
                  disabled={memberDependentDisabled}
                  onChange={() =>
                    updatePolicy({
                      personalCalendarApproverMemberIds: toggleListValue(
                        policy.personalCalendarApproverMemberIds,
                        member.id,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
        {policy.personalCalendarApproverMode === 'SELECTED_ROLES' ? (
          <div className="space-y-2">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Approver roles
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {workspaceRoleOptions.map((role) => (
                <CalendarPolicyToggle
                  key={role.value}
                  label={role.label}
                  description="Can approve personal calendar requests."
                  checked={policy.personalCalendarApproverRoleKeys.includes(
                    role.value,
                  )}
                  disabled={memberDependentDisabled}
                  onChange={() =>
                    updatePolicy({
                      personalCalendarApproverRoleKeys: toggleListValue(
                        policy.personalCalendarApproverRoleKeys,
                        role.value,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Operational behavior
            </span>
            <Select
              value={policy.personalCalendarAvailabilityBehavior}
              disabled={memberDependentDisabled}
              onChange={(event) =>
                updatePolicy({
                  personalCalendarAvailabilityBehavior: event.target
                    .value as WorkspaceCalendarConnectionPolicy['personalCalendarAvailabilityBehavior'],
                })
              }
            >
              {personalAvailabilityBehaviorLabels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Busy display
            </span>
            <Select
              value={policy.personalCalendarBusyDisplayMode}
              disabled={memberDependentDisabled}
              onChange={(event) =>
                updatePolicy({
                  personalCalendarBusyDisplayMode: event.target
                    .value as WorkspaceCalendarConnectionPolicy['personalCalendarBusyDisplayMode'],
                })
              }
            >
              {personalBusyDisplayModeLabels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
          <p className="text-sm font-medium text-amber-100">
            Personal calendar events are not official Time Off.
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-100/75">
            Members must use Skillify Time Off or the business&apos;s approved
            leave process for official availability records.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          Sync permissions
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <CalendarPolicyToggle
            label="Read-only availability sync"
            description="Allows imports or availability-only member sync."
            checked={policy.allowMemberReadOnlySync}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowMemberReadOnlySync: checked })
            }
          />
          <CalendarPolicyToggle
            label="Outbound-only sync"
            description="Allows Skillify to write to approved member calendars."
            checked={policy.allowMemberWriteOnlySync}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowMemberWriteOnlySync: checked })
            }
          />
          <CalendarPolicyToggle
            label="Two-way sync"
            description="Allows approved member calendars to import and export events."
            checked={policy.allowMemberTwoWaySync}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowMemberTwoWaySync: checked })
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          Privacy
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Personal calendar visibility
            </span>
            <Select
              value={policy.defaultMemberVisibilityMode}
              disabled={memberDependentDisabled}
              onChange={(event) =>
                updatePolicy({
                  defaultMemberVisibilityMode: event.target
                    .value as WorkspaceCalendarConnectionPolicy['defaultMemberVisibilityMode'],
                })
              }
            >
              <option value="BUSY_ONLY">Busy only</option>
              <option value="TITLE_ONLY">Title only</option>
              <option value="FULL_DETAILS">Full details</option>
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Workspace account visibility
            </span>
            <Select
              value={policy.defaultWorkspaceVisibilityMode}
              disabled={!canManage}
              onChange={(event) =>
                updatePolicy({
                  defaultWorkspaceVisibilityMode: event.target
                    .value as WorkspaceCalendarConnectionPolicy['defaultWorkspaceVisibilityMode'],
                })
              }
            >
              <option value="BUSY_ONLY">Busy only</option>
              <option value="TITLE_ONLY">Title only</option>
              <option value="FULL_DETAILS">Full details</option>
            </Select>
          </label>
          <CalendarPolicyToggle
            label="Allow member visibility override"
            description="Members may request a more permissive privacy mode where allowed."
            checked={policy.allowMemberVisibilityOverride}
            disabled={memberDependentDisabled}
            onChange={(checked) =>
              updatePolicy({ allowMemberVisibilityOverride: checked })
            }
          />
          <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
            <p className="text-sm font-medium text-neutral-100">
              Provider-private events stay private
            </p>
            <p className="text-neutral-text-secondary mt-0.5 text-xs leading-5">
              Events marked private by Google or Outlook are always reduced to
              busy-only details.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          Approval and administration
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CalendarPolicyToggle
            label="Notify admins on connection request"
            description="Creates a governance event when a member-owned account needs approval."
            checked={policy.notifyAdminsOnConnectionRequest}
            disabled={!canManage}
            onChange={(checked) =>
              updatePolicy({ notifyAdminsOnConnectionRequest: checked })
            }
          />
          <CalendarPolicyToggle
            label="Notify admins when an owner leaves"
            description="Member-owned connections are paused and flagged for review when their owner leaves."
            checked={policy.notifyAdminsOnOwnerDeparture}
            disabled={!canManage}
            onChange={(checked) =>
              updatePolicy({ notifyAdminsOnOwnerDeparture: checked })
            }
          />
        </div>
      </div>
    </Card>
  )
}

type NotificationPreferencesResponse = {
  preferences?: {
    workspace?: WorkspaceSchedulingNotificationPreferences
    member?: MemberSchedulingNotificationPreferences | null
  }
  runtime?: {
    resendConfigured?: boolean
    developmentEmailMode?: string | null
  }
}

type GoogleCalendarStateResponse = {
  provider?: {
    key: 'google' | 'microsoft' | 'caldav'
    label: string
    status: string
    syncEnabled: boolean
    missing: string[]
  }
  policy?: {
    allowMemberConnections?: boolean
    allowMultipleAccountsPerMember?: boolean
    allowWorkspaceConnections?: boolean
    requireMemberConnectionApproval?: boolean
    allowMemberTwoWaySync?: boolean
    allowMemberWriteOnlySync?: boolean
    allowMemberReadOnlySync?: boolean
    includeMemberCalendarsInBusy?: boolean
    defaultMemberVisibilityMode?: string
    allowMemberVisibilityOverride?: boolean
    allowAdminDisableMemberConnections?: boolean
    notifyAdminsOnConnectionRequest?: boolean
    notifyAdminsOnOwnerDeparture?: boolean
    memberConnectionsAllowed: boolean
    multipleAccountsPerMemberAllowed: boolean
    sharedConnectionsAllowed: boolean
    requireAdminApproval: boolean
    defaultPersonalVisibilityMode: string
    defaultWorkspaceVisibilityMode: string
    personalCalendarAccess?: {
      canSeePersonalCalendarOption: boolean
      canRequestConnection: boolean
      canConnectWithoutApproval: boolean
      approvalRequired: boolean
      canApprove: boolean
      availabilityBehavior: string
      busyDisplayMode: string
      reasonCode?: string
    } | null
  }
  currentMember?: {
    id: string
  } | null
  connections?: Array<{
    id: string
    accountEmail?: string | null
    displayName?: string | null
    providerAccountId?: string | null
    platform?: string | null
    serverUrl?: string | null
    ownershipType?: 'MEMBER' | 'WORKSPACE'
    connectionPurpose?: CalendarConnectionPurpose
    classificationSource?: string
    classificationConfidence?: number | null
    classifiedAt?: string | null
    adminConfirmedAt?: string | null
    classificationConfirmation?: {
      status?: string
      requestedPurpose?: CalendarConnectionPurpose
      suggestedPurpose?: CalendarConnectionPurpose
      classificationConfidence?: number
      reasonCode?: string
      mismatchReason?: string
    } | null
    availabilityBehavior?: string
    busyDisplayMode?: string
    visibilityMode?: string
    approvalStatus?: string
    disabledAt?: string | null
    disabledReason?: string | null
    ownerInactiveAt?: string | null
    tokenStatus?: string | null
    ownerMember?: {
      id: string
      name: string
      email?: string | null
      isCurrentMember?: boolean
    } | null
    connectedByMember?: {
      id: string
      name: string
      email?: string | null
      isCurrentMember?: boolean
    } | null
    canManage?: boolean
    syncEligibility?: {
      canDiscoverCalendars: boolean
      canPull: boolean
      canPush: boolean
      contributesToBusy: boolean
      exposesTitle: boolean
      exposesFullDetails: boolean
      reasonCode: string
    }
    syncStatus: string
    conflictPolicy: string
    syncFrequencyMinutes: number
    lastSuccessfulSyncAt?: string | null
    lastAttemptedSyncAt?: string | null
    nextSyncAt?: string | null
    lastErrorCode?: string | null
    lastErrorMessage?: string | null
    calendars: Array<{
      id: string
      providerCalendarId: string
      name: string
      ownerEmail?: string | null
      timezone?: string | null
      color?: string | null
      accessRole?: string | null
      isPrimary: boolean
      isWritable: boolean
      selectedForSync: boolean
      syncDirection: string
      defaultExportTarget: boolean
      calendarPurpose?: CalendarConnectionPurpose
      classificationSource?: string
      classificationConfidence?: number | null
      availabilityBehavior?: string
      busyDisplayMode?: string
      lastSyncedAt?: string | null
      lastErrorCode?: string | null
      lastErrorMessage?: string | null
    }>
    watchChannels: Array<{
      id: string
      connectedCalendarId?: string | null
      providerCalendarId?: string | null
      status: string
      expiresAt?: string | null
      lastNotificationAt?: string | null
    }>
    conflicts?: Array<{
      id: string
      type: string
      safeMessage: string
      detectedAt: string
      providerSnapshot?: unknown
      skillifySnapshot?: unknown
      metadata?: unknown
    }>
    openConflicts: number
    recentLogs: Array<{
      id: string
      operation: string
      direction: string
      status: string
      safeMessage?: string | null
      startedAt: string
    }>
  }>
  diagnostics?: {
    pendingSync: number
    connectedAccounts: number
    openConflicts: number
    activeWatchChannels: number
    expiredWatchChannels?: number
  }
}

type GoogleImportPreviewResponse = {
  existingSkillifyEvents: number
  existingGoogleEvents: number
  duplicates: Array<{ score: number; confidence: string }>
  eventsToImport: unknown[]
  eventsToExport: unknown[]
  eventsSkipped: unknown[]
  conflicts: unknown[]
  dryRun: boolean
}

function formatProviderStatus({
  providerStatus,
  connected,
  syncing,
  warning,
  disconnected,
}: {
  providerStatus?: string
  connected: boolean
  syncing: boolean
  warning: boolean
  disconnected: boolean
}) {
  if (providerStatus !== 'available') return 'Not configured'
  if (warning) return 'Attention required'
  if (syncing) return 'Syncing'
  if (connected) return 'Healthy'
  if (disconnected) return 'Disconnected'
  return 'Ready to connect'
}

function providerStatusVariant(status: string) {
  if (status === 'Healthy' || status === 'Connected') return 'green'
  if (status === 'Syncing' || status === 'Ready to connect') return 'yellow'
  if (
    status === 'Warning' ||
    status === 'Attention required' ||
    status === 'Authentication expired'
  ) {
    return 'red'
  }
  return 'gray'
}

const calDavPlatformDefaults = {
  apple: {
    serverUrl: 'https://caldav.icloud.com',
    usernameLabel: 'Apple ID',
    passwordLabel: 'App-specific password',
    passwordHelp:
      'Use an Apple app-specific password. Your Apple ID password is not accepted.',
    help: 'Apple Calendar uses CalDAV. Enter your Apple ID and an Apple app-specific password.',
    connectLabel: 'Connect Apple Calendar',
  },
  generic: {
    serverUrl: '',
    usernameLabel: 'Username',
    passwordLabel: 'Password or app password',
    passwordHelp:
      'Use the app password or account password supported by the server.',
    help: 'Use a standards-compatible HTTPS CalDAV endpoint. Credentials are encrypted before storage.',
    connectLabel: 'Connect CalDAV',
  },
} as const

function formatExternalVisibilityMode(value?: string) {
  if (value === 'FULL_DETAILS') return 'Full details'
  if (value === 'TITLE_ONLY') return 'Title only'
  return 'Busy only'
}

const calendarPurposeLabels: Record<CalendarConnectionPurpose, string> = {
  PERSONAL: 'Personal',
  INDIVIDUAL_WORK: 'Individual work',
  WORKSPACE_SHARED: 'Workspace shared',
  RESOURCE: 'Resource',
  UNKNOWN: 'Needs classification',
}

const personalCalendarModeLabels: Array<{
  value: WorkspaceCalendarConnectionPolicy['personalCalendarMode']
  label: string
}> = [
  { value: 'DISABLED', label: 'Off for everyone' },
  { value: 'OWNER_ONLY', label: 'Owner only' },
  { value: 'SELECTED_MEMBERS', label: 'Selected members' },
  { value: 'SELECTED_ROLES', label: 'Selected roles' },
  { value: 'ALL_MEMBERS', label: 'Everyone' },
]

const personalAvailabilityBehaviorLabels: Array<{
  value: WorkspaceCalendarConnectionPolicy['personalCalendarAvailabilityBehavior']
  label: string
}> = [
  { value: 'IGNORE', label: 'Ignore personal calendar events' },
  { value: 'SUGGEST_CONFLICTS', label: 'Suggest scheduling conflicts only' },
  { value: 'BLOCK_AVAILABILITY', label: 'Block availability automatically' },
]

const personalBusyDisplayModeLabels: Array<{
  value: WorkspaceCalendarConnectionPolicy['personalCalendarBusyDisplayMode']
  label: string
}> = [
  { value: 'HIDDEN', label: 'Hidden from Busy' },
  { value: 'MEMBER_DETAIL_ONLY', label: 'Show only for a selected member' },
  {
    value: 'EXPANDABLE_EXTERNAL_AVAILABILITY',
    label: 'Show under External Availability',
  },
  { value: 'VISIBLE_IN_BUSY', label: 'Show directly in Busy' },
]

const personalApproverModeLabels: Array<{
  value: WorkspaceCalendarConnectionPolicy['personalCalendarApproverMode']
  label: string
}> = [
  { value: 'OWNER_ONLY', label: 'Owner only' },
  { value: 'OWNERS_AND_ADMINS', label: 'Owners and admins' },
  { value: 'SELECTED_ROLES', label: 'Selected roles' },
  { value: 'SELECTED_MEMBERS', label: 'Selected members' },
]

const workspaceRoleOptions = [
  { value: 'OWNER', label: 'Owners' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'MEMBER', label: 'Members' },
]

type CalendarApprovalRequest = {
  id: string
  provider: string
  accountEmail?: string | null
  displayName?: string | null
  purpose: CalendarConnectionPurpose
  approvalStatus: string
  availabilityBehavior: string
  busyDisplayMode: string
  visibilityMode: string
  classificationConfidence?: number | null
  selectedCalendarCount: number
  selectedCalendarNames: string[]
  member?: { id: string; name: string; email?: string | null } | null
  classificationConfirmation?: {
    status?: string
    requestedPurpose?: CalendarConnectionPurpose
    suggestedPurpose?: CalendarConnectionPurpose
    mismatchReason?: string
    reasonCode?: string
  } | null
  updatedAt: string
}

function CalendarConnectionApprovalsInbox({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [requests, setRequests] = useState<CalendarApprovalRequest[]>([])
  const [count, setCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('actionRequired')
  const [providerFilter, setProviderFilter] = useState('all')
  const [purposeFilter, setPurposeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set(
        'actionRequiredOnly',
        statusFilter === 'actionRequired' ? 'true' : 'false',
      )
      if (statusFilter !== 'actionRequired' && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (providerFilter !== 'all') params.set('provider', providerFilter)
      if (purposeFilter !== 'all') params.set('purpose', purposeFilter)
      const [requestsResponse, countResponse] = await Promise.all([
        fetch(
          `/api/workspaces/${workspaceId}/scheduling/calendar-connections/approvals?${params.toString()}`,
        ),
        fetch(
          `/api/workspaces/${workspaceId}/scheduling/calendar-connections/approvals/count`,
        ),
      ])
      if (!requestsResponse.ok || !countResponse.ok) {
        throw new Error('Calendar approvals could not be loaded.')
      }
      const requestsData = await requestsResponse.json()
      const countData = await countResponse.json()
      setRequests(requestsData.requests ?? [])
      setCount(countData.count ?? 0)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Calendar approvals could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [providerFilter, purposeFilter, statusFilter, workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  async function act(
    requestId: string,
    body: Record<string, unknown>,
    label: string,
  ) {
    setSavingId(requestId)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${requestId}/approval`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? `${label} failed.`)
      }
      toast.success(label)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : `${label} failed.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Calendar approvals{count ? ` · ${count}` : ''}
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
            Review member calendar requests, classification mismatches, and
            policy-driven reapproval without exposing personal event details.
          </p>
        </div>
        <Button type="button" size="xs" variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <Select
          value={statusFilter}
          aria-label="Approval status filter"
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="actionRequired">Action required</option>
          <option value="all">All history</option>
          <option value="PENDING">Pending</option>
          <option value="NEEDS_REVIEW">Needs review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select
          value={providerFilter}
          aria-label="Approval provider filter"
          onChange={(event) => setProviderFilter(event.target.value)}
        >
          <option value="all">All providers</option>
          <option value="GOOGLE">Google</option>
          <option value="OUTLOOK">Outlook</option>
        </Select>
        <Select
          value={purposeFilter}
          aria-label="Approval purpose filter"
          onChange={(event) => setPurposeFilter(event.target.value)}
        >
          <option value="all">All purposes</option>
          <option value="PERSONAL">Personal</option>
          <option value="INDIVIDUAL_WORK">Individual work</option>
          <option value="WORKSPACE_SHARED">Workspace shared</option>
          <option value="RESOURCE">Resource</option>
          <option value="UNKNOWN">Needs classification</option>
        </Select>
      </div>
      {error ? (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-neutral-text-secondary text-sm">
            Loading approvals...
          </p>
        ) : requests.length ? (
          requests.map((request) => {
            const mismatch =
              request.classificationConfirmation?.requestedPurpose &&
              request.classificationConfirmation?.suggestedPurpose &&
              request.classificationConfirmation.requestedPurpose !==
                request.classificationConfirmation.suggestedPurpose
            return (
              <div
                key={request.id}
                className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {request.member?.name ?? 'Workspace connection'} ·{' '}
                      {request.provider}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      {request.accountEmail ?? 'Account email unavailable'} ·{' '}
                      {calendarPurposeLabels[request.purpose ?? 'UNKNOWN']} ·{' '}
                      {request.approvalStatus.replaceAll('_', ' ')}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      {request.selectedCalendarCount} selected calendars ·{' '}
                      {request.availabilityBehavior.replaceAll('_', ' ')} ·{' '}
                      {request.busyDisplayMode.replaceAll('_', ' ')}
                    </p>
                    {mismatch ? (
                      <p className="mt-2 text-xs text-amber-100">
                        Classification mismatch: member selected{' '}
                        {
                          calendarPurposeLabels[
                            request.classificationConfirmation
                              ?.requestedPurpose ?? 'UNKNOWN'
                          ]
                        }
                        , Skillify suggested{' '}
                        {
                          calendarPurposeLabels[
                            request.classificationConfirmation
                              ?.suggestedPurpose ?? 'UNKNOWN'
                          ]
                        }
                        .
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={savingId !== null}
                      onClick={() =>
                        act(
                          request.id,
                          { action: 'approveSuggestion' },
                          'Approved as conflict suggestions.',
                        )
                      }
                    >
                      Approve suggestions
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={savingId !== null}
                      onClick={() =>
                        act(
                          request.id,
                          { action: 'approveBlocking' },
                          'Approved as blocking availability.',
                        )
                      }
                    >
                      Approve blocking
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={savingId !== null}
                      onClick={() =>
                        act(
                          request.id,
                          { action: 'approveWork' },
                          'Approved as work calendar.',
                        )
                      }
                    >
                      Approve work
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={savingId !== null}
                      onClick={() =>
                        act(
                          request.id,
                          { action: 'requestChanges' },
                          'Changes requested.',
                        )
                      }
                    >
                      Request changes
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={savingId !== null}
                      onClick={() =>
                        act(request.id, { action: 'reject' }, 'Rejected.')
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-neutral-text-secondary rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm">
            No calendar approval requests match these filters.
          </p>
        )}
      </div>
    </Card>
  )
}

function CalDavCalendarSettingsCard({
  workspaceId,
  canManage,
  platform,
  providerTitle,
}: {
  workspaceId: string
  canManage: boolean
  platform: 'apple' | 'generic'
  providerTitle: string
}) {
  const defaults = calDavPlatformDefaults[platform]
  const [state, setState] = useState<GoogleCalendarStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importPreview, setImportPreview] =
    useState<GoogleImportPreviewResponse | null>(null)
  const [repairSummary, setRepairSummary] = useState<string | null>(null)
  const [connectionPurpose, setConnectionPurpose] =
    useState<CalendarConnectionPurpose>('PERSONAL')
  const [ownershipType, setOwnershipType] = useState<'MEMBER' | 'WORKSPACE'>(
    'MEMBER',
  )
  const [serverUrl, setServerUrl] = useState<string>(defaults.serverUrl)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/caldav?platform=${platform}`,
      )
      if (!response.ok) throw new Error(`Unable to load ${providerTitle}.`)
      setState(await response.json())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to load ${providerTitle}.`,
      )
    } finally {
      setLoading(false)
    }
  }, [platform, providerTitle, workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const provider = state?.provider
  const connections = state?.connections ?? []
  const providerAvailable = provider?.status === 'available'
  const connected = connections.some(
    (connection) =>
      connection.syncStatus === 'CONNECTED' ||
      connection.syncStatus === 'INITIAL_SYNC',
  )
  const warning = connections.some(
    (connection) =>
      connection.syncStatus === 'NEEDS_ATTENTION' ||
      Boolean(connection.lastErrorCode) ||
      Boolean(connection.lastErrorMessage),
  )
  const displayStatus = formatProviderStatus({
    providerStatus: provider?.status,
    connected,
    syncing: false,
    warning,
    disconnected: connections.some(
      (connection) => connection.syncStatus === 'DISCONNECTED',
    ),
  })
  const personalAccess = state?.policy?.personalCalendarAccess
  const memberConnectionsAllowed =
    personalAccess?.canRequestConnection ??
    state?.policy?.memberConnectionsAllowed ??
    canManage
  const sharedConnectionsAllowed =
    state?.policy?.sharedConnectionsAllowed ?? canManage
  const canSubmit =
    providerAvailable &&
    username.trim().length > 0 &&
    password.trim().length > 0 &&
    serverUrl.trim().length > 0 &&
    savingId === null &&
    (ownershipType === 'WORKSPACE'
      ? canManage && sharedConnectionsAllowed
      : memberConnectionsAllowed)

  async function postAction(url: string, body?: unknown) {
    setSavingId(url)
    setError(null)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ??
            result.safeMessage ??
            `${providerTitle} action failed.`,
        )
      }
      await load()
      toast.success(`${providerTitle} updated.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `${providerTitle} action failed.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    await postAction(
      `/api/workspaces/${workspaceId}/scheduling/caldav/connect`,
      {
        platform,
        serverUrl,
        username,
        password,
        ownershipType,
        connectionPurpose:
          ownershipType === 'WORKSPACE'
            ? 'WORKSPACE_SHARED'
            : connectionPurpose,
      },
    )
    setPassword('')
  }

  async function updateCalendar(
    calendarId: string,
    patch: Record<string, unknown>,
  ) {
    setSavingId(calendarId)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/caldav/calendars/${calendarId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? 'Unable to update calendar mapping.')
      }
      await load()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to update calendar mapping.'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function loadImportPreview(connectionId: string) {
    setSavingId(`preview:${connectionId}`)
    setImportPreview(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/caldav/connections/${connectionId}/import-preview`,
        { method: 'POST' },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ?? `Unable to preview ${providerTitle} import.`,
        )
      }
      setImportPreview(result)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Unable to preview ${providerTitle} import.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function runMappingRepair(repair: boolean) {
    setSavingId('repair')
    setRepairSummary(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/caldav/repair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repair }),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ?? `Unable to inspect ${providerTitle} mappings.`,
        )
      }
      const value = result.value ?? result
      setRepairSummary(
        `${value.findings?.length ?? 0} findings · ${value.repaired ?? 0} repaired`,
      )
      await load()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Unable to inspect ${providerTitle} mappings.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function resolveConflict(conflictId: string, resolution: string) {
    setSavingId(`conflict:${conflictId}`)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/caldav/conflicts/${conflictId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? 'Unable to resolve conflict.')
      }
      await load()
      toast.success(`${providerTitle} conflict updated.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to resolve conflict.'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-cyan-200"
            aria-label={`${providerTitle} provider`}
            role="img"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">
              {providerTitle}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              {defaults.help}
            </p>
          </div>
        </div>
        <Badge variant={providerStatusVariant(displayStatus)} size="sm">
          {displayStatus}
        </Badge>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-neutral-text-secondary mt-4 text-sm">
          Loading {providerTitle}...
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <form
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
            onSubmit={connect}
          >
            <div className="flex flex-wrap items-end gap-3">
              {platform === 'generic' ? (
                <label className="min-w-[16rem] flex-1 space-y-1">
                  <span className="text-neutral-text-secondary text-xs">
                    CalDAV server URL
                  </span>
                  <Input
                    value={serverUrl}
                    placeholder="https://caldav.example.com"
                    disabled={!providerAvailable || savingId !== null}
                    onChange={(event) => setServerUrl(event.target.value)}
                  />
                </label>
              ) : (
                <div className="min-w-[14rem] rounded-lg border border-slate-800 bg-slate-950/45 px-3 py-2 text-xs text-neutral-300">
                  Server · {serverUrl}
                </div>
              )}
              <label className="min-w-[12rem] flex-1 space-y-1">
                <span className="text-neutral-text-secondary text-xs">
                  {defaults.usernameLabel}
                </span>
                <Input
                  value={username}
                  autoComplete="username"
                  disabled={!providerAvailable || savingId !== null}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label className="min-w-[12rem] flex-1 space-y-1">
                <span className="text-neutral-text-secondary text-xs">
                  {defaults.passwordLabel}
                </span>
                <Input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  disabled={!providerAvailable || savingId !== null}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs">
                  Account type
                </span>
                <Select
                  value={ownershipType}
                  className="h-9 min-w-[11rem] text-xs"
                  disabled={!providerAvailable || savingId !== null}
                  onChange={(event) => {
                    const next = event.target.value as 'MEMBER' | 'WORKSPACE'
                    setOwnershipType(next)
                    if (next === 'WORKSPACE') {
                      setConnectionPurpose('WORKSPACE_SHARED')
                    }
                  }}
                >
                  <option value="MEMBER">Personal calendar</option>
                  {canManage ? (
                    <option value="WORKSPACE">Workspace shared</option>
                  ) : null}
                </Select>
              </label>
              {ownershipType === 'MEMBER' ? (
                <label className="space-y-1">
                  <span className="text-neutral-text-secondary text-xs">
                    Purpose
                  </span>
                  <Select
                    value={connectionPurpose}
                    className="h-9 min-w-[11rem] text-xs"
                    disabled={!providerAvailable || savingId !== null}
                    onChange={(event) =>
                      setConnectionPurpose(
                        event.target.value as CalendarConnectionPurpose,
                      )
                    }
                  >
                    <option value="PERSONAL">Personal calendar</option>
                    <option value="INDIVIDUAL_WORK">My work calendar</option>
                  </Select>
                </label>
              ) : null}
              <Button
                type="submit"
                size="xs"
                variant="outline"
                disabled={!canSubmit}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {defaults.connectLabel}
              </Button>
            </div>
            <p className="text-neutral-text-secondary mt-3 text-xs">
              {defaults.passwordHelp} Skillify stores encrypted credentials and
              never logs passwords.
            </p>
            {!providerAvailable ? (
              <p className="mt-2 text-xs text-amber-200">
                Calendar credential encryption must be configured before CalDAV
                accounts can be connected.
              </p>
            ) : null}
          </form>

          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-4">
              <p className="text-sm font-medium text-neutral-200">
                No {providerTitle} accounts connected
              </p>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Connect an account to discover calendars, map purposes, and
                enable polling-based sync.
              </p>
            </div>
          ) : (
            connections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {connection.displayName ?? `${providerTitle} account`}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      {connection.serverUrl
                        ? `Server · ${connection.serverUrl}`
                        : 'Server discovered'}{' '}
                      · {connection.calendars.length}{' '}
                      {connection.calendars.length === 1
                        ? 'calendar'
                        : 'calendars'}
                    </p>
                    {connection.lastErrorMessage ? (
                      <p className="mt-2 flex items-center gap-1 text-xs text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {connection.lastErrorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!connection.canManage || savingId !== null}
                      onClick={() =>
                        postAction(
                          `/api/workspaces/${workspaceId}/scheduling/caldav/connections/${connection.id}/discover`,
                        )
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!connection.canManage || savingId !== null}
                      onClick={() =>
                        postAction(
                          `/api/workspaces/${workspaceId}/scheduling/caldav/connections/${connection.id}/sync`,
                        )
                      }
                    >
                      Sync now
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!connection.canManage || savingId !== null}
                      onClick={() => loadImportPreview(connection.id)}
                    >
                      Preview import
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!connection.canManage || savingId !== null}
                      onClick={() => runMappingRepair(false)}
                    >
                      View diagnostics
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!connection.canManage || savingId !== null}
                      onClick={() =>
                        postAction(
                          `/api/workspaces/${workspaceId}/scheduling/caldav/connections/${connection.id}/disconnect`,
                        )
                      }
                    >
                      <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
                      Disconnect
                    </Button>
                  </div>
                </div>
                {importPreview ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-3 text-xs text-cyan-50">
                    <p className="font-semibold">Initial sync preview</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <span>
                        Skillify events · {importPreview.existingSkillifyEvents}
                      </span>
                      <span>
                        {providerTitle} events ·{' '}
                        {importPreview.existingGoogleEvents}
                      </span>
                      <span>
                        Duplicates · {importPreview.duplicates.length}
                      </span>
                      <span>
                        To import · {importPreview.eventsToImport.length}
                      </span>
                      <span>
                        To export · {importPreview.eventsToExport.length}
                      </span>
                      <span>
                        Skipped · {importPreview.eventsSkipped.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled
                      >
                        Import {providerTitle}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled
                      >
                        Export Skillify
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled
                      >
                        Merge
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setImportPreview(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                {connection.conflicts?.length ? (
                  <div className="mt-3 space-y-2">
                    {connection.conflicts.map((conflict) => (
                      <div
                        key={conflict.id}
                        className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-50"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {conflict.type.replaceAll('_', ' ')}
                            </p>
                            <p className="mt-1 text-amber-100/80">
                              {conflict.safeMessage}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onClick={() =>
                                resolveConflict(conflict.id, 'keepSkillify')
                              }
                            >
                              Keep Skillify
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onClick={() =>
                                resolveConflict(conflict.id, 'keepCalDav')
                              }
                            >
                              Keep {providerTitle}
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onClick={() =>
                                resolveConflict(conflict.id, 'merge')
                              }
                            >
                              Merge
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {connection.calendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/45 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex min-w-0 items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-cyan-300"
                            checked={calendar.selectedForSync}
                            disabled={
                              !connection.canManage || savingId !== null
                            }
                            onChange={(event) =>
                              updateCalendar(calendar.id, {
                                selectedForSync: event.target.checked,
                              })
                            }
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-neutral-100">
                              {calendar.name}
                            </span>
                            <span className="text-neutral-text-secondary block text-xs">
                              {calendar.isPrimary ? 'Primary' : 'Calendar'} ·{' '}
                              {calendar.isWritable ? 'Writable' : 'Read-only'} ·{' '}
                              {calendar.timezone ?? 'Timezone unknown'}
                            </span>
                          </span>
                        </label>
                        <Badge variant={calendar.isWritable ? 'green' : 'gray'}>
                          {calendar.accessRole ?? 'reader'}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <label className="block space-y-1">
                          <span className="text-neutral-text-secondary text-xs">
                            Calendar purpose
                          </span>
                          <Select
                            value={calendar.calendarPurpose ?? 'UNKNOWN'}
                            disabled={
                              !connection.canManage || savingId !== null
                            }
                            onChange={(event) =>
                              updateCalendar(calendar.id, {
                                calendarPurpose: event.target.value,
                              })
                            }
                          >
                            <option value="PERSONAL">Personal</option>
                            <option value="INDIVIDUAL_WORK">
                              Individual work
                            </option>
                            {canManage ? (
                              <>
                                <option value="WORKSPACE_SHARED">
                                  Workspace shared
                                </option>
                                <option value="RESOURCE">Resource</option>
                              </>
                            ) : null}
                            <option value="UNKNOWN">
                              Needs classification
                            </option>
                          </Select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-neutral-text-secondary text-xs">
                            Sync direction
                          </span>
                          <Select
                            value={calendar.syncDirection}
                            disabled={
                              !connection.canManage || savingId !== null
                            }
                            onChange={(event) =>
                              updateCalendar(calendar.id, {
                                syncDirection: event.target.value,
                              })
                            }
                          >
                            <option value="IMPORT_ONLY">
                              {providerTitle} to Skillify
                            </option>
                            <option value="EXPORT_ONLY">
                              Skillify to {providerTitle}
                            </option>
                            <option value="TWO_WAY">Bidirectional</option>
                            <option value="AVAILABILITY_ONLY">
                              Availability only
                            </option>
                            <option value="DISABLED">Disabled</option>
                          </Select>
                        </label>
                        <label className="flex items-center gap-2 self-end rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-neutral-200">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-cyan-300"
                            checked={calendar.defaultExportTarget}
                            disabled={
                              !connection.canManage ||
                              !calendar.isWritable ||
                              savingId !== null
                            }
                            onChange={(event) =>
                              updateCalendar(calendar.id, {
                                defaultExportTarget: event.target.checked,
                              })
                            }
                          />
                          Default Skillify export calendar
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {repairSummary ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3 text-xs text-neutral-300">
              Mapping integrity · {repairSummary}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function GoogleCalendarSettingsCard({
  workspaceId,
  canManage,
  providerSlug,
  providerTitle,
  externalName,
}: {
  workspaceId: string
  canManage: boolean
  providerSlug: 'google' | 'microsoft'
  providerTitle: string
  externalName: 'Google' | 'Outlook'
}) {
  const [state, setState] = useState<GoogleCalendarStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importPreview, setImportPreview] =
    useState<GoogleImportPreviewResponse | null>(null)
  const [repairSummary, setRepairSummary] = useState<string | null>(null)
  const [connectionPurpose, setConnectionPurpose] =
    useState<CalendarConnectionPurpose>('PERSONAL')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}`,
      )
      if (!response.ok) throw new Error(`Unable to load ${providerTitle}.`)
      setState(await response.json())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to load ${providerTitle}.`,
      )
    } finally {
      setLoading(false)
    }
  }, [providerSlug, providerTitle, workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const provider = state?.provider
  const connections = state?.connections ?? []
  const connected = connections.some(
    (connection) =>
      connection.syncStatus === 'CONNECTED' ||
      connection.syncStatus === 'INITIAL_SYNC',
  )
  const providerAvailable = provider?.status === 'available'
  const syncing = connections.some(
    (connection) => connection.syncStatus === 'INITIAL_SYNC',
  )
  const warning = connections.some(
    (connection) =>
      connection.syncStatus === 'NEEDS_ATTENTION' ||
      Boolean(connection.lastErrorCode) ||
      Boolean(connection.lastErrorMessage) ||
      connection.openConflicts > 0,
  )
  const disconnected = connections.some(
    (connection) => connection.syncStatus === 'DISCONNECTED',
  )
  const displayStatus = formatProviderStatus({
    providerStatus: provider?.status,
    connected,
    syncing,
    warning,
    disconnected,
  })
  const diagnosticsAvailable = providerAvailable && connections.length > 0
  const developerDetailsAllowed =
    canManage && process.env.NODE_ENV !== 'production'
  const personalAccess = state?.policy?.personalCalendarAccess
  const memberConnectionsAllowed =
    personalAccess?.canRequestConnection ??
    state?.policy?.memberConnectionsAllowed ??
    canManage
  const showPersonalConnect =
    personalAccess?.canSeePersonalCalendarOption ?? memberConnectionsAllowed
  const sharedConnectionsAllowed =
    state?.policy?.sharedConnectionsAllowed ?? canManage
  const connectDisabledReason = !providerAvailable
    ? 'Integration setup is required before accounts can be connected.'
    : !memberConnectionsAllowed
      ? 'Your workspace does not currently allow members to connect personal calendars.'
      : null

  async function postAction(url: string, body?: unknown) {
    setSavingId(url)
    setError(null)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ??
            result.safeMessage ??
            `${providerTitle} action failed.`,
        )
      }
      if (result.ok && result.value?.authorizationUrl) {
        window.location.assign(result.value.authorizationUrl)
        return
      }
      await load()
      toast.success(`${providerTitle} updated.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `${providerTitle} action failed.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function loadImportPreview(connectionId: string) {
    setSavingId(`preview:${connectionId}`)
    setImportPreview(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connections/${connectionId}/import-preview`,
        { method: 'POST' },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ?? `Unable to preview ${providerTitle} import.`,
        )
      }
      setImportPreview(result)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Unable to preview ${providerTitle} import.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function resolveConflict(conflictId: string, resolution: string) {
    setSavingId(`conflict:${conflictId}`)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/conflicts/${conflictId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? 'Unable to resolve conflict.')
      }
      await load()
      toast.success(`${providerTitle} conflict updated.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to resolve conflict.'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function runMappingRepair(repair: boolean) {
    setSavingId('repair')
    setRepairSummary(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/repair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repair }),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message ?? `Unable to inspect ${providerTitle} mappings.`,
        )
      }
      setRepairSummary(
        `${result.findings?.length ?? 0} findings · ${result.repaired ?? 0} repaired`,
      )
      await load()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Unable to inspect ${providerTitle} mappings.`
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function updateCalendar(
    calendarId: string,
    patch: Record<string, unknown>,
  ) {
    setSavingId(calendarId)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/calendars/${calendarId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.message ?? 'Unable to update calendar mapping.')
      }
      await load()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to update calendar mapping.'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-cyan-200"
            aria-label={`${providerTitle} provider`}
            role="img"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">
              {providerTitle}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              Skillify remains the source of truth. {providerTitle} syncs
              selected calendars as an external provider.
            </p>
          </div>
        </div>
        <Badge variant={providerStatusVariant(displayStatus)} size="sm">
          {displayStatus}
        </Badge>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-neutral-text-secondary mt-4 text-sm">
          Loading {providerTitle}...
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  Provider status
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {providerAvailable
                    ? 'OAuth credentials and encryption are configured.'
                    : `${providerTitle} has not been configured yet.`}
                </p>
                {!providerAvailable ? (
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    A Skillify administrator must configure this integration
                    before workspace accounts can be connected.
                  </p>
                ) : null}
                {providerAvailable && !memberConnectionsAllowed ? (
                  <p className="mt-1 text-xs text-amber-200">
                    Your workspace administrator has disabled personal calendar
                    connections.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showPersonalConnect ? (
                  <>
                    <label
                      className="sr-only"
                      htmlFor={`${providerSlug}-purpose`}
                    >
                      Calendar account type
                    </label>
                    <Select
                      id={`${providerSlug}-purpose`}
                      value={connectionPurpose}
                      disabled={
                        !providerAvailable ||
                        !memberConnectionsAllowed ||
                        savingId !== null
                      }
                      className="h-8 min-w-[10rem] text-xs"
                      onChange={(event) =>
                        setConnectionPurpose(
                          event.target.value as CalendarConnectionPurpose,
                        )
                      }
                    >
                      <option value="PERSONAL">Personal calendar</option>
                      <option value="INDIVIDUAL_WORK">My work calendar</option>
                    </Select>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={
                        !providerAvailable ||
                        !memberConnectionsAllowed ||
                        savingId !== null
                      }
                      title={connectDisabledReason ?? undefined}
                      aria-describedby={
                        connectDisabledReason
                          ? `${providerSlug}-connect-help`
                          : undefined
                      }
                      onClick={() =>
                        postAction(
                          `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connect`,
                          {
                            ownershipType: 'MEMBER',
                            connectionPurpose,
                          },
                        )
                      }
                    >
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Connect {externalName}
                    </Button>
                  </>
                ) : null}
                {canManage ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={
                      !providerAvailable ||
                      !sharedConnectionsAllowed ||
                      savingId !== null
                    }
                    title={
                      !providerAvailable
                        ? 'Integration setup is required before workspace accounts can be connected.'
                        : undefined
                    }
                    onClick={() =>
                      postAction(
                        `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connect`,
                        {
                          ownershipType: 'WORKSPACE',
                          connectionPurpose: 'WORKSPACE_SHARED',
                        },
                      )
                    }
                  >
                    Connect Workspace Account
                  </Button>
                ) : null}
              </div>
            </div>
            {connectDisabledReason ? (
              <p
                id={`${providerSlug}-connect-help`}
                className="text-neutral-text-secondary mt-3 text-xs"
              >
                {connectDisabledReason}
              </p>
            ) : null}
            {connectionPurpose === 'PERSONAL' && showPersonalConnect ? (
              <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100">
                This appears to be a personal calendar. Personal calendars are
                treated as optional availability signals, not approved Time Off.
                Current policy:{' '}
                {personalAvailabilityBehaviorLabels.find(
                  (option) =>
                    option.value ===
                    state?.policy?.personalCalendarAccess?.availabilityBehavior,
                )?.label ?? 'Suggest scheduling conflicts only'}
                .
              </div>
            ) : null}
            {developerDetailsAllowed ? (
              <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-neutral-300">
                <summary className="cursor-pointer font-semibold text-neutral-200">
                  Developer details
                </summary>
                <div className="mt-3 space-y-1 break-words">
                  <p>
                    Feature flag enabled: {provider?.syncEnabled ? 'Yes' : 'No'}
                  </p>
                  <p>Provider status: {provider?.status ?? 'unknown'}</p>
                  <p>
                    Missing configuration:{' '}
                    {provider?.missing?.length
                      ? provider.missing.join(', ')
                      : 'None'}
                  </p>
                  <p>
                    Redirect URI:{' '}
                    {providerSlug === 'google'
                      ? 'GOOGLE_CALENDAR_REDIRECT_URI'
                      : 'MICROSOFT_CALENDAR_REDIRECT_URI'}
                  </p>
                  <p>
                    Encryption check:{' '}
                    {provider?.status === 'encryptionMissing'
                      ? 'Missing'
                      : 'Configured or not required for this status'}
                  </p>
                </div>
              </details>
            ) : null}
          </div>

          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-4">
              <p className="text-sm font-medium text-neutral-200">
                No {externalName} accounts connected
              </p>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Connect a {externalName} account to select calendars and
                synchronize them with this workspace.
              </p>
              <p className="text-neutral-text-secondary mt-2 text-xs">
                {memberConnectionsAllowed
                  ? 'You can connect your own account. Other workspace members may connect theirs separately.'
                  : 'Your workspace administrator has disabled personal calendar connections.'}
              </p>
            </div>
          ) : (
            connections.map((connection) => {
              const selectedCalendars = connection.calendars.filter(
                (calendar) => calendar.selectedForSync,
              )
              const defaultCalendar = connection.calendars.find(
                (calendar) => calendar.defaultExportTarget,
              )
              const ownerLabel =
                connection.ownershipType === 'WORKSPACE'
                  ? 'Workspace account'
                  : connection.ownerMember?.isCurrentMember
                    ? 'Your account'
                    : connection.ownerMember
                      ? `${connection.ownerMember.name}'s account`
                      : 'Member account'
              const connectedByLabel = connection.connectedByMember
                ? `Connected by ${
                    connection.connectedByMember.isCurrentMember
                      ? 'you'
                      : connection.connectedByMember.name
                  }`
                : 'Connection owner not assigned'
              const connectionHealth = connection.ownerInactiveAt
                ? 'Owner inactive'
                : connection.disabledAt
                  ? 'Disabled'
                  : connection.approvalStatus === 'PENDING'
                    ? 'Pending approval'
                    : connection.approvalStatus === 'REJECTED'
                      ? 'Rejected'
                      : connection.approvalStatus === 'NEEDS_REVIEW'
                        ? 'Needs review'
                        : connection.tokenStatus === 'revoked'
                          ? 'Authentication expired'
                          : connection.syncStatus === 'NEEDS_ATTENTION'
                            ? 'Attention required'
                            : connection.syncStatus === 'CONNECTED'
                              ? 'Healthy'
                              : connection.syncStatus.replaceAll('_', ' ')

              return (
                <div
                  key={connection.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-100">
                        {connection.displayName ??
                          connection.accountEmail ??
                          `${externalName} account`}
                      </p>
                      {connection.accountEmail ? (
                        <p className="truncate text-xs text-neutral-300">
                          {connection.accountEmail}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          size="xs"
                          variant={
                            connection.ownershipType === 'WORKSPACE'
                              ? 'blue'
                              : 'slate'
                          }
                        >
                          {ownerLabel}
                        </Badge>
                        <Badge
                          size="xs"
                          variant={providerStatusVariant(connectionHealth)}
                        >
                          {connectionHealth}
                        </Badge>
                        <Badge size="xs" variant="gray">
                          {formatExternalVisibilityMode(
                            connection.visibilityMode,
                          )}
                        </Badge>
                        <Badge size="xs" variant="slate">
                          {
                            calendarPurposeLabels[
                              connection.connectionPurpose ?? 'UNKNOWN'
                            ]
                          }
                        </Badge>
                        {connection.availabilityBehavior ? (
                          <Badge size="xs" variant="gray">
                            {connection.availabilityBehavior
                              .replaceAll('_', ' ')
                              .toLowerCase()}
                          </Badge>
                        ) : null}
                        {connection.syncEligibility?.reasonCode &&
                        connection.syncEligibility.reasonCode !== 'eligible' ? (
                          <Badge size="xs" variant="yellow">
                            {connection.syncEligibility.reasonCode
                              .replace(/([A-Z])/g, ' $1')
                              .toLowerCase()}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-neutral-text-secondary mt-2 text-xs">
                        {connectedByLabel} · {selectedCalendars.length} selected{' '}
                        {selectedCalendars.length === 1
                          ? 'calendar'
                          : 'calendars'}
                        {defaultCalendar
                          ? ` · Default ${defaultCalendar.name}`
                          : ''}
                      </p>
                      <p className="text-neutral-text-secondary mt-1 text-xs">
                        {connection.openConflicts} open conflicts ·{' '}
                        {connection.watchChannels.length} watch channels · Sync
                        every {connection.syncFrequencyMinutes} min
                      </p>
                      {connection.lastSuccessfulSyncAt ? (
                        <p className="text-neutral-text-secondary mt-1 text-xs">
                          Last sync{' '}
                          {new Date(
                            connection.lastSuccessfulSyncAt,
                          ).toLocaleString()}
                        </p>
                      ) : null}
                      {connection.lastErrorMessage ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {connection.lastErrorMessage}
                        </p>
                      ) : null}
                      {connection.approvalStatus === 'PENDING' ||
                      connection.approvalStatus === 'NEEDS_REVIEW' ? (
                        <p className="mt-2 text-xs text-amber-200">
                          This member-owned account is waiting for admin
                          approval before it can sync or contribute to
                          availability.
                        </p>
                      ) : null}
                      {connection.classificationConfirmation?.status ===
                        'PENDING' ||
                      connection.classificationConfirmation?.status ===
                        'NEEDS_REVIEW' ? (
                        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                            Confirm calendar type
                          </p>
                          <div className="mt-2 grid gap-2 text-xs text-neutral-200 sm:grid-cols-2">
                            <p>
                              You selected:{' '}
                              <span className="font-medium text-neutral-50">
                                {
                                  calendarPurposeLabels[
                                    connection.classificationConfirmation
                                      .requestedPurpose ?? 'UNKNOWN'
                                  ]
                                }
                              </span>
                            </p>
                            <p>
                              Skillify detected:{' '}
                              <span className="font-medium text-neutral-50">
                                {
                                  calendarPurposeLabels[
                                    connection.classificationConfirmation
                                      .suggestedPurpose ?? 'UNKNOWN'
                                  ]
                                }
                              </span>
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-amber-100/80">
                            {connection.classificationConfirmation
                              .mismatchReason === 'providerPurposeAmbiguous'
                              ? 'Provider metadata was ambiguous. Confirm how this account should be used before sync starts.'
                              : connection.classificationConfirmation
                                    .requestedPurpose === 'INDIVIDUAL_WORK' &&
                                  connection.classificationConfirmation
                                    .suggestedPurpose === 'PERSONAL'
                                ? 'This account uses a common personal email signal. Gmail-based businesses can still confirm work usage, but an administrator may need to review it.'
                                : connection.classificationConfirmation
                                      .requestedPurpose === 'PERSONAL' &&
                                    connection.classificationConfirmation
                                      .suggestedPurpose === 'INDIVIDUAL_WORK'
                                  ? 'This account appears to use your organization domain. Confirm whether it contains personal or work scheduling information.'
                                  : 'Confirm how this account should participate in workspace scheduling.'}
                          </p>
                          {connection.canManage ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                ['PERSONAL', 'Personal calendar'],
                                ['INDIVIDUAL_WORK', 'My work calendar'],
                                ...(canManage
                                  ? [
                                      [
                                        'WORKSPACE_SHARED',
                                        'Shared workspace calendar',
                                      ],
                                      ['RESOURCE', 'Resource calendar'],
                                    ]
                                  : []),
                              ].map(([purpose, label]) => (
                                <Button
                                  key={purpose}
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  disabled={savingId !== null}
                                  onClick={() =>
                                    postAction(
                                      `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/classification/confirm`,
                                      { purpose },
                                    )
                                  }
                                >
                                  {label}
                                </Button>
                              ))}
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                disabled={savingId !== null}
                                onClick={() =>
                                  postAction(
                                    `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/classification/confirm`,
                                    { action: 'cancel' },
                                  )
                                }
                              >
                                Cancel connection
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {connection.connectionPurpose === 'PERSONAL' ? (
                        <p className="text-neutral-text-secondary mt-2 text-xs">
                          External calendar availability does not confirm
                          approved Time Off.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage &&
                      (connection.approvalStatus === 'PENDING' ||
                        connection.approvalStatus === 'NEEDS_REVIEW') ? (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={savingId !== null}
                            onClick={() =>
                              postAction(
                                `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/approval`,
                                { action: 'approveBusyOnly' },
                              )
                            }
                          >
                            Approve busy-only
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={savingId !== null}
                            onClick={() =>
                              postAction(
                                `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/approval`,
                                { action: 'approveReadOnly' },
                              )
                            }
                          >
                            Approve read-only
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={savingId !== null}
                            onClick={() =>
                              postAction(
                                `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/approval`,
                                { action: 'reject' },
                              )
                            }
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {canManage &&
                      connection.ownershipType === 'MEMBER' &&
                      state?.policy?.allowAdminDisableMemberConnections ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={savingId !== null}
                          onClick={() =>
                            postAction(
                              `/api/workspaces/${workspaceId}/scheduling/calendar-connections/${connection.id}/disable`,
                              { disabled: !connection.disabledAt },
                            )
                          }
                        >
                          {connection.disabledAt ? 'Request review' : 'Disable'}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={
                          !connection.canManage ||
                          !connection.syncEligibility?.canDiscoverCalendars ||
                          savingId !== null
                        }
                        onClick={() =>
                          postAction(
                            `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connections/${connection.id}/discover`,
                          )
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={
                          !connection.canManage ||
                          (!connection.syncEligibility?.canPull &&
                            !connection.syncEligibility?.canPush) ||
                          savingId !== null
                        }
                        onClick={() =>
                          postAction(
                            `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connections/${connection.id}/sync`,
                          )
                        }
                      >
                        Sync now
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={
                          !connection.canManage ||
                          !connection.syncEligibility?.canPull ||
                          savingId !== null
                        }
                        onClick={() => loadImportPreview(connection.id)}
                      >
                        Preview import
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={!connection.canManage || savingId !== null}
                        onClick={() => runMappingRepair(false)}
                      >
                        View diagnostics
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={!connection.canManage || savingId !== null}
                        onClick={() =>
                          postAction(
                            `/api/workspaces/${workspaceId}/scheduling/${providerSlug}/connections/${connection.id}/disconnect`,
                          )
                        }
                      >
                        <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  {importPreview ? (
                    <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-3 text-xs text-cyan-50">
                      <p className="font-semibold">Initial sync preview</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <span>
                          Skillify events ·{' '}
                          {importPreview.existingSkillifyEvents}
                        </span>
                        <span>
                          {externalName} events ·{' '}
                          {importPreview.existingGoogleEvents}
                        </span>
                        <span>
                          Duplicates · {importPreview.duplicates.length}
                        </span>
                        <span>
                          To import · {importPreview.eventsToImport.length}
                        </span>
                        <span>
                          To export · {importPreview.eventsToExport.length}
                        </span>
                        <span>
                          Skipped · {importPreview.eventsSkipped.length}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled
                          title="Import apply is intentionally gated until operators review this dry-run preview."
                        >
                          Import {externalName}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled
                          title="Export apply is intentionally gated until operators review this dry-run preview."
                        >
                          Export Skillify
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled
                          title="Merge apply requires conflict-specific review."
                        >
                          Merge
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => setImportPreview(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {connection.conflicts?.length ? (
                    <div className="mt-3 space-y-2">
                      {connection.conflicts.map((conflict) => (
                        <div
                          key={conflict.id}
                          className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-50"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {conflict.type.replaceAll('_', ' ')}
                              </p>
                              <p className="mt-1 text-amber-100/80">
                                {conflict.safeMessage}
                              </p>
                              <p className="mt-1 text-amber-100/60">
                                Detected{' '}
                                {new Date(conflict.detectedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={
                                  !connection.canManage || savingId !== null
                                }
                                onClick={() =>
                                  resolveConflict(conflict.id, 'keepSkillify')
                                }
                              >
                                Keep Skillify
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={
                                  !connection.canManage || savingId !== null
                                }
                                onClick={() =>
                                  resolveConflict(
                                    conflict.id,
                                    externalName === 'Google'
                                      ? 'keepGoogle'
                                      : 'keepMicrosoft',
                                  )
                                }
                              >
                                Keep {externalName}
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={
                                  !connection.canManage || savingId !== null
                                }
                                onClick={() =>
                                  resolveConflict(conflict.id, 'merge')
                                }
                              >
                                Merge
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                disabled={
                                  !connection.canManage || savingId !== null
                                }
                                onClick={() =>
                                  resolveConflict(conflict.id, 'retryLater')
                                }
                              >
                                Retry later
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {connection.calendars.map((calendar) => (
                      <div
                        key={calendar.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/45 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex min-w-0 items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-cyan-300"
                              checked={calendar.selectedForSync}
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onChange={(event) =>
                                updateCalendar(calendar.id, {
                                  selectedForSync: event.target.checked,
                                })
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-neutral-100">
                                {calendar.name}
                              </span>
                              <span className="text-neutral-text-secondary block text-xs">
                                {calendar.isPrimary ? 'Primary' : 'Calendar'} ·{' '}
                                {calendar.isWritable ? 'Writable' : 'Read-only'}{' '}
                                · {calendar.timezone ?? 'Timezone unknown'}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                <Badge size="xs" variant="slate">
                                  {
                                    calendarPurposeLabels[
                                      calendar.calendarPurpose ?? 'UNKNOWN'
                                    ]
                                  }
                                </Badge>
                                {calendar.calendarPurpose === 'PERSONAL' ? (
                                  <Badge size="xs" variant="gray">
                                    External availability
                                  </Badge>
                                ) : null}
                              </span>
                            </span>
                          </label>
                          <Badge
                            variant={calendar.isWritable ? 'green' : 'gray'}
                          >
                            {calendar.accessRole ?? 'reader'}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <label className="block space-y-1">
                            <span className="text-neutral-text-secondary text-xs">
                              Calendar purpose
                            </span>
                            <Select
                              value={calendar.calendarPurpose ?? 'UNKNOWN'}
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onChange={(event) =>
                                updateCalendar(calendar.id, {
                                  calendarPurpose: event.target.value,
                                })
                              }
                            >
                              <option value="PERSONAL">Personal</option>
                              <option value="INDIVIDUAL_WORK">
                                Individual work
                              </option>
                              {canManage ? (
                                <>
                                  <option value="WORKSPACE_SHARED">
                                    Workspace shared
                                  </option>
                                  <option value="RESOURCE">Resource</option>
                                </>
                              ) : null}
                              <option value="UNKNOWN">
                                Needs classification
                              </option>
                            </Select>
                          </label>
                          <label className="block space-y-1">
                            <span className="text-neutral-text-secondary text-xs">
                              Sync direction
                            </span>
                            <Select
                              value={calendar.syncDirection}
                              disabled={
                                !connection.canManage || savingId !== null
                              }
                              onChange={(event) =>
                                updateCalendar(calendar.id, {
                                  syncDirection: event.target.value,
                                })
                              }
                            >
                              <option value="IMPORT_ONLY">
                                {externalName} to Skillify
                              </option>
                              <option value="EXPORT_ONLY">
                                Skillify to {externalName}
                              </option>
                              <option value="TWO_WAY">Bidirectional</option>
                              <option value="AVAILABILITY_ONLY">
                                Availability only
                              </option>
                              <option value="DISABLED">Disabled</option>
                            </Select>
                          </label>
                          <label className="flex items-center gap-2 self-end rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-neutral-200">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-cyan-300"
                              checked={calendar.defaultExportTarget}
                              disabled={
                                !connection.canManage ||
                                !calendar.isWritable ||
                                savingId !== null
                              }
                              onChange={(event) =>
                                updateCalendar(calendar.id, {
                                  defaultExportTarget: event.target.checked,
                                })
                              }
                            />
                            Default Skillify export calendar
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}

          {state?.diagnostics ? (
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              {!diagnosticsAvailable ? (
                <div className="text-neutral-text-secondary rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:col-span-2">
                  Sync diagnostics become available after an account is
                  connected.
                </div>
              ) : null}
              <div
                className={cn(
                  'rounded-lg border border-slate-800 bg-slate-950/45 p-3',
                  !diagnosticsAvailable &&
                    'text-neutral-text-secondary opacity-60',
                )}
              >
                Pending sync ·{' '}
                {diagnosticsAvailable ? state.diagnostics.pendingSync : '—'}
              </div>
              <div
                className={cn(
                  'rounded-lg border border-slate-800 bg-slate-950/45 p-3',
                  !diagnosticsAvailable &&
                    'text-neutral-text-secondary opacity-60',
                )}
              >
                Active watch channels ·{' '}
                {diagnosticsAvailable
                  ? state.diagnostics.activeWatchChannels
                  : '—'}
              </div>
              <div
                className={cn(
                  'rounded-lg border border-slate-800 bg-slate-950/45 p-3',
                  !diagnosticsAvailable &&
                    'text-neutral-text-secondary opacity-60',
                )}
              >
                Expired watch channels ·{' '}
                {diagnosticsAvailable
                  ? (state.diagnostics.expiredWatchChannels ?? 0)
                  : '—'}
              </div>
              <div
                className={cn(
                  'rounded-lg border border-slate-800 bg-slate-950/45 p-3',
                  !diagnosticsAvailable &&
                    'text-neutral-text-secondary opacity-60',
                )}
              >
                Open conflicts ·{' '}
                {diagnosticsAvailable ? state.diagnostics.openConflicts : '—'}
              </div>
              {repairSummary ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3 sm:col-span-2">
                  Mapping integrity · {repairSummary}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}

const notificationCategoryLabels: Array<{
  category: SchedulingNotificationCategory
  label: string
}> = [
  { category: 'assignment', label: 'Assignments' },
  { category: 'reassignment', label: 'Reassignments' },
  { category: 'rescheduled', label: 'Reschedules' },
  { category: 'canceled', label: 'Cancellations' },
  { category: 'completed', label: 'Completion updates' },
  { category: 'missed', label: 'Missed events' },
  { category: 'conflict', label: 'Conflicts' },
  { category: 'reminder', label: 'Reminders' },
]

const defaultNotificationReminder: SchedulingReminderInput = {
  offsetMinutes: 30,
  channel: 'inApp',
  recipientGroup: 'assignedMembers',
}

function mergeCategorySetting(
  settings: SchedulingNotificationCategorySettings | undefined,
  category: SchedulingNotificationCategory,
  patch: NonNullable<
    SchedulingNotificationCategorySettings[SchedulingNotificationCategory]
  >,
) {
  return {
    ...(settings ?? {}),
    [category]: {
      ...(settings?.[category] ?? {}),
      ...patch,
    },
  }
}

function normalizeReminderOffset(value: number) {
  if (!Number.isFinite(value)) return defaultNotificationReminder.offsetMinutes
  return Math.min(Math.max(Math.round(value), 0), 10_080)
}

function SchedulingNotificationSettingsCards({
  workspaceId,
  settings,
  canManage,
}: {
  workspaceId: string
  settings: WorkspaceSchedulingSettings
  canManage: boolean
}) {
  const [workspacePrefs, setWorkspacePrefs] =
    useState<WorkspaceSchedulingNotificationPreferences>(
      settings.notificationPreferences ?? {
        schedulingEnabled: true,
        inAppEnabled: true,
        emailEnabled: false,
        defaultReminders: [defaultNotificationReminder],
        externalAttendeesEnabled: false,
        linkedClientsEnabled: false,
        organizerCopiesEnabled: true,
        deliveryFailureAlertsEnabled: true,
      },
    )
  const [memberPrefs, setMemberPrefs] =
    useState<MemberSchedulingNotificationPreferences | null>(null)
  const [runtime, setRuntime] = useState<
    NotificationPreferencesResponse['runtime'] | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')

  const loadPreferences = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/notification-preferences`,
      )
      if (!response.ok) throw new Error('Notification settings could not load.')
      const data = (await response.json()) as NotificationPreferencesResponse
      if (data.preferences?.workspace)
        setWorkspacePrefs(data.preferences.workspace)
      setMemberPrefs(data.preferences?.member ?? null)
      setRuntime(data.runtime ?? null)
    } catch {
      setSaveState('error')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  async function savePreferences({
    scope,
    preferences,
    previousWorkspace,
    previousMember,
    reset = false,
  }: {
    scope: 'workspace' | 'member'
    preferences: Partial<
      WorkspaceSchedulingNotificationPreferences &
        MemberSchedulingNotificationPreferences
    >
    previousWorkspace?: WorkspaceSchedulingNotificationPreferences
    previousMember?: MemberSchedulingNotificationPreferences | null
    reset?: boolean
  }) {
    setSaveState('saving')
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/notification-preferences`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            action: reset ? 'reset' : undefined,
            preferences,
          }),
        },
      )
      if (!response.ok) throw new Error('Notification settings could not save.')
      const data = (await response.json()) as NotificationPreferencesResponse
      if (data.preferences?.workspace)
        setWorkspacePrefs(data.preferences.workspace)
      setMemberPrefs(data.preferences?.member ?? null)
      setRuntime(data.runtime ?? null)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1400)
    } catch {
      if (previousWorkspace) setWorkspacePrefs(previousWorkspace)
      if (previousMember !== undefined) setMemberPrefs(previousMember)
      setSaveState('error')
    }
  }

  function updateWorkspacePrefs(
    patch:
      | Partial<WorkspaceSchedulingNotificationPreferences>
      | ((
          current: WorkspaceSchedulingNotificationPreferences,
        ) => WorkspaceSchedulingNotificationPreferences),
  ) {
    if (!canManage) return
    const previousWorkspace = workspacePrefs
    const next =
      typeof patch === 'function'
        ? patch(workspacePrefs)
        : { ...workspacePrefs, ...patch }
    setWorkspacePrefs(next)
    void savePreferences({
      scope: 'workspace',
      preferences: next,
      previousWorkspace,
    })
  }

  function updateMemberPrefs(
    patch:
      | Partial<MemberSchedulingNotificationPreferences>
      | ((
          current: MemberSchedulingNotificationPreferences,
        ) => MemberSchedulingNotificationPreferences),
  ) {
    const previousMember = memberPrefs
    const current = memberPrefs ?? {}
    const next =
      typeof patch === 'function' ? patch(current) : { ...current, ...patch }
    setMemberPrefs(next)
    void savePreferences({
      scope: 'member',
      preferences: next,
      previousMember,
    })
  }

  const defaultReminder =
    workspacePrefs.defaultReminders?.[0] ?? defaultNotificationReminder
  const additionalReminder = workspacePrefs.defaultReminders?.[1]
  const memberMode = memberPrefs ? 'Customized' : 'Inherited'

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Scheduling Notifications
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Control internal alerts, reminder defaults, and delivery behavior.
          </p>
        </div>
        <Badge variant={saveState === 'error' ? 'red' : 'slate'}>
          {loading
            ? 'Loading'
            : saveState === 'saving'
              ? 'Saving'
              : saveState === 'saved'
                ? 'Saved'
                : saveState === 'error'
                  ? 'Error'
                  : 'Ready'}
        </Badge>
      </div>

      <div className="grid gap-3">
        <NotificationSettingsGroup title="Internal Notifications">
          <NotificationToggle
            label="Workspace master toggle"
            checked={workspacePrefs.schedulingEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ schedulingEnabled: checked })
            }
          />
          <NotificationToggle
            label="In-app notifications"
            checked={workspacePrefs.inAppEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ inAppEnabled: checked })
            }
          />
          <NotificationToggle
            label="Email notifications"
            checked={workspacePrefs.emailEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ emailEnabled: checked })
            }
          />
          {notificationCategoryLabels
            .filter((item) => item.category !== 'reminder')
            .map((item) => (
              <NotificationToggle
                key={item.category}
                label={item.label}
                checked={
                  workspacePrefs.categorySettings?.[item.category]?.enabled !==
                  false
                }
                disabled={!canManage}
                onChange={(checked) =>
                  updateWorkspacePrefs((current) => ({
                    ...current,
                    categorySettings: mergeCategorySetting(
                      current.categorySettings,
                      item.category,
                      { enabled: checked },
                    ),
                  }))
                }
              />
            ))}
          <NotificationToggle
            label="Organizer copy"
            checked={workspacePrefs.organizerCopiesEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ organizerCopiesEnabled: checked })
            }
          />
        </NotificationSettingsGroup>

        <NotificationSettingsGroup title="External Notifications">
          <NotificationToggle
            label="Notify external attendees"
            checked={workspacePrefs.externalAttendeesEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ externalAttendeesEnabled: checked })
            }
          />
          <NotificationToggle
            label="Notify linked clients"
            checked={workspacePrefs.linkedClientsEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ linkedClientsEnabled: checked })
            }
          />
          <NotificationToggle
            label="Notify removed attendees"
            checked={
              workspacePrefs.categorySettings?.reassignment?.emailEnabled !==
              false
            }
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                categorySettings: mergeCategorySetting(
                  current.categorySettings,
                  'reassignment',
                  { emailEnabled: checked },
                ),
              }))
            }
          />
          <NotificationToggle
            label="Public reminder emails"
            checked={
              workspacePrefs.categorySettings?.reminder?.emailEnabled !== false
            }
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                categorySettings: mergeCategorySetting(
                  current.categorySettings,
                  'reminder',
                  { emailEnabled: checked },
                ),
              }))
            }
          />
          <NotificationToggle
            label="Public cancellation emails"
            checked={
              workspacePrefs.categorySettings?.canceled?.emailEnabled !== false
            }
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                categorySettings: mergeCategorySetting(
                  current.categorySettings,
                  'canceled',
                  { emailEnabled: checked },
                ),
              }))
            }
          />
        </NotificationSettingsGroup>

        <NotificationSettingsGroup title="Reminder Defaults">
          <ReminderPreferenceRow
            label="Workspace default reminder"
            reminder={defaultReminder}
            disabled={!canManage}
            onChange={(reminder) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                defaultReminders: [
                  reminder ?? defaultNotificationReminder,
                  ...(current.defaultReminders ?? []).slice(1, 2),
                ],
              }))
            }
          />
          <ReminderPreferenceRow
            label="Additional reminder"
            reminder={additionalReminder ?? null}
            disabled={!canManage}
            optional
            onChange={(reminder) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                defaultReminders:
                  reminder === null
                    ? [defaultReminder]
                    : [defaultReminder, reminder],
              }))
            }
          />
        </NotificationSettingsGroup>

        <NotificationSettingsGroup title="Delivery">
          <NotificationToggle
            label="Quiet hours enabled"
            checked={workspacePrefs.quietHours?.enabled === true}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs((current) => ({
                ...current,
                quietHours: {
                  enabled: checked,
                  startTime: current.quietHours?.startTime ?? '22:00',
                  endTime: current.quietHours?.endTime ?? '07:00',
                  timezone: current.quietHours?.timezone ?? settings.timezone,
                  allowUrgentBypass:
                    current.quietHours?.allowUrgentBypass ?? true,
                },
              }))
            }
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs">
                Quiet hours start
              </span>
              <Input
                type="time"
                disabled={
                  !canManage || workspacePrefs.quietHours?.enabled !== true
                }
                value={workspacePrefs.quietHours?.startTime ?? '22:00'}
                onChange={(event) =>
                  updateWorkspacePrefs((current) => ({
                    ...current,
                    quietHours: {
                      ...(current.quietHours ?? {
                        enabled: true,
                        endTime: '07:00',
                      }),
                      startTime: event.target.value,
                      timezone:
                        current.quietHours?.timezone ?? settings.timezone,
                    },
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-neutral-text-secondary text-xs">
                Quiet hours end
              </span>
              <Input
                type="time"
                disabled={
                  !canManage || workspacePrefs.quietHours?.enabled !== true
                }
                value={workspacePrefs.quietHours?.endTime ?? '07:00'}
                onChange={(event) =>
                  updateWorkspacePrefs((current) => ({
                    ...current,
                    quietHours: {
                      ...(current.quietHours ?? {
                        enabled: true,
                        startTime: '22:00',
                      }),
                      endTime: event.target.value,
                      timezone:
                        current.quietHours?.timezone ?? settings.timezone,
                    },
                  }))
                }
              />
            </label>
          </div>
          <NotificationToggle
            label="Delivery failure alerts"
            checked={workspacePrefs.deliveryFailureAlertsEnabled}
            disabled={!canManage}
            onChange={(checked) =>
              updateWorkspacePrefs({ deliveryFailureAlertsEnabled: checked })
            }
          />
          <div className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs">
            <p>Workspace timezone: {settings.timezone}</p>
            <p>
              Email delivery:{' '}
              {runtime?.resendConfigured
                ? 'Resend configured'
                : 'Resend not configured'}
            </p>
            <p>
              Development email mode:{' '}
              {runtime?.developmentEmailMode ?? 'not enabled'}
            </p>
          </div>
        </NotificationSettingsGroup>

        <NotificationSettingsGroup
          title={`My Preferences · ${memberMode}`}
          description="Fine tune your personal scheduling notification behavior."
        >
          <NotificationToggle
            label="Use workspace defaults"
            checked={!memberPrefs}
            onChange={(checked) => {
              if (checked) {
                const previousMember = memberPrefs
                setMemberPrefs(null)
                void savePreferences({
                  scope: 'member',
                  preferences: {},
                  previousMember,
                  reset: true,
                })
              } else {
                updateMemberPrefs({
                  schedulingEnabled: true,
                  inAppEnabled: workspacePrefs.inAppEnabled,
                  emailEnabled: workspacePrefs.emailEnabled,
                  selfNotifications: false,
                  timezone: settings.timezone,
                })
              }
            }}
          />
          <NotificationToggle
            label="In-app assignments"
            checked={
              memberPrefs?.categorySettings?.assignment?.inAppEnabled ?? true
            }
            disabled={!memberPrefs}
            onChange={(checked) =>
              updateMemberPrefs((current) => ({
                ...current,
                categorySettings: mergeCategorySetting(
                  current.categorySettings,
                  'assignment',
                  { inAppEnabled: checked },
                ),
              }))
            }
          />
          <NotificationToggle
            label="Email reminders"
            checked={
              memberPrefs?.categorySettings?.reminder?.emailEnabled ?? false
            }
            disabled={!memberPrefs}
            onChange={(checked) =>
              updateMemberPrefs((current) => ({
                ...current,
                categorySettings: mergeCategorySetting(
                  current.categorySettings,
                  'reminder',
                  { emailEnabled: checked },
                ),
              }))
            }
          />
          <NotificationToggle
            label="Notify me about my own actions"
            checked={memberPrefs?.selfNotifications === true}
            disabled={!memberPrefs}
            onChange={(checked) =>
              updateMemberPrefs({ selfNotifications: checked })
            }
          />
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs">
              Personal timezone
            </span>
            <TimezoneSelector
              value={memberPrefs?.timezone ?? settings.timezone}
              disabled={!memberPrefs}
              currentInstant={new Date()}
              onChange={(timezone) => updateMemberPrefs({ timezone })}
            />
          </label>
        </NotificationSettingsGroup>
      </div>
    </Card>
  )
}

function NotificationSettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
        {title}
      </h3>
      {description ? (
        <p className="text-neutral-text-secondary mt-1 text-xs">
          {description}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function NotificationToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-100">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-300"
      />
    </label>
  )
}

const reminderOffsetOptions = [
  5, 10, 15, 30, 45, 60, 120, 240, 480, 1440, 2880, 10_080,
]

function ReminderPreferenceRow({
  label,
  reminder,
  disabled,
  optional = false,
  onChange,
}: {
  label: string
  reminder: SchedulingReminderInput | null
  disabled?: boolean
  optional?: boolean
  onChange: (reminder: SchedulingReminderInput | null) => void
}) {
  const activeReminder = reminder ?? defaultNotificationReminder
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-100">{label}</span>
        {optional ? (
          <input
            type="checkbox"
            checked={Boolean(reminder)}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.target.checked ? defaultNotificationReminder : null,
              )
            }
            aria-label={`Enable ${label}`}
            className="h-4 w-4 accent-cyan-300"
          />
        ) : null}
      </div>
      {reminder || !optional ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            value={activeReminder.channel}
            disabled={disabled}
            aria-label={`${label} channel`}
            onChange={(event) =>
              onChange({
                ...activeReminder,
                channel: event.target
                  .value as SchedulingReminderInput['channel'],
              })
            }
          >
            <option value="inApp">In-app</option>
            <option value="email">Email</option>
          </Select>
          <Select
            value={String(activeReminder.offsetMinutes)}
            disabled={disabled}
            aria-label={`${label} offset`}
            onChange={(event) =>
              onChange({
                ...activeReminder,
                offsetMinutes: normalizeReminderOffset(
                  Number(event.target.value),
                ),
              })
            }
          >
            {reminderOffsetOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatReminderOffsetLabel(minutes)}
              </option>
            ))}
          </Select>
          <Select
            value={activeReminder.recipientGroup}
            disabled={disabled}
            aria-label={`${label} recipients`}
            onChange={(event) =>
              onChange({
                ...activeReminder,
                recipientGroup: event.target
                  .value as SchedulingReminderInput['recipientGroup'],
              })
            }
          >
            <option value="assignedMembers">Assigned members</option>
            <option value="organizer">Organizer</option>
            <option value="externalAttendees">External attendees</option>
            <option value="linkedContact">Linked contact</option>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

function EventReminderEditor({
  mode,
  reminders,
  recurrenceRule,
  onModeChange,
  onRemindersChange,
}: {
  mode: SchedulingReminderMode
  reminders: SchedulingReminderInput[]
  recurrenceRule: SchedulingEvent['recurrenceRule']
  onModeChange: (mode: SchedulingReminderMode) => void
  onRemindersChange: (reminders: SchedulingReminderInput[]) => void
}) {
  const activeReminders = reminders.length
    ? reminders
    : [defaultNotificationReminder]
  const updateReminder = (index: number, reminder: SchedulingReminderInput) => {
    onRemindersChange(
      activeReminders.map((item, itemIndex) =>
        itemIndex === index ? reminder : item,
      ),
    )
  }
  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Reminders
        </span>
        <Select
          value={mode}
          onChange={(event) =>
            onModeChange(event.target.value as SchedulingReminderMode)
          }
        >
          <option value="workspaceDefault">Workspace default</option>
          <option value="none">No reminders</option>
          <option value="custom">Multiple reminders</option>
        </Select>
      </label>
      <p className="text-neutral-text-secondary text-[11px]">
        {mode === 'workspaceDefault'
          ? `Uses the workspace reminder defaults.${recurrenceRule ? ' For repeating events, defaults apply to each future occurrence.' : ''}`
          : mode === 'none'
            ? 'No reminders will be scheduled for this event.'
            : `Each reminder can use its own channel, recipients, and timing.${recurrenceRule ? ' These reminders apply to each future occurrence.' : ''}`}
      </p>
      {mode === 'custom' ? (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
          {activeReminders.map((reminder, index) => (
            <div
              key={`${index}-${reminder.channel}-${reminder.recipientGroup}`}
              className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Select
                value={reminder.channel}
                aria-label={`Reminder ${index + 1} channel`}
                onChange={(event) =>
                  updateReminder(index, {
                    ...reminder,
                    channel: event.target
                      .value as SchedulingReminderInput['channel'],
                  })
                }
              >
                <option value="inApp">In-app</option>
                <option value="email">Email</option>
              </Select>
              <ReminderOffsetControl
                value={reminder.offsetMinutes}
                onChange={(offsetMinutes) =>
                  updateReminder(index, { ...reminder, offsetMinutes })
                }
              />
              <Select
                value={reminder.recipientGroup}
                aria-label={`Reminder ${index + 1} recipients`}
                onChange={(event) =>
                  updateReminder(index, {
                    ...reminder,
                    recipientGroup: event.target
                      .value as SchedulingReminderInput['recipientGroup'],
                  })
                }
              >
                <option value="assignedMembers">Assigned members</option>
                <option value="organizer">Organizer</option>
                <option value="externalAttendees">External attendees</option>
                <option value="linkedContact">Linked contact</option>
              </Select>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={activeReminders.length <= 1}
                onClick={() =>
                  onRemindersChange(
                    activeReminders.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() =>
              onRemindersChange([
                ...activeReminders,
                defaultNotificationReminder,
              ])
            }
          >
            Add reminder
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ReminderOffsetControl({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const isCustom = !reminderOffsetOptions.includes(value)
  return (
    <div className="grid gap-2">
      <Select
        value={isCustom ? 'custom' : String(value)}
        aria-label="Reminder offset"
        onChange={(event) => {
          if (event.target.value === 'custom') {
            onChange(90)
            return
          }
          onChange(normalizeReminderOffset(Number(event.target.value)))
        }}
      >
        {reminderOffsetOptions.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatReminderOffsetLabel(minutes)}
          </option>
        ))}
        <option value="custom">Custom</option>
      </Select>
      {isCustom ? (
        <Input
          type="number"
          min={0}
          max={10_080}
          value={value}
          aria-label="Custom reminder offset in minutes"
          onChange={(event) =>
            onChange(normalizeReminderOffset(Number(event.target.value)))
          }
        />
      ) : null}
    </div>
  )
}

function formatReminderOffsetLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  if (minutes === 60) return '1 hr'
  if (minutes < 1440) return `${minutes / 60} hr`
  if (minutes === 1440) return '1 day'
  if (minutes === 2880) return '2 days'
  if (minutes === 10_080) return '1 week'
  return `${minutes} min`
}

function SchedulingEventDrawer({
  event,
  occurrenceId,
  workspaceSlug,
  capabilities,
  settings,
  visibleEventTypes,
  memberOptions,
  recordRefreshKey,
  eventTypesSettingsHref = '#event-types',
  onCreateEventType,
  recordTerminology,
  onClose,
  onChanged,
  onAskAI,
}: {
  event: SchedulingEvent
  occurrenceId: string | null
  workspaceSlug: string
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  visibleEventTypes: SchedulingEventType[]
  memberOptions: SchedulingMemberOption[]
  recordRefreshKey: number
  eventTypesSettingsHref?: string
  onCreateEventType?: (label: string) => { label?: string; error?: string }
  recordTerminology?: WorkspaceRecordTerminology
  onClose: () => void
  onChanged: () => void
  onAskAI?: () => void
}) {
  const currentInstant = useCurrentMinute()
  const { user } = useUser()
  const preferenceUserId = user?.id ?? 'anonymous'
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => eventToEditForm(event))
  const [formErrors, setFormErrors] = useState<SchedulingFormErrors>({})
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmLinkedRecordRemoval, setConfirmLinkedRecordRemoval] =
    useState(false)
  const [confirmLocationRemoval, setConfirmLocationRemoval] = useState(false)
  const [confirmUndeterminedLocation, setConfirmUndeterminedLocation] =
    useState(false)
  const [externalConflictOverrideReason, setExternalConflictOverrideReason] =
    useState('')
  const [editScope, setEditScope] =
    useState<SchedulingRecurrenceActionScope>('thisOccurrence')
  const [scopePrompt, setScopePrompt] = useState<{
    action:
      | Extract<SchedulingRecurringAction, 'edit' | 'cancel' | 'delete'>
      | 'duplicate'
    nextStatus?: SchedulingEventStatus
  } | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const transitions = getAllowedStatusTransitions(event.status)
  const recurring = isRecurringOccurrence(event)
  const memberLabelById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.label])),
    [memberOptions],
  )
  const linkedRecordTarget = event.linkedRecord
    ? getLinkedRecordNavigationTarget({
        workspaceSlug,
        recordType: event.linkedRecord.recordType,
        recordId: event.linkedRecord.recordId,
      })
    : null
  const draftWindow = useMemo(() => {
    if (
      !isSchedulingDateKey(form.date) ||
      (!form.allDay &&
        (!isValidTimeValue(form.startTime) || !isValidTimeValue(form.endTime)))
    ) {
      return null
    }
    return getSchedulingDraftWindow(form)
  }, [form])
  const recurrencePreviewRangeEndUtc = useMemo(() => {
    if (!draftWindow || !recurring || editScope === 'thisOccurrence') {
      return undefined
    }
    return new Date(
      new Date(draftWindow.startsAt).getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString()
  }, [draftWindow, editScope, recurring])
  const externalAvailabilityPreview = useExternalAvailabilityPreview({
    enabled: editing,
    request:
      draftWindow && form.assignedMemberIds.length
        ? {
            workspaceId: event.workspaceId,
            workspaceMemberIds: form.assignedMemberIds,
            startsAtUtc: draftWindow.startsAt,
            endsAtUtc: draftWindow.endsAt,
            timezone: form.timezone,
            schedulingEventId: event.id,
            occurrenceId: occurrenceId ?? undefined,
            recurrenceScope: recurring ? editScope : undefined,
            recurrenceRule: form.recurrenceRule,
            previewRangeEndUtc: recurrencePreviewRangeEndUtc,
          }
        : null,
  })

  useEffect(() => {
    setForm(eventToEditForm(event))
    setFormErrors({})
    setEditing(false)
    setEditScope('thisOccurrence')
    setScopePrompt(null)
    setExternalConflictOverrideReason('')
  }, [event])

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(eventToEditForm(event)),
    [event, form],
  )

  const requestClose = () => {
    if (editing && isDirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      if (scopePrompt) {
        setScopePrompt(null)
        return
      }
      requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // requestClose intentionally reads the latest edit state through render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, isDirty, scopePrompt])

  const beginEdit = () => {
    if (
      shouldPromptForRecurrenceScope({
        action: 'edit',
        occurrence: event,
      })
    ) {
      setScopePrompt({ action: 'edit' })
      return
    }
    setEditScope('thisOccurrence')
    setEditing(true)
  }

  const save = async ({
    skipLinkedRecordRemovalWarning = false,
    skipLocationRemovalWarning = false,
    skipUndeterminedLocationWarning = false,
  }: {
    skipLinkedRecordRemovalWarning?: boolean
    skipLocationRemovalWarning?: boolean
    skipUndeterminedLocationWarning?: boolean
  } = {}) => {
    const errors = validateSchedulingDraft({
      form,
      capabilities,
      settings,
      mode: 'edit',
    })
    setFormErrors(errors)
    if (errors.form) {
      focusFirstInvalidSchedulingField(drawerRef.current)
      return
    }
    const nextLinkedRecord = normalizeSchedulingLinkedRecord({
      recordType: form.linkedRecordType,
      recordId: form.linkedRecordId,
      label: form.linkedRecordLabel,
    })
    const linkedRecordRule = resolveSchedulingLinkedRecordRule({
      eventType: form.type,
      settings,
      capabilities,
    })
    if (
      !skipLinkedRecordRemovalWarning &&
      event.linkedRecord &&
      !nextLinkedRecord &&
      linkedRecordRule.requirement !== 'required'
    ) {
      setConfirmLinkedRecordRemoval(true)
      return
    }
    const nextLocationRule = resolveSchedulingLocationRule({
      eventType: form.type,
      settings,
    })
    const existingLocationDisplay = getSchedulingLocationDisplay({
      locationType: getEventLocationType(event),
      location: event.location,
      locationLabel: event.locationLabel,
      locationAddress: event.locationAddress,
      meetingUrl: event.meetingUrl,
      phoneNumber: event.phoneNumber,
    })
    if (
      !skipLocationRemovalWarning &&
      existingLocationDisplay &&
      nextLocationRule.requirement === 'notAllowed'
    ) {
      setConfirmLocationRemoval(true)
      return
    }
    if (
      !skipUndeterminedLocationWarning &&
      getEventLocationType(event) !== 'toBeDetermined' &&
      shouldWarnWhenSchedulingWithUndeterminedLocation({
        eventType: form.type,
        settings,
        locationType: form.locationType,
      }) &&
      !isSchedulingWarningSuppressed({
        workspaceId: event.workspaceId,
        userId: preferenceUserId,
        eventType: form.type,
        warningKey: 'scheduleWithUndeterminedLocation',
      })
    ) {
      setConfirmUndeterminedLocation(true)
      return
    }
    try {
      const response = await fetch(
        `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              ...editFormToEventChanges(form, event, settings),
              acknowledgedExternalAvailabilitySignalIds:
                externalAvailabilityPreview.signalIds,
              externalAvailabilityOverrideReason:
                externalAvailabilityPreview.hasBlockingConflict
                  ? externalConflictOverrideReason
                  : undefined,
            },
            scope: recurring ? editScope : undefined,
          }),
        },
      )
      await parseSchedulingEventResponse(response)
      onChanged()
      setEditing(false)
      setConfirmLinkedRecordRemoval(false)
      setConfirmLocationRemoval(false)
      setConfirmUndeterminedLocation(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Event could not be saved.'
      setFormErrors({
        ...(error instanceof SchedulingFormSubmissionError
          ? error.fieldErrors
          : {}),
        form: message,
      })
      focusFirstInvalidSchedulingField(drawerRef.current)
      toast.error(message)
    }
  }

  const duplicate = async () => {
    if (
      recurring &&
      shouldPromptForRecurrenceScope({
        action: 'delete',
        occurrence: event,
      })
    ) {
      setScopePrompt({ action: 'duplicate' })
      return
    }
    await duplicateWithScope()
  }

  const duplicateWithScope = async (
    scope?: SchedulingRecurrenceActionScope,
  ) => {
    const response = await fetch(
      `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', scope }),
      },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      toast.error(data.error ?? 'Event could not be duplicated.')
      return
    }
    const data = (await response.json()) as { event?: SchedulingEvent }
    onChanged()
    if (data.event) setForm(eventToEditForm(data.event))
  }

  const remove = async () => {
    const response = await fetch(
      `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: recurring ? editScope : undefined,
        }),
      },
    )
    if (!response.ok) {
      toast.error(
        await getSchedulingMutationErrorMessage(
          response,
          'Event could not be deleted.',
        ),
      )
      return
    }
    onChanged()
    onClose()
  }

  const setStatus = async (status: SchedulingEventStatus) => {
    if (
      status === 'canceled' &&
      shouldPromptForRecurrenceScope({
        action: 'cancel',
        occurrence: event,
      })
    ) {
      setScopePrompt({ action: 'cancel', nextStatus: status })
      return
    }
    const response = await fetch(
      `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          scope: recurring ? 'thisOccurrence' : undefined,
        }),
      },
    )
    if (!response.ok) {
      toast.error(
        await getSchedulingMutationErrorMessage(
          response,
          'Status could not be changed.',
        ),
      )
      return
    }
    onChanged()
  }

  const confirmScope = async (scope: SchedulingRecurrenceActionScope) => {
    if (!scopePrompt) return
    if (scopePrompt.action === 'edit') {
      setEditScope(scope)
      setEditing(true)
      setScopePrompt(null)
      return
    }
    if (scopePrompt.action === 'duplicate') {
      setScopePrompt(null)
      await duplicateWithScope(scope)
      return
    }
    setEditScope(scope)
    setScopePrompt(null)
    if (scopePrompt.action === 'delete') {
      const response = await fetch(
        `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope }),
        },
      )
      if (!response.ok) {
        toast.error(
          await getSchedulingMutationErrorMessage(
            response,
            'Event could not be deleted.',
          ),
        )
        return
      }
      onChanged()
      onClose()
      return
    }
    const response = await fetch(
      `/api/workspaces/${event.workspaceId}/scheduling/events/${event.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: scopePrompt.nextStatus ?? 'canceled',
          scope,
        }),
      },
    )
    if (!response.ok) {
      toast.error(
        await getSchedulingMutationErrorMessage(
          response,
          'Event could not be canceled.',
        ),
      )
      return
    }
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-[80]" aria-hidden={false}>
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onMouseDown={(mouseEvent) => {
          if (mouseEvent.target === mouseEvent.currentTarget) requestClose()
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl sm:w-[34rem]"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                Scheduling Event
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-50">
                {event.title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {getEventTypeLabel(event.type, settings)}
                {occurrenceId ? ' · occurrence' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close scheduling event"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {!editing && transitions.length ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Next actions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(status)}
                  >
                    Mark {schedulingStatusLabels[status]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {editing ? (
              <>
                {onAskAI ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAskAI}
                    leftIcon={<Bot className="h-4 w-4" />}
                  >
                    Ask Scheduling AI
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    isDirty ? setConfirmClose(true) : setEditing(false)
                  }
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => save()}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={beginEdit}
                  leftIcon={<Edit3 className="h-4 w-4" />}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={duplicate}
                  leftIcon={<Copy className="h-4 w-4" />}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (
                      shouldPromptForRecurrenceScope({
                        action: 'delete',
                        occurrence: event,
                      })
                    ) {
                      setScopePrompt({ action: 'delete' })
                      return
                    }
                    void remove()
                  }}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {editing ? (
            <div ref={drawerRef} className="space-y-4">
              {recurring ? (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] px-3 py-2 text-sm text-cyan-100">
                  Editing {recurrenceScopeLabel(editScope).toLowerCase()}.
                </div>
              ) : null}
              {formErrors.form ? (
                <FormErrorSummary errors={formErrors} />
              ) : null}
              <SchedulingEventEditForm
                form={form}
                setForm={(nextForm) => {
                  setForm(nextForm)
                  if (formErrors.form) setFormErrors({})
                }}
                errors={formErrors}
                capabilities={capabilities}
                settings={settings}
                visibleEventTypes={visibleEventTypes}
                workspaceId={event.workspaceId}
                memberOptions={memberOptions}
                recordRefreshKey={recordRefreshKey}
                currentInstant={currentInstant}
                eventTypesSettingsHref={eventTypesSettingsHref}
                onCreateEventType={onCreateEventType}
                recordTerminology={recordTerminology}
              />
              <ExternalAvailabilityConflictSummary
                result={externalAvailabilityPreview.data}
                loading={externalAvailabilityPreview.loading}
                error={externalAvailabilityPreview.error}
                timezone={form.timezone}
                variant={recurring ? 'recurrenceSummary' : 'drawer'}
                overrideReason={externalConflictOverrideReason}
                onOverrideReasonChange={setExternalConflictOverrideReason}
              />
            </div>
          ) : (
            <>
              <DetailGrid
                rows={[
                  ['Event type', getEventTypeLabel(event.type, settings)],
                  ['Status', schedulingStatusLabels[event.status]],
                  ['Date', formatDateOnly(event.startsAt, event.timezone)],
                  ['Time', formatWindow(event)],
                  ['Duration', formatDuration(event)],
                  ['Timezone', event.timezone],
                  ...getEventLocationRows(event),
                  [
                    'Team',
                    formatMemberIds(event.assignedMemberIds, memberLabelById),
                  ],
                  [
                    'Linked record',
                    event.linkedRecord && linkedRecordTarget ? (
                      <Link
                        href={linkedRecordTarget.href}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 font-medium text-cyan-100 underline-offset-4 hover:underline"
                        aria-label={`Open ${event.linkedRecord.label} ${formatLinkedRecordType(
                          event.linkedRecord.recordType,
                          recordTerminology,
                        ).toLowerCase()} record`}
                      >
                        {event.linkedRecord.label} ·{' '}
                        {formatLinkedRecordType(
                          event.linkedRecord.recordType,
                          recordTerminology,
                        )}
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : event.linkedRecord ? (
                      <span>
                        {event.linkedRecord.label} ·{' '}
                        {formatLinkedRecordType(
                          event.linkedRecord.recordType,
                          recordTerminology,
                        )}
                        <span className="text-neutral-text-secondary block text-xs">
                          Record unavailable
                        </span>
                      </span>
                    ) : (
                      'Not linked'
                    ),
                  ],
                  [
                    'Repeat',
                    event.recurrenceSeriesId
                      ? 'Part of a recurring series'
                      : formatSchedulingRecurrenceSummary(
                          event.recurrenceRule ?? null,
                          getWorkspaceDateKey(event.startsAt, event.timezone),
                          weekdayLabels,
                        ),
                  ],
                  [
                    'Occurrence state',
                    formatOccurrenceState(event.occurrenceState),
                  ],
                  [
                    'External sync',
                    formatExternalCalendarState(event.externalCalendarState),
                  ],
                  ['Created', formatDateTime(event.createdAt, event.timezone)],
                  ['Updated', formatDateTime(event.updatedAt, event.timezone)],
                ]}
              />
              {event.description ? (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-100">
                    Notes
                  </h3>
                  <p className="mt-2 rounded-xl border border-slate-800 bg-slate-900/35 p-3 text-sm text-neutral-200">
                    {event.description}
                  </p>
                </section>
              ) : null}
            </>
          )}
        </div>
        {confirmLinkedRecordRemoval ? (
          <div className="border-t border-amber-300/25 bg-amber-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-amber-100">
              Remove the linked record?
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              This event will no longer be connected to “
              {event.linkedRecord?.label ?? 'the linked record'}”. The event
              itself will remain scheduled.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const currentRule = resolveSchedulingLinkedRecordRule({
                    eventType: form.type,
                    settings,
                    capabilities,
                  })
                  setConfirmLinkedRecordRemoval(false)
                  setForm({
                    ...form,
                    type:
                      currentRule.requirement === 'notAllowed'
                        ? event.type
                        : form.type,
                    linkedRecordType: event.linkedRecord?.recordType ?? '',
                    linkedRecordId: event.linkedRecord?.recordId ?? '',
                    linkedRecordLabel: event.linkedRecord?.label ?? '',
                  })
                }}
              >
                Keep Linked Record
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => save({ skipLinkedRecordRemovalWarning: true })}
              >
                Remove Link and Save
              </Button>
            </div>
          </div>
        ) : null}
        {confirmLocationRemoval ? (
          <div className="border-t border-amber-300/25 bg-amber-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-amber-100">
              Remove location details?
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              {getEventTypeLabel(form.type, settings)} does not use a location.
              Saving will remove the current address, meeting link, or phone
              details from this event.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmLocationRemoval(false)}
              >
                Keep Editing
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  setConfirmLocationRemoval(false)
                  void save({ skipLocationRemovalWarning: true })
                }}
              >
                Remove Location
              </Button>
            </div>
          </div>
        ) : null}
        {confirmUndeterminedLocation ? (
          <div className="border-t border-cyan-300/25 bg-cyan-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-cyan-100">
              Save without a confirmed location?
            </p>
            <p className="mt-1 text-xs text-cyan-100/75">
              This event&apos;s location is still to be determined. You can add
              it later.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmUndeterminedLocation(false)}
              >
                Go Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setConfirmUndeterminedLocation(false)
                  void save({ skipUndeterminedLocationWarning: true })
                }}
              >
                Save as To Be Determined
              </Button>
            </div>
          </div>
        ) : null}
        {confirmClose ? (
          <div className="border-t border-amber-300/25 bg-amber-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-amber-100">
              Discard unsaved event changes?
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              Your edits have not been saved.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmClose(false)}
              >
                Continue Editing
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  setConfirmClose(false)
                  setEditing(false)
                  setForm(eventToEditForm(event))
                  onClose()
                }}
              >
                Discard Changes
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
      {scopePrompt ? (
        <RecurrenceScopePrompt
          event={event}
          action={scopePrompt.action}
          allowedScopes={
            scopePrompt.action === 'duplicate'
              ? ['thisOccurrence', 'entireSeries']
              : getAllowedRecurrenceScopes({
                  action: scopePrompt.action,
                  occurrence: event,
                })
          }
          onCancel={() => setScopePrompt(null)}
          onConfirm={confirmScope}
        />
      ) : null}
    </div>
  )
}

function RecurrenceScopePrompt({
  event,
  action,
  allowedScopes,
  onCancel,
  onConfirm,
}: {
  event: SchedulingEvent
  action:
    | Extract<SchedulingRecurringAction, 'edit' | 'cancel' | 'delete'>
    | 'duplicate'
  allowedScopes: SchedulingRecurrenceActionScope[]
  onCancel: () => void
  onConfirm: (scope: SchedulingRecurrenceActionScope) => void
}) {
  const [selectedScope, setSelectedScope] =
    useState<SchedulingRecurrenceActionScope>(
      allowedScopes.includes('thisOccurrence')
        ? 'thisOccurrence'
        : (allowedScopes[0] ?? 'thisOccurrence'),
    )
  const firstOptionRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    firstOptionRef.current?.focus()
  }, [])

  const title =
    action === 'edit'
      ? 'Edit recurring event'
      : action === 'cancel'
        ? 'Cancel recurring event'
        : action === 'duplicate'
          ? 'Duplicate recurring event'
          : 'Delete recurring event'
  const primaryLabel =
    action === 'edit'
      ? 'Continue to Edit'
      : action === 'cancel'
        ? 'Cancel Events'
        : action === 'duplicate'
          ? 'Duplicate Event'
          : 'Delete Events'
  const recurrenceSummary = event.recurrenceSeriesId
    ? 'Part of a recurring series'
    : formatSchedulingRecurrenceSummary(
        event.recurrenceRule ?? null,
        getWorkspaceDateKey(
          event.occurrenceOriginalAt ?? event.startsAt,
          event.timezone,
        ),
        weekdayLabels,
      )
  const helperByScope: Record<SchedulingRecurrenceActionScope, string> = {
    thisOccurrence:
      action === 'duplicate'
        ? 'Duplicate this resolved occurrence as a new standalone event. It will not remain attached to the original series.'
        : 'Only this scheduled occurrence will change. Other events in the series will remain unchanged.',
    thisAndFollowing:
      'This occurrence and all future occurrences will use the new change. Earlier occurrences will remain unchanged.',
    entireSeries:
      action === 'duplicate'
        ? 'Duplicate the recurrence rule into a new series. Occurrence overrides are not copied.'
        : 'The recurring series will be changed. Past completed occurrences will remain in history.',
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-scope-title"
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="recurrence-scope-title"
              className="text-base font-semibold text-neutral-50"
            >
              {title}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              {formatDateOnly(
                event.occurrenceOriginalAt ?? event.startsAt,
                event.timezone,
              )}
              {' · '}
              {recurrenceSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close recurrence scope prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {allowedScopes.map((scope, index) => (
            <label
              key={scope}
              className={cn(
                'block cursor-pointer rounded-2xl border p-3 transition',
                selectedScope === scope
                  ? 'border-cyan-300/60 bg-cyan-300/[0.08]'
                  : 'border-slate-800 bg-slate-900/45 hover:border-slate-600',
              )}
            >
              <span className="flex items-start gap-3">
                <input
                  ref={index === 0 ? firstOptionRef : undefined}
                  type="radio"
                  name="recurrence-scope"
                  className="mt-1"
                  checked={selectedScope === scope}
                  onChange={() => setSelectedScope(scope)}
                />
                <span>
                  <span className="block text-sm font-semibold text-neutral-100">
                    {recurrenceScopeLabel(scope)}
                  </span>
                  <span className="text-neutral-text-secondary mt-1 block text-xs leading-5">
                    {helperByScope[scope]}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={action === 'delete' ? 'danger' : 'primary'}
            onClick={() => onConfirm(selectedScope)}
          >
            {primaryLabel}
          </Button>
        </div>
      </section>
    </div>
  )
}

function formatOccurrenceState(state?: SchedulingOccurrenceState) {
  if (state === 'master') return 'Series master'
  if (state === 'generated') return 'Generated occurrence'
  if (state === 'overridden') return 'Edited occurrence'
  if (state === 'detached') return 'Detached occurrence'
  if (state === 'canceled') return 'Canceled occurrence'
  if (state === 'completed') return 'Completed occurrence'
  if (state === 'deleted') return 'Deleted occurrence'
  return 'One-time event'
}

function DetailGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-100">Event Details</h3>
      <div className="mt-3 divide-y divide-slate-800 rounded-2xl border border-slate-800">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]"
          >
            <span className="text-neutral-text-secondary">{label}</span>
            <span className="text-neutral-100">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

type SchedulingEditForm = ReturnType<typeof eventToEditForm>
type SchedulingFormErrors = Partial<Record<SchedulingFormErrorKey, string>>
type SchedulingReminderPreset =
  | 'workspaceDefault'
  | 'none'
  | 'inApp15'
  | 'inApp30'
  | 'email60'
  | 'email1440'
type SchedulingReminderMode = 'workspaceDefault' | 'none' | 'custom'

function getEventLocationType(event: SchedulingEvent): SchedulingLocationType {
  if (event.locationType)
    return normalizeSchedulingLocationType(event.locationType)
  if (event.meetingUrl) return 'videoMeeting'
  if (event.locationAddress) return 'physicalAddress'
  if (event.location) return 'physicalAddress'
  return 'none'
}

function getNormalizedLocationFormValues({
  eventType,
  settings,
  locationType,
  location,
  locationLabel,
  locationAddress,
  meetingUrl,
  phoneNumber,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  locationType?: string | null
  location?: string | null
  locationLabel?: string | null
  locationAddress?: string | null
  meetingUrl?: string | null
  phoneNumber?: string | null
}) {
  return normalizeSchedulingLocation({
    eventType,
    settings,
    location: {
      locationType,
      location,
      locationLabel,
      locationAddress,
      meetingUrl,
      phoneNumber,
    },
  })
}

function getEventLocationRows(event: SchedulingEvent) {
  const locationType = getEventLocationType(event)
  if (locationType === 'none') {
    return [['Location', 'None']] as Array<[string, React.ReactNode]>
  }
  if (locationType === 'toBeDetermined') {
    return [
      ['Location', 'To be determined'],
      [
        'Location status',
        <span key="location-status" className="text-cyan-100">
          Location has not been confirmed yet.
        </span>,
      ],
    ] as Array<[string, React.ReactNode]>
  }
  const display = getSchedulingLocationDisplay({
    locationType,
    location: event.location,
    locationLabel: event.locationLabel,
    locationAddress: event.locationAddress,
    meetingUrl: event.meetingUrl,
    phoneNumber: event.phoneNumber,
  })
  const detailLabel =
    locationType === 'videoMeeting'
      ? 'Meeting link'
      : locationType === 'phoneCall'
        ? 'Phone'
        : locationType === 'physicalAddress' ||
            locationType === 'customerLocation'
          ? 'Address'
          : 'Location details'
  const detail =
    locationType === 'videoMeeting' && display ? (
      <a
        href={display}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-cyan-100 underline-offset-4 hover:underline"
      >
        Open meeting
      </a>
    ) : (
      (display ?? 'Not set')
    )
  return [
    ['Location', formatSchedulingLocationType(locationType)],
    [detailLabel, detail],
  ] as Array<[string, React.ReactNode]>
}

function eventToEditForm(event: SchedulingEvent) {
  const startTime = getWorkspaceTimeInputValue(event.startsAt, event.timezone)
  const endTime = getWorkspaceTimeInputValue(event.endsAt, event.timezone)
  const durationMinutes =
    getEventDurationMinutes(event) ??
    getPositiveTimeDurationMinutes(startTime, endTime)
  return {
    type: event.type,
    title: event.title,
    status: event.status,
    date: getWorkspaceDateKey(event.startsAt, event.timezone),
    startTime,
    endTime,
    durationMinutes,
    previousTimedStartTime: startTime,
    previousTimedEndTime: endTime,
    allDay: event.allDay,
    timezone: event.timezone,
    location: event.location ?? '',
    locationType: getEventLocationType(event),
    locationLabel: event.locationLabel ?? event.location ?? '',
    locationAddress: event.locationAddress ?? '',
    meetingUrl: event.meetingUrl ?? '',
    phoneNumber: event.phoneNumber ?? '',
    assignedMemberIds: event.assignedMemberIds,
    linkedRecordType: event.linkedRecord?.recordType ?? '',
    linkedRecordId: event.linkedRecord?.recordId ?? '',
    linkedRecordLabel: event.linkedRecord?.label ?? '',
    description: event.description ?? '',
    recurrenceRule: event.recurrenceRule,
    reminderMode: getReminderModeFromPolicy(event.reminderPolicy),
    reminders: getRemindersFromPolicy(event.reminderPolicy),
    reminderPreset: getReminderPresetFromPolicy(event.reminderPolicy),
  }
}

function getReminderModeFromPolicy(
  policy: SchedulingEvent['reminderPolicy'],
): SchedulingReminderMode {
  if (!policy || policy.mode === 'workspaceDefault') return 'workspaceDefault'
  if (policy.mode === 'none') return 'none'
  return 'custom'
}

function getRemindersFromPolicy(
  policy: SchedulingEvent['reminderPolicy'],
): SchedulingReminderInput[] {
  if (policy?.mode !== 'custom' || !policy.reminders?.length) {
    return [defaultNotificationReminder]
  }
  return policy.reminders
}

function getReminderPresetFromPolicy(
  policy: SchedulingEvent['reminderPolicy'],
): SchedulingReminderPreset {
  if (!policy || policy.mode === 'workspaceDefault') return 'workspaceDefault'
  if (policy.mode === 'none') return 'none'
  const reminder = policy.reminders?.[0]
  if (!reminder) return 'workspaceDefault'
  if (reminder.channel === 'inApp' && reminder.offsetMinutes === 15)
    return 'inApp15'
  if (reminder.channel === 'inApp' && reminder.offsetMinutes === 30)
    return 'inApp30'
  if (reminder.channel === 'email' && reminder.offsetMinutes === 60)
    return 'email60'
  if (reminder.channel === 'email' && reminder.offsetMinutes === 1440)
    return 'email1440'
  return 'workspaceDefault'
}

function getReminderPolicyFromPreset(
  preset: SchedulingReminderPreset,
): SchedulingEvent['reminderPolicy'] {
  if (preset === 'workspaceDefault') return { mode: 'workspaceDefault' }
  if (preset === 'none') return { mode: 'none' }
  const remindersByPreset: Record<
    Exclude<SchedulingReminderPreset, 'workspaceDefault' | 'none'>,
    SchedulingReminderInput
  > = {
    inApp15: {
      offsetMinutes: 15,
      channel: 'inApp',
      recipientGroup: 'assignedMembers',
    },
    inApp30: {
      offsetMinutes: 30,
      channel: 'inApp',
      recipientGroup: 'assignedMembers',
    },
    email60: {
      offsetMinutes: 60,
      channel: 'email',
      recipientGroup: 'assignedMembers',
    },
    email1440: {
      offsetMinutes: 1440,
      channel: 'email',
      recipientGroup: 'assignedMembers',
    },
  }
  return {
    mode: 'custom',
    reminders: [remindersByPreset[preset]],
  }
}

function getReminderPolicyFromEditor({
  mode,
  reminders,
}: {
  mode: SchedulingReminderMode
  reminders: SchedulingReminderInput[]
}): SchedulingEvent['reminderPolicy'] {
  if (mode === 'workspaceDefault') return { mode: 'workspaceDefault' }
  if (mode === 'none') return { mode: 'none' }
  return {
    mode: 'custom',
    reminders: reminders.length ? reminders : [defaultNotificationReminder],
  }
}

function getReminderPresetHelperText({
  preset,
  recurrenceRule,
}: {
  preset: SchedulingReminderPreset
  recurrenceRule: SchedulingEvent['recurrenceRule']
}) {
  const recurrenceText = recurrenceRule
    ? ' For repeating events, this applies to each future occurrence.'
    : ''
  if (preset === 'workspaceDefault') {
    return `Uses the workspace reminder defaults.${recurrenceText}`
  }
  if (preset === 'none') return 'No reminders will be scheduled for this event.'
  return `Sends to assigned members.${recurrenceText}`
}

function editFormToEventChanges(
  form: SchedulingEditForm,
  event: SchedulingEvent,
  settings: WorkspaceSchedulingSettings,
) {
  const { startsAt, endsAt } = getSchedulingDraftWindow(form)
  const linkedRecord = normalizeSchedulingLinkedRecord({
    recordType: form.linkedRecordType,
    recordId: form.linkedRecordId,
    label: form.linkedRecordLabel,
  })
  const normalizedLocation = getNormalizedLocationFormValues({
    eventType: form.type,
    settings,
    locationType: form.locationType,
    location: form.location,
    locationLabel: form.locationLabel,
    locationAddress: form.locationAddress,
    meetingUrl: form.meetingUrl,
    phoneNumber: form.phoneNumber,
  })
  return {
    type: form.type,
    title: form.title,
    status: form.status,
    startsAt,
    endsAt,
    allDay: form.allDay,
    timezone: form.timezone,
    ...normalizedLocation,
    assignedMemberIds: form.assignedMemberIds,
    linkedRecord,
    description: form.description || undefined,
    recurrenceRule: form.recurrenceRule,
    reminderPolicy: getReminderPolicyFromEditor({
      mode: form.reminderMode,
      reminders: form.reminders,
    }),
  }
}

function isValidDateValue(value: string) {
  return isSchedulingDateKey(value)
}

function isValidTimeValue(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function getDurationLabel({
  startTime,
  endTime,
  allDay,
}: {
  startTime: string
  endTime: string
  allDay: boolean
}) {
  if (allDay) return 'Duration: All day'
  const minutes = getPositiveTimeDurationMinutes(startTime, endTime)
  if (!minutes) return null
  if (minutes < 60) return `Duration: ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `Duration: ${hours} hr${remainder ? ` ${remainder} min` : ''}`
}

function getResolvedDurationMinutes({
  form,
  settings,
}: {
  form: SchedulingEditForm
  settings: WorkspaceSchedulingSettings
}) {
  const currentDuration = getPositiveTimeDurationMinutes(
    form.startTime,
    form.endTime,
  )
  return (
    currentDuration ??
    form.durationMinutes ??
    resolveSchedulingEventTypeDefinition(form.type, settings)
      .defaultDurationMinutes ??
    defaultEventDurationMinutes
  )
}

function getSchedulingDraftWindow({
  date,
  startTime,
  endTime,
  allDay,
  timezone,
}: Pick<
  SchedulingEditForm,
  'date' | 'startTime' | 'endTime' | 'allDay' | 'timezone'
>) {
  const startsAt = combineDateAndTimeInTimezone({
    dateKey: date,
    time: allDay ? '00:00' : startTime,
    timezone,
  }).toISOString()
  const endInstant = allDay
    ? new Date(
        combineDateAndTimeInTimezone({
          dateKey: date,
          time: '00:00',
          timezone,
        }).getTime() +
          24 * 60 * 60 * 1000 -
          1,
      )
    : combineDateAndTimeInTimezone({
        dateKey: date,
        time: endTime,
        timezone,
      })
  return {
    startsAt,
    endsAt: endInstant.toISOString(),
  }
}

function timeInputClassName() {
  return cn(
    'h-10 pr-11 [color-scheme:dark]',
    '[&::-webkit-calendar-picker-indicator]:ml-auto',
    '[&::-webkit-calendar-picker-indicator]:mr-0',
    '[&::-webkit-calendar-picker-indicator]:opacity-70',
  )
}

function availabilityExceptionAppliesOnDate({
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
      : [getDateKeyWeekday(record.date)]
    if (!days.includes(getDateKeyWeekday(date))) return false
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

function getTimeOffConflictWarnings({
  availability,
  assignedMemberIds,
  date,
  startTime,
  endTime,
  allDay,
  timezone,
  memberOptions,
}: {
  availability: TeamAvailabilityRecord[]
  assignedMemberIds: string[]
  date: SchedulingDateKey
  startTime: string
  endTime: string
  allDay: boolean
  timezone: string
  memberOptions: SchedulingMemberOption[]
}) {
  if (!assignedMemberIds.length || !isSchedulingDateKey(date)) return []
  if (!allDay && (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)))
    return []
  const memberLabelById = new Map(
    memberOptions.map((member) => [member.id, member.label]),
  )
  const start = combineDateAndTimeInTimezone({
    dateKey: date,
    time: allDay ? '00:00' : startTime,
    timezone,
  })
  const end = allDay
    ? combineDateAndTimeInTimezone({
        dateKey: date,
        time: '00:00',
        timezone,
      }).getTime() +
      24 * 60 * 60 * 1000 -
      1
    : combineDateAndTimeInTimezone({
        dateKey: date,
        time: endTime,
        timezone,
      }).getTime()
  const overrideWarnings = availability.flatMap((record) => {
    if (record.kind === 'timeOff') {
      if (!assignedMemberIds.includes(record.memberId)) return []
      if (
        new Date(record.startsAt).getTime() <= end &&
        new Date(record.endsAt).getTime() >= start.getTime()
      ) {
        const memberName =
          memberLabelById.get(record.memberId) ?? record.memberName
        return [`${memberName} is unavailable during this time.`]
      }
    }
    if (record.kind === 'availabilityException') {
      if (!availabilityExceptionAppliesOnDate({ record, date })) return []
      if (
        record.scope === 'member' &&
        record.memberId &&
        !assignedMemberIds.includes(record.memberId)
      ) {
        return []
      }
      const scopeName =
        record.scope === 'workspace'
          ? 'The workspace'
          : (record.memberName ??
            memberLabelById.get(record.memberId ?? '') ??
            'This member')
      if (record.exceptionType === 'closed' || record.allDayClosed) {
        return [`${scopeName} is closed or unavailable on this date.`]
      }
      if (
        !allDay &&
        record.startTime &&
        record.endTime &&
        (minutesFromTime(startTime) < minutesFromTime(record.startTime) ||
          minutesFromTime(endTime) > minutesFromTime(record.endTime))
      ) {
        return [
          `${scopeName} has special hours ${formatClockRange({
            startTime: record.startTime,
            endTime: record.endTime,
            settings: {
              timezone,
              timeFormat: '12hour',
            } as WorkspaceSchedulingSettings,
          })} on this date.`,
        ]
      }
    }
    return []
  })
  if (overrideWarnings.length) return overrideWarnings

  const hasConfiguredWorkingHours = availability.some(
    (record) => record.kind === 'workingHours',
  )
  if (!hasConfiguredWorkingHours) return []

  return assignedMemberIds.flatMap((assignedId) => {
    const isTeam = assignedId.startsWith('team-')
    const effective = resolveEffectiveWorkingHours({
      availability,
      workspaceId:
        availability.find((record) => record.workspaceId)?.workspaceId ?? '',
      workspaceMemberId: isTeam ? null : assignedId,
      teamIds: isTeam ? [assignedId] : [],
      date,
      timezone,
    })
    if (effective.source === 'none') return []
    const memberName =
      memberLabelById.get(assignedId) ?? humanizeMemberId(assignedId)
    if (!effective.isAvailable) {
      return [
        `${memberName} is outside their available working hours for this date.`,
      ]
    }
    if (
      !allDay &&
      effective.startTime &&
      effective.endTime &&
      (minutesFromTime(startTime) < minutesFromTime(effective.startTime) ||
        minutesFromTime(endTime) > minutesFromTime(effective.endTime))
    ) {
      return [
        `${memberName} is outside their available working hours for this time. Available: ${formatClockRange(
          {
            startTime: effective.startTime,
            endTime: effective.endTime,
            settings: {
              timezone,
              timeFormat: '12hour',
            } as WorkspaceSchedulingSettings,
          },
        )}.`,
      ]
    }
    return []
  })
}

function validateSchedulingDraft({
  form,
  capabilities,
  settings,
  mode = 'create',
  recurrenceMode,
  customInterval,
  customFrequency,
  customWeekdays,
  customEndType,
  customEndDate,
  customCount,
}: {
  form: SchedulingEditForm
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  mode?: 'create' | 'edit'
  recurrenceMode?: string
  customInterval?: number
  customFrequency?: 'daily' | 'weekly' | 'monthly'
  customWeekdays?: number[]
  customEndType?: 'never' | 'onDate' | 'afterOccurrences'
  customEndDate?: string
  customCount?: number
}) {
  const errors: SchedulingFormErrors = {}
  const definition = resolveSchedulingEventTypeDefinition(form.type, settings)
  if (!form.type) errors.type = 'Choose an event type.'
  if (!form.title.trim()) errors.title = 'Title is required.'
  if (!isValidDateValue(form.date)) errors.date = 'Enter a valid date.'
  if (!form.timezone.trim()) {
    errors.timezone = 'Timezone is required.'
  } else if (!isSupportedSchedulingTimezone(form.timezone)) {
    errors.timezone = 'Choose a supported timezone.'
  }
  if (!form.allDay) {
    if (!isValidTimeValue(form.startTime)) {
      errors.startTime = 'Enter a valid start time.'
    }
    if (!isValidTimeValue(form.endTime)) {
      errors.endTime = 'Enter a valid end time.'
    }
    if (
      !errors.startTime &&
      !errors.endTime &&
      minutesFromTime(form.endTime) <= minutesFromTime(form.startTime)
    ) {
      errors.endTime = 'End time must be later than start time.'
    }
  }
  if (definition.requiresAssignment && !form.assignedMemberIds.length) {
    errors.assignedMemberIds = 'Assign at least one team member.'
  }
  const locationResult = validateSchedulingLocation({
    eventType: form.type,
    settings,
    location: {
      locationType: form.locationType,
      location: form.location,
      locationLabel: form.locationLabel,
      locationAddress: form.locationAddress,
      meetingUrl: form.meetingUrl,
      phoneNumber: form.phoneNumber,
    },
  })
  if (!locationResult.valid) {
    errors.location = locationResult.message
  }
  const linkedRecordResult = validateSchedulingLinkedRecord({
    eventType: form.type,
    settings,
    capabilities,
    linkedRecord: {
      recordType: form.linkedRecordType,
      recordId: form.linkedRecordId,
      label: form.linkedRecordLabel,
    },
  })
  if (!linkedRecordResult.valid) {
    errors.linkedRecord = linkedRecordResult.message
  }

  if (recurrenceMode === 'custom') {
    if ((customInterval ?? 1) < 1) {
      errors.customInterval = 'Repeat interval must be at least 1.'
    }
    if (customFrequency === 'weekly' && !(customWeekdays ?? []).length) {
      errors.customWeekdays = 'Choose at least one weekday.'
    }
    if (customEndType === 'onDate') {
      if (!customEndDate || !isValidDateValue(customEndDate)) {
        errors.customEndDate = 'Enter a valid recurrence end date.'
      } else if (isValidDateValue(form.date) && customEndDate < form.date) {
        errors.customEndDate = 'End date cannot be before the event date.'
      }
    }
    if (customEndType === 'afterOccurrences' && (customCount ?? 0) < 1) {
      errors.customCount = 'Occurrence count must be at least 1.'
    }
  }

  if (Object.keys(errors).length) {
    errors.form =
      mode === 'edit'
        ? 'Complete the highlighted fields before saving your changes.'
        : 'Complete the highlighted fields before scheduling this event.'
  }
  return errors
}

function focusFirstInvalidSchedulingField(scope: HTMLElement | null) {
  window.setTimeout(() => {
    const target = (scope ?? document).querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-scheduling-invalid="true"] input, [data-scheduling-invalid="true"] select, [data-scheduling-invalid="true"] textarea, [data-scheduling-invalid="true"] button',
    )
    if (typeof target?.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    target?.focus?.()
  }, 0)
}

function FormErrorSummary({ errors }: { errors: SchedulingFormErrors }) {
  const fieldErrors = Object.entries(errors).filter(([key]) => key !== 'form')
  return (
    <div className="rounded-2xl border border-rose-400/35 bg-rose-500/[0.08] p-3">
      <p className="text-sm font-medium text-rose-100">
        {errors.form ?? 'Complete the highlighted fields before continuing.'}
      </p>
      {fieldErrors.length > 1 ? (
        <ul className="mt-2 space-y-1 text-xs text-rose-100/80">
          {fieldErrors.map(([key, message]) => (
            <li key={key}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

class SchedulingFormSubmissionError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: SchedulingFormErrors = {},
  ) {
    super(message)
    this.name = 'SchedulingFormSubmissionError'
  }
}

async function parseSchedulingEventResponse(response: Response) {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new SchedulingFormSubmissionError(
      response.ok
        ? 'The server returned an invalid scheduling response.'
        : 'The event could not be scheduled. Try again.',
    )
  }

  const data = body as
    | ({ ok?: true; event?: SchedulingEvent } & Record<string, unknown>)
    | SchedulingApiErrorBody

  if (!response.ok || data.ok === false) {
    const requestReference =
      data.ok === false && data.requestId
        ? ` Reference: ${data.requestId}.`
        : ''
    throw new SchedulingFormSubmissionError(
      data.ok === false
        ? `${data.message}${requestReference}`
        : 'The event could not be scheduled. Try again.',
      data.ok === false
        ? ((data.fieldErrors as SchedulingFormErrors) ?? {})
        : {},
    )
  }

  if (!data.event) {
    throw new SchedulingFormSubmissionError(
      'The event could not be scheduled. Try again.',
    )
  }

  return data.event
}

async function getSchedulingMutationErrorMessage(
  response: Response,
  fallback: string,
) {
  const data = (await response.json().catch(() => ({}))) as {
    code?: string
    error?: string
    message?: string
  }
  if (data.code === 'RECURRENCE_VERSION_CONFLICT') {
    return 'This recurring schedule changed since you opened it. Refreshing the latest version.'
  }
  if (data.code === 'RECURRENCE_MUTATION_BUSY') {
    return 'Another scheduling change is being processed. Try again in a moment.'
  }
  if (data.code === 'RECURRENCE_RETRY_EXHAUSTED') {
    return 'Another scheduling change is still being processed. Try again in a moment.'
  }
  if (data.code === 'IDEMPOTENCY_KEY_REUSED') {
    return 'This scheduling request was already used for a different change.'
  }
  return data.message ?? data.error ?? fallback
}

function SchedulingLocationFields({
  eventType,
  settings,
  locationType,
  locationLabel,
  locationAddress,
  meetingUrl,
  phoneNumber,
  legacyLocation,
  error,
  onChange,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  locationType: SchedulingLocationType
  locationLabel: string
  locationAddress: string
  meetingUrl: string
  phoneNumber: string
  legacyLocation?: string
  error?: string
  onChange: (
    patch: Partial<{
      locationType: SchedulingLocationType
      location: string
      locationLabel: string
      locationAddress: string
      meetingUrl: string
      phoneNumber: string
    }>,
  ) => void
}) {
  const rule = resolveSchedulingLocationRule({ eventType, settings })
  const effectiveType = rule.allowedLocationTypes.includes(locationType)
    ? locationType
    : rule.defaultLocationType
  const hasLocation = Boolean(
    getSchedulingLocationDisplay({
      locationType,
      location: legacyLocation,
      locationLabel,
      locationAddress,
      meetingUrl,
      phoneNumber,
    }),
  )

  if (rule.requirement === 'notAllowed') {
    return hasLocation ? (
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] px-3 py-2 text-xs text-amber-100/80 sm:col-span-2">
        Location is not used for this event type. Existing location details will
        be removed when changes are saved.
      </div>
    ) : null
  }

  const setLocationType = (nextType: SchedulingLocationType) => {
    if (nextType === 'none') {
      onChange({
        locationType: 'none',
        location: '',
        locationLabel: '',
        locationAddress: '',
        meetingUrl: '',
        phoneNumber: '',
      })
      return
    }
    onChange({ locationType: nextType })
  }

  return (
    <div
      className="space-y-3 sm:col-span-2"
      data-scheduling-invalid={Boolean(error) || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Location
        </span>
        <Badge variant={rule.requirement === 'required' ? 'orange' : 'slate'}>
          {rule.requirement === 'required' ? 'Required' : 'Optional'}
        </Badge>
      </div>
      <label className="block space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Location type
        </span>
        <Select
          value={effectiveType}
          error={error}
          aria-invalid={Boolean(error)}
          onChange={(event) =>
            setLocationType(event.target.value as SchedulingLocationType)
          }
        >
          {rule.allowedLocationTypes.map((type) => (
            <option key={type} value={type}>
              {formatSchedulingLocationType(type)}
            </option>
          ))}
        </Select>
      </label>
      {effectiveType === 'none' ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs text-neutral-300">
          This event will not have a physical or virtual location.
        </p>
      ) : null}
      {effectiveType === 'toBeDetermined' ? (
        <p className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] px-3 py-2 text-xs text-cyan-100/80">
          The final location has not been confirmed yet. You can add the
          address, meeting link, or phone details later.
        </p>
      ) : null}
      {effectiveType === 'physicalAddress' ||
      effectiveType === 'customerLocation' ? (
        <label className="block space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Address
          </span>
          <Input
            value={locationAddress || locationLabel || legacyLocation || ''}
            error={error}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({
                locationAddress: event.target.value,
                locationLabel: event.target.value,
                location: event.target.value,
              })
            }
            placeholder={
              effectiveType === 'customerLocation'
                ? 'Customer address or manual override'
                : 'Street address or location label'
            }
          />
        </label>
      ) : null}
      {effectiveType === 'workspaceLocation' || effectiveType === 'other' ? (
        <label className="block space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Location label
          </span>
          <Input
            value={locationLabel || legacyLocation || ''}
            error={error}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({
                locationLabel: event.target.value,
                location: event.target.value,
              })
            }
            placeholder={
              effectiveType === 'workspaceLocation'
                ? 'Office, warehouse, or workspace location'
                : 'Location label'
            }
          />
        </label>
      ) : null}
      {effectiveType === 'videoMeeting' ? (
        <label className="block space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Meeting link
          </span>
          <Input
            type="url"
            value={meetingUrl || legacyLocation || ''}
            error={error}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({
                meetingUrl: event.target.value,
                location: event.target.value,
              })
            }
            placeholder="https://"
          />
        </label>
      ) : null}
      {effectiveType === 'phoneCall' ? (
        <label className="block space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Phone number
          </span>
          <Input
            value={phoneNumber || locationLabel || legacyLocation || ''}
            error={error}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({
                phoneNumber: event.target.value,
                locationLabel: event.target.value,
                location: event.target.value,
              })
            }
            placeholder="(555) 555-5555"
          />
        </label>
      ) : null}
      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </div>
  )
}

function SchedulingEventEditForm({
  form,
  setForm,
  errors,
  capabilities,
  settings,
  visibleEventTypes,
  workspaceId,
  memberOptions,
  recordRefreshKey,
  currentInstant,
  eventTypesSettingsHref,
  onCreateEventType,
  recordTerminology,
}: {
  form: SchedulingEditForm
  setForm: (form: SchedulingEditForm) => void
  errors: SchedulingFormErrors
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  visibleEventTypes: SchedulingEventType[]
  workspaceId: string
  memberOptions: SchedulingMemberOption[]
  recordRefreshKey: number
  currentInstant: Date
  eventTypesSettingsHref?: string
  onCreateEventType?: (label: string) => { label?: string; error?: string }
  recordTerminology?: WorkspaceRecordTerminology
}) {
  const optionTypes = Array.from(new Set([form.type, ...visibleEventTypes]))
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Event type
        </span>
        <Select
          value={form.type}
          error={errors.type}
          aria-invalid={Boolean(errors.type)}
          onChange={(event) => {
            const nextType = event.target.value as SchedulingEventType
            const nextRule = resolveSchedulingLinkedRecordRule({
              eventType: nextType,
              settings,
              capabilities,
            })
            const nextLocationRule = resolveSchedulingLocationRule({
              eventType: nextType,
              settings,
            })
            const nextLocationType =
              nextLocationRule.requirement === 'notAllowed' ||
              nextLocationRule.allowedLocationTypes.includes(form.locationType)
                ? form.locationType
                : nextLocationRule.defaultLocationType
            setForm({
              ...form,
              type: nextType,
              locationType: nextLocationType,
              linkedRecordType:
                nextRule.requirement === 'notAllowed'
                  ? ''
                  : form.linkedRecordType,
              linkedRecordId:
                nextRule.requirement === 'notAllowed'
                  ? ''
                  : form.linkedRecordId,
              linkedRecordLabel:
                nextRule.requirement === 'notAllowed'
                  ? ''
                  : form.linkedRecordLabel,
              durationMinutes:
                form.durationMinutes ??
                resolveSchedulingEventTypeDefinition(nextType, settings)
                  .defaultDurationMinutes ??
                defaultEventDurationMinutes,
            })
          }}
        >
          {optionTypes.map((type) => (
            <option key={type} value={type}>
              {getEventTypeLabel(type, settings)}
            </option>
          ))}
        </Select>
        <span className="text-neutral-text-secondary text-[11px]">
          {formatEventTypeSectionGuidance({ type: form.type, settings })}
        </span>
        <ConfigurationQuickAdd
          label="Event Type"
          addLabel="Add Event Type"
          manageLabel="Manage Event Types"
          manageHref={eventTypesSettingsHref ?? '#event-types'}
          hintId={`${workspaceId}:event-types:edit`}
          hintTitle="Event types are customizable"
          hintBody="Create event types for the way your business schedules work."
          onCreate={(label) => {
            const result = onCreateEventType?.(label) ?? {
              error: 'Event type management is unavailable.',
            }
            if (result.label) {
              setForm({
                ...form,
                type: result.label as SchedulingEventType,
              })
            }
            return result
          }}
        />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Title
        </span>
        <Input
          value={form.title}
          error={errors.title}
          aria-invalid={Boolean(errors.title)}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Status
        </span>
        <Select
          value={form.status}
          onChange={(event) =>
            setForm({
              ...form,
              status: event.target.value as SchedulingEventStatus,
            })
          }
        >
          {Object.entries(schedulingStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Date
        </span>
        <Input
          type="date"
          value={form.date}
          error={errors.date}
          aria-invalid={Boolean(errors.date)}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />
      </label>
      {!form.allDay ? (
        <>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Start time
            </span>
            <Input
              type="time"
              value={form.startTime}
              error={errors.startTime}
              aria-invalid={Boolean(errors.startTime)}
              className={timeInputClassName()}
              onChange={(event) => {
                const nextStartTime = event.target.value
                const durationMinutes = getResolvedDurationMinutes({
                  form,
                  settings,
                })
                setForm({
                  ...form,
                  startTime: nextStartTime,
                  endTime: addMinutesToTime(nextStartTime, durationMinutes),
                  durationMinutes,
                  previousTimedStartTime: nextStartTime,
                  previousTimedEndTime: addMinutesToTime(
                    nextStartTime,
                    durationMinutes,
                  ),
                })
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              End time
            </span>
            <Input
              type="time"
              value={form.endTime}
              error={errors.endTime}
              aria-invalid={Boolean(errors.endTime)}
              className={timeInputClassName()}
              onChange={(event) => {
                const nextEndTime = event.target.value
                setForm({
                  ...form,
                  endTime: nextEndTime,
                  durationMinutes:
                    getPositiveTimeDurationMinutes(
                      form.startTime,
                      nextEndTime,
                    ) ?? form.durationMinutes,
                  previousTimedStartTime: form.startTime,
                  previousTimedEndTime: nextEndTime,
                })
              }}
            />
            {getDurationLabel({
              startTime: form.startTime,
              endTime: form.endTime,
              allDay: form.allDay,
            }) ? (
              <span className="text-neutral-text-secondary text-[11px]">
                {getDurationLabel({
                  startTime: form.startTime,
                  endTime: form.endTime,
                  allDay: form.allDay,
                })}
              </span>
            ) : null}
          </label>
        </>
      ) : null}
      <div
        data-testid="scheduling-all-day-cell"
        className="flex min-h-[4.5rem] flex-col justify-start gap-1 self-start py-1 sm:items-start sm:pl-2"
      >
        <span aria-hidden="true" className="hidden h-5 sm:block" />
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(event) => {
              const nextAllDay = event.target.checked
              if (nextAllDay) {
                setForm({
                  ...form,
                  allDay: true,
                  previousTimedStartTime: form.startTime,
                  previousTimedEndTime: form.endTime,
                  durationMinutes:
                    getPositiveTimeDurationMinutes(
                      form.startTime,
                      form.endTime,
                    ) ?? form.durationMinutes,
                })
                return
              }
              const restoredStartTime =
                isValidTimeValue(form.previousTimedStartTime) &&
                form.previousTimedStartTime
                  ? form.previousTimedStartTime
                  : '09:00'
              const durationMinutes =
                getPositiveTimeDurationMinutes(
                  form.previousTimedStartTime,
                  form.previousTimedEndTime,
                ) ??
                form.durationMinutes ??
                resolveSchedulingEventTypeDefinition(form.type, settings)
                  .defaultDurationMinutes ??
                defaultEventDurationMinutes
              const restoredEndTime =
                isValidTimeValue(form.previousTimedEndTime) &&
                getPositiveTimeDurationMinutes(
                  restoredStartTime,
                  form.previousTimedEndTime,
                )
                  ? form.previousTimedEndTime
                  : addMinutesToTime(restoredStartTime, durationMinutes)
              setForm({
                ...form,
                allDay: false,
                startTime: restoredStartTime,
                endTime: restoredEndTime,
                previousTimedStartTime: restoredStartTime,
                previousTimedEndTime: restoredEndTime,
                durationMinutes:
                  getPositiveTimeDurationMinutes(
                    restoredStartTime,
                    restoredEndTime,
                  ) ?? durationMinutes,
              })
            }}
            className="h-4 w-4 accent-cyan-300"
          />
          <span className="text-sm text-neutral-100">All-day event</span>
        </label>
        {form.allDay ? (
          <p className="text-neutral-text-secondary text-[11px]">All day</p>
        ) : null}
      </div>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Timezone
        </span>
        <TimezoneSelector
          value={form.timezone || settings.timezone}
          error={errors.timezone}
          currentInstant={currentInstant}
          onChange={(timezone) => setForm({ ...form, timezone })}
        />
        {errors.timezone ? (
          <p className="text-[11px] text-rose-300">{errors.timezone}</p>
        ) : null}
      </label>
      <SchedulingLocationFields
        eventType={form.type}
        settings={settings}
        locationType={form.locationType}
        locationLabel={form.locationLabel}
        locationAddress={form.locationAddress}
        meetingUrl={form.meetingUrl}
        phoneNumber={form.phoneNumber}
        legacyLocation={form.location}
        error={errors.location}
        onChange={(patch) => setForm({ ...form, ...patch })}
      />
      <div className="sm:col-span-2">
        <MemberMultiSelector
          members={memberOptions}
          selectedIds={form.assignedMemberIds}
          error={errors.assignedMemberIds}
          onChange={(assignedMemberIds) =>
            setForm({ ...form, assignedMemberIds })
          }
        />
      </div>
      <ConditionalLinkFields
        workspaceId={workspaceId}
        capabilities={capabilities}
        settings={settings}
        terminology={recordTerminology}
        eventType={form.type}
        recordRefreshKey={recordRefreshKey}
        recordType={form.linkedRecordType}
        recordId={form.linkedRecordId}
        error={errors.linkedRecord}
        onRecordTypeChange={(linkedRecordType) =>
          setForm({
            ...form,
            linkedRecordType,
            linkedRecordId: '',
            linkedRecordLabel: '',
          })
        }
        onChange={(linkedRecord) =>
          setForm({
            ...form,
            linkedRecordType: linkedRecord?.recordType ?? '',
            linkedRecordId: linkedRecord?.recordId ?? '',
            linkedRecordLabel: linkedRecord?.label ?? '',
          })
        }
      />
      <EventReminderEditor
        mode={form.reminderMode}
        reminders={form.reminders}
        recurrenceRule={form.recurrenceRule}
        onModeChange={(reminderMode) => setForm({ ...form, reminderMode })}
        onRemindersChange={(reminders) => setForm({ ...form, reminders })}
      />
      <label className="space-y-1 sm:col-span-2">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Description or notes
        </span>
        <Textarea
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </label>
    </div>
  )
}

function formatDuration(event: SchedulingEvent) {
  if (event.allDay) return 'All day'
  const minutes = Math.round(
    (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) /
      60000,
  )
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

export function SchedulingCreateModal({
  workspaceId,
  capabilities,
  settings,
  visibleEventTypes,
  memberOptions,
  recordRefreshKey,
  availability = [],
  createLabel,
  initialDate,
  initialEventType,
  initialRepeat = 'none',
  eventTypesSettingsHref,
  onCreateEventType,
  recordTerminology,
  onClose,
  onCreated,
}: {
  workspaceId: string
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  visibleEventTypes: SchedulingEventType[]
  memberOptions: SchedulingMemberOption[]
  recordRefreshKey: number
  availability?: TeamAvailabilityRecord[]
  createLabel: string
  initialDate?: SchedulingDateKey | null
  initialEventType?: SchedulingEventType | null
  initialRepeat?: string
  eventTypesSettingsHref?: string
  onCreateEventType?: (label: string) => { label?: string; error?: string }
  recordTerminology?: WorkspaceRecordTerminology
  onClose: () => void
  onCreated: (event: SchedulingEvent) => void
}) {
  const { user } = useUser()
  const preferenceUserId = user?.id ?? 'anonymous'
  const currentInstant = useCurrentMinute()
  const initialDateKey = resolveSchedulingCreateInitialDate({
    explicitDateKey: initialDate,
    timezone: settings.timezone,
    now: currentInstant,
    entryPoint: 'scheduling-create-modal',
  }).dateKey
  const typeOptions = visibleEventTypes.length
    ? visibleEventTypes
    : capabilities.supportedEventTypes
  const defaultType =
    initialEventType && typeOptions.includes(initialEventType)
      ? initialEventType
      : (typeOptions[0] ?? 'internalMeeting')
  const defaultLocationRule = resolveSchedulingLocationRule({
    eventType: defaultType,
    settings,
  })
  const [type, setType] = useState<SchedulingEventType>(defaultType)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<SchedulingEventStatus>('scheduled')
  const [date, setDate] = useState(initialDateKey)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(
    resolveSchedulingEventTypeDefinition(defaultType, settings)
      .defaultDurationMinutes ?? defaultEventDurationMinutes,
  )
  const [previousTimedStartTime, setPreviousTimedStartTime] = useState('09:00')
  const [previousTimedEndTime, setPreviousTimedEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [timezone, setTimezone] = useState(settings.timezone)
  const [repeat, setRepeat] = useState(initialRepeat)
  const [customInterval, setCustomInterval] = useState(1)
  const [customFrequency, setCustomFrequency] = useState<
    'daily' | 'weekly' | 'monthly'
  >('weekly')
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([
    getDateKeyWeekday(initialDateKey),
  ])
  const [customEndType, setCustomEndType] = useState<
    'never' | 'onDate' | 'afterOccurrences'
  >('never')
  const [customEndDate, setCustomEndDate] = useState('')
  const [customCount, setCustomCount] = useState(6)
  const [reminderMode, setReminderMode] =
    useState<SchedulingReminderMode>('workspaceDefault')
  const [reminders, setReminders] = useState<SchedulingReminderInput[]>([
    defaultNotificationReminder,
  ])
  const [location, setLocation] = useState('')
  const [locationType, setLocationType] = useState<SchedulingLocationType>(
    defaultLocationRule.defaultLocationType,
  )
  const [locationLabel, setLocationLabel] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([])
  const [linkedRecordType, setLinkedRecordType] = useState('')
  const [linkedRecordId, setLinkedRecordId] = useState('')
  const [linkedRecordLabel, setLinkedRecordLabel] = useState('')
  const [description, setDescription] = useState('')
  const [formErrors, setFormErrors] = useState<SchedulingFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [externalConflictOverrideReason, setExternalConflictOverrideReason] =
    useState('')
  const savingRef = useRef(false)
  const skipNoLinkedRecordWarningRef = useRef(false)
  const skipUndeterminedLocationWarningRef = useRef(false)
  const [showNoLinkedRecordWarning, setShowNoLinkedRecordWarning] =
    useState(false)
  const [showUndeterminedLocationWarning, setShowUndeterminedLocationWarning] =
    useState(false)
  const [suppressNoLinkedRecordWarning, setSuppressNoLinkedRecordWarning] =
    useState(false)
  const [
    suppressUndeterminedLocationWarning,
    setSuppressUndeterminedLocationWarning,
  ] = useState(false)
  const [endTimeManuallyEdited, setEndTimeManuallyEdited] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const selectedTypeDefinition = resolveSchedulingEventTypeDefinition(
    type,
    settings,
  )
  const recurrenceRule = buildRecurrenceRule({
    repeat,
    date,
    customInterval,
    customFrequency,
    customWeekdays,
    customEndType,
    customEndDate,
    customCount,
  })
  const conflictWarnings = getTimeOffConflictWarnings({
    availability,
    assignedMemberIds,
    date,
    startTime,
    endTime,
    allDay,
    timezone,
    memberOptions,
  })
  const createDraftWindow = useMemo(() => {
    if (
      !isSchedulingDateKey(date) ||
      (!allDay && (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)))
    ) {
      return null
    }
    return getSchedulingDraftWindow({
      date,
      startTime,
      endTime,
      allDay,
      timezone,
    })
  }, [allDay, date, endTime, startTime, timezone])
  const recurrencePreviewRangeEndUtc = useMemo(() => {
    if (!createDraftWindow || !recurrenceRule) return undefined
    return new Date(
      new Date(createDraftWindow.startsAt).getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString()
  }, [createDraftWindow, recurrenceRule])
  const externalAvailabilityPreview = useExternalAvailabilityPreview({
    request:
      createDraftWindow && assignedMemberIds.length
        ? {
            workspaceId,
            workspaceMemberIds: assignedMemberIds,
            startsAtUtc: createDraftWindow.startsAt,
            endsAtUtc: createDraftWindow.endsAt,
            timezone,
            recurrenceScope: recurrenceRule ? 'entireSeries' : undefined,
            recurrenceRule: recurrenceRule ?? undefined,
            previewRangeEndUtc: recurrencePreviewRangeEndUtc,
          }
        : null,
  })

  const applyTypeDefaultDuration = (nextType: SchedulingEventType) => {
    setType(nextType)
    const nextLocationRule = resolveSchedulingLocationRule({
      eventType: nextType,
      settings,
    })
    setLocationType((currentType) =>
      nextLocationRule.requirement === 'notAllowed' ||
      nextLocationRule.allowedLocationTypes.includes(currentType)
        ? currentType
        : nextLocationRule.defaultLocationType,
    )
    if (
      resolveSchedulingLinkedRecordRule({
        eventType: nextType,
        settings,
        capabilities,
      }).requirement === 'notAllowed'
    ) {
      setLinkedRecordType('')
      setLinkedRecordId('')
      setLinkedRecordLabel('')
    }
    if (!endTimeManuallyEdited) {
      const duration =
        resolveSchedulingEventTypeDefinition(nextType, settings)
          .defaultDurationMinutes ?? defaultEventDurationMinutes
      setDurationMinutes(duration)
      setEndTime(addMinutesToTime(startTime, duration))
      setPreviousTimedStartTime(startTime)
      setPreviousTimedEndTime(addMinutesToTime(startTime, duration))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (savingRef.current) return
    const draft: SchedulingEditForm = {
      type,
      title,
      status,
      date,
      startTime,
      endTime,
      durationMinutes,
      previousTimedStartTime,
      previousTimedEndTime,
      allDay,
      timezone,
      location,
      locationType,
      locationLabel,
      locationAddress,
      meetingUrl,
      phoneNumber,
      assignedMemberIds,
      linkedRecordType,
      linkedRecordId,
      linkedRecordLabel,
      description,
      recurrenceRule: recurrenceRule ?? undefined,
      reminderMode,
      reminders,
      reminderPreset: 'workspaceDefault' as SchedulingReminderPreset,
    }
    const errors = validateSchedulingDraft({
      form: draft,
      capabilities,
      settings,
      recurrenceMode: repeat,
      customInterval,
      customFrequency,
      customWeekdays,
      customEndType,
      customEndDate,
      customCount,
    })
    setFormErrors(errors)
    if (errors.form) {
      focusFirstInvalidSchedulingField(formRef.current)
      return
    }
    if (
      !skipUndeterminedLocationWarningRef.current &&
      shouldWarnWhenSchedulingWithUndeterminedLocation({
        eventType: type,
        settings,
        locationType,
      }) &&
      !isSchedulingWarningSuppressed({
        workspaceId,
        userId: preferenceUserId,
        eventType: type,
        warningKey: 'scheduleWithUndeterminedLocation',
      })
    ) {
      setShowUndeterminedLocationWarning(true)
      return
    }
    skipUndeterminedLocationWarningRef.current = false
    const linkedRecordDraft = {
      recordType: linkedRecordType,
      recordId: linkedRecordId,
      label: linkedRecordLabel,
    }
    if (
      !skipNoLinkedRecordWarningRef.current &&
      shouldWarnWhenSchedulingWithoutLinkedRecord({
        eventType: type,
        settings,
        capabilities,
        linkedRecord: linkedRecordDraft,
      }) &&
      !isSchedulingWarningSuppressed({
        workspaceId,
        userId: preferenceUserId,
        eventType: type,
        warningKey: 'scheduleWithoutLinkedRecord',
      })
    ) {
      setShowNoLinkedRecordWarning(true)
      return
    }
    skipNoLinkedRecordWarningRef.current = false
    const { startsAt, endsAt } =
      createDraftWindow ??
      getSchedulingDraftWindow({
        date,
        startTime,
        endTime,
        allDay,
        timezone,
      })
    const linkedRecord = normalizeSchedulingLinkedRecord(linkedRecordDraft)
    const normalizedLocation = getNormalizedLocationFormValues({
      eventType: type,
      settings,
      locationType,
      location,
      locationLabel,
      locationAddress,
      meetingUrl,
      phoneNumber,
    })
    savingRef.current = true
    setSaving(true)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              title: title.trim(),
              description: description.trim() || undefined,
              type,
              status,
              startsAt,
              endsAt,
              allDay,
              timezone,
              ...normalizedLocation,
              assignedMemberIds,
              linkedRecord,
              recurrenceRule: recurrenceRule ?? undefined,
              reminderPolicy: getReminderPolicyFromEditor({
                mode: reminderMode,
                reminders,
              }),
              externalCalendarState: 'notConnected',
              acknowledgedExternalAvailabilitySignalIds:
                externalAvailabilityPreview.signalIds,
              externalAvailabilityOverrideReason:
                externalAvailabilityPreview.hasBlockingConflict
                  ? externalConflictOverrideReason
                  : undefined,
            },
          }),
        },
      )
      if (!response.ok) {
        await parseSchedulingEventResponse(response)
      }
      const createdEvent = await parseSchedulingEventResponse(response)
      toast.success('Event scheduled.')
      onCreated(createdEvent)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Event could not be scheduled.'
      setFormErrors({
        ...(error instanceof SchedulingFormSubmissionError
          ? error.fieldErrors
          : {}),
        form: message,
      })
      focusFirstInvalidSchedulingField(formRef.current)
      toast.error(message)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-label={createLabel}
        onSubmit={submit}
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">
              {createLabel}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              This will be saved to the workspace schedule. External calendar
              sync connects later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close create schedule item"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-x-4 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {formErrors.form ? (
            <div className="sm:col-span-2">
              <FormErrorSummary errors={formErrors} />
            </div>
          ) : null}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Event type
            </span>
            <Select
              value={type}
              error={formErrors.type}
              aria-invalid={Boolean(formErrors.type)}
              onChange={(event) => {
                applyTypeDefaultDuration(
                  event.target.value as SchedulingEventType,
                )
                if (formErrors.form) setFormErrors({})
              }}
            >
              {typeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {getEventTypeLabel(typeOption, settings)}
                </option>
              ))}
            </Select>
            <span className="text-neutral-text-secondary text-[11px]">
              {formatEventTypeSectionGuidance({ type, settings })}
            </span>
            <ConfigurationQuickAdd
              label="Event Type"
              addLabel="Add Event Type"
              manageLabel="Manage Event Types"
              manageHref={eventTypesSettingsHref ?? '#event-types'}
              hintId={`${workspaceId}:event-types:create`}
              hintTitle="Event types are customizable"
              hintBody="Create event types for the way your business schedules work."
              onCreate={(label) => {
                const result = onCreateEventType?.(label) ?? {
                  error: 'Event type management is unavailable.',
                }
                if (result.label) {
                  applyTypeDefaultDuration(result.label as SchedulingEventType)
                }
                return result
              }}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Title
            </span>
            <Input
              value={title}
              error={formErrors.title}
              aria-invalid={Boolean(formErrors.title)}
              onChange={(event) => {
                setTitle(event.target.value)
                if (formErrors.form) setFormErrors({})
              }}
              placeholder={selectedTypeDefinition.label}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Date
            </span>
            <Input
              type="date"
              value={date}
              error={formErrors.date}
              aria-invalid={Boolean(formErrors.date)}
              onChange={(event) => {
                setDate(event.target.value)
                if (formErrors.form) setFormErrors({})
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Status
            </span>
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as SchedulingEventStatus)
              }
            >
              {Object.entries(schedulingStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          {!allDay ? (
            <>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  Start time
                </span>
                <Input
                  type="time"
                  value={startTime}
                  error={formErrors.startTime}
                  aria-invalid={Boolean(formErrors.startTime)}
                  className={timeInputClassName()}
                  onChange={(event) => {
                    const nextStartTime = event.target.value
                    const nextEndTime = addMinutesToTime(
                      nextStartTime,
                      durationMinutes,
                    )
                    setStartTime(nextStartTime)
                    setEndTime(nextEndTime)
                    setPreviousTimedStartTime(nextStartTime)
                    setPreviousTimedEndTime(nextEndTime)
                    if (formErrors.form) setFormErrors({})
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-neutral-text-secondary text-xs font-medium">
                  End time
                </span>
                <Input
                  type="time"
                  value={endTime}
                  error={formErrors.endTime}
                  aria-invalid={Boolean(formErrors.endTime)}
                  className={timeInputClassName()}
                  onChange={(event) => {
                    const nextEndTime = event.target.value
                    setEndTime(nextEndTime)
                    setEndTimeManuallyEdited(true)
                    setDurationMinutes(
                      getPositiveTimeDurationMinutes(startTime, nextEndTime) ??
                        durationMinutes,
                    )
                    setPreviousTimedStartTime(startTime)
                    setPreviousTimedEndTime(nextEndTime)
                    if (formErrors.form) setFormErrors({})
                  }}
                />
                {getDurationLabel({ startTime, endTime, allDay }) ? (
                  <span className="text-neutral-text-secondary text-[11px]">
                    {getDurationLabel({ startTime, endTime, allDay })}
                  </span>
                ) : null}
              </label>
            </>
          ) : null}
          <div
            data-testid="scheduling-all-day-cell"
            className="flex min-h-[4.5rem] flex-col justify-start gap-1 self-start py-1 sm:items-start sm:pl-2"
          >
            <span aria-hidden="true" className="hidden h-5 sm:block" />
            <label className="flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(event) => {
                  const nextAllDay = event.target.checked
                  if (nextAllDay) {
                    setPreviousTimedStartTime(startTime)
                    setPreviousTimedEndTime(endTime)
                    setDurationMinutes(
                      getPositiveTimeDurationMinutes(startTime, endTime) ??
                        durationMinutes,
                    )
                    setAllDay(true)
                    if (formErrors.form) setFormErrors({})
                    return
                  }
                  const restoredStartTime = isValidTimeValue(
                    previousTimedStartTime,
                  )
                    ? previousTimedStartTime
                    : '09:00'
                  const restoredDuration =
                    getPositiveTimeDurationMinutes(
                      previousTimedStartTime,
                      previousTimedEndTime,
                    ) ?? durationMinutes
                  const restoredEndTime =
                    isValidTimeValue(previousTimedEndTime) &&
                    getPositiveTimeDurationMinutes(
                      restoredStartTime,
                      previousTimedEndTime,
                    )
                      ? previousTimedEndTime
                      : addMinutesToTime(restoredStartTime, restoredDuration)
                  setStartTime(restoredStartTime)
                  setEndTime(restoredEndTime)
                  setDurationMinutes(
                    getPositiveTimeDurationMinutes(
                      restoredStartTime,
                      restoredEndTime,
                    ) ?? restoredDuration,
                  )
                  setAllDay(false)
                  if (formErrors.form) setFormErrors({})
                }}
                className="h-4 w-4 accent-cyan-300"
              />
              <span className="text-sm text-neutral-100">All-day event</span>
            </label>
            {allDay ? (
              <p className="text-neutral-text-secondary text-[11px]">All day</p>
            ) : null}
          </div>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Timezone
            </span>
            <TimezoneSelector
              value={timezone}
              error={formErrors.timezone}
              currentInstant={currentInstant}
              onChange={(nextTimezone) => {
                setTimezone(nextTimezone)
                if (formErrors.form) setFormErrors({})
              }}
            />
            {formErrors.timezone ? (
              <p className="text-[11px] text-rose-300">{formErrors.timezone}</p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Repeat
            </span>
            <Select
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="everyTwoWeeks">Every two weeks</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </Select>
          </label>
          {repeat === 'custom' ? (
            <CustomRecurrenceEditor
              interval={customInterval}
              setInterval={setCustomInterval}
              frequency={customFrequency}
              setFrequency={setCustomFrequency}
              weekdays={customWeekdays}
              setWeekdays={setCustomWeekdays}
              endType={customEndType}
              setEndType={setCustomEndType}
              endDate={customEndDate}
              setEndDate={setCustomEndDate}
              occurrenceCount={customCount}
              setOccurrenceCount={setCustomCount}
              errors={formErrors}
              summary={formatSchedulingRecurrenceSummary(
                recurrenceRule ?? null,
                date,
                weekdayLabels,
              )}
            />
          ) : recurrenceRule ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-2 text-sm text-neutral-200 sm:col-span-2">
              {formatSchedulingRecurrenceSummary(
                recurrenceRule,
                date,
                weekdayLabels,
              )}
            </p>
          ) : null}
          <EventReminderEditor
            mode={reminderMode}
            reminders={reminders}
            recurrenceRule={recurrenceRule ?? undefined}
            onModeChange={setReminderMode}
            onRemindersChange={setReminders}
          />
          <SchedulingLocationFields
            eventType={type}
            settings={settings}
            locationType={locationType}
            locationLabel={locationLabel}
            locationAddress={locationAddress}
            meetingUrl={meetingUrl}
            phoneNumber={phoneNumber}
            legacyLocation={location}
            error={formErrors.location}
            onChange={(patch) => {
              if (patch.locationType !== undefined)
                setLocationType(patch.locationType)
              if (patch.location !== undefined) setLocation(patch.location)
              if (patch.locationLabel !== undefined)
                setLocationLabel(patch.locationLabel)
              if (patch.locationAddress !== undefined)
                setLocationAddress(patch.locationAddress)
              if (patch.meetingUrl !== undefined)
                setMeetingUrl(patch.meetingUrl)
              if (patch.phoneNumber !== undefined)
                setPhoneNumber(patch.phoneNumber)
              if (formErrors.form) setFormErrors({})
            }}
          />
          <div className="sm:col-span-2">
            <MemberMultiSelector
              members={memberOptions}
              selectedIds={assignedMemberIds}
              error={formErrors.assignedMemberIds}
              onChange={(nextAssignedMemberIds) => {
                setAssignedMemberIds(nextAssignedMemberIds)
                if (formErrors.form) setFormErrors({})
              }}
            />
            {conflictWarnings.length ? (
              <div className="mt-2 space-y-1 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
                {conflictWarnings.map((warning) => (
                  <p key={warning} className="text-xs text-amber-100">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
            <ExternalAvailabilityConflictSummary
              result={externalAvailabilityPreview.data}
              loading={externalAvailabilityPreview.loading}
              error={externalAvailabilityPreview.error}
              timezone={timezone}
              variant={recurrenceRule ? 'recurrenceSummary' : 'form'}
              overrideReason={externalConflictOverrideReason}
              onOverrideReasonChange={setExternalConflictOverrideReason}
            />
          </div>
          <ConditionalLinkFields
            workspaceId={workspaceId}
            capabilities={capabilities}
            settings={settings}
            eventType={type}
            terminology={recordTerminology}
            recordRefreshKey={recordRefreshKey}
            recordType={linkedRecordType}
            recordId={linkedRecordId}
            error={formErrors.linkedRecord}
            onRecordTypeChange={(nextRecordType) => {
              setLinkedRecordType(nextRecordType)
              setLinkedRecordId('')
              setLinkedRecordLabel('')
              if (formErrors.form) setFormErrors({})
            }}
            onChange={(linkedRecord) => {
              setLinkedRecordType(linkedRecord?.recordType ?? '')
              setLinkedRecordId(linkedRecord?.recordId ?? '')
              setLinkedRecordLabel(linkedRecord?.label ?? '')
              if (formErrors.form) setFormErrors({})
            }}
          />
          <label className="space-y-1 sm:col-span-2">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Description or notes
            </span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add scheduling notes, prep details, or customer context."
            />
          </label>
        </div>
        {showUndeterminedLocationWarning ? (
          <div className="border-t border-cyan-300/25 bg-cyan-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-cyan-100">
              Save without a confirmed location?
            </p>
            <p className="mt-1 text-xs text-cyan-100/75">
              This event&apos;s location is still to be determined. You can add
              it later.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-cyan-100/80">
              <input
                type="checkbox"
                checked={suppressUndeterminedLocationWarning}
                onChange={(event) =>
                  setSuppressUndeterminedLocationWarning(event.target.checked)
                }
                className="h-4 w-4 accent-cyan-300"
              />
              Don&apos;t remind me again for this event type
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowUndeterminedLocationWarning(false)}
              >
                Go Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (suppressUndeterminedLocationWarning) {
                    suppressSchedulingWarning({
                      workspaceId,
                      userId: preferenceUserId,
                      eventType: type,
                      warningKey: 'scheduleWithUndeterminedLocation',
                    })
                  }
                  setShowUndeterminedLocationWarning(false)
                  skipUndeterminedLocationWarningRef.current = true
                  formRef.current?.requestSubmit()
                }}
              >
                Save as To Be Determined
              </Button>
            </div>
          </div>
        ) : null}
        {showNoLinkedRecordWarning ? (
          <div className="border-t border-amber-300/25 bg-amber-300/[0.05] px-5 py-4">
            <p className="text-sm font-medium text-amber-100">
              Schedule without a linked record?
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              This event will not be connected to a lead, opportunity, sale,
              client, or other workspace record. You can link it later.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-amber-100/80">
              <input
                type="checkbox"
                checked={suppressNoLinkedRecordWarning}
                onChange={(event) =>
                  setSuppressNoLinkedRecordWarning(event.target.checked)
                }
                className="h-4 w-4 accent-cyan-300"
              />
              Don&apos;t remind me again for this event type
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowNoLinkedRecordWarning(false)}
              >
                Go Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (suppressNoLinkedRecordWarning) {
                    suppressSchedulingWarning({
                      workspaceId,
                      userId: preferenceUserId,
                      eventType: type,
                      warningKey: 'scheduleWithoutLinkedRecord',
                    })
                  }
                  setShowNoLinkedRecordWarning(false)
                  skipNoLinkedRecordWarningRef.current = true
                  formRef.current?.requestSubmit()
                }}
              >
                Schedule Without Link
              </Button>
            </div>
          </div>
        ) : null}
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Scheduling...' : createLabel}
          </Button>
        </footer>
      </form>
    </div>
  )
}

function buildRecurrenceRule({
  repeat,
  date,
  customInterval,
  customFrequency,
  customWeekdays,
  customEndType,
  customEndDate,
  customCount,
}: {
  repeat: string
  date: string
  customInterval: number
  customFrequency: 'daily' | 'weekly' | 'monthly'
  customWeekdays: number[]
  customEndType: 'never' | 'onDate' | 'afterOccurrences'
  customEndDate: string
  customCount: number
}): SchedulingEvent['recurrenceRule'] | null {
  if (!isSchedulingDateKey(date)) return null
  const weekday = getDateKeyWeekday(date)
  if (repeat === 'daily')
    return { frequency: 'daily', interval: 1, endType: 'never' }
  if (repeat === 'weekly') {
    return {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [weekday],
      endType: 'never',
    }
  }
  if (repeat === 'everyTwoWeeks') {
    return {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [weekday],
      endType: 'never',
    }
  }
  if (repeat === 'monthly')
    return { frequency: 'monthly', interval: 1, endType: 'never' }
  if (repeat === 'annually')
    return { frequency: 'yearly', interval: 1, endType: 'never' }
  if (repeat !== 'custom') return null
  return {
    frequency: customFrequency,
    interval: Math.max(1, customInterval),
    daysOfWeek: customFrequency === 'weekly' ? customWeekdays : undefined,
    endType: customEndType,
    endDate: customEndType === 'onDate' ? customEndDate : undefined,
    occurrenceCount:
      customEndType === 'afterOccurrences' ? customCount : undefined,
  }
}

function CustomRecurrenceEditor({
  interval,
  setInterval,
  frequency,
  setFrequency,
  weekdays,
  setWeekdays,
  endType,
  setEndType,
  endDate,
  setEndDate,
  occurrenceCount,
  setOccurrenceCount,
  errors,
  summary,
}: {
  interval: number
  setInterval: (value: number) => void
  frequency: 'daily' | 'weekly' | 'monthly'
  setFrequency: (value: 'daily' | 'weekly' | 'monthly') => void
  weekdays: number[]
  setWeekdays: (value: number[]) => void
  endType: 'never' | 'onDate' | 'afterOccurrences'
  setEndType: (value: 'never' | 'onDate' | 'afterOccurrences') => void
  endDate: string
  setEndDate: (value: string) => void
  occurrenceCount: number
  setOccurrenceCount: (value: number) => void
  errors?: SchedulingFormErrors
  summary: string
}) {
  const toggleWeekday = (day: number) => {
    setWeekdays(
      weekdays.includes(day)
        ? weekdays.filter((item) => item !== day)
        : [...weekdays, day].sort(),
    )
  }
  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/35 p-3 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Repeat every
          </span>
          <Input
            type="number"
            min={1}
            value={interval}
            error={errors?.customInterval}
            aria-invalid={Boolean(errors?.customInterval)}
            onChange={(event) => setInterval(Number(event.target.value))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Frequency
          </span>
          <Select
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as typeof frequency)
            }
          >
            <option value="daily">Day</option>
            <option value="weekly">Week</option>
            <option value="monthly">Month</option>
          </Select>
        </label>
      </div>
      {frequency === 'weekly' ? (
        <div>
          <p className="text-neutral-text-secondary text-xs font-medium">
            Days of week
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdayLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(index)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  weekdays.includes(index)
                    ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                    : 'border-slate-700 text-neutral-300 hover:bg-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors?.customWeekdays ? (
            <p className="mt-1 text-[11px] text-rose-300">
              {errors.customWeekdays}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Ends
          </span>
          <Select
            value={endType}
            onChange={(event) =>
              setEndType(event.target.value as typeof endType)
            }
          >
            <option value="never">Never</option>
            <option value="onDate">On date</option>
            <option value="afterOccurrences">After occurrences</option>
          </Select>
        </label>
        {endType === 'onDate' ? (
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              End date
            </span>
            <Input
              type="date"
              value={endDate}
              error={errors?.customEndDate}
              aria-invalid={Boolean(errors?.customEndDate)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        ) : endType === 'afterOccurrences' ? (
          <label className="space-y-1">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Occurrences
            </span>
            <Input
              type="number"
              min={1}
              value={occurrenceCount}
              error={errors?.customCount}
              aria-invalid={Boolean(errors?.customCount)}
              onChange={(event) =>
                setOccurrenceCount(Number(event.target.value))
              }
            />
          </label>
        ) : null}
      </div>
      <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-neutral-200">
        {summary}
      </p>
    </div>
  )
}

function TimezoneSelector({
  value,
  disabled,
  currentInstant,
  error,
  onChange,
}: {
  value: string
  disabled?: boolean
  currentInstant: Date
  error?: string
  onChange: (value: string) => void
}) {
  const selected = getSchedulingTimezoneOption(value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 288,
  })
  const options = filterSchedulingTimezoneOptions(query)
  const displayTime = (timezone: string) =>
    formatInWorkspaceTimezone(currentInstant, timezone, {
      hour: 'numeric',
      minute: '2-digit',
    })

  const choose = (timezone: string) => {
    onChange(timezone)
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const viewportPadding = 16
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const desiredHeight = Math.min(
        320,
        Math.max(180, Math.max(spaceBelow, spaceAbove)),
      )
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow
      setMenuPosition({
        top: openAbove
          ? Math.max(viewportPadding, rect.top - desiredHeight - 8)
          : Math.min(
              window.innerHeight - viewportPadding - desiredHeight,
              rect.bottom + 8,
            ),
        left: Math.min(
          Math.max(viewportPadding, rect.left),
          window.innerWidth - viewportPadding - rect.width,
        ),
        width: rect.width,
        maxHeight: desiredHeight,
      })
    }
    updatePosition()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  if (disabled) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
        <p className="text-sm font-medium text-neutral-100">{selected.label}</p>
        <p className="text-neutral-text-secondary text-xs">
          {selected.value} · {displayTime(selected.value)}
        </p>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen((current) => !current)
          }
        }}
        className={cn(
          'text-neutral-text-primary focus-visible:ring-brand-primary/70 group flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-slate-950/80 px-3 py-2 text-left text-sm shadow-sm transition hover:border-cyan-300/40 hover:bg-slate-900/70 focus:outline-none focus-visible:ring-2',
          error
            ? 'border-rose-500/70 focus-visible:ring-rose-500/60'
            : 'border-slate-700',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Timezone: ${selected.label}, ${selected.value}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-5">
            {selected.label}
          </span>
          <span className="text-neutral-text-secondary block truncate text-xs leading-4">
            {selected.value} · {displayTime(selected.value)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'text-neutral-text-secondary h-4 w-4 shrink-0 transition group-hover:text-cyan-100',
            open ? 'rotate-180' : null,
          )}
        />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              data-timezone-menu="true"
              className="fixed z-[120] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              <div className="border-b border-slate-800 p-2">
                <div className="relative">
                  <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setActiveIndex(0)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setActiveIndex((current) =>
                          Math.min(options.length - 1, current + 1),
                        )
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setActiveIndex((current) => Math.max(0, current - 1))
                      } else if (event.key === 'Enter') {
                        event.preventDefault()
                        const option = options[activeIndex]
                        if (option) choose(option.value)
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setOpen(false)
                      }
                    }}
                    autoFocus
                    className="pl-9"
                    placeholder="Search city, timezone, or US timezone name..."
                    aria-label="Search timezones"
                  />
                </div>
              </div>
              <div
                role="listbox"
                className="overflow-y-auto p-1"
                style={{
                  maxHeight: Math.max(120, menuPosition.maxHeight - 58),
                }}
              >
                {options.length ? (
                  options.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option.value)}
                      className={cn(
                        'grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-3 py-2 text-left transition focus:outline-none',
                        option.value === value
                          ? 'bg-cyan-300/[0.08] text-cyan-100'
                          : index === activeIndex
                            ? 'bg-slate-900 text-neutral-100'
                            : 'text-neutral-200 hover:bg-slate-900',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="text-neutral-text-secondary block truncate text-xs">
                          {option.value}
                        </span>
                      </span>
                      <span className="text-neutral-text-secondary self-center text-xs tabular-nums">
                        {displayTime(option.value)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-neutral-text-secondary px-3 py-6 text-center text-sm">
                    No matching timezones.
                  </p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function ConditionalLinkFields({
  workspaceId,
  capabilities,
  settings,
  terminology,
  eventType,
  recordRefreshKey,
  recordType,
  recordId,
  error,
  onRecordTypeChange,
  onChange,
}: {
  workspaceId: string
  capabilities: SchedulingCapabilities
  settings: WorkspaceSchedulingSettings
  terminology?: WorkspaceRecordTerminology
  eventType: SchedulingEventType | string
  recordRefreshKey: number
  recordType: string
  recordId: string
  error?: string
  onRecordTypeChange: (value: string) => void
  onChange: (value: SchedulingEvent['linkedRecord'] | null) => void
}) {
  const linkedRecordRule = resolveSchedulingLinkedRecordRule({
    eventType,
    settings,
    capabilities,
  })
  const fields = linkedRecordRule.supportedLinkedRecordTypes
  const [search, setSearch] = useState('')
  const typedRecordType = recordType as SchedulingLinkedRecordType
  const options = useMemo(() => {
    void recordRefreshKey
    return recordType
      ? getSchedulingLinkedRecordOptions({
          workspaceId,
          recordType: typedRecordType,
        })
      : []
  }, [recordRefreshKey, recordType, typedRecordType, workspaceId])
  const filteredOptions = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) =>
      [
        option.label,
        option.secondary,
        option.context,
        formatLinkedRecordType(option.recordType, terminology),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [options, search, terminology])
  const selected = options.find((option) => option.recordId === recordId)

  if (linkedRecordRule.requirement === 'notAllowed' || !fields.length) {
    return null
  }

  return (
    <div
      className="space-y-2 sm:col-span-2"
      data-scheduling-invalid={error ? 'true' : undefined}
    >
      <p className="text-neutral-text-secondary text-xs font-medium">
        Linked record{' '}
        <span className="text-[11px] font-normal text-neutral-500">
          {linkedRecordRule.requirement === 'required'
            ? 'Required'
            : 'Optional'}
        </span>
      </p>
      <div
        className={cn(
          'grid gap-3 rounded-2xl sm:grid-cols-2',
          error && 'border border-rose-500/50 p-2',
        )}
      >
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-[0.14em]">
            Record type
          </span>
          <Select
            value={recordType}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              const next = event.target.value
              onRecordTypeChange(next)
              if (!next) onChange(null)
              setSearch('')
            }}
          >
            {linkedRecordRule.requirement === 'optional' ? (
              <option value="">None</option>
            ) : null}
            {fields.map((field) => (
              <option key={field} value={field}>
                {formatLinkedRecordType(field, terminology)}
              </option>
            ))}
          </Select>
        </label>
        <div className="space-y-1">
          <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-[0.14em]">
            Record
          </span>
          {recordType ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
              <Input
                value={search}
                aria-invalid={Boolean(error)}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${formatLinkedRecordType(typedRecordType, terminology).toLowerCase()} records...`}
                aria-label="Search linked records"
              />
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                {selected && !search ? (
                  <div className="rounded-lg border border-cyan-300/45 bg-cyan-300/[0.08] px-3 py-2">
                    <p className="text-sm font-medium text-cyan-100">
                      {selected.label}
                    </p>
                    {selected.secondary ? (
                      <p className="text-xs text-cyan-100/70">
                        {selected.secondary}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.recordId}
                      type="button"
                      onClick={() => {
                        onChange({
                          recordType: option.recordType,
                          recordId: option.recordId,
                          label: option.label,
                        })
                        setSearch('')
                      }}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                        option.recordId === recordId
                          ? 'border-cyan-300/60 bg-cyan-300/[0.08]'
                          : 'border-transparent hover:border-slate-700 hover:bg-slate-900/70',
                      )}
                    >
                      <span className="block text-sm font-medium text-neutral-100">
                        {option.label}
                      </span>
                      <span className="text-neutral-text-secondary block text-xs">
                        {[option.secondary, option.context]
                          .filter(Boolean)
                          .join(' - ') ||
                          formatLinkedRecordType(
                            option.recordType,
                            terminology,
                          )}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-neutral-text-secondary px-2 py-3 text-sm">
                    {options.length
                      ? 'No records match that search.'
                      : `No ${formatLinkedRecordType(typedRecordType, terminology).toLowerCase()} records available yet.`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
              Not linked
            </div>
          )}
        </div>
      </div>
      {linkedRecordRule.requirement === 'optional' && !recordType ? (
        <p className="text-neutral-text-secondary text-[11px]">
          This event will remain standalone and can be linked later.
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </div>
  )
}

function MemberMultiSelector({
  members,
  selectedIds,
  error,
  onChange,
}: {
  members: SchedulingMemberOption[]
  selectedIds: string[]
  error?: string
  onChange: (selectedIds: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const selected = selectedIds
    .map(
      (id) =>
        members.find((member) => member.id === id) ?? {
          id,
          label: humanizeMemberId(id),
        },
    )
    .filter(Boolean) as SchedulingMemberOption[]
  const filteredMembers = members.filter((member) => {
    if (selectedIds.includes(member.id)) return false
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return [member.label, member.secondary, member.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })

  const remove = (id: string) => {
    onChange(selectedIds.filter((selectedId) => selectedId !== id))
  }

  return (
    <div
      className="space-y-2"
      data-scheduling-invalid={error ? 'true' : undefined}
    >
      <p className="text-neutral-text-secondary text-xs font-medium">
        Assigned team members
      </p>
      <div
        className={cn(
          'rounded-xl border bg-slate-950/50 p-2',
          error ? 'border-rose-500/60' : 'border-slate-800',
        )}
      >
        <div className="flex flex-wrap gap-2">
          {selected.length ? (
            selected.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => remove(member.id)}
                className="rounded-full border border-cyan-300/35 bg-cyan-300/[0.08] px-2.5 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-300/15"
                aria-label={`Remove ${member.label}`}
              >
                {member.label} ×
              </button>
            ))
          ) : (
            <span className="text-neutral-text-secondary px-1 py-1 text-sm">
              Unassigned
            </span>
          )}
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search active workspace members..."
          className="mt-2"
          aria-invalid={Boolean(error)}
          aria-label="Search active workspace members"
        />
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {filteredMembers.length ? (
            filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  onChange([...selectedIds, member.id])
                  setSearch('')
                }}
                className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <span className="block text-sm font-medium text-neutral-100">
                  {member.label}
                </span>
                {member.secondary || member.role ? (
                  <span className="text-neutral-text-secondary block text-xs">
                    {member.secondary ?? member.role}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="text-neutral-text-secondary px-2 py-3 text-sm">
              {members.length
                ? 'No active members match that search.'
                : 'No active workspace members are available.'}
            </p>
          )}
        </div>
      </div>
      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </div>
  )
}
