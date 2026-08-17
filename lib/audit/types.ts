export type AuditEventType =
  | 'run-started'
  | 'run-completed'
  | 'run-failed'
  | 'approval-requested'
  | 'approval-approved'
  | 'approval-rejected'
  | 'node-entered'
  | 'node-completed'
  | 'node-skipped'
  | 'node-partial-failure'
  | 'manual-intervention'

export interface AuditEvent {
  id: string
  runId: string
  workspaceId?: string
  nodeId?: string
  nodeLabel?: string
  nodeType?: string
  actorUserId?: string
  actorRole?: string
  type: AuditEventType
  message?: string
  payload?: any
  createdAt: string
}
