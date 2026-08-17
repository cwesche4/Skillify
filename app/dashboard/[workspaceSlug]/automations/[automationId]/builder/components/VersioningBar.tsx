'use client'

import { GitBranchPlus, GitCompare, Save } from 'lucide-react'

interface VersioningBarProps {
  versions: string[]
  currentVersion: string
  onChangeVersion?: (id: string) => void
  onSaveVersion?: () => void
  onCompare?: () => void
  className?: string
}

export default function VersioningBar({
  versions,
  currentVersion,
  onChangeVersion,
  onSaveVersion,
  onCompare,
  className,
}: VersioningBarProps) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800/70 bg-slate-950/90 px-3 py-2 text-slate-100 shadow-lg backdrop-blur ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <GitBranchPlus className="h-4 w-4 text-cyan-400" />
        <select
          className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          value={currentVersion}
          onChange={(e) => onChangeVersion?.(e.target.value)}
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <button
        className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-700 hover:bg-slate-800"
        onClick={onSaveVersion}
      >
        <Save className="h-4 w-4 text-emerald-400" />
        Save Version
      </button>

      <button
        className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-700 hover:bg-slate-800"
        onClick={onCompare}
      >
        <GitCompare className="h-4 w-4 text-amber-400" />
        Compare
      </button>
    </div>
  )
}
