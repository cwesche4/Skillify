'use client'

import type { FC } from 'react'

// Compliance mode.
// Explicit workspace setting.
// No hidden changes.
export const ComplianceModeNotice: FC = () => {
  return (
    <div className="rounded border border-blue-700/60 bg-blue-900/60 px-3 py-2 text-xs text-blue-50">
      <div className="text-[11px] font-semibold uppercase text-blue-100">
        Compliance mode
      </div>
      <ul className="mt-1 list-disc pl-4 text-[11px] text-blue-50">
        <li>Change control policies enforced</li>
        <li>Secrets must use vault references</li>
        <li>Templates/demos remain read-only until duplicated</li>
        <li>Evidence exports available</li>
      </ul>
    </div>
  )
}

export default ComplianceModeNotice
