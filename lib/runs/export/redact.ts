import type { TimelineItem } from '@/lib/runs/timeline/types'

// Compliance export.
// Redacted evidence only.
// No secrets or payloads by default.
export function redactTimeline(items: TimelineItem[]): TimelineItem[] {
  return items.map((item) => ({
    ...item,
    details: undefined,
    subtitle: item.subtitle ? safeMessage(item.subtitle) : undefined,
  }))
}

function safeMessage(message: string) {
  return message.split('\n')[0].slice(0, 200)
}
