// components/permissions/ProtectedFeature.tsx
'use client'

import type { ReactNode } from 'react'
import type { Plan, FeatureKey } from '@/lib/subscriptions/features'
import { hasFeature } from '@/lib/subscriptions/hasFeature'
import { PremiumInlineLock } from '@/components/upsell/PremiumInlineLock'

interface ProtectedFeatureProps {
  plan: Plan
  feature: FeatureKey
  workspaceSlug: string
  children: ReactNode
  lockMessage?: string
}

/**
 * Wrap any section/component that should be gated by a feature flag.
 * If the current plan does not include the feature, it renders the
 * blurred preview + upgrade CTA instead.
 */
export function ProtectedFeature({
  plan,
  feature,
  workspaceSlug,
  children,
  lockMessage,
}: ProtectedFeatureProps) {
  if (!hasFeature(plan, feature)) {
    return (
      <PremiumInlineLock
        plan={plan}
        feature={feature}
        workspaceSlug={workspaceSlug}
        message={lockMessage ?? 'Upgrade to unlock this feature.'}
      >
        {children}
      </PremiumInlineLock>
    )
  }

  return <>{children}</>
}
