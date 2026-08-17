import type { WorkspaceCapabilitiesSource } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

export function normalizeSalesProcessConfig(
  config: WorkspaceCapabilitiesSource,
): WorkspaceCapabilitiesSource {
  const opportunitiesEnabled = Boolean(config.opportunitiesEnabled)
  const normalizedCapabilities = getWorkspaceCapabilities({
    ...config,
    opportunitiesEnabled,
  })
  return {
    ...config,
    opportunitiesEnabled,
    defaultLeadDestination:
      normalizedCapabilities.conversion.defaultLeadDestination,
    qualifiedLeadBehavior:
      normalizedCapabilities.conversion.qualifiedLeadBehavior,
  }
}
