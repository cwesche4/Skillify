'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CollaborationSnapshot } from '@/lib/collab/types'

type Options = {
  enabled?: boolean
  workspaceId: string
  automationId: string
  intervalMs?: number
}

export function useCollaborationSnapshot({
  enabled = false,
  workspaceId,
  automationId,
  intervalMs = 8000,
}: Options) {
  const [data, setData] = useState<CollaborationSnapshot>({
    presence: [],
    locks: [],
    serverTime: Date.now(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    const fetchSnapshot = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/automations/${automationId}/collab/snapshot`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error(`Snapshot load failed (${res.status})`)
        const json = (await res.json()) as CollaborationSnapshot
        setData(json)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Failed to load collaboration snapshot')
      } finally {
        setLoading(false)
      }
    }

    fetchSnapshot()

    const timer = setInterval(fetchSnapshot, intervalMs)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [enabled, workspaceId, automationId, intervalMs])

  const value = useMemo(
    () => ({
      presence: data.presence,
      locks: data.locks,
      serverTime: data.serverTime,
      loading,
      error,
      refresh: () => setData((d) => ({ ...d })),
    }),
    [data, loading, error],
  )

  return value
}
