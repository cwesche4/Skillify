'use client'

import { useEffect, useRef } from 'react'
import { assignCursorColor } from '@/lib/collaboration/colors'

type Options = {
  workspaceId: string
  automationId: string
  enabled: boolean
  userId?: string
  name?: string
}

// Broadcasts cursor position via heartbeat; read-only relative to builder state.
export function useCursorBroadcaster({
  workspaceId,
  automationId,
  enabled,
  userId = 'local-user',
  name = 'You',
}: Options) {
  const throttling = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (throttling.current) return
      throttling.current = true
      setTimeout(() => {
        throttling.current = false
      }, 120)

      const payload = {
        userId,
        name,
        color: assignCursorColor(userId),
        cursor: {
          x: e.clientX,
          y: e.clientY,
        },
      }

      fetch(
        `/api/workspaces/${workspaceId}/automations/${automationId}/presence`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      ).catch(() => {})
    }

    window.addEventListener('pointermove', handler, { passive: true })
    return () => window.removeEventListener('pointermove', handler)
  }, [enabled, workspaceId, automationId, userId, name])
}
