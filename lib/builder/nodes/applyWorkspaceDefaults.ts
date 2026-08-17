import type { WorkspaceDefaults } from '@/lib/workspaces/defaults'

// Workspace defaults persistence.
// Explicit configuration only.
// No inference, learning, or retroactive mutation.
// Execution behavior must remain unchanged.
export function applyWorkspaceDefaults<T extends Record<string, any>>(
  data: T,
  defaults?: WorkspaceDefaults,
): T {
  if (!defaults) return data
  return {
    ...data,
    label: data.label ?? defaults.namePrefix,
    retryCount: data.retryCount ?? defaults.retryCount,
    timeoutMs: data.timeoutMs ?? defaults.timeoutMs,
    aiModel: data.aiModel ?? defaults.aiModel,
    requiresApproval: data.requiresApproval ?? defaults.requiresApproval,
  }
}
