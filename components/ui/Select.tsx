// components/ui/Select.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <select
          ref={ref}
          className={cn(
            'text-neutral-text-primary w-full rounded-xl border bg-slate-950/80 px-3 py-2 text-sm shadow-sm outline-none transition-colors',
            'focus:border-brand-primary/70 focus:ring-brand-primary/60 border-slate-700 focus:ring-1',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'
