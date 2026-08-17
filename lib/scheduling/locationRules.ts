import {
  getSchedulingEventTypeDefinition,
  type SchedulingEventTypeDefinition,
} from '@/lib/scheduling/schedulingPresetRegistry'
import type {
  SchedulingEvent,
  SchedulingEventType,
  SchedulingLocationRequirement,
  SchedulingLocationType,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export type SchedulingLocationDraft = {
  locationType?: string | null
  location?: string | null
  locationLabel?: string | null
  locationAddress?: string | null
  meetingUrl?: string | null
  phoneNumber?: string | null
}

export const undeterminedLocationLabel = 'To be determined'

export const schedulingLocationTypes: SchedulingLocationType[] = [
  'none',
  'toBeDetermined',
  'physicalAddress',
  'customerLocation',
  'workspaceLocation',
  'videoMeeting',
  'phoneCall',
  'other',
]

const locationTypeLabels: Record<SchedulingLocationType, string> = {
  none: 'None',
  toBeDetermined: 'To be determined',
  physicalAddress: 'Physical address',
  customerLocation: 'Customer location',
  workspaceLocation: 'Workspace location',
  videoMeeting: 'Video meeting',
  phoneCall: 'Phone call',
  other: 'Other',
}

export function formatSchedulingLocationType(type?: string | null) {
  return locationTypeLabels[normalizeSchedulingLocationType(type)] ?? 'Location'
}

export function normalizeSchedulingLocationType(
  value: unknown,
): SchedulingLocationType {
  if (
    typeof value === 'string' &&
    schedulingLocationTypes.includes(value as SchedulingLocationType)
  ) {
    return value as SchedulingLocationType
  }
  return 'none'
}

function resolveDefinitionLocationRequirement(
  definition: SchedulingEventTypeDefinition,
): SchedulingLocationRequirement {
  if (definition.locationRequirement) return definition.locationRequirement
  if (definition.requiresLocation) return 'required'
  return 'optional'
}

export function resolveSchedulingLocationRule({
  eventType,
  settings,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
}): {
  requirement: SchedulingLocationRequirement
  allowedLocationTypes: SchedulingLocationType[]
  defaultLocationType: SchedulingLocationType
  allowUndeterminedLocation: boolean
} {
  const customType = (settings.customEventTypes ?? []).find(
    (candidate) => candidate.key === eventType,
  )
  if (customType) {
    const requirement = customType.locationRequirement ?? 'optional'
    const allowed: SchedulingLocationType[] = (
      customType.allowedLocationTypes?.length
        ? customType.allowedLocationTypes
        : requirement === 'notAllowed'
          ? (['none'] as SchedulingLocationType[])
          : schedulingLocationTypes
    ).filter((type): type is SchedulingLocationType =>
      schedulingLocationTypes.includes(type as SchedulingLocationType),
    )
    const allowUndeterminedLocation =
      customType.allowUndeterminedLocation === true &&
      requirement !== 'notAllowed'
    const normalizedAllowed: SchedulingLocationType[] =
      requirement === 'notAllowed'
        ? ['none']
        : allowUndeterminedLocation
          ? allowed
          : allowed.filter((type) => type !== 'toBeDetermined')
    const effectiveAllowed =
      allowUndeterminedLocation && !normalizedAllowed.includes('toBeDetermined')
        ? (['toBeDetermined', ...normalizedAllowed] as SchedulingLocationType[])
        : normalizedAllowed
    const requestedDefault = normalizeSchedulingLocationType(
      customType.defaultLocationType,
    )
    return {
      requirement,
      allowedLocationTypes: effectiveAllowed.includes('none')
        ? effectiveAllowed
        : requirement === 'optional'
          ? (['none', ...effectiveAllowed] as SchedulingLocationType[])
          : effectiveAllowed,
      defaultLocationType: effectiveAllowed.includes(requestedDefault)
        ? requestedDefault
        : requirement === 'required'
          ? (effectiveAllowed.find((type) => type !== 'none') ?? 'other')
          : 'none',
      allowUndeterminedLocation,
    }
  }

  const definition = getSchedulingEventTypeDefinition(eventType)
  const requirement = resolveDefinitionLocationRequirement(definition)
  const allowed: SchedulingLocationType[] = definition.allowedLocationTypes
    ?.length
    ? definition.allowedLocationTypes
    : requirement === 'notAllowed'
      ? (['none'] as SchedulingLocationType[])
      : schedulingLocationTypes
  const normalizedAllowed: SchedulingLocationType[] =
    requirement === 'notAllowed'
      ? ['none']
      : requirement === 'optional' && !allowed.includes('none')
        ? (['none', ...allowed] as SchedulingLocationType[])
        : allowed
  const allowUndeterminedLocation =
    definition.allowUndeterminedLocation === true &&
    requirement !== 'notAllowed'
  const policyAllowed = allowUndeterminedLocation
    ? normalizedAllowed
    : normalizedAllowed.filter((type) => type !== 'toBeDetermined')
  const effectiveAllowed =
    allowUndeterminedLocation && !policyAllowed.includes('toBeDetermined')
      ? (['toBeDetermined', ...policyAllowed] as SchedulingLocationType[])
      : policyAllowed
  const requestedDefault = normalizeSchedulingLocationType(
    definition.defaultLocationType,
  )
  return {
    requirement,
    allowedLocationTypes: effectiveAllowed,
    defaultLocationType: effectiveAllowed.includes(requestedDefault)
      ? requestedDefault
      : requirement === 'required'
        ? (effectiveAllowed.find((type) => type !== 'none') ?? 'other')
        : 'none',
    allowUndeterminedLocation,
  }
}

function clean(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidMeetingUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function getSchedulingLocationDisplay(
  location?: SchedulingLocationDraft | null,
) {
  if (!location) return null
  const type = normalizeSchedulingLocationType(location.locationType)
  if (type === 'none') return null
  if (type === 'toBeDetermined') return undeterminedLocationLabel
  if (type === 'videoMeeting') return clean(location.meetingUrl)
  if (type === 'phoneCall') return clean(location.phoneNumber)
  if (type === 'physicalAddress' || type === 'customerLocation') {
    return clean(location.locationAddress) || clean(location.locationLabel)
  }
  return (
    clean(location.locationLabel) ||
    clean(location.locationAddress) ||
    clean(location.location) ||
    clean(location.meetingUrl) ||
    clean(location.phoneNumber)
  )
}

export function normalizeSchedulingLocation({
  eventType,
  settings,
  location,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  location?: SchedulingLocationDraft | null
}): Pick<
  SchedulingEvent,
  | 'location'
  | 'locationType'
  | 'locationLabel'
  | 'locationAddress'
  | 'meetingUrl'
  | 'phoneNumber'
> {
  const rule = resolveSchedulingLocationRule({ eventType, settings })
  const requestedType = normalizeSchedulingLocationType(location?.locationType)
  const locationType =
    rule.requirement === 'notAllowed'
      ? 'none'
      : rule.allowedLocationTypes.includes(requestedType)
        ? requestedType
        : rule.defaultLocationType
  if (locationType === 'none') {
    return {
      location: undefined,
      locationType: 'none',
      locationLabel: undefined,
      locationAddress: undefined,
      meetingUrl: undefined,
      phoneNumber: undefined,
    }
  }
  if (locationType === 'toBeDetermined') {
    return {
      location: undeterminedLocationLabel,
      locationType,
      locationLabel: undeterminedLocationLabel,
      locationAddress: undefined,
      meetingUrl: undefined,
      phoneNumber: undefined,
    }
  }

  const locationLabel =
    clean(location?.locationLabel) || clean(location?.location)
  const locationAddress = clean(location?.locationAddress)
  const meetingUrl = clean(location?.meetingUrl)
  const phoneNumber = clean(location?.phoneNumber)
  const display = getSchedulingLocationDisplay({
    locationType,
    location: location?.location,
    locationLabel,
    locationAddress,
    meetingUrl,
    phoneNumber,
  })

  return {
    location: display ?? undefined,
    locationType,
    locationLabel: locationLabel || undefined,
    locationAddress: locationAddress || undefined,
    meetingUrl: meetingUrl || undefined,
    phoneNumber: phoneNumber || undefined,
  }
}

export function validateSchedulingLocation({
  eventType,
  settings,
  location,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  location?: SchedulingLocationDraft | null
}): { valid: true } | { valid: false; message: string } {
  const rule = resolveSchedulingLocationRule({ eventType, settings })
  const type = normalizeSchedulingLocationType(location?.locationType)
  if (rule.requirement === 'notAllowed') {
    return { valid: true }
  }
  if (!rule.allowedLocationTypes.includes(type)) {
    return {
      valid: false,
      message: 'Choose a supported location type for this event.',
    }
  }
  if (rule.requirement === 'required' && type === 'none') {
    return {
      valid: false,
      message: 'Select a location for this event type.',
    }
  }
  if (type === 'toBeDetermined') {
    if (!rule.allowUndeterminedLocation) {
      return {
        valid: false,
        message: 'Choose a confirmed location for this event type.',
      }
    }
    return { valid: true }
  }
  if (type === 'physicalAddress') {
    if (!clean(location?.locationAddress) && !clean(location?.locationLabel)) {
      return {
        valid: false,
        message: 'Enter a physical address for this event.',
      }
    }
  }
  if (type === 'customerLocation') {
    if (!clean(location?.locationAddress) && !clean(location?.locationLabel)) {
      return {
        valid: false,
        message: 'Enter or confirm the customer location.',
      }
    }
  }
  if (
    type === 'videoMeeting' &&
    (rule.requirement === 'required' || clean(location?.meetingUrl))
  ) {
    if (!isValidMeetingUrl(clean(location?.meetingUrl))) {
      return {
        valid: false,
        message: 'Enter a valid meeting link.',
      }
    }
  }
  if (type === 'other' && rule.requirement === 'required') {
    if (!clean(location?.locationLabel)) {
      return {
        valid: false,
        message: 'Enter a location label.',
      }
    }
  }
  return { valid: true }
}
