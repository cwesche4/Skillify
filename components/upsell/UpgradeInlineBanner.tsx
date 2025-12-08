// components/upsell/UpgradeInlineBanner.tsx
'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface UpgradeInlineBannerProps {
  title: string
  description: string
  ctaLabel?: string
  onClick?: () => void
  className?: string
}

export function UpgradeInlineBanner({
  title,
  description,
  ctaLabel = 'View plans',
  onClick,
  className,
}: UpgradeInlineBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs',
        className,
      )}
    >
      <div>
        <div className="font-medium text-slate-50">{title}</div>
        <p className="text-[11px] text-slate-300/90">{description}</p>
      </div>
      <Button
        size="xs"
        variant="primary"
        onClick={onClick}
        className="shrink-0"
      >
        {ctaLabel}
        <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  )
}
