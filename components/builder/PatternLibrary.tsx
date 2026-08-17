'use client'

import type { FC } from 'react'

type Pattern = {
  id: string
  name: string
  description?: string
  purpose?: string
  inputs?: string[]
  outputs?: string[]
  nodeCount?: number
  source?: 'local' | 'workspace'
}

type Props = {
  patterns: Pattern[]
  onInsert: (id: string) => void
  highlightIndex?: number
}

export const PatternLibrary: FC<Props> = ({
  patterns,
  onInsert,
  highlightIndex = -1,
}) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        Patterns (explicit, static)
      </div>
      <div className="text-[11px] text-slate-500">
        Static snapshots only. No auto-wiring.
      </div>
      {patterns.length === 0 ? (
        <div className="mt-1 text-[11px] text-slate-500">
          No saved patterns.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {patterns.map((p, idx) => (
            <div
              key={p.id}
              className={`rounded border px-2 py-1 text-[12px] ${
                idx === highlightIndex
                  ? 'border-emerald-600/70 bg-emerald-600/10'
                  : 'border-slate-800 bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                {p.nodeCount !== undefined ? (
                  <span className="text-[10px] text-slate-500">
                    {p.nodeCount} nodes
                  </span>
                ) : null}
                {p.source ? (
                  <span className="text-[10px] text-slate-500">
                    {p.source === 'workspace' ? 'Workspace' : 'Personal'}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onInsert(p.id)}
                  className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-100 hover:border-slate-500"
                >
                  Insert
                </button>
              </div>
              {p.description ? (
                <div className="text-[11px] text-slate-400">
                  {p.description}
                </div>
              ) : null}
              {p.purpose ? (
                <div className="text-[11px] text-slate-500">
                  Purpose: {p.purpose}
                </div>
              ) : null}
              {(p.inputs?.length || 0) > 0 ? (
                <div className="text-[11px] text-slate-500">
                  Inputs: {p.inputs?.join(', ')}
                </div>
              ) : null}
              {(p.outputs?.length || 0) > 0 ? (
                <div className="text-[11px] text-slate-500">
                  Outputs: {p.outputs?.join(', ')}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PatternLibrary
