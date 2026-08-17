import type { RunEvent } from '@/lib/runs/timeline/types'
import type { SlaBreachEvent, SlaConfig } from './types'

/**
 * Evaluate SLA breaches based on run timeline and config.
 * - No retries; explicit breach events returned.
 */
export function evaluateSlaBreaches(params: {
  events: RunEvent[]
  config: SlaConfig
}): SlaBreachEvent[] {
  const breaches: SlaBreachEvent[] = []
  const { runTimeoutMs, nodeTimeoutMs } = params.config

  if (runTimeoutMs && params.events.length > 0) {
    const started = params.events.find((e) => e.type === 'run-started')
    const ended = params.events.find(
      (e) => e.type === 'run-completed' || e.type === 'run-failed',
    )
    if (started && !ended) {
      const duration = Date.now() - new Date(started.createdAt).getTime()
      if (duration > runTimeoutMs) {
        breaches.push({
          type: 'run-timeout',
          runId: started.runId,
          occurredAt: new Date().toISOString(),
          reason: `Run exceeded max duration ${runTimeoutMs}ms`,
        })
      }
    }
  }

  if (nodeTimeoutMs) {
    const nodesEntered = params.events.filter((e) => e.type === 'node-entered')
    for (const entered of nodesEntered) {
      const completed = params.events.find(
        (e) =>
          e.nodeId === entered.nodeId &&
          (e.type === 'node-completed' ||
            e.type === 'node-partial-failure' ||
            e.type === 'node-skipped'),
      )
      if (!completed) {
        const duration = Date.now() - new Date(entered.createdAt).getTime()
        if (duration > nodeTimeoutMs) {
          breaches.push({
            type: 'node-timeout',
            runId: entered.runId,
            nodeId: entered.nodeId,
            nodeLabel: entered.nodeLabel,
            occurredAt: new Date().toISOString(),
            reason: `Node exceeded max duration ${nodeTimeoutMs}ms`,
          })
        }
      }
    }
  }

  return breaches
}
