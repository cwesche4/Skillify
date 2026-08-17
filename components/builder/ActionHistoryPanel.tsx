'use client'

import { useSyncExternalStore } from 'react'

import {
  getActionHistory,
  subscribeActionHistory,
  undoLastAction,
} from '@/lib/builder/history/actionHistory'
import { Button } from '@/components/ui/Button'

export function ActionHistoryPanel() {
  const actions = useSyncExternalStore(
    subscribeActionHistory,
    getActionHistory,
    () => [],
  )

  const last =
    [...actions].reverse().find((entry) => !entry.undone) ?? actions.at(-1)

  return (
    <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-950/80 p-3 text-[11px] text-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
          AI Action History
        </p>
        <Button
          size="xs"
          variant="secondary"
          disabled={!last || !!last?.undone}
          onClick={() => undoLastAction()}
        >
          Undo last
        </Button>
      </div>

      {last ? (
        <div className="space-y-1 rounded border border-slate-800/70 bg-slate-900/60 px-2 py-2">
          <p className="text-[11px] text-slate-100">{last.summary}</p>
          <p className="text-[10px] text-slate-500">
            {new Date(last.createdAt).toLocaleTimeString()}
          </p>
          <div className="space-y-0.5 text-[10px] text-slate-500">
            <p>This change was applied in a single, ordered step.</p>
            <p>No other nodes or connections were modified.</p>
            <p>Undo restores the previous configuration safely.</p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">No AI actions yet.</p>
      )}
    </div>
  )
}
