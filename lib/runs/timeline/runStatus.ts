import type { TimelineItem } from './types'

export type RunStatus = 'success' | 'failed' | 'partial' | 'unknown'

export function deriveRunStatus(items: TimelineItem[]): RunStatus {
  let status: RunStatus = 'unknown'
  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
  for (const item of sorted) {
    if (item.type === 'run-failed') status = 'failed'
    if (item.type === 'run-completed') {
      // If there were earlier failures, treat as partial.
      status = status === 'failed' ? 'partial' : 'success'
    }
    if (item.type === 'node-partial-failure') {
      status = 'partial'
    }
  }
  return status
}
