import type { TimelineItem } from '@/lib/runs/timeline/types'

export type RunStatus = 'success' | 'partial-failure' | 'failed'

/**
 * Compute run-level status from timeline events.
 * - success: no failures, no partial failures
 * - partial-failure: any node failure/partial-failure/skip with some successes
 * - failed: run-level failure or only failures with no successes
 */
export function computeRunStatus(items: TimelineItem[]): RunStatus {
  let hasSuccess = false
  let hasFailure = false
  let hasPartial = false

  for (const item of items) {
    if (item.status === 'success') hasSuccess = true
    if (item.status === 'failed') hasFailure = true
    if (item.status === 'warning' || item.status === 'skipped') {
      hasPartial = true
    }
  }

  if (hasFailure && !hasSuccess) return 'failed'
  if (hasFailure || hasPartial) return 'partial-failure'
  return 'success'
}
