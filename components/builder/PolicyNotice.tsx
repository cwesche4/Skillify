'use client'

import type { FC } from 'react'
import type { ChangeControlPolicies } from '@/lib/workspaces/policies'

// Change control.
// Explicit policy gates only.
// No inference.
export const PolicyNotice: FC<{ policies: ChangeControlPolicies }> = ({
  policies,
}) => {
  const flags: string[] = []
  if (policies.requirePublishApproval) flags.push('Publish requires approval')
  if (policies.requireProdEditApproval)
    flags.push('Production edits require approval')
  if (policies.requireSecretBindingApproval)
    flags.push('Secret bindings require approval')
  if (policies.bulkEditApprovalThreshold)
    flags.push(
      `Bulk edits over ${policies.bulkEditApprovalThreshold} nodes require approval`,
    )
  if (!flags.length) return null
  return (
    <div className="rounded border border-amber-700/60 bg-amber-900/60 px-3 py-2 text-xs text-amber-100">
      <div className="text-[11px] font-semibold uppercase text-amber-200">
        Change control
      </div>
      <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-100">
        {flags.map((flag) => (
          <li key={flag}>{flag}</li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-amber-200/90">
        Policies are informational; approval flows must be completed before
        production.
      </p>
    </div>
  )
}

export default PolicyNotice
