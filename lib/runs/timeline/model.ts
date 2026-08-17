import type {
  RunEvent,
  RunEventStatus,
  RunEventType,
  TimelineItem,
} from './types'

// Authoritative mapping from runtime/audit events to user-visible timeline items.
// No derived events are generated here; the input array must already contain real runtime events.

export const RUN_EVENT_TITLES: Record<RunEventType, string> = {
  'run-started': 'Run started',
  'run-completed': 'Run completed',
  'run-failed': 'Run failed',
  'node-entered': 'Node entered',
  'node-completed': 'Node completed',
  'node-skipped': 'Node skipped',
  'node-partial-failure': 'Node partial failure',
  'retry-attempt': 'Retry attempt',
  'approval-requested': 'Approval requested',
  'approval-approved': 'Approval approved',
  'approval-rejected': 'Approval rejected',
  'sla-breach': 'SLA breach',
  'kill-initiated': 'Kill initiated',
  'kill-completed': 'Kill completed',
  'manual-intervention': 'Manual intervention',
}

export const RUN_EVENT_STATUS: Record<RunEventType, RunEventStatus> = {
  'run-started': 'info',
  'run-completed': 'success',
  'run-failed': 'failed',
  'node-entered': 'info',
  'node-completed': 'success',
  'node-skipped': 'skipped',
  'node-partial-failure': 'warning',
  'retry-attempt': 'warning',
  'approval-requested': 'info',
  'approval-approved': 'success',
  'approval-rejected': 'failed',
  'sla-breach': 'warning',
  'kill-initiated': 'warning',
  'kill-completed': 'warning',
  'manual-intervention': 'info',
}

function titleForEvent(event: RunEvent): string {
  const base = RUN_EVENT_TITLES[event.type]
  if (event.nodeLabel) {
    return `${base} • ${event.nodeLabel}${event.nodeType ? ` (${event.nodeType})` : ''}`
  }
  return base
}

export function eventToTimelineItem(
  event: RunEvent,
  previousTimestamp?: string,
): TimelineItem {
  const currentTs = new Date(event.createdAt).getTime()
  const prevTs = previousTimestamp
    ? new Date(previousTimestamp).getTime()
    : undefined
  const timeDeltaMs =
    prevTs !== undefined && Number.isFinite(prevTs)
      ? Math.max(currentTs - prevTs, 0)
      : undefined

  return {
    id: event.id,
    type: event.type,
    status: RUN_EVENT_STATUS[event.type],
    timestamp: event.createdAt,
    title: titleForEvent(event),
    subtitle: event.message,
    details: event.details,
    actor: event.actor,
    timeDeltaMs,
  }
}
