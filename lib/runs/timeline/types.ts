export type RunEventType =
  | 'run-started'
  | 'run-completed'
  | 'run-failed'
  | 'node-entered'
  | 'node-completed'
  | 'node-skipped'
  | 'node-partial-failure'
  | 'retry-attempt'
  | 'approval-requested'
  | 'approval-approved'
  | 'approval-rejected'
  | 'sla-breach'
  | 'kill-initiated'
  | 'kill-completed'
  | 'manual-intervention'

export type RunEventStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'info'
  | 'warning'

export interface RunEvent {
  id: string
  runId: string
  createdAt: string
  type: RunEventType
  nodeId?: string
  nodeLabel?: string
  nodeType?: string
  actor?: string
  message?: string
  details?: any
}

export interface TimelineItem {
  id: string
  type: RunEventType
  status: RunEventStatus
  timestamp: string
  title: string
  subtitle?: string
  details?: any
  actor?: string
  timeDeltaMs?: number
  nodeId?: string
  nodeLabel?: string
  nodeType?: string
}
