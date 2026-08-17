import React from 'react'

import { Button } from '@/components/ui/Button'
import { BrandIcon } from '@/components/branding/BrandLogo'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="border-app bg-app-surface-raised flex flex-col items-center justify-center rounded-xl border border-dashed px-8 py-16 text-center shadow-sm">
      <BrandIcon theme="dark" alt="" className="mb-5 h-12 w-12 opacity-80" />
      <h3 className="text-app-primary text-xl font-semibold">{title}</h3>
      <p className="text-neutral-text-secondary mt-3 max-w-md text-sm leading-6">
        {description}
      </p>

      {actionLabel && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
