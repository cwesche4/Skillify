import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  SCHEDULING_PRESETS,
  getDefaultSchedulingPresetForBusinessModel,
} from '@/lib/scheduling/schedulingPresetRegistry'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type {
  SchedulingCapabilities,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export function getWorkspaceSchedulingCapabilities({
  businessModel,
  settings,
  workspaceTimezone,
}: {
  businessModel: WorkspaceBusinessModel | string
  settings?: Partial<WorkspaceSchedulingSettings> | null
  workspaceTimezone?: string | null
}): SchedulingCapabilities {
  const preset =
    settings?.preset ??
    getDefaultSchedulingPresetForBusinessModel(businessModel)
  const definition = SCHEDULING_PRESETS[preset] ?? SCHEDULING_PRESETS.service
  const normalizedSettings = normalizeSchedulingSettings({
    businessModel,
    settings,
    workspaceTimezone,
  })
  const supported = new Set(definition.supportedSections)

  return {
    enabled: normalizedSettings.enabled,
    preset: normalizedSettings.preset,
    supportedSections: definition.supportedSections,
    defaultVisibleSections: definition.defaultVisibleSections,
    visibleSections: normalizedSettings.visibleSections.filter((section) =>
      supported.has(section),
    ),
    supportedEventTypes: definition.supportedEventTypes,
    ...definition.linkSupport,
  }
}

export function canAccessSchedulingSection(
  capabilities: SchedulingCapabilities,
  section: string,
) {
  return (
    capabilities.enabled &&
    capabilities.supportedSections.includes(section as any) &&
    capabilities.visibleSections.includes(section as any)
  )
}

export function canRouteToSchedulingSection(
  capabilities: SchedulingCapabilities,
  section: string,
) {
  return (
    capabilities.enabled &&
    capabilities.supportedSections.includes(section as any)
  )
}
