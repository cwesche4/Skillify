import type { FC, ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useJustCreated } from '@/lib/builder/nodes/useJustCreated'

type Props = {
  summary: ReactNode
  fields: ReactNode
  autoFocusSelector?: string
  justCreated?: boolean
  onConsumed?: () => void
}

export const InlineConfig: FC<Props> = ({
  summary,
  fields,
  autoFocusSelector,
  justCreated = false,
  onConsumed,
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useJustCreated(
    justCreated,
    () => onConsumed?.(),
    () => {
      setOpen(true)
      if (autoFocusSelector && containerRef.current) {
        const target = containerRef.current.querySelector(
          autoFocusSelector,
        ) as HTMLElement | null
        target?.focus()
      }
    },
  )

  return (
    <div
      ref={containerRef}
      className="rounded border border-slate-800 bg-slate-950/80 text-[12px] text-slate-100 shadow-sm"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-slate-900/80"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{summary}</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-slate-800 px-2 py-2">{fields}</div>
      ) : null}
    </div>
  )
}

export default InlineConfig
