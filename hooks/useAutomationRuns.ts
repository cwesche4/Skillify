'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RunTimeline } from '@/lib/runtime/types'

type RunSummary = {
  id: string
  automationId: string
  startedAt: number
  finishedAt?: number
}

type AutomationRunsState = {
  runs: RunSummary[]
  timeline: RunTimeline | null
  loading: boolean
  error: string | null
  selectedRunId: string | null
}

// READ-ONLY data flow: fetches run lists and timelines; no mutations or side effects.
export function useAutomationRuns(automationId: string, enabled: boolean) {
  const [state, setState] = useState<AutomationRunsState>({
    runs: [],
    timeline: null,
    loading: false,
    error: null,
    selectedRunId: null,
  })

  const fetchRuns = useCallback(
    async (runId?: string) => {
      if (!enabled) return
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const res = await fetch(
          `/api/automations/${automationId}/runs${runId ? `?runId=${runId}` : ''}`,
        )
        if (!res.ok) throw new Error(`Failed to load runs (${res.status})`)
        const data = await res.json()
        setState((s) => ({
          ...s,
          runs: data.runs || [],
          timeline: data.timeline || s.timeline,
          selectedRunId: data.timeline?.runId ?? s.selectedRunId,
          loading: false,
        }))
      } catch (err: any) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || 'Error loading runs',
        }))
      }
    },
    [automationId, enabled],
  )

  useEffect(() => {
    if (!enabled) return
    fetchRuns()
  }, [enabled, fetchRuns])

  const selectRun = useCallback(
    (runId: string) => {
      if (!enabled) return
      fetchRuns(runId)
    },
    [enabled, fetchRuns],
  )

  const value = useMemo(
    () => ({
      ...state,
      selectRun,
      refresh: fetchRuns,
    }),
    [state, selectRun, fetchRuns],
  )

  return value
}
