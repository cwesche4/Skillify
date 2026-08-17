'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CollaborationSession } from '@/lib/collaboration/types'

type Options = {
  workspaceId: string
  automationId: string
  enabled: boolean
  intervalMs?: number
}

export function usePresencePolling({
  workspaceId,
  automationId,
  enabled,
  intervalMs = 1500,
}: Options) {
  const [session, setSession] = useState<CollaborationSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPresence = async (controller?: AbortController) => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/automations/${automationId}/presence`,
        { signal: controller?.signal },
      )
      if (!res.ok) throw new Error(`Failed to load presence (${res.status})`)
      const data = await res.json()
      setSession(data.session ?? null)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Presence load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchPresence(controller)
    timerRef.current = setInterval(() => fetchPresence(controller), intervalMs)
    return () => {
      controller.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled, intervalMs, workspaceId, automationId])

  return useMemo(
    () => ({
      session,
      loading,
      error,
      refresh: () => fetchPresence(),
    }),
    [session, loading, error],
  )
}
