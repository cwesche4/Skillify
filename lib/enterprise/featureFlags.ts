// Enterprise feature flags.
// Explicit, documented, non-inferential.
export type FeatureFlag = {
  key: string
  description: string
  enabled: boolean
}

const flagStore = new Map<string, FeatureFlag[]>()

export function setWorkspaceFlags(workspaceId: string, flags: FeatureFlag[]) {
  flagStore.set(workspaceId, flags)
}

export function getWorkspaceFlags(workspaceId: string): FeatureFlag[] {
  return flagStore.get(workspaceId) ?? []
}
