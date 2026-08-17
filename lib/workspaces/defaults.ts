export type WorkspaceDefaults = {
  namePrefix?: string
  retryCount?: number
  timeoutMs?: number
  aiModel?: string
  requiresApproval?: boolean
}

export function getWorkspaceDefaults(
  workspaceId?: string | null,
): WorkspaceDefaults {
  // Workspace defaults.
  // Explicit configuration only.
  // No inference or adaptive behavior.
  return {
    namePrefix: 'Node',
    retryCount: 2,
    timeoutMs: 30_000,
    aiModel: 'gpt-4o-mini',
    requiresApproval: false,
  }
}
