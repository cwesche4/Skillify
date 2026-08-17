import React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

type ClearFiltersButtonProps = {
  count: number
  onClear: () => void
  className?: string
}

export function ClearFiltersButton({
  count,
  onClear,
  className,
}: ClearFiltersButtonProps) {
  if (count <= 0) return null

  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/55 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
        className,
      )}
      aria-label={`Clear ${count} active ${count === 1 ? 'filter' : 'filters'}`}
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
      Clear Filters ({count})
    </button>
  )
}
