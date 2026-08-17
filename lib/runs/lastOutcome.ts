import type { TimelineItem } from './timeline/types'

export type NodeOutcomeStatus = 'success' | 'failed' | 'skipped'

export interface NodeOutcome {
  nodeId: string
  status: NodeOutcomeStatus
  timestamp: string
  message?: string
  eventId: string
}

export function computeLastNodeOutcomes(
  items: TimelineItem[],
): Record<string, NodeOutcome> {
  const outcomes: Record<string, NodeOutcome> = {}
  items.forEach((item) => {
    const nodeId = (item.details && item.details.nodeId) || (item as any).nodeId
    if (!nodeId) return
    if (
      item.status === 'success' ||
      item.status === 'failed' ||
      item.status === 'skipped'
    ) {
      const existing = outcomes[nodeId]
      const currentTs = new Date(item.timestamp).getTime()
      const existingTs = existing
        ? new Date(existing.timestamp).getTime()
        : -Infinity
      if (currentTs >= existingTs) {
        outcomes[nodeId] = {
          nodeId,
          status: item.status as NodeOutcomeStatus,
          timestamp: item.timestamp,
          message: item.subtitle,
          eventId: item.id,
        }
      }
    }
  })
  return outcomes
}
