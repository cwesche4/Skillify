'use client'

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Visual skeleton for conflict resolution. No state, no handlers, no wiring.
============================================================================ */

import {
  CONFLICT_TYPES,
  type ConflictType,
} from '@/lib/collaboration/conflicts'

interface ConflictResolutionModalProps {
  conflictType?: ConflictType
  visible?: boolean
  onClose?: () => void // unused placeholder
}

export default function ConflictResolutionModal({
  conflictType,
  visible = false,
}: ConflictResolutionModalProps) {
  if (!visible) return null

  const conflict = conflictType || CONFLICT_TYPES[0]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-slate-800/70 bg-slate-950/95 p-5 text-slate-100 shadow-2xl">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Conflict Detected (Preview)
          </p>
          <h3 className="text-sm font-semibold text-slate-100">
            {conflict.label}
          </h3>
          <p className="text-[12px] text-slate-400">{conflict.description}</p>
        </div>

        <div className="space-y-2 text-[12px] text-slate-300">
          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-2">
            <div className="font-semibold">Options (conceptual)</div>
            <ul className="mt-1 space-y-1 text-slate-400">
              <li>• Keep mine</li>
              <li>• Use theirs</li>
              <li>• Fork new version</li>
              <li>• Cancel and reload</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-2 text-slate-400">
            No automatic merges. Human-in-the-loop only. Always reversible.
          </div>
        </div>
      </div>
    </div>
  )
}
