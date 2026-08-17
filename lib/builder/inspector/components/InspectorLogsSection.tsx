'use client'

import { Button } from '@/components/ui/Button'
import React from 'react'

type LogEntry = { ts: number; level: 'info' | 'error'; message: string }

type Props = {
  logs: LogEntry[]
  workspaceId: string
  automationId: string
  onReplay: () => void
}

function InspectorLogsSectionComponent({
  logs,
  workspaceId,
  automationId,
  onReplay,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-100">Logs</p>
        <Button
          size="xs"
          variant="secondary"
          disabled={!workspaceId || !automationId}
          onClick={onReplay}
          title="Open latest run in replay"
          data-testid="inspector-replay-link"
        >
          View in Replay
        </Button>
      </div>
      {logs.length === 0 && (
        <p className="text-[11px] text-slate-500">No logs yet.</p>
      )}
      {logs.length > 0 && (
        <div className="max-h-60 space-y-2 overflow-auto">
          {logs.map((l, idx) => (
            <div
              key={`${l.ts}-${idx}`}
              className="flex items-start gap-2 rounded border border-slate-800/60 bg-slate-900/60 p-2"
            >
              <span className="text-[10px] text-slate-500">
                {new Date(l.ts).toLocaleTimeString()}
              </span>
              <span
                className={`text-[10px] ${
                  l.level === 'error' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {l.level.toUpperCase()}
              </span>
              <span className="text-[11px] text-slate-200">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const InspectorLogsSection = React.memo(InspectorLogsSectionComponent)
