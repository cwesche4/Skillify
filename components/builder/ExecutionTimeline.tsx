'use client'

import type { FC } from 'react'
import type { TimelineItem } from '@/lib/runs/timeline/types'

type Props = {
  items: TimelineItem[]
  onJumpToNode: (nodeId: string, append?: boolean) => void
}

export const ExecutionTimeline: FC<Props> = ({ items, onJumpToNode }) => {
  // Timeline navigation.
  // Read-only execution visualization.
  // Never re-run or infer behavior.
  return null // Placeholder if needed; builder uses RunTimeline (runs).
}

export default ExecutionTimeline
