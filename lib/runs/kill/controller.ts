import type { TimelineItem } from '@/lib/runs/timeline/types'

export type KillEventType = 'kill-initiated' | 'kill-completed'

export interface KillEvent {
  type: KillEventType
  runId: string
  workspaceId: string
  initiatedBy: string
  createdAt: string
  message?: string
}

/**
 * Create kill switch events (append-only). Actual stopping of runs is handled by runtime.
 */
export function createKillEvents(params: {
  runId: string
  workspaceId: string
  initiatedBy: string
  reason?: string
}): KillEvent[] {
  const now = new Date().toISOString()
  return [
    {
      type: 'kill-initiated',
      runId: params.runId,
      workspaceId: params.workspaceId,
      initiatedBy: params.initiatedBy,
      createdAt: now,
      message: params.reason ?? 'Kill switch activated.',
    },
    {
      type: 'kill-completed',
      runId: params.runId,
      workspaceId: params.workspaceId,
      initiatedBy: params.initiatedBy,
      createdAt: now,
      message: 'Run stopped; future runs blocked until re-enabled.',
    },
  ]
}

export function killEventsToTimeline(events: KillEvent[]): TimelineItem[] {
  return events.map((e) => ({
    id: `${e.type}-${e.createdAt}-${e.runId}`,
    type: e.type === 'kill-initiated' ? 'node-partial-failure' : 'run-failed',
    status: e.type === 'kill-initiated' ? 'warning' : 'failed',
    timestamp: e.createdAt,
    title: e.type === 'kill-initiated' ? 'Kill initiated' : 'Kill completed',
    subtitle: e.message,
    details: {
      runId: e.runId,
      workspaceId: e.workspaceId,
      initiatedBy: e.initiatedBy,
    },
  }))
}
