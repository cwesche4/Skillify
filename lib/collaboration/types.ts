export type CollaborationEventType =
  | 'editor-joined'
  | 'editor-left'
  | 'approval-reviewer'
  | 'manual-intervention'
  | 'replay-viewed'

export interface CollaborationEvent {
  id: string
  automationId: string
  workspaceId: string
  userId?: string
  type: CollaborationEventType
  createdAt: string
}

export interface CollaborationAggregate {
  editors: number
  reviewers: number
  manualInterventions: number
  replays: number
}

export interface Collaborator {
  userId: string
  name?: string
  color?: string
  updatedAt?: number
  lastSeenAt?: number
}

export interface PresenceCursor {
  userId: string
  x: number
  y: number
  viewport?: any
  color?: string
  updatedAt: number
}

export interface NodeLock {
  nodeId: string
  lockedBy: string
  mode: 'soft' | 'hard' | string
  updatedAt?: number
  since?: number
}

export interface CollaborationSession {
  sessionId?: string
  workspaceId?: string
  automationId?: string
  collaborators: Collaborator[]
  cursors: PresenceCursor[]
  locks: NodeLock[]
  updatedAt?: number
}
