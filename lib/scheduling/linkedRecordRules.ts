import {
  getSchedulingEventTypeDefinition,
  type SchedulingEventTypeDefinition,
} from '@/lib/scheduling/schedulingPresetRegistry'
import { getSupportedLinkedRecordTypes } from '@/lib/scheduling/schedulingWorkspaceData'
import type {
  SchedulingCapabilities,
  SchedulingEvent,
  SchedulingEventType,
  SchedulingLinkedRecordRequirement,
  SchedulingLinkedRecordType,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export type SchedulingLinkedRecordDraft = {
  recordType?: string | null
  recordId?: string | null
  label?: string | null
}

const optionalSystemEventTypesThatWarn = new Set<string>([
  'discoveryCall',
  'consultation',
])

function hasLinkedRecord(linkedRecord?: SchedulingLinkedRecordDraft | null) {
  return Boolean(
    linkedRecord?.recordType?.trim() &&
    linkedRecord.recordId?.trim() &&
    linkedRecord.label?.trim(),
  )
}

function resolveSystemRequirement(
  definition: SchedulingEventTypeDefinition,
): SchedulingLinkedRecordRequirement {
  if (definition.linkedRecordRequirement)
    return definition.linkedRecordRequirement
  if (definition.requiresLinkedRecord) return 'required'
  if (optionalSystemEventTypesThatWarn.has(definition.key)) return 'optional'
  return 'notAllowed'
}

export function resolveSchedulingLinkedRecordRule({
  eventType,
  settings,
  capabilities,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  capabilities?: SchedulingCapabilities
}): {
  requirement: SchedulingLinkedRecordRequirement
  supportedLinkedRecordTypes: SchedulingLinkedRecordType[]
  warnWhenUnlinked: boolean
} {
  const customType = (settings.customEventTypes ?? []).find(
    (candidate) => candidate.key === eventType,
  )
  const workspaceSupportedTypes = capabilities
    ? getSupportedLinkedRecordTypes(capabilities)
    : []

  if (customType) {
    const supportedLinkedRecordTypes = customType.supportedLinkedRecordTypes
      .length
      ? customType.supportedLinkedRecordTypes.filter((recordType) =>
          workspaceSupportedTypes.length
            ? workspaceSupportedTypes.includes(recordType)
            : true,
        )
      : workspaceSupportedTypes
    const requirement =
      customType.linkedRecordRequirement ??
      (customType.requiresLinkedRecord
        ? 'required'
        : supportedLinkedRecordTypes.length
          ? 'optional'
          : 'notAllowed')

    return {
      requirement,
      supportedLinkedRecordTypes:
        requirement === 'notAllowed' ? [] : supportedLinkedRecordTypes,
      warnWhenUnlinked:
        customType.warnWhenUnlinked ??
        (requirement === 'optional' && supportedLinkedRecordTypes.length > 0),
    }
  }

  const definition = getSchedulingEventTypeDefinition(eventType)
  const requirement = resolveSystemRequirement(definition)
  return {
    requirement,
    supportedLinkedRecordTypes:
      requirement === 'notAllowed' ? [] : workspaceSupportedTypes,
    warnWhenUnlinked:
      definition.warnWhenUnlinked ??
      (requirement === 'optional' &&
        optionalSystemEventTypesThatWarn.has(definition.key)),
  }
}

export function normalizeSchedulingLinkedRecord(
  linkedRecord?: SchedulingLinkedRecordDraft | null,
): SchedulingEvent['linkedRecord'] | null {
  if (!hasLinkedRecord(linkedRecord)) return null
  return {
    recordType: linkedRecord?.recordType?.trim() as SchedulingLinkedRecordType,
    recordId: linkedRecord?.recordId?.trim() ?? '',
    label: linkedRecord?.label?.trim() ?? '',
  }
}

export function validateSchedulingLinkedRecord({
  eventType,
  settings,
  capabilities,
  linkedRecord,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  capabilities?: SchedulingCapabilities
  linkedRecord?: SchedulingLinkedRecordDraft | null
}): { valid: true } | { valid: false; message: string } {
  const rule = resolveSchedulingLinkedRecordRule({
    eventType,
    settings,
    capabilities,
  })
  const normalized = normalizeSchedulingLinkedRecord(linkedRecord)

  if (rule.requirement === 'notAllowed') {
    return normalized
      ? {
          valid: false,
          message: 'This event type does not use linked records.',
        }
      : { valid: true }
  }

  if (rule.requirement === 'required' && !normalized) {
    return {
      valid: false,
      message: 'Select a linked record for this event type.',
    }
  }

  if (
    normalized &&
    !rule.supportedLinkedRecordTypes.includes(normalized.recordType)
  ) {
    return {
      valid: false,
      message: 'Choose a supported linked record type.',
    }
  }

  return { valid: true }
}

export function shouldWarnWhenSchedulingWithoutLinkedRecord({
  eventType,
  settings,
  capabilities,
  linkedRecord,
}: {
  eventType: SchedulingEventType | string
  settings: WorkspaceSchedulingSettings
  capabilities: SchedulingCapabilities
  linkedRecord?: SchedulingLinkedRecordDraft | null
}) {
  const rule = resolveSchedulingLinkedRecordRule({
    eventType,
    settings,
    capabilities,
  })
  return (
    rule.requirement === 'optional' &&
    rule.warnWhenUnlinked &&
    rule.supportedLinkedRecordTypes.length > 0 &&
    !normalizeSchedulingLinkedRecord(linkedRecord)
  )
}
