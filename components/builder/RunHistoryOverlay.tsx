'use client'

import type { RunHistoryItem } from '@/hooks/useRunHistory'

interface RunHistoryOverlayProps {
  runs: RunHistoryItem[]
  selectedRunId?: string | null
  onSelectRun?: (id: string) => void
  visible?: boolean
  className?: string
}

export default function RunHistoryOverlay({
  runs,
  selectedRunId,
  onSelectRun,
  visible = true,
  className,
}: RunHistoryOverlayProps) {
  if (!visible) return null

  return (
    <div
      className={`pointer-events-none absolute left-4 top-4 z-40 ${className ?? ''}`}
      aria-label="Run history overlay"
    >
      <div className="pointer-events-auto w-64 rounded-xl border border-slate-800/70 bg-slate-950/90 p-3 text-slate-100 shadow-xl backdrop-blur">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Run History
        </div>
        <div className="max-h-56 space-y-2 overflow-auto pr-1">
          {runs.length === 0 && (
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
              No runs yet.
            </div>
          )}
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => onSelectRun?.(run.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] ${
                run.id === selectedRunId
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-slate-50'
                  : 'border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <span className="font-semibold">{run.label}</span>
              <span className="text-[10px] text-slate-400">
                {new Date(run.startedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
