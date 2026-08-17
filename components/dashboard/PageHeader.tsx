import React from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-neutral-text-secondary max-w-3xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
