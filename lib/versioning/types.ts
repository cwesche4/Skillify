export type AutomationVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type AutomationVersionMeta = {
  id: string
  automationId: string
  workspaceId: string
  createdAt: number
  createdByUserId: string
  label?: string | null
  message?: string | null
  baseVersionId?: string | null
  status: AutomationVersionStatus
}

export type AutomationVersionSnapshot = {
  id: string
  versionId: string
  flowJson: unknown
  schemaVersion: number
  nodeCount: number
  edgeCount: number
  checksum: string
  createdAt: number
}

export type AutomationSnapshot = {
  nodes: unknown[]
  edges: unknown[]
  viewport?: { x: number; y: number; zoom: number }
  metadata?: Record<string, any>
}

export type AutomationVersion = {
  id: string
  automationId: string
  workspaceId: string
  label?: string | null
  createdAt: number
  createdBy: string
  snapshot: AutomationSnapshot
  status?: AutomationVersionStatus
}

// DESIGN-ONLY / INACTIVE (read-only snapshot shape for builder UI)
export type VersionDiff = {
  addedNodes: string[]
  removedNodes: string[]
  changedNodes: string[]
}
