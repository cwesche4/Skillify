import React, { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'

type ReliabilityIndicatorsProps = {
  lastRunStatus: 'success' | 'failed' | 'unknown'
  validationIssueCount: number
  aiSuggestionsAvailable: boolean
  className?: string
}

const statusCopy: Record<
  ReliabilityIndicatorsProps['lastRunStatus'],
  { label: string; tone: 'success' | 'warn' | 'muted' }
> = {
  success: { label: 'Last run: Success', tone: 'success' },
  failed: { label: 'Last run: Needs attention', tone: 'warn' },
  unknown: { label: 'Last run: No completed runs yet', tone: 'muted' },
}

const toneClasses: Record<'success' | 'warn' | 'muted', string> = {
  success: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40',
  warn: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40',
  muted: 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/30',
}

function ReliabilityIndicatorsComponent({
  lastRunStatus,
  validationIssueCount,
  aiSuggestionsAvailable,
  className,
}: ReliabilityIndicatorsProps) {
  const runStatus = statusCopy[lastRunStatus] ?? statusCopy.unknown

  const validationText = useMemo(() => {
    if (validationIssueCount <= 0)
      return 'Validation: Clear — issues will appear here'
    return `Validation: ${validationIssueCount} issue${validationIssueCount === 1 ? '' : 's'}`
  }, [validationIssueCount])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-200 shadow-sm',
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full px-3 py-1 shadow-sm',
          toneClasses[runStatus.tone],
        )}
      >
        {runStatus.label}
      </span>
      <span
        className={cn(
          'rounded-full px-3 py-1 shadow-sm',
          validationIssueCount > 0 ? toneClasses.warn : toneClasses.success,
        )}
      >
        {validationText}
      </span>
      <span
        className={cn(
          'rounded-full px-3 py-1 shadow-sm',
          aiSuggestionsAvailable ? toneClasses.success : toneClasses.muted,
        )}
      >
        AI suggestions{' '}
        {aiSuggestionsAvailable ? 'available' : 'not available right now'}
      </span>
    </div>
  )
}

export const ReliabilityIndicators = memo(ReliabilityIndicatorsComponent)
