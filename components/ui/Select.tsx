// components/ui/Select.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  onValueChange?: (value: string) => void
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      error,
      children,
      onValueChange,
      onChange,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedErrorId = React.useId()
    const errorId = error ? `${generatedErrorId}-error` : undefined
    const describedBy =
      [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined
    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
      onChange?.(e)
      onValueChange?.(e.target.value)
    }

    return (
      <div className="space-y-1">
        <select
          ref={ref}
          aria-describedby={describedBy}
          className={cn(
            'bg-app-surface-raised text-app-primary w-full rounded-xl border py-2 pl-3 pr-10 text-sm shadow-sm outline-none transition-colors',
            'focus:border-brand-primary/70 focus:ring-brand-primary/60 border-app focus:ring-1',
            error &&
              'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/60',
            className,
          )}
          onChange={handleChange}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} className="text-[11px] text-rose-300">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'

export const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('inline-flex items-center', className)}
    {...props}
  >
    {children}
  </div>
))
SelectTrigger.displayName = 'SelectTrigger'

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return placeholder ? <option value="">{placeholder}</option> : null
}

export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

export function SelectItem({
  value,
  children,
  disabled,
}: {
  value: string
  children?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
}
