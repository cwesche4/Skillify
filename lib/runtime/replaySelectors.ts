import type { RunTimeline } from './types'
import { getReplayFrame } from './replayEngine'

export function getActiveNodeIds(
  timeline: RunTimeline,
  time: number,
): Set<string> {
  const frame = getReplayFrame(timeline, time)
  if (frame.event?.nodeId) {
    return new Set([frame.event.nodeId])
  }
  return new Set()
}
