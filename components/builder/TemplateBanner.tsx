'use client'

import type { FC } from 'react'

type Props = {
  onDuplicate?: () => void
}

// Canonical templates.
// Read-only reference only.
// Must be duplicated before modification or execution.
export const TemplateBanner: FC<Props> = ({ onDuplicate }) => {
  return (
    <div className="rounded border border-amber-700/60 bg-amber-900/70 px-3 py-2 text-sm text-amber-100 shadow-lg">
      <div className="font-semibold">Template (read-only)</div>
      <p className="text-[12px] text-amber-200">
        This template cannot be edited or executed. Duplicate to make changes.
      </p>
      {onDuplicate ? (
        <button
          type="button"
          className="mt-2 rounded bg-amber-700 px-3 py-1 text-xs text-white hover:bg-amber-600"
          onClick={onDuplicate}
        >
          Duplicate to edit
        </button>
      ) : null}
    </div>
  )
}

export default TemplateBanner
