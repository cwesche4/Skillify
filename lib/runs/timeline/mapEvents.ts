import type { RunEvent, TimelineItem } from './types'
import { eventToTimelineItem } from './model'

export function mapEventsToTimeline(events: RunEvent[]): TimelineItem[] {
  const sorted = events
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

  return sorted.map((event, idx) =>
    eventToTimelineItem(event, sorted[idx - 1]?.createdAt),
  )
}
