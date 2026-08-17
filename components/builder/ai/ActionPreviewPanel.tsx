import React from 'react'

type ActionPreviewPanelProps = {
  title: string
  description?: string
}

export function ActionPreviewPanel({
  title,
  description,
}: ActionPreviewPanelProps) {
  return (
    <div className="mt-2 space-y-1 rounded-md border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Preview (read-only)
      </p>
      <p className="text-[11px] text-slate-100">{title}</p>
      {description && (
        <p className="text-[11px] text-slate-400">{description}</p>
      )}
      <div className="space-y-0.5 rounded border border-slate-800/60 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-400">
        <p className="font-semibold text-slate-300">This would update:</p>
        <p className="text-slate-400">Node fields shown in this preview.</p>
        <p className="font-semibold text-slate-300">This will not change:</p>
        <p className="text-slate-400">
          Triggers, connections, billing, or live data.
        </p>
      </div>
      <div className="space-y-0.5 rounded border border-slate-800/60 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-400">
        <p className="font-semibold text-slate-300">Why you’re seeing this</p>
        <p>This suggestion appears when a node may be incomplete.</p>
        <p>Triggered by minimal or missing configuration.</p>
        <p>Based only on the selected node’s current data.</p>
      </div>
    </div>
  )
}
