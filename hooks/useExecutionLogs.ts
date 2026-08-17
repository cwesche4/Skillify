'use client'

import { useState, useCallback, useMemo } from 'react'

export type ExecutionLog = {
  id: string
  nodeId: string
  status: 'info' | 'error' | 'retry'
  message: string
  timestamp: number
}

export function useExecutionLogs(initial: ExecutionLog[] = []) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<ExecutionLog[]>(initial)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [context, setContext] = useState<{
    currentTime?: number
    activeNodeIds?: Set<string>
  }>({})

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const addLog = useCallback((log: ExecutionLog) => {
    setLogs((prev) => [...prev, log])
  }, [])

  const select = useCallback((idx: number) => {
    setSelectedIndex(idx)
  }, [])

  const activeLogs = useMemo(() => {
    if (!context.activeNodeIds || context.activeNodeIds.size === 0) return logs
    return logs.filter((l) => context.activeNodeIds?.has(l.nodeId))
  }, [logs, context.activeNodeIds])

  return {
    open,
    toggle,
    logs,
    addLog,
    selectedIndex,
    select,
    setLogs,
    activeLogs,
    setContext,
  }
}
