'use client'

import { useCallback, useState } from 'react'

type LogEntry = {
  ts: number
  level: 'info' | 'error'
  message: string
  meta?: any
}

export function useNodeLogs() {
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})

  const appendLog = useCallback(
    (nodeId: string, entry: Omit<LogEntry, 'ts'> & { ts?: number }) => {
      setLogs((prev) => {
        const list = prev[nodeId] ?? []
        return {
          ...prev,
          [nodeId]: [...list, { ts: entry.ts ?? Date.now(), ...entry }],
        }
      })
    },
    [],
  )

  const getLogs = useCallback((nodeId: string) => logs[nodeId] ?? [], [logs])

  return { logs, appendLog, getLogs }
}
