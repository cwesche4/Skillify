'use client'

import React from 'react'

type Props = {
  entries: Array<{
    payload: { tab?: string }
  }>
  visible: boolean
}

function InspectorTelemetryDevPanelComponent({ entries, visible }: Props) {
  if (!visible || entries.length === 0) return null
  const aggregates = entries.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.payload.tab || 'config'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <details className="rounded-lg border border-slate-800/70 bg-slate-950/80 text-[11px] text-slate-200">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-slate-300">
        Advanced details
      </summary>
      <div className="border-t border-slate-800/70 p-3">
        <p className="mb-2 font-semibold text-slate-100">Most interacted</p>
        <ul className="space-y-1 text-[11px] text-slate-400">
          {Object.entries(aggregates)
            .slice(0, 5)
            .map(([key, count]) => (
              <li key={key} className="flex justify-between">
                <span>{key}</span>
                <span>{count}</span>
              </li>
            ))}
        </ul>
      </div>
    </details>
  )
}

export const InspectorTelemetryDevPanel = React.memo(
  InspectorTelemetryDevPanelComponent,
)
