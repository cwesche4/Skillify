// components/ui/Badge.tsx
import { cn } from '@/lib/utils'
import * as React from 'react'

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg'

export type BadgeVariant =
  | 'default'
  | 'blue'
  | 'green'
  | 'red'
  | 'purple'
  | 'orange'
  | 'yellow'
  | 'brand'
  | 'gray'
  | 'slate'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: BadgeSize
  variant?: BadgeVariant
}

/* -------------------------------
   SIZE STYLES
-------------------------------- */
function sizeClasses(size: BadgeSize = 'sm') {
  switch (size) {
    case 'xs':
      return 'text-[10px] px-2 py-0.5 rounded-full'
    case 'sm':
      return 'text-[11px] px-2.5 py-0.5 rounded-full'
    case 'md':
      return 'text-xs px-3 py-1 rounded-full'
    case 'lg':
      return 'text-sm px-3.5 py-1.5 rounded-full'
    default:
      return 'text-[11px] px-2.5 py-0.5 rounded-full'
  }
}

/* -------------------------------
   VARIANT STYLES
-------------------------------- */
function variantClasses(variant: BadgeVariant = 'default') {
  switch (variant) {
    case 'blue':
      return 'bg-sky-500/10 text-sky-700 border border-sky-500/35 dark:text-sky-300 dark:border-sky-500/40'
    case 'green':
      return 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/35 dark:text-emerald-300 dark:border-emerald-500/40'
    case 'red':
      return 'bg-rose-500/10 text-rose-700 border border-rose-500/35 dark:text-rose-300 dark:border-rose-500/40'
    case 'purple':
      return 'bg-violet-500/10 text-violet-700 border border-violet-500/35 dark:text-violet-300 dark:border-violet-500/40'
    case 'orange':
      return 'bg-amber-500/10 text-amber-700 border border-amber-500/35 dark:text-amber-300 dark:border-amber-500/40'
    case 'yellow':
      return 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/35 dark:text-yellow-300 dark:border-yellow-500/40'
    case 'gray':
    case 'slate':
      return 'bg-app-surface-muted text-app-secondary border border-app'

    /* --------------------------
       YOUR NEW BRAND VARIANT
    --------------------------- */
    case 'brand':
      return 'bg-brand-primary/10 text-brand-primary border border-brand-primary/40'

    case 'default':
    default:
      return 'bg-app-surface-muted text-app-secondary border border-app'
  }
}

/* -------------------------------
   COMPONENT
-------------------------------- */
export function Badge({
  className,
  size = 'sm',
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap align-middle font-medium',
        sizeClasses(size),
        variantClasses(variant),
        className,
      )}
      {...props}
    />
  )
}
