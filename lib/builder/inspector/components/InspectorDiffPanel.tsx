'use client'

import React from 'react'

type Props = {
  diffPanel: { summary: string; before: any; after: any } | null
  showDiff: boolean
  onToggleDiff: () => void
}

function InspectorDiffPanelComponent({
  diffPanel,
  showDiff,
  onToggleDiff,
}: Props) {
  if (!diffPanel) return null
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/80 p-3 text-[11px] text-slate-200">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-100">Suggested change diff</p>
        <button
          className="text-[10px] text-slate-400 hover:text-slate-200"
          onClick={onToggleDiff}
        >
          {showDiff ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="text-[11px] text-slate-400">{diffPanel.summary}</p>
      {showDiff && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase text-slate-500">Before</p>
            <pre className="max-h-48 overflow-auto rounded bg-slate-900/70 p-2 text-[11px] text-slate-100">
              {JSON.stringify(diffPanel.before, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">After</p>
            <pre className="max-h-48 overflow-auto rounded bg-slate-900/70 p-2 text-[11px] text-emerald-100">
              {JSON.stringify(diffPanel.after, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export const InspectorDiffSection = React.memo(InspectorDiffPanelComponent)
