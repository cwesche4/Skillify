'use client'

import type { FC } from 'react'
import { useState } from 'react'
import type { WorkspaceDefaults } from '@/lib/workspaces/defaults'

type Props = {
  defaults: WorkspaceDefaults
  onChange?: (updated: WorkspaceDefaults) => void
}

export const WorkspaceDefaultsPanel: FC<Props> = ({ defaults, onChange }) => {
  const [draft, setDraft] = useState(defaults)

  const update = (partial: Partial<WorkspaceDefaults>) => {
    const next = { ...draft, ...partial }
    setDraft(next)
    onChange?.(next)
  }

  return (
    <div className="space-y-3 rounded border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        Workspace Defaults (explicit)
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-slate-200">
        <span>Name prefix</span>
        <input
          value={draft.namePrefix ?? ''}
          onChange={(e) => update({ namePrefix: e.target.value })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-slate-200">
        <span>Retry count</span>
        <input
          type="number"
          value={draft.retryCount ?? 0}
          onChange={(e) => update({ retryCount: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-slate-200">
        <span>Timeout (ms)</span>
        <input
          type="number"
          value={draft.timeoutMs ?? 0}
          onChange={(e) => update({ timeoutMs: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-slate-200">
        <span>AI model</span>
        <input
          value={draft.aiModel ?? ''}
          onChange={(e) => update({ aiModel: e.target.value })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-[12px] text-slate-200">
        <input
          type="checkbox"
          checked={draft.requiresApproval ?? false}
          onChange={(e) => update({ requiresApproval: e.target.checked })}
        />
        <span>Default requires approval</span>
      </label>
      <p className="text-[11px] text-slate-500">
        Defaults are applied on new nodes only and are always
        visible/overridable.
      </p>
    </div>
  )
}

export default WorkspaceDefaultsPanel
