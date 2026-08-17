import type { FC, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type SharedField<T> = {
  key: string
  label: string
  value: T | undefined
  conflicted: boolean
  renderInput: (value: T | undefined) => ReactNode
}

type Props<T> = {
  count: number
  sharedFields: SharedField<T>[]
  onApply: (updates: Record<string, unknown>) => void
  onCancel: () => void
}

export const BulkInspector = <T,>({
  count,
  sharedFields,
  onApply,
  onCancel,
}: Props<T>) => {
  const hasConflicts = sharedFields.some((f) => f.conflicted)

  const handleApply = () => {
    const updates: Record<string, unknown> = {}
    sharedFields.forEach((f) => {
      if (f.value !== undefined) updates[f.key] = f.value
    })
    onApply(updates)
  }

  return (
    <div className="space-y-3 rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-100">Bulk edit</div>
          <div className="text-[12px] text-slate-400">
            {count} nodes selected. Only shared fields are editable.
          </div>
        </div>
        {hasConflicts ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-amber-600/70 bg-amber-600/10 px-2 py-1 text-[11px] text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Conflicts present — differing values
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {sharedFields.map((field) => (
          <div
            key={field.key}
            className="space-y-1 rounded border border-slate-800 bg-slate-900/80 p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-200">
                {field.label}
              </span>
              {field.conflicted ? (
                <span className="text-[11px] text-amber-300">
                  Multiple values
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-slate-100">
              {field.renderInput(field.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 text-[12px]">
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-500"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded border border-emerald-700 bg-emerald-700/20 px-3 py-1 font-semibold text-emerald-100 hover:border-emerald-500"
          onClick={handleApply}
        >
          Apply changes
        </button>
      </div>
    </div>
  )
}

export default BulkInspector
