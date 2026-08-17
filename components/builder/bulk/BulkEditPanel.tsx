'use client'

import type { FC } from 'react'
import { useState } from 'react'
import type { Node } from 'reactflow'
import {
  applyBulkEdit,
  type BulkOverrides,
} from '@/lib/builder/bulk/applyBulkEdit'

type Props = {
  selectedIds: string[]
  nodes: Node[]
  onApply: (nodes: Node[]) => void
}

export const BulkEditPanel: FC<Props> = ({ selectedIds, nodes, onApply }) => {
  const [overrides, setOverrides] = useState<BulkOverrides>({})

  const handleApply = () => {
    const updated = applyBulkEdit(nodes, selectedIds, overrides)
    onApply(updated)
    setOverrides({})
  }

  const handleCancel = () => {
    setOverrides({})
  }

  const mixedLabel = '—'

  const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id))
  const currentRetry =
    new Set(selectedNodes.map((n) => n.data?.retryCount)).size === 1
      ? selectedNodes[0]?.data?.retryCount
      : undefined
  const currentTimeout =
    new Set(selectedNodes.map((n) => n.data?.timeoutMs)).size === 1
      ? selectedNodes[0]?.data?.timeoutMs
      : undefined
  const currentApproval =
    new Set(selectedNodes.map((n) => n.data?.requiresApproval)).size === 1
      ? selectedNodes[0]?.data?.requiresApproval
      : undefined

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      {/* Bulk edits.
          Explicit user action only.
          No inference or execution mutation. */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Bulk edit ({selectedIds.length})
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-slate-700 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded border border-emerald-600 px-3 py-1 text-[12px] font-semibold text-emerald-100 hover:border-emerald-500"
            disabled={Object.keys(overrides).length === 0}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-2 text-[12px] text-slate-200">
        <div className="text-[11px] text-amber-200">
          Bulk edits may require approval per workspace policy.
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Label prefix</span>
          <input
            value={overrides.labelPrefix ?? ''}
            placeholder={mixedLabel}
            onChange={(e) =>
              setOverrides((o) => ({ ...o, labelPrefix: e.target.value }))
            }
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Retry count</span>
          <input
            type="number"
            value={overrides.retryCount ?? ''}
            placeholder={currentRetry ?? mixedLabel}
            onChange={(e) =>
              setOverrides((o) => ({
                ...o,
                retryCount:
                  e.target.value === '' ? undefined : Number(e.target.value),
              }))
            }
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Timeout (ms)</span>
          <input
            type="number"
            value={overrides.timeoutMs ?? ''}
            placeholder={currentTimeout ?? mixedLabel}
            onChange={(e) =>
              setOverrides((o) => ({
                ...o,
                timeoutMs:
                  e.target.value === '' ? undefined : Number(e.target.value),
              }))
            }
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
          />
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={overrides.requiresApproval ?? currentApproval ?? false}
            onChange={(e) =>
              setOverrides((o) => ({
                ...o,
                requiresApproval: e.target.checked,
              }))
            }
          />
          <span className="text-[11px] text-slate-300">Requires approval</span>
        </label>
      </div>
    </div>
  )
}

export default BulkEditPanel
