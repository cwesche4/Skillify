import React from 'react'

import { cn } from '@/lib/utils'
import type { WorkspaceSetupStepStatus } from '@/lib/workspaces/workspaceSetup'

export function setupStatusLabel(
  status: WorkspaceSetupStepStatus | 'connectionError',
) {
  if (status === 'complete') return 'Complete'
  if (status === 'skipped') return 'Skipped'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'configurationRequired') return 'Configuration Required'
  if (status === 'actionRequired') return 'Action Required'
  if (status === 'connectionError') return 'Error'
  if (status === 'inProgress') return 'In Progress'
  return 'Not Started'
}

function setupStatusClasses(
  status: WorkspaceSetupStepStatus | 'connectionError',
) {
  if (status === 'complete') {
    return 'border border-emerald-300/35 bg-emerald-300/12 text-emerald-100'
  }
  if (status === 'skipped') {
    return 'border border-slate-500/30 bg-slate-700/30 text-slate-200'
  }
  if (status === 'unavailable' || status === 'configurationRequired') {
    return 'border border-violet-300/25 bg-violet-300/10 text-violet-100'
  }
  if (status === 'actionRequired') {
    return 'border border-amber-300/40 bg-amber-300/12 text-amber-100'
  }
  if (status === 'connectionError') {
    return 'border border-rose-300/40 bg-rose-300/12 text-rose-100'
  }
  if (status === 'inProgress') {
    return 'border border-sky-300/35 bg-sky-300/12 text-sky-100'
  }
  return 'border border-slate-600/35 bg-slate-800/80 text-slate-300'
}

export function SetupStatusBadge({
  status,
  className,
}: {
  status: WorkspaceSetupStepStatus | 'connectionError'
  className?: string
}) {
  const label = setupStatusLabel(status)
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-[6.75rem] items-center justify-center whitespace-nowrap rounded-full px-3 text-center text-[10px] font-semibold leading-none',
        setupStatusClasses(status),
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  )
}
