// components/upsell/LockedFeatureTooltip.tsx
'use client'

import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface LockedFeatureTooltipProps {
  planLabel: string
  requiredPlan: 'Pro' | 'Elite'
  message?: string
  className?: string
}

export function LockedFeatureTooltip({
  planLabel,
  requiredPlan,
  message,
  className,
}: LockedFeatureTooltipProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2',
        className,
      )}
    >
      <div className="mt-0.5">
        <Info className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-amber-100">Locked feature</span>
          <Badge size="xs" variant="blue">
            Your plan: {planLabel}
          </Badge>
        </div>
        <p className="text-[11px] text-amber-200/90">
          Requires <span className="font-semibold">{requiredPlan}</span> to use
          this action.
          {message && <> {message}</>}
        </p>
      </div>
    </div>
  )
}
