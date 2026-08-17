import type { ApprovalEvent, ApprovalRequest } from './types'
import type { TimelineItem } from '@/lib/runs/timeline/types'

/**
 * Produce approval-related events without mutating history.
 * Persistence/auditing is handled by callers; this is purely structural.
 */
export function createApprovalRequestedEvent(
  req: ApprovalRequest,
): ApprovalEvent {
  return {
    id: crypto.randomUUID(),
    type: 'approval-requested',
    runId: req.runId,
    nodeId: req.nodeId,
    nodeLabel: req.nodeLabel,
    createdAt: new Date().toISOString(),
    message: req.reasonRequired
      ? 'Approval requested (reason required)'
      : 'Approval requested',
  }
}

export function createApprovalDecisionEvent(params: {
  request: ApprovalRequest
  actedByUserId: string
  decision: 'approved' | 'rejected'
  approvalReason: string
}): ApprovalEvent {
  return {
    id: crypto.randomUUID(),
    type:
      params.decision === 'approved'
        ? 'approval-approved'
        : 'approval-rejected',
    runId: params.request.runId,
    nodeId: params.request.nodeId,
    nodeLabel: params.request.nodeLabel,
    createdAt: new Date().toISOString(),
    actedByUserId: params.actedByUserId,
    approvalReason: params.approvalReason,
    message:
      params.decision === 'approved'
        ? 'Approval granted; execution may resume.'
        : 'Approval rejected; run will terminate.',
  }
}

/**
 * Map approval events to timeline items (append-only; ordered elsewhere).
 */
export function approvalEventsToTimeline(
  events: ApprovalEvent[],
): TimelineItem[] {
  return events.map((ev) => {
    const base = {
      id: ev.id,
      timestamp: ev.createdAt,
      details: { nodeId: ev.nodeId, approvalReason: ev.approvalReason },
    }
    if (ev.type === 'approval-requested') {
      return {
        ...base,
        type: 'node-entered',
        status: 'info',
        title: `Approval requested for ${ev.nodeLabel ?? ev.nodeId}`,
        subtitle: ev.message,
      }
    }
    if (ev.type === 'approval-approved') {
      return {
        ...base,
        type: 'node-completed',
        status: 'success',
        title: `Approved: ${ev.nodeLabel ?? ev.nodeId}`,
        subtitle: ev.message,
      }
    }
    return {
      ...base,
      type: 'node-partial-failure',
      status: 'failed',
      title: `Rejected: ${ev.nodeLabel ?? ev.nodeId}`,
      subtitle: ev.message,
    }
  })
}
