// components/upsell/FeatureLockOverlay.tsx
'use client'

import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface FeatureLockOverlayProps {
  planLabel: string
  requiredPlan?: 'Pro' | 'Elite'
  onUpgradeClick?: () => void
  className?: string
  subtle?: boolean // ✅ FIX: Add subtle here
  children?: React.ReactNode
}

export function FeatureLockOverlay({
  children,
  planLabel,
  requiredPlan,
  onUpgradeClick,
  subtle,
}: FeatureLockOverlayProps) {
  return (
    <div className="relative">
      <div
        className={cn(
          'pointer-events-none rounded-xl border border-dashed border-amber-500/40 bg-slate-950/60',
          subtle ? 'backdrop-blur-sm' : 'backdrop-blur-md',
        )}
      >
        {children}
      </div>

      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center">
        <div className="rounded-xl border border-amber-500/40 bg-slate-950/95 p-3 text-xs shadow-lg shadow-amber-900/40">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15">
              <Lock className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-amber-100">
                Unlock this premium feature
              </div>
              <div className="text-[10px] text-amber-200/80">
                Requires {requiredPlan} plan. You&apos;re on {planLabel}.
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="xs" variant="primary" onClick={onUpgradeClick}>
              View upgrade options
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
