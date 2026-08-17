import type { FC } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import type { FlowValidationResult } from '@/lib/builder/validation/validateFlow'

type Props = {
  validation: FlowValidationResult
}

export const FlowHealth: FC<Props> = ({ validation }) => {
  const errorCount =
    validation.nodeIssues.filter((i) => i.severity === 'error').length +
    validation.flowIssues.filter((i) => i.severity === 'error').length
  const warningCount =
    validation.nodeIssues.filter((i) => i.severity === 'warning').length +
    validation.flowIssues.filter((i) => i.severity === 'warning').length

  const statusIcon =
    errorCount > 0 ? (
      <ShieldAlert className="h-4 w-4 text-rose-500" aria-hidden />
    ) : (
      <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
    )

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200"
      aria-label="Flow health summary"
    >
      {statusIcon}
      <span className="font-medium">
        {errorCount > 0 ? 'Blocking errors present' : 'No blocking errors'}
      </span>
      <span className="ml-2 text-[11px] text-slate-400">
        {errorCount} errors • {warningCount} warnings
      </span>
    </div>
  )
}

export default FlowHealth
