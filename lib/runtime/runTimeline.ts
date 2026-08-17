import type { RunTimeline, RunEvent } from './types'

export function sortEvents(timeline: RunTimeline): RunTimeline {
  return {
    ...timeline,
    events: [...timeline.events].sort((a, b) => a.timestamp - b.timestamp),
  }
}

export function getEventsUpTo(timeline: RunTimeline, time: number): RunEvent[] {
  return timeline.events.filter((e) => e.timestamp <= time)
}

export function getCurrentEvent(
  timeline: RunTimeline,
  time: number,
): RunEvent | null {
  const sorted = sortEvents(timeline).events
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (time >= sorted[i].timestamp) return sorted[i]
  }
  return null
}
