'use client'

import type { FC } from 'react'
import type { DiffResult } from '@/lib/builder/diff/computeDiff'

type Props = {
  diff: DiffResult
}

// Diff preview.
// Informational only.
// No execution or inference.
export const DiffPreview: FC<Props> = ({ diff }) => {
  const hasChanges =
    diff.addedNodes.length ||
    diff.removedNodes.length ||
    diff.changedNodes.length ||
    diff.addedEdges.length ||
    diff.removedEdges.length

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100">
      <div className="text-[11px] text-slate-400">
        Change preview (read-only)
      </div>
      {!hasChanges ? (
        <div className="mt-1 text-[12px] text-slate-400">
          No changes detected.
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          {diff.addedNodes.length ? (
            <div className="text-emerald-200">
              Added nodes:{' '}
              <span className="font-mono">{diff.addedNodes.join(', ')}</span>
            </div>
          ) : null}
          {diff.removedNodes.length ? (
            <div className="text-rose-200">
              Removed nodes:{' '}
              <span className="font-mono">{diff.removedNodes.join(', ')}</span>
            </div>
          ) : null}
          {diff.changedNodes.length ? (
            <div className="text-amber-200">
              Changed nodes:{' '}
              <span className="font-mono">{diff.changedNodes.join(', ')}</span>
            </div>
          ) : null}
          {diff.addedEdges.length ? (
            <div className="text-emerald-200">
              Added edges:{' '}
              <span className="font-mono">{diff.addedEdges.join(', ')}</span>
            </div>
          ) : null}
          {diff.removedEdges.length ? (
            <div className="text-rose-200">
              Removed edges:{' '}
              <span className="font-mono">{diff.removedEdges.join(', ')}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default DiffPreview
