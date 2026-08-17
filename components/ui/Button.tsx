// components/ui/Button.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'subtle'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  leftIcon,
  rightIcon,
  loading,
  asChild,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)] disabled:opacity-50 disabled:cursor-not-allowed'

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-brand-primary text-white hover:bg-brand-primary/90 border border-brand-primary/80',
    secondary:
      'bg-app-surface-raised text-app-primary border border-app hover:bg-app-surface-hover',
    subtle:
      'bg-app-surface-muted text-app-primary border border-app hover:bg-app-surface-hover',
    outline:
      'bg-transparent text-app-primary border border-app hover:bg-app-surface-hover',
    ghost:
      'bg-transparent text-app-primary hover:bg-app-surface-hover border border-transparent',
    danger:
      'bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/80',
    destructive:
      'bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/80',
  }

  const sizes: Record<ButtonSize, string> = {
    xs: 'h-7 px-2 text-[11px]',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-10 px-4 text-sm',
    icon: 'h-9 w-9 p-0',
  }

  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-slate-200 border-t-transparent" />
      )}
      {leftIcon && <span className="flex items-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex items-center">{rightIcon}</span>}
    </button>
  )
}
