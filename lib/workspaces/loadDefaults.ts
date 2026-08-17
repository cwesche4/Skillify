import type { WorkspaceDefaults as Defaults } from '@/lib/workspaces/defaults'

// Workspace defaults persistence.
// Explicit configuration only.
// No inference, learning, or retroactive mutation.
// Execution behavior must remain unchanged.
export async function loadWorkspaceDefaults(
  workspaceId: string,
): Promise<Defaults> {
  void workspaceId
  return {}
}
