'use client'

import type { FC, ReactNode } from 'react'

type Props = {
  children: ReactNode
  message: string
}

// Builder guardrails.
// Informational only.
// Must never block, infer, or mutate execution.
export const GuardrailHint: FC<Props> = ({ children, message }) => {
  return (
    <div className="group relative inline-flex items-center">
      {children}
      <div className="pointer-events-none absolute -right-2 -top-2 hidden min-w-[200px] rounded border border-amber-700/60 bg-amber-900/80 px-2 py-1 text-[11px] text-amber-100 shadow-lg group-hover:block">
        {message}
      </div>
    </div>
  )
}

export default GuardrailHint
