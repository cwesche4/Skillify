'use client'

import { useMemo, useState, useEffect } from 'react'
import type { RunTimeline, RunEvent } from '@/lib/runtime/types'
import {
  getEventsUpTo,
  getCurrentEvent,
  sortEvents,
} from '@/lib/runtime/runTimeline'

type ControllerOptions = {
  enabled?: boolean
}

export function useRunTimelineController(
  timeline: RunTimeline,
  options: ControllerOptions = {},
) {
  const enabled = options.enabled ?? true

  const sorted = useMemo(
    () => (enabled ? sortEvents(timeline) : timeline),
    [timeline, enabled],
  )

  const [currentTime, setCurrentTime] = useState<number>(
    enabled ? (sorted.startedAt ?? 0) : 0,
  )

  useEffect(() => {
    if (!enabled) return
    setCurrentTime(sorted.startedAt ?? 0)
  }, [enabled, sorted.startedAt])

  const currentEvent: RunEvent | null = useMemo(() => {
    if (!enabled) return null
    return getCurrentEvent(sorted, currentTime)
  }, [sorted, currentTime, enabled])

  const visibleEvents: RunEvent[] = useMemo(() => {
    if (!enabled) return []
    return getEventsUpTo(sorted, currentTime)
  }, [sorted, currentTime, enabled])

  return {
    timeline: sorted,
    currentTime,
    setTime: setCurrentTime,
    currentEvent,
    visibleEvents,
  }
}
