import type { RunTimeline, RunEvent } from './types'
import { sortEvents } from './runTimeline'

export type ReplayFrame = {
  time: number
  event: RunEvent | null
}

export function buildReplayFrames(timeline: RunTimeline): ReplayFrame[] {
  const sorted = sortEvents(timeline).events
  return sorted.map((event) => ({
    time: event.timestamp,
    event,
  }))
}

export function getReplayFrame(
  timeline: RunTimeline,
  time: number,
): ReplayFrame {
  const frames = buildReplayFrames(timeline)
  let current: ReplayFrame = { time, event: null }
  for (const frame of frames) {
    if (time >= frame.time) {
      current = frame
    } else {
      break
    }
  }
  return current
}
