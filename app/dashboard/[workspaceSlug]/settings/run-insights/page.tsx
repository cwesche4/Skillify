'use client'

import RunTimelineSettings from '@/components/builder/RunTimelineSettings'
import type { RunSettings } from '@/lib/runs/runSettings'

const defaultSettings: RunSettings = {
  showSummaryDefault: true,
  allowUserToggleSummary: true,
  allowCompare: true,
  allowHeatmap: true,
}

export default function RunInsightsSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 text-slate-100">
      <div>
        <h1 className="text-lg font-semibold">Run Insights Settings</h1>
        <p className="text-sm text-slate-400">
          Workspace and personal preferences for run summaries, compare, and
          heat overlays. Admins can set defaults; members can view effective
          settings.
        </p>
      </div>
      <RunTimelineSettings settings={defaultSettings} isAdmin />
    </div>
  )
}
