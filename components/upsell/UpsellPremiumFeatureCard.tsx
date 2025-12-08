// components/upsell/UpsellPremiumFeatureCard.tsx
'use client'

import { Star } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface UpsellPremiumFeatureCardProps {
  label: string
  description: string
  requiredPlan: 'Pro' | 'Elite'
  onUpgradeClick?: () => void
}

export function UpsellPremiumFeatureCard({
  label,
  description,
  requiredPlan,
  onUpgradeClick,
}: UpsellPremiumFeatureCardProps) {
  return (
    <Card className="flex items-center justify-between gap-4 border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
          <Star className="h-3.5 w-3.5 text-amber-300" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-50">{label}</span>
            <Badge size="xs" variant="blue">
              {requiredPlan} feature
            </Badge>
          </div>
          <p className="text-[11px] text-slate-300/90">{description}</p>
        </div>
      </div>
      <Button size="xs" variant="primary" onClick={onUpgradeClick}>
        Upgrade to {requiredPlan}
      </Button>
    </Card>
  )
}
