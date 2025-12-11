// components/upsell/PremiumInlineLock.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'

import type { Plan, FeatureKey } from '@/lib/subscriptions/features'
import { FeatureMatrix } from '@/lib/subscriptions/features'
import { Button } from '@/components/ui/Button'
import { UpsellDFYModal } from '@/components/upsell/UpsellDFYModal'

interface PremiumInlineLockProps {
  plan: Plan
  feature: FeatureKey
  workspaceSlug: string
  children: React.ReactNode
  message?: string
}

/**
 * Decide which plan is recommended for this feature.
 * If "Pro" is in the allowed list, we recommend Pro.
 * Otherwise we recommend Elite.
 */
function getRequiredPlan(feature: FeatureKey): 'Pro' | 'Elite' {
  const allowed = FeatureMatrix[feature] as readonly Plan[]
  return allowed.includes('Pro') ? 'Pro' : 'Elite'
}

export function PremiumInlineLock({
  plan,
  feature,
  workspaceSlug,
  children,
  message,
}: PremiumInlineLockProps) {
  const [dfyOpen, setDfyOpen] = useState(false)

  const requiredPlan = getRequiredPlan(feature)
  const isAlreadyAbove =
    plan === 'Elite' || (plan === 'Pro' && requiredPlan === 'Pro')

  const label =
    message ??
    (requiredPlan === 'Pro'
      ? 'Upgrade to Pro to unlock this feature.'
      : 'Upgrade to Elite to unlock this feature.')

  return (
    <>
      {/* BLURRED PREVIEW */}
      <div className="relative">
        {/* Actual content, blurred + disabled */}
        <div className="pointer-events-none select-none opacity-60 blur-[2px]">
          {children}
        </div>

        {/* Lock overlay */}
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-950/95">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800">
              <Lock className="h-3 w-3 text-amber-300" />
            </span>
            <span className="font-medium">
              Premium feature — {requiredPlan} plan
            </span>
          </div>

          <p className="max-w-sm text-center text-[11px] text-slate-400">
            {label}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            {!isAlreadyAbove && (
              <Link href={`/dashboard/${workspaceSlug}/upsell`}>
                <Button size="xs" variant="primary">
                  Upgrade to {requiredPlan}
                </Button>
              </Link>
            )}
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setDfyOpen(true)}
              className="inline-flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Done-for-you help
            </Button>
          </div>

          <p className="mt-1 text-[10px] text-slate-500">
            We&apos;ll keep this view blurred until you upgrade — but you still
            get a preview of what&apos;s possible.
          </p>
        </div>
      </div>

      {/* DFY REQUEST MODAL */}
      <UpsellDFYModal
        open={dfyOpen}
        onClose={() => setDfyOpen(false)}
        workspaceId={workspaceSlug} // using slug consistently like elsewhere
        feature={feature}
      />
    </>
  )
}
