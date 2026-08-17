'use client'

import type { FC } from 'react'

type Props = {
  nodeCount: number
  groupCount: number
  sectionCount: number
  activeRunLabel?: string
  demoLabel?: string
}

// Flow HUD.
// Read-only context only.
// Must not mutate builder or execution state.
export const FlowHud: FC<Props> = ({
  nodeCount,
  groupCount,
  sectionCount,
  activeRunLabel,
  demoLabel,
}) => {
  return (
    <div className="inline-flex items-center gap-3 rounded border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <span className="text-[11px] text-slate-400">Flow HUD (read-only)</span>
      <span className="rounded bg-slate-900 px-2 py-1">Nodes: {nodeCount}</span>
      <span className="rounded bg-slate-900 px-2 py-1">
        Groups: {groupCount}
      </span>
      <span className="rounded bg-slate-900 px-2 py-1">
        Sections: {sectionCount}
      </span>
      {activeRunLabel ? (
        <span className="rounded bg-emerald-900/40 px-2 py-1 text-emerald-100">
          Active run: {activeRunLabel}
        </span>
      ) : null}
      {demoLabel ? (
        <span className="rounded bg-amber-900/40 px-2 py-1 text-amber-100">
          {demoLabel}
        </span>
      ) : null}
    </div>
  )
}

export default FlowHud
