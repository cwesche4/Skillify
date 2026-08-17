'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  if (!open) return null
  return <>{children}</>
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 pt-24">
      <div
        className={cn(
          'w-full max-w-xl rounded border border-slate-800 bg-slate-950 text-slate-100 shadow-xl',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}
