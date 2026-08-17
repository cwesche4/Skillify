'use client'

import { useCallback } from 'react'

import {
  getInspectorTelemetryBuffer,
  logInspectorEvent,
  trackOnce,
} from '@/lib/inspector/telemetry'

export function useInspectorTelemetry(enabled: boolean | undefined) {
  const logEvent = useCallback(
    (event: any, payload: Record<string, any>, allow?: boolean | undefined) =>
      logInspectorEvent(event as any, payload, allow ?? enabled),
    [enabled],
  )

  const trackOnceFn = useCallback(
    (key: string, fn: () => void, allow?: boolean | undefined) =>
      trackOnce(key, fn, allow ?? enabled),
    [enabled],
  )

  return {
    logEvent,
    trackOnce: trackOnceFn,
    getBuffer: getInspectorTelemetryBuffer,
  }
}
