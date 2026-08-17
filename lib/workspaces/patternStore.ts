// Workspace patterns.
// Explicit sharing only.
// No dependencies or live updates.
export type WorkspacePattern = {
  id: string
  workspaceId: string
  name: string
  purpose?: string
  inputs?: string[]
  outputs?: string[]
  nodes: any[]
  edges: any[]
  createdAt: string
}

const store = new Map<string, WorkspacePattern[]>()

export function listWorkspacePatterns(workspaceId: string): WorkspacePattern[] {
  return store.get(workspaceId) ?? []
}

export function saveWorkspacePattern(pattern: WorkspacePattern) {
  const existing = store.get(pattern.workspaceId) ?? []
  store.set(pattern.workspaceId, [...existing, pattern])
}
