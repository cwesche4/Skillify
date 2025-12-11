'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function DashboardShell({
  children,
  title,
  description,
  actions,
  className,
}: DashboardShellProps) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-8', className)}>
      {(title || description || actions) && (
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            {title && (
              <h1 className="text-neutral-text-primary text-2xl font-semibold tracking-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-neutral-text-secondary text-sm">
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex-shrink-0">{actions}</div>}
        </header>
      )}

      <div className="min-h-[200px]">{children}</div>
    </div>
  )
}
