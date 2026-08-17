'use client'

import type { FC } from 'react'
import type { DiffResult } from '@/lib/builder/diff/computeDiff'
import DiffPreview from './DiffPreview'

type Props = {
  diff: DiffResult
  onConfirm: () => void
  onCancel: () => void
}

// Diff preview.
// Informational only.
// No execution or inference.
export const BuilderSaveBar: FC<Props> = ({ diff, onConfirm, onCancel }) => {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[520px] -translate-x-1/2 rounded border border-slate-800 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-2xl">
      <DiffPreview diff={diff} />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-100 hover:border-slate-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600"
        >
          Confirm save
        </button>
      </div>
    </div>
  )
}

export default BuilderSaveBar
