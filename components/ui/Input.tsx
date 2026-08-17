// components/ui/Input.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, error, 'aria-describedby': ariaDescribedBy, ...props },
    ref,
  ) => {
    const generatedErrorId = React.useId()
    const errorId = error ? `${generatedErrorId}-error` : undefined
    const describedBy =
      [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined
    return (
      <div className="space-y-1">
        <input
          ref={ref}
          aria-describedby={describedBy}
          className={cn(
            'bg-app-surface-raised text-app-primary placeholder:text-app-muted disabled:bg-app-surface-muted disabled:text-app-muted w-full rounded-xl border px-3 py-2 text-sm shadow-sm outline-none transition-colors',
            'focus:border-brand-primary/70 focus:ring-brand-primary/60 border-app focus:ring-1',
            error &&
              'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/60',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-[11px] text-rose-300">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
