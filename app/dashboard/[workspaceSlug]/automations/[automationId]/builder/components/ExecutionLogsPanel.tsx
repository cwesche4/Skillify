'use client'

import { useMemo } from 'react'
import { Clock, PlayCircle, ShieldAlert, ShieldCheck, X } from 'lucide-react'

import { BrandLogo } from '@/components/branding/BrandLogo'

type LogStatus = 'success' | 'failed' | 'running'

export type ExecutionLog = {
  id: string
  timestamp: string | number | Date
  nodeName: string
  status: LogStatus
  message?: string
}

interface ExecutionLogsPanelProps {
  open: boolean
  logs: ExecutionLog[]
  currentIndex?: number
  onScrub?: (index: number) => void
  onClose?: () => void
  className?: string
  title?: string
}

export default function ExecutionLogsPanel({
  open,
  logs,
  currentIndex = 0,
  onScrub,
  onClose,
  className,
  title = 'Execution Timeline',
}: ExecutionLogsPanelProps) {
  const active = useMemo(
    () =>
      logs.length ? Math.min(Math.max(currentIndex, 0), logs.length - 1) : 0,
    [logs.length, currentIndex],
  )

  const activeLog = logs[active]

  const statusIcon = (status: LogStatus) => {
    if (status === 'success')
      return <ShieldCheck className="h-4 w-4 text-emerald-400" />
    if (status === 'failed')
      return <ShieldAlert className="h-4 w-4 text-rose-400" />
    return <PlayCircle className="h-4 w-4 text-cyan-400" />
  }

  if (!open) return null

  return (
    <div
      className={`pointer-events-auto w-80 rounded-xl border border-slate-800/70 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur ${
        className ?? ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">
            Scrub through execution history
          </p>
        </div>
        {onClose && (
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            onClick={onClose}
            aria-label="Close execution logs"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrubber */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(logs.length - 1, 0)}
          value={active}
          onChange={(e) => onScrub?.(Number(e.target.value))}
          className="h-1 flex-1 accent-cyan-400"
        />
        <span className="text-[11px] text-slate-400">
          {logs.length ? `${active + 1}/${logs.length}` : '0/0'}
        </span>
      </div>

      {/* Active detail */}
      {activeLog ? (
        <div className="mb-3 rounded-lg border border-slate-800/70 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              {statusIcon(activeLog.status)}
              <span>{activeLog.nodeName}</span>
            </div>
            <span className="text-[11px] text-slate-400">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              {formatTs(activeLog.timestamp)}
            </span>
          </div>
          {activeLog.message && (
            <p className="mt-2 text-[12px] text-slate-300">
              {activeLog.message}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-[12px] text-slate-400">
          No execution logs yet.
        </div>
      )}

      {/* List */}
      <div className="max-h-48 space-y-2 overflow-auto pr-1">
        {logs.map((log, idx) => (
          <button
            key={log.id}
            onClick={() => onScrub?.(idx)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition ${
              idx === active
                ? 'border-cyan-500/50 bg-cyan-500/10 text-slate-50'
                : 'border-slate-800/70 bg-slate-900/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusIcon(log.status)}
              <div className="flex flex-col">
                <span className="font-semibold">{log.nodeName}</span>
                <span className="text-[11px] text-slate-400">
                  {formatTs(log.timestamp)}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500">#{idx + 1}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end border-t border-slate-800/70 pt-3">
        <BrandLogo
          variant="automated"
          theme="dark"
          alt="Automated by Skillify"
          className="h-5 w-28 opacity-70"
        />
      </div>
    </div>
  )
}

function formatTs(ts: string | number | Date) {
  const d = ts instanceof Date ? ts : new Date(ts)
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
