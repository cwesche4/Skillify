'use client'

import { useState, useCallback } from 'react'

export type RunHistoryItem = {
  id: string
  label: string
  startedAt: number
  finishedAt?: number
}

export function useRunHistory(initial: RunHistoryItem[] = []) {
  const [runs, setRuns] = useState<RunHistoryItem[]>(initial)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const selectRun = useCallback((id: string) => {
    setSelectedRunId(id)
  }, [])

  const addRun = useCallback((run: RunHistoryItem) => {
    setRuns((prev) => [run, ...prev])
  }, [])

  return { runs, selectedRunId, selectRun, addRun, setRuns }
}
