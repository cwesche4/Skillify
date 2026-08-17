'use client'

import type { AutomationVersion } from '@/lib/versioning/types'
import { Button } from '@/components/ui/Button'

interface VersionHistoryPanelProps {
  versions: AutomationVersion[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onRestore?: (id: string) => void
  visible?: boolean
}

export default function VersionHistoryPanel({
  versions,
  loading,
  error,
  onRefresh,
  onRestore,
  visible = false,
}: VersionHistoryPanelProps) {
  if (!visible) return null

  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-50 w-80 rounded-xl border border-slate-800/70 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Version History
          </p>
          <p className="text-[11px] text-slate-500">Manual restore only</p>
        </div>
        <Button
          size="xs"
          variant="subtle"
          onClick={onRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </div>
      )}

      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {loading && <p className="text-[11px] text-slate-500">Loading…</p>}
        {!loading && versions.length === 0 && (
          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
            No versions yet.
          </div>
        )}

        {versions.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-[12px]"
          >
            <div className="flex flex-col">
              <span className="font-semibold">
                {v.label || 'Untitled version'}
              </span>
              <span className="text-[11px] text-slate-500">
                {new Date(v.createdAt).toLocaleString()}
              </span>
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => onRestore?.(v.id)}
              disabled={loading}
            >
              Restore
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
