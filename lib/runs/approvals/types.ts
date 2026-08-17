export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type ApprovalEventType =
  | 'approval-requested'
  | 'approval-approved'
  | 'approval-rejected'

export interface ApprovalRequest {
  id: string
  runId: string
  nodeId: string
  nodeLabel?: string
  requestedAt: string
  reasonRequired: boolean
  slaHint?: string // informational only
}

export interface ApprovalEvent {
  id: string
  type: ApprovalEventType
  runId: string
  nodeId: string
  nodeLabel?: string
  createdAt: string
  requestedByUserId?: string
  actedByUserId?: string
  message?: string
  approvalReason?: string
}
