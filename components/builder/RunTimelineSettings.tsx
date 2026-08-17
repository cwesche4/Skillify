'use client'

import { useMemo } from 'react'
import type { RunSettings } from '@/lib/runs/runSettings'

type RunTimelineSettingsProps = {
  settings: RunSettings
  onChange?: (next: RunSettings) => void
  isAdmin?: boolean
}

export default function RunTimelineSettings({
  settings,
  onChange,
  isAdmin = false,
}: RunTimelineSettingsProps) {
  const rows = useMemo(
    () => [
      {
        key: 'showSummaryDefault' as const,
        label: 'Enable Run Summary by default',
        adminOnly: true,
      },
      {
        key: 'allowUserToggleSummary' as const,
        label: 'Allow members to toggle summary',
        adminOnly: true,
      },
      {
        key: 'allowCompare' as const,
        label: 'Allow compare mode',
        adminOnly: true,
      },
      {
        key: 'allowHeatmap' as const,
        label: 'Allow heat overlays',
        adminOnly: true,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-950/80 p-3 text-sm text-slate-100">
      <div className="text-[13px] font-semibold text-slate-100">
        Run Insights & Timeline Settings
      </div>
      {!isAdmin && (
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-2 text-[12px] text-slate-300">
          Only workspace admins can change defaults. You can view effective
          settings below.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const checked = settings[row.key]
          return (
            <label
              key={row.key}
              className="flex items-center justify-between rounded-md bg-slate-900/70 px-2 py-2 text-[12px] text-slate-200"
            >
              <span>{row.label}</span>
              <input
                type="checkbox"
                checked={checked}
                disabled={!isAdmin || !row.adminOnly || !onChange}
                onChange={(e) =>
                  onChange?.({ ...settings, [row.key]: e.target.checked })
                }
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}
