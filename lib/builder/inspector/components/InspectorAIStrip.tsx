'use client'

import { Sparkles } from 'lucide-react'
import React from 'react'
import { ActionPreviewPanel } from '@/components/builder/ai/ActionPreviewPanel'

type Props = {
  scoreVisible: boolean
  scoreValue: number
  scoreReason: string
  suggestion?: string | null
  canAiImprove: boolean
  sessionLocked?: boolean
  onDismissSuggestion: () => void
  onApplyFix?: () => void
}

function InspectorAIStripComponent({
  scoreVisible,
  scoreValue,
  scoreReason,
  suggestion,
  canAiImprove,
  sessionLocked,
  onDismissSuggestion,
  onApplyFix,
}: Props) {
  return (
    <>
      {!canAiImprove && (
        <div className="flex items-center justify-between rounded-md border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
          <span>AI actions are disabled by workspace settings.</span>
          <span className="text-[10px] text-slate-500">
            Contact an admin to re-enable.
          </span>
        </div>
      )}

      {sessionLocked && (
        <div className="flex flex-col gap-0.5 rounded-md border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-[11px] text-amber-100">
          <span>AI actions paused for this session.</span>
          <span className="text-[10px] text-amber-200/80">
            To prevent accidental changes, please confirm before continuing.
          </span>
        </div>
      )}

      {scoreVisible && (
        <div className="flex items-center gap-2 rounded-md border border-slate-800/70 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-200">
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-100">
            Score {scoreValue}
          </span>
          <span className="text-slate-300">{scoreReason}</span>
        </div>
      )}

      {suggestion && canAiImprove && !sessionLocked && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-800/70 bg-sky-900/10 px-3 py-2 text-[11px] text-slate-100">
          <Sparkles className="h-4 w-4 text-sky-400" />

          <div className="flex-1 space-y-1">
            <p className="text-[11px] font-semibold text-sky-200">
              AI suggestion
            </p>

            <p className="text-[11px] text-slate-200">{suggestion}</p>

            <p className="text-[10px] text-slate-400">
              Confidence: High confidence
            </p>

            <p className="text-[10px] text-slate-400">
              AI actions supported for this node
            </p>

            <ActionPreviewPanel
              title="This change would be applied to the selected node"
              description={suggestion || undefined}
            />
            {onApplyFix ? (
              <button
                className="text-[10px] text-emerald-200 hover:text-emerald-100"
                onClick={onApplyFix}
                type="button"
              >
                Apply suggestion
              </button>
            ) : null}
          </div>

          <button
            className="text-[10px] text-slate-400 hover:text-slate-200"
            onClick={onDismissSuggestion}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}

export const InspectorAIStrip = React.memo(InspectorAIStripComponent)
