'use client'

import type { FC } from 'react'

type Props = {
  forkedFromId?: string | null
}

// Automation forking.
// Lineage is informational only.
// No runtime or config coupling.
export const LineageBadge: FC<Props> = ({ forkedFromId }) => {
  if (!forkedFromId) return null
  return (
    <div className="inline-flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100">
      <span className="text-[11px] text-slate-400">Forked from</span>
      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-200">
        {forkedFromId}
      </span>
    </div>
  )
}

export default LineageBadge
