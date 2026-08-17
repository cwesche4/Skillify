// components/ui/Textarea.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <textarea
          ref={ref}
          className={cn(
            'bg-app-surface-raised text-app-primary placeholder:text-app-muted w-full rounded-xl border px-3 py-2 text-sm shadow-sm outline-none transition-colors',
            'focus:border-brand-primary/70 focus:ring-brand-primary/60 border-app focus:ring-1',
            'min-h-[120px] resize-y',
            error &&
              'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/60',
            className,
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
