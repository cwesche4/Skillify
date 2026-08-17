'use client'

import type { ExecutionLog } from '@/hooks/useExecutionLogs'
import { BrandLogo } from '@/components/branding/BrandLogo'

interface ExecutionLogsPanelProps {
  open: boolean
  logs: ExecutionLog[]
  selectedIndex?: number
  onSelect?: (index: number) => void
  onClose?: () => void
}

export default function ExecutionLogsPanel({
  open,
  logs,
  selectedIndex = 0,
  onSelect,
  onClose,
}: ExecutionLogsPanelProps) {
  if (!open) return null

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-50 w-80 rounded-xl border border-slate-800/70 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Execution Logs
          </p>
          <p className="text-[11px] text-slate-500">Node status over time</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
        >
          Close
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {logs.map((log, idx) => (
          <button
            key={log.id}
            onClick={() => onSelect?.(idx)}
            className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-[12px] ${
              idx === selectedIndex
                ? 'border-cyan-500/60 bg-cyan-500/10 text-slate-50'
                : 'border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{log.nodeId}</span>
              <span className="text-[10px] text-slate-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">{log.message}</div>
            <div className="text-[10px] uppercase text-slate-500">
              {log.status}
            </div>
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
