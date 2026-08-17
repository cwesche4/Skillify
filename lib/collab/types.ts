export type PresenceStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE'

export type PresenceViewport = {
  x: number
  y: number
  zoom: number
}

export type PresenceCursor = {
  x: number
  y: number
}

export type PresenceUser = {
  id: string
  userId: string
  displayName?: string
  color?: string
  status: PresenceStatus
  cursor?: PresenceCursor
  viewport?: PresenceViewport
  activeNodeId?: string | null
  lastSeenAt?: number
}

export type LockState = 'SOFT' | 'HARD'
export type LockScope = 'NODE' | 'CANVAS'

export type LockDescriptor = {
  id: string
  workspaceId: string
  automationId: string
  nodeId?: string | null
  ownerUserId: string
  lockType: LockScope
  state: LockState
  expiresAt?: number | null
  updatedAt?: number
}

export type CollaborationSnapshot = {
  presence: PresenceUser[]
  locks: LockDescriptor[]
  serverTime: number
}
