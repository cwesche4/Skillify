// lib/auth/getWorkspaceRole.ts

export type WorkspaceRole = 'owner' | 'admin' | 'member'

/**
 * Client-side helper that calls the workspace-role API
 * and returns the current user's role inside a workspace.
 */
export async function getWorkspaceRole(
  workspaceId: string,
): Promise<WorkspaceRole> {
  try {
    const res = await fetch('/api/workspace-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    })

    if (!res.ok) {
      return 'member'
    }

    const data = (await res.json()) as { role?: WorkspaceRole }
    return (data.role ?? 'member') as WorkspaceRole
  } catch {
    return 'member'
  }
}
