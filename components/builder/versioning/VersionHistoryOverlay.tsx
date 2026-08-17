'use client'

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Read-only version list overlay. No restore/diff yet.
============================================================================ */

import type { AutomationVersion } from '@/lib/versioning/types'
import { Button } from '@/components/ui/Button'

interface VersionHistoryOverlayProps {
  versions: AutomationVersion[]
  visible?: boolean
}

export default function VersionHistoryOverlay({
  versions,
  visible = false,
}: VersionHistoryOverlayProps) {
  if (!visible) return null

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-50 w-80 rounded-xl border border-slate-800/70 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Version History
          </p>
          <p className="text-[11px] text-slate-500">Preview only</p>
        </div>
        <Button size="xs" variant="subtle" disabled>
          Refresh
        </Button>
      </div>
      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {versions.length === 0 && (
          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
            No versions yet.
          </div>
        )}
        {versions.map((v) => (
          <div
            key={v.id}
            className="rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[12px]"
          >
            <div className="font-semibold">{v.label || 'Untitled version'}</div>
            <div className="text-[11px] text-slate-500">
              {new Date(v.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
