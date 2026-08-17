// Compliance mode.
// Explicit workspace setting.
// No hidden changes.
const complianceStore = new Map<string, boolean>()

export function getComplianceMode(workspaceId: string): boolean {
  return complianceStore.get(workspaceId) ?? false
}

export function setComplianceMode(workspaceId: string, enabled: boolean) {
  complianceStore.set(workspaceId, enabled)
}
