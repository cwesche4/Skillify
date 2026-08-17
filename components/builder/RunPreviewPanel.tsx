import type { FC } from 'react'
import { AlertCircle } from 'lucide-react'
import type { RunPreview } from '@/lib/builder/preview/computeRunPreview'

type Props = {
  preview: RunPreview
  onClose?: () => void
}

export const RunPreviewPanel: FC<Props> = ({ preview, onClose }) => {
  return (
    <div className="flex h-full flex-col border-l border-slate-800 bg-slate-950 text-sm text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-slate-100">
            Run Preview
          </div>
          <div className="text-[11px] text-slate-400">
            Simulation only; no execution
          </div>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-auto px-3 py-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Nodes
          </div>
          <ul className="mt-1 space-y-1">
            {preview.nodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between rounded border border-slate-800/60 bg-slate-900 px-2 py-1"
              >
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-slate-100">
                    {n.label || n.type}
                  </span>
                  <span className="text-[11px] text-slate-500">{n.type}</span>
                </div>
                <div className="text-[11px]">
                  {n.disabled ? (
                    <span className="text-rose-400">Skipped (disabled)</span>
                  ) : n.willExecute ? (
                    <span className="text-emerald-400">Will execute</span>
                  ) : (
                    <span className="text-slate-400">Not connected</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Branches
          </div>
          <ul className="mt-1 space-y-1">
            {preview.branches.map((b, idx) => (
              <li
                key={`${b.from}-${b.to}-${idx}`}
                className="flex items-center justify-between rounded border border-slate-800/60 bg-slate-900 px-2 py-1 text-[12px]"
              >
                <span className="text-slate-200">
                  {b.from} → {b.to}
                </span>
                <span className="text-[11px] text-slate-400">
                  {b.taken ? 'Connected' : 'Not connected'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {preview.notes.length ? (
          <div className="rounded border border-slate-800/60 bg-slate-900 px-2 py-2">
            <div className="flex items-center gap-2 text-[12px] text-slate-100">
              <AlertCircle className="h-4 w-4 text-amber-400" aria-hidden />
              Notes
            </div>
            <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
              {preview.notes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default RunPreviewPanel
