'use client'

import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Props = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export const SectionCollapse: FC<Props> = ({
  title,
  children,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 text-sm text-slate-100">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900/80"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold text-slate-100">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-slate-800 px-3 py-2">{children}</div>
      ) : null}
    </div>
  )
}

export default SectionCollapse
