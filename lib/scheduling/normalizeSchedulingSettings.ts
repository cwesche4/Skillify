import type {
  SchedulingCalendarView,
  SchedulingEventType,
  SchedulingLinkedRecordRequirement,
  SchedulingLocationRequirement,
  SchedulingLocationType,
  SchedulingPreset,
  SchedulingSectionKey,
  WorkspaceCalendarConnectionPolicy,
  WorkspaceSchedulingCustomEventType,
  WorkspaceSchedulingEventTypePreference,
  WorkspaceSchedulingNotificationPreferences,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'
import {
  SCHEDULING_EVENT_TYPES,
  SCHEDULING_PRESETS,
  getDefaultSchedulingPresetForBusinessModel,
  getSchedulingSectionDefinition,
  sanitizeSchedulingSectionLabel,
} from '@/lib/scheduling/schedulingPresetRegistry'
import { normalizeSchedulingTimezone } from '@/lib/scheduling/schedulingTimezones'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'

const calendarViews: SchedulingCalendarView[] = [
  'day',
  'week',
  'month',
  'agenda',
]
const sectionKeys = new Set<SchedulingSectionKey>(
  Object.values(SCHEDULING_PRESETS).flatMap(
    (preset) => preset.supportedSections,
  ),
)
const linkedRecordRequirements = new Set<SchedulingLinkedRecordRequirement>([
  'notAllowed',
  'optional',
  'required',
])
const locationRequirements = new Set<SchedulingLocationRequirement>([
  'notAllowed',
  'optional',
  'required',
])
const locationTypes = new Set<SchedulingLocationType>([
  'none',
  'toBeDetermined',
  'physicalAddress',
  'customerLocation',
  'workspaceLocation',
  'videoMeeting',
  'phoneCall',
  'other',
])
const eventTypeKeys = new Set<SchedulingEventType>(
  Object.keys(SCHEDULING_EVENT_TYPES) as SchedulingEventType[],
)
const notificationCategories = new Set([
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
])
const notificationChannels = new Set(['inApp', 'email'])
const reminderRecipientGroups = new Set([
  'assignedMembers',
  'organizer',
  'externalAttendees',
  'linkedContact',
])
const calendarVisibilityModes = new Set([
  'BUSY_ONLY',
  'TITLE_ONLY',
  'FULL_DETAILS',
])
const personalCalendarModes = new Set([
  'DISABLED',
  'OWNER_ONLY',
  'SELECTED_MEMBERS',
  'SELECTED_ROLES',
  'ALL_MEMBERS',
])
const personalCalendarAvailabilityBehaviors = new Set([
  'IGNORE',
  'SUGGEST_CONFLICTS',
  'BLOCK_AVAILABILITY',
])
const personalCalendarBusyDisplayModes = new Set([
  'HIDDEN',
  'MEMBER_DETAIL_ONLY',
  'EXPANDABLE_EXTERNAL_AVAILABILITY',
  'VISIBLE_IN_BUSY',
])
const personalCalendarApproverModes = new Set([
  'OWNER_ONLY',
  'OWNERS_AND_ADMINS',
  'SELECTED_ROLES',
  'SELECTED_MEMBERS',
])
const businessDomainStatuses = new Set([
  'verified',
  'adminConfirmed',
  'unverified',
])
const workspaceRoleKeys = new Set(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'])

export const defaultWorkspaceCalendarConnectionPolicy: WorkspaceCalendarConnectionPolicy =
  {
    allowMemberConnections: false,
    allowMultipleAccountsPerMember: true,
    allowWorkspaceConnections: true,
    requireMemberConnectionApproval: true,
    allowMemberTwoWaySync: false,
    allowMemberWriteOnlySync: false,
    allowMemberReadOnlySync: true,
    includeMemberCalendarsInBusy: true,
    defaultMemberVisibilityMode: 'BUSY_ONLY',
    defaultWorkspaceVisibilityMode: 'TITLE_ONLY',
    allowMemberVisibilityOverride: false,
    allowAdminDisableMemberConnections: true,
    notifyAdminsOnConnectionRequest: true,
    notifyAdminsOnOwnerDeparture: true,
    personalCalendarMode: 'DISABLED',
    personalCalendarAllowedMemberIds: [],
    personalCalendarAllowedRoleKeys: [],
    personalCalendarDeniedMemberIds: [],
    personalCalendarApprovalRequired: true,
    personalCalendarApproverMode: 'OWNER_ONLY',
    personalCalendarApproverMemberIds: [],
    personalCalendarApproverRoleKeys: [],
    ownerPersonalCalendarAllowed: false,
    allowPersonalCalendarSelfApproval: false,
    personalCalendarAvailabilityBehavior: 'SUGGEST_CONFLICTS',
    personalCalendarBusyDisplayMode: 'HIDDEN',
    personalCalendarDefaultVisibilityMode: 'BUSY_ONLY',
    allowMembersToRequestPersonalCalendarAccess: true,
    hidePersonalCalendarControlsWhenNotAllowed: true,
    treatPersonalEventsAsOfficialTimeOff: false,
    workCalendarApprovalRequired: false,
    requireVerifiedBusinessDomainForWorkCalendars: false,
    unknownCalendarApprovalRequired: true,
    workspaceBusinessDomains: [],
  }

export type WorkspaceSchedulingSettingsInput =
  | Partial<WorkspaceSchedulingSettings>
  | null
  | undefined

function isSchedulingPreset(value: unknown): value is SchedulingPreset {
  return typeof value === 'string' && value in SCHEDULING_PRESETS
}

function isCalendarView(value: unknown): value is SchedulingCalendarView {
  return (
    typeof value === 'string' &&
    calendarViews.includes(value as SchedulingCalendarView)
  )
}

function uniqueSections(values: unknown): SchedulingSectionKey[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<SchedulingSectionKey>()
  values.forEach((value) => {
    if (typeof value !== 'string') return
    const key = value as SchedulingSectionKey
    if (!sectionKeys.has(key) || seen.has(key)) return
    seen.add(key)
  })
  return [...seen]
}

function normalizeEventTypePreferences(
  values: unknown,
): WorkspaceSchedulingEventTypePreference[] | undefined {
  if (!Array.isArray(values)) return undefined
  const seen = new Set<SchedulingEventType>()
  return values
    .map((value, index) => {
      if (!value || typeof value !== 'object') return null
      const record = value as Partial<WorkspaceSchedulingEventTypePreference>
      if (
        !record.key ||
        !eventTypeKeys.has(record.key) ||
        seen.has(record.key)
      ) {
        return null
      }
      seen.add(record.key)
      return {
        key: record.key,
        isVisible: record.isVisible !== false,
        sortOrder:
          typeof record.sortOrder === 'number' &&
          Number.isFinite(record.sortOrder)
            ? record.sortOrder
            : index,
        defaultDurationMinutes:
          typeof record.defaultDurationMinutes === 'number' &&
          record.defaultDurationMinutes > 0
            ? Math.round(record.defaultDurationMinutes)
            : undefined,
      }
    })
    .filter(Boolean) as WorkspaceSchedulingEventTypePreference[]
}

function normalizeCustomEventTypes(
  values: unknown,
  workspaceId = '',
): WorkspaceSchedulingCustomEventType[] | undefined {
  if (!Array.isArray(values)) return undefined
  return values
    .map((value, index) => {
      if (!value || typeof value !== 'object') return null
      const record = value as Partial<WorkspaceSchedulingCustomEventType>
      const label = record.label?.trim()
      if (!label) return null
      const sections = uniqueSections(record.sectionKeys)
      const presetScope = Array.isArray(record.presetScope)
        ? record.presetScope.filter(isSchedulingPreset)
        : []
      const now = new Date().toISOString()
      return {
        id: record.id?.trim() || `custom-event-type-${index}`,
        workspaceId: record.workspaceId?.trim() || workspaceId,
        key:
          record.key?.trim() ||
          `custom.${label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')}`,
        label,
        description: record.description?.trim() || undefined,
        presetScope: presetScope.length
          ? presetScope
          : ['service', 'consultative', 'commerce'],
        sectionKeys: sections.length ? sections : ['calendar'],
        defaultDurationMinutes:
          typeof record.defaultDurationMinutes === 'number' &&
          record.defaultDurationMinutes > 0
            ? Math.round(record.defaultDurationMinutes)
            : undefined,
        blocksAvailability: record.blocksAvailability !== false,
        requiresLinkedRecord: record.requiresLinkedRecord === true,
        linkedRecordRequirement: linkedRecordRequirements.has(
          record.linkedRecordRequirement as SchedulingLinkedRecordRequirement,
        )
          ? (record.linkedRecordRequirement as SchedulingLinkedRecordRequirement)
          : record.requiresLinkedRecord === true
            ? 'required'
            : Array.isArray(record.supportedLinkedRecordTypes) &&
                record.supportedLinkedRecordTypes.length
              ? 'optional'
              : 'notAllowed',
        warnWhenUnlinked:
          typeof record.warnWhenUnlinked === 'boolean'
            ? record.warnWhenUnlinked
            : undefined,
        supportedLinkedRecordTypes: Array.isArray(
          record.supportedLinkedRecordTypes,
        )
          ? record.supportedLinkedRecordTypes
          : [],
        locationRequirement: locationRequirements.has(
          record.locationRequirement as SchedulingLocationRequirement,
        )
          ? (record.locationRequirement as SchedulingLocationRequirement)
          : 'optional',
        allowedLocationTypes: Array.isArray(record.allowedLocationTypes)
          ? record.allowedLocationTypes.filter(
              (type): type is SchedulingLocationType =>
                locationTypes.has(type as SchedulingLocationType),
            )
          : ['none'],
        defaultLocationType: locationTypes.has(
          record.defaultLocationType as SchedulingLocationType,
        )
          ? (record.defaultLocationType as SchedulingLocationType)
          : 'none',
        allowUndeterminedLocation: record.allowUndeterminedLocation === true,
        isActive: record.isActive !== false,
        isSystem: false,
        sortOrder:
          typeof record.sortOrder === 'number' &&
          Number.isFinite(record.sortOrder)
            ? record.sortOrder
            : index,
        createdAt: record.createdAt ?? now,
        updatedAt: record.updatedAt ?? now,
      }
    })
    .filter(Boolean) as WorkspaceSchedulingCustomEventType[]
}

function normalizeSectionLabelOverrides(
  values: unknown,
  supportedSections: Set<SchedulingSectionKey>,
) {
  if (!values || typeof values !== 'object') return undefined
  const entries = Object.entries(values as Record<string, unknown>)
    .map(([key, value]) => {
      const section = key as SchedulingSectionKey
      if (!supportedSections.has(section)) return null
      const label = sanitizeSchedulingSectionLabel(value)
      if (!label) return null
      const definition = getSchedulingSectionDefinition(section)
      if (label === definition.label || label === definition.shortLabel)
        return null
      return [section, label] as const
    })
    .filter(Boolean) as Array<readonly [SchedulingSectionKey, string]>
  return entries.length
    ? (Object.fromEntries(
        entries,
      ) as WorkspaceSchedulingSettings['sectionLabelOverrides'])
    : undefined
}

function normalizeTimeInput(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback
}

function normalizeReminderInputs(values: unknown) {
  if (!Array.isArray(values)) return undefined
  const normalized = values
    .map((value) => {
      if (!value || typeof value !== 'object') return null
      const record = value as {
        offsetMinutes?: unknown
        channel?: unknown
        recipientGroup?: unknown
      }
      if (
        typeof record.offsetMinutes !== 'number' ||
        !Number.isFinite(record.offsetMinutes)
      ) {
        return null
      }
      const offsetMinutes = Math.round(record.offsetMinutes)
      if (offsetMinutes < 0 || offsetMinutes > 10_080) return null
      if (!notificationChannels.has(String(record.channel))) return null
      if (!reminderRecipientGroups.has(String(record.recipientGroup)))
        return null
      return {
        offsetMinutes,
        channel: record.channel as 'inApp' | 'email',
        recipientGroup: record.recipientGroup as
          | 'assignedMembers'
          | 'organizer'
          | 'externalAttendees'
          | 'linkedContact',
      }
    })
    .filter(Boolean)
  return normalized.length
    ? (normalized as WorkspaceSchedulingNotificationPreferences['defaultReminders'])
    : undefined
}

function normalizeNotificationCategorySettings(values: unknown) {
  if (!values || typeof values !== 'object') return undefined
  const entries = Object.entries(values as Record<string, unknown>)
    .map(([category, value]) => {
      if (!notificationCategories.has(category)) return null
      if (!value || typeof value !== 'object') return null
      const record = value as {
        enabled?: unknown
        inAppEnabled?: unknown
        emailEnabled?: unknown
      }
      return [
        category,
        {
          enabled:
            typeof record.enabled === 'boolean' ? record.enabled : undefined,
          inAppEnabled:
            typeof record.inAppEnabled === 'boolean'
              ? record.inAppEnabled
              : undefined,
          emailEnabled:
            typeof record.emailEnabled === 'boolean'
              ? record.emailEnabled
              : undefined,
        },
      ] as const
    })
    .filter(
      (
        entry,
      ): entry is readonly [
        string,
        {
          readonly enabled: boolean | undefined
          readonly inAppEnabled: boolean | undefined
          readonly emailEnabled: boolean | undefined
        },
      ] => entry !== null,
    )
  return entries.length ? Object.fromEntries(entries) : undefined
}

function normalizeSchedulingNotificationPreferences(
  values: unknown,
  timezone: string,
): WorkspaceSchedulingNotificationPreferences {
  const input =
    values && typeof values === 'object'
      ? (values as Partial<WorkspaceSchedulingNotificationPreferences>)
      : {}
  const quietHours =
    input.quietHours && typeof input.quietHours === 'object'
      ? {
          enabled: input.quietHours.enabled === true,
          startTime: normalizeTimeInput(input.quietHours.startTime, '22:00'),
          endTime: normalizeTimeInput(input.quietHours.endTime, '07:00'),
          timezone: normalizeSchedulingTimezone({
            timezone: input.quietHours.timezone,
            workspaceTimezone: timezone,
            fallbackTimezone: timezone,
          }),
          allowUrgentBypass: input.quietHours.allowUrgentBypass !== false,
        }
      : undefined
  return {
    schedulingEnabled: input.schedulingEnabled !== false,
    inAppEnabled: input.inAppEnabled !== false,
    emailEnabled: input.emailEnabled === true,
    categorySettings: normalizeNotificationCategorySettings(
      input.categorySettings,
    ),
    quietHours,
    defaultReminders: normalizeReminderInputs(input.defaultReminders) ?? [
      {
        offsetMinutes: 30,
        channel: 'inApp',
        recipientGroup: 'assignedMembers',
      },
    ],
    externalAttendeesEnabled: input.externalAttendeesEnabled === true,
    linkedClientsEnabled: input.linkedClientsEnabled === true,
    organizerCopiesEnabled: input.organizerCopiesEnabled !== false,
    deliveryFailureAlertsEnabled: input.deliveryFailureAlertsEnabled !== false,
    notificationSystemActivatedAt:
      typeof input.notificationSystemActivatedAt === 'string'
        ? input.notificationSystemActivatedAt
        : undefined,
  }
}

function normalizeCalendarVisibilityMode(
  value: unknown,
  fallback: WorkspaceCalendarConnectionPolicy['defaultMemberVisibilityMode'],
) {
  return calendarVisibilityModes.has(String(value))
    ? (value as WorkspaceCalendarConnectionPolicy['defaultMemberVisibilityMode'])
    : fallback
}

function normalizeStringList(values: unknown) {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  values.forEach((value) => {
    if (typeof value !== 'string') return
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
  })
  return [...seen]
}

function normalizeWorkspaceRoleKeys(values: unknown) {
  return normalizeStringList(values)
    .map((value) => value.toUpperCase())
    .filter((value) => workspaceRoleKeys.has(value))
}

function normalizeBusinessDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/[^a-z0-9.-]/g, '')
}

function normalizeWorkspaceBusinessDomains(values: unknown) {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  return values
    .map((value) => {
      if (!value || typeof value !== 'object') return null
      const record = value as {
        domain?: unknown
        status?: unknown
        primary?: unknown
      }
      if (typeof record.domain !== 'string') return null
      const domain = normalizeBusinessDomain(record.domain)
      if (!domain || !domain.includes('.') || seen.has(domain)) return null
      seen.add(domain)
      return {
        domain,
        status: businessDomainStatuses.has(String(record.status))
          ? (record.status as 'verified' | 'adminConfirmed' | 'unverified')
          : 'adminConfirmed',
        primary: record.primary === true,
      }
    })
    .filter(
      Boolean,
    ) as WorkspaceCalendarConnectionPolicy['workspaceBusinessDomains']
}

export function normalizeWorkspaceCalendarConnectionPolicy(
  value: unknown,
): WorkspaceCalendarConnectionPolicy {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<WorkspaceCalendarConnectionPolicy>)
      : {}
  const allowMemberConnections =
    typeof input.allowMemberConnections === 'boolean'
      ? input.allowMemberConnections
      : defaultWorkspaceCalendarConnectionPolicy.allowMemberConnections
  const allowMemberReadOnlySync =
    typeof input.allowMemberReadOnlySync === 'boolean'
      ? input.allowMemberReadOnlySync
      : defaultWorkspaceCalendarConnectionPolicy.allowMemberReadOnlySync
  const allowMemberTwoWaySync =
    allowMemberConnections && input.allowMemberTwoWaySync === true
  const allowMemberWriteOnlySync =
    allowMemberConnections && input.allowMemberWriteOnlySync === true
  const personalCalendarMode = personalCalendarModes.has(
    String(input.personalCalendarMode),
  )
    ? (input.personalCalendarMode as WorkspaceCalendarConnectionPolicy['personalCalendarMode'])
    : defaultWorkspaceCalendarConnectionPolicy.personalCalendarMode
  const personalCalendarAvailabilityBehavior =
    personalCalendarAvailabilityBehaviors.has(
      String(input.personalCalendarAvailabilityBehavior),
    )
      ? (input.personalCalendarAvailabilityBehavior as WorkspaceCalendarConnectionPolicy['personalCalendarAvailabilityBehavior'])
      : defaultWorkspaceCalendarConnectionPolicy.personalCalendarAvailabilityBehavior
  const personalCalendarBusyDisplayMode = personalCalendarBusyDisplayModes.has(
    String(input.personalCalendarBusyDisplayMode),
  )
    ? (input.personalCalendarBusyDisplayMode as WorkspaceCalendarConnectionPolicy['personalCalendarBusyDisplayMode'])
    : defaultWorkspaceCalendarConnectionPolicy.personalCalendarBusyDisplayMode
  const personalCalendarApproverMode = personalCalendarApproverModes.has(
    String(input.personalCalendarApproverMode),
  )
    ? (input.personalCalendarApproverMode as WorkspaceCalendarConnectionPolicy['personalCalendarApproverMode'])
    : defaultWorkspaceCalendarConnectionPolicy.personalCalendarApproverMode
  return {
    allowMemberConnections,
    allowMultipleAccountsPerMember:
      typeof input.allowMultipleAccountsPerMember === 'boolean'
        ? input.allowMultipleAccountsPerMember
        : defaultWorkspaceCalendarConnectionPolicy.allowMultipleAccountsPerMember,
    allowWorkspaceConnections:
      typeof input.allowWorkspaceConnections === 'boolean'
        ? input.allowWorkspaceConnections
        : defaultWorkspaceCalendarConnectionPolicy.allowWorkspaceConnections,
    requireMemberConnectionApproval:
      typeof input.requireMemberConnectionApproval === 'boolean'
        ? input.requireMemberConnectionApproval
        : defaultWorkspaceCalendarConnectionPolicy.requireMemberConnectionApproval,
    allowMemberTwoWaySync,
    allowMemberWriteOnlySync,
    allowMemberReadOnlySync,
    includeMemberCalendarsInBusy:
      typeof input.includeMemberCalendarsInBusy === 'boolean'
        ? input.includeMemberCalendarsInBusy
        : defaultWorkspaceCalendarConnectionPolicy.includeMemberCalendarsInBusy,
    defaultMemberVisibilityMode: normalizeCalendarVisibilityMode(
      input.defaultMemberVisibilityMode,
      defaultWorkspaceCalendarConnectionPolicy.defaultMemberVisibilityMode,
    ),
    defaultWorkspaceVisibilityMode: normalizeCalendarVisibilityMode(
      input.defaultWorkspaceVisibilityMode,
      defaultWorkspaceCalendarConnectionPolicy.defaultWorkspaceVisibilityMode,
    ),
    allowMemberVisibilityOverride:
      allowMemberConnections && input.allowMemberVisibilityOverride === true,
    allowAdminDisableMemberConnections:
      typeof input.allowAdminDisableMemberConnections === 'boolean'
        ? input.allowAdminDisableMemberConnections
        : defaultWorkspaceCalendarConnectionPolicy.allowAdminDisableMemberConnections,
    notifyAdminsOnConnectionRequest:
      typeof input.notifyAdminsOnConnectionRequest === 'boolean'
        ? input.notifyAdminsOnConnectionRequest
        : defaultWorkspaceCalendarConnectionPolicy.notifyAdminsOnConnectionRequest,
    notifyAdminsOnOwnerDeparture:
      typeof input.notifyAdminsOnOwnerDeparture === 'boolean'
        ? input.notifyAdminsOnOwnerDeparture
        : defaultWorkspaceCalendarConnectionPolicy.notifyAdminsOnOwnerDeparture,
    personalCalendarMode,
    personalCalendarAllowedMemberIds: normalizeStringList(
      input.personalCalendarAllowedMemberIds,
    ),
    personalCalendarAllowedRoleKeys: normalizeWorkspaceRoleKeys(
      input.personalCalendarAllowedRoleKeys,
    ),
    personalCalendarDeniedMemberIds: normalizeStringList(
      input.personalCalendarDeniedMemberIds,
    ),
    personalCalendarApprovalRequired:
      typeof input.personalCalendarApprovalRequired === 'boolean'
        ? input.personalCalendarApprovalRequired
        : defaultWorkspaceCalendarConnectionPolicy.personalCalendarApprovalRequired,
    personalCalendarApproverMode,
    personalCalendarApproverMemberIds: normalizeStringList(
      input.personalCalendarApproverMemberIds,
    ),
    personalCalendarApproverRoleKeys: normalizeWorkspaceRoleKeys(
      input.personalCalendarApproverRoleKeys,
    ),
    ownerPersonalCalendarAllowed: input.ownerPersonalCalendarAllowed === true,
    allowPersonalCalendarSelfApproval:
      input.allowPersonalCalendarSelfApproval === true,
    personalCalendarAvailabilityBehavior,
    personalCalendarBusyDisplayMode,
    personalCalendarDefaultVisibilityMode: normalizeCalendarVisibilityMode(
      input.personalCalendarDefaultVisibilityMode,
      defaultWorkspaceCalendarConnectionPolicy.personalCalendarDefaultVisibilityMode,
    ),
    allowMembersToRequestPersonalCalendarAccess:
      input.allowMembersToRequestPersonalCalendarAccess !== false,
    hidePersonalCalendarControlsWhenNotAllowed:
      input.hidePersonalCalendarControlsWhenNotAllowed !== false,
    treatPersonalEventsAsOfficialTimeOff: false,
    workCalendarApprovalRequired: input.workCalendarApprovalRequired === true,
    requireVerifiedBusinessDomainForWorkCalendars:
      input.requireVerifiedBusinessDomainForWorkCalendars === true,
    unknownCalendarApprovalRequired:
      input.unknownCalendarApprovalRequired !== false,
    workspaceBusinessDomains: normalizeWorkspaceBusinessDomains(
      input.workspaceBusinessDomains,
    ),
  }
}

export function normalizeSchedulingSettings({
  businessModel,
  settings,
  workspaceTimezone,
}: {
  businessModel: WorkspaceBusinessModel | string
  settings?: WorkspaceSchedulingSettingsInput
  workspaceTimezone?: string | null
}): WorkspaceSchedulingSettings {
  const defaultPreset =
    getDefaultSchedulingPresetForBusinessModel(businessModel)
  const preset = isSchedulingPreset(settings?.preset)
    ? settings.preset
    : defaultPreset
  const presetDefinition = SCHEDULING_PRESETS[preset]
  const supported = new Set(presetDefinition.supportedSections)
  const savedVisible = uniqueSections(settings?.visibleSections).filter(
    (section) => supported.has(section),
  )
  const visibleSections: SchedulingSectionKey[] = savedVisible.length
    ? savedVisible
    : presetDefinition.defaultVisibleSections

  const normalizedVisibleSections: SchedulingSectionKey[] =
    visibleSections.includes('calendar')
      ? visibleSections
      : (['calendar', ...visibleSections] as SchedulingSectionKey[]).filter(
          (section) => supported.has(section),
        )

  const timezone = normalizeSchedulingTimezone({
    timezone: settings?.timezone,
    workspaceTimezone,
    fallbackTimezone: 'America/New_York',
  })

  return {
    enabled:
      typeof settings?.enabled === 'boolean'
        ? settings.enabled
        : presetDefinition.defaultEnabled,
    preset,
    visibleSections: normalizedVisibleSections,
    defaultCalendarView: isCalendarView(settings?.defaultCalendarView)
      ? settings.defaultCalendarView
      : 'week',
    weekStartsOn: settings?.weekStartsOn === 1 ? 1 : 0,
    timezone,
    sectionLabelOverrides: normalizeSectionLabelOverrides(
      settings?.sectionLabelOverrides,
      supported,
    ),
    eventTypePreferences: normalizeEventTypePreferences(
      settings?.eventTypePreferences,
    ),
    customEventTypes: normalizeCustomEventTypes(settings?.customEventTypes),
    notificationPreferences: normalizeSchedulingNotificationPreferences(
      settings?.notificationPreferences,
      timezone,
    ),
    calendarConnectionPolicy: normalizeWorkspaceCalendarConnectionPolicy(
      settings?.calendarConnectionPolicy,
    ),
  }
}

export function mergeSchedulingVisibility({
  current,
  nextVisibleSections,
  supportedSections,
}: {
  current: WorkspaceSchedulingSettings
  nextVisibleSections: SchedulingSectionKey[]
  supportedSections: SchedulingSectionKey[]
}): WorkspaceSchedulingSettings {
  const supported = new Set(supportedSections)
  const unique = Array.from(new Set(nextVisibleSections)).filter((section) =>
    supported.has(section),
  )
  const visibleSections: SchedulingSectionKey[] = unique.includes('calendar')
    ? unique
    : (['calendar', ...unique] as SchedulingSectionKey[])
  return {
    ...current,
    visibleSections,
  }
}
