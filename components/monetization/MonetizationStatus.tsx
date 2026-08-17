import { useMemo } from 'react'

import { featureFlags } from '@/lib/config/featureFlags'
import { resolveEntitlement } from '@/lib/monetization/entitlementResolver'
import type {
  EntitlementKey,
  EntitlementResult,
  MonetizationPlanId,
} from '@/lib/monetization/contracts'

type MonetizationStatusProps = {
  workspaceId?: string
  planId?: MonetizationPlanId
}

const ENTITLEMENTS: EntitlementKey[] = [
  'analytics_dashboards',
  'inspector_heatmaps',
  'ai_assist',
  'preset_sharing',
  'marketplace_access',
]

const reasonLabels: Record<EntitlementResult['reason'], string> = {
  monetization_disabled: 'Locked (Preview disabled)',
  plan_insufficient: 'Locked (Plan insufficient)',
  not_configured: 'Allowed',
}

export function MonetizationStatus({
  workspaceId,
  planId,
}: MonetizationStatusProps) {
  const statuses = useMemo(
    () =>
      ENTITLEMENTS.map((entitlement) => ({
        entitlement,
        result: resolveEntitlement(entitlement, { workspaceId, planId }),
      })),
    [workspaceId, planId],
  )

  if (!featureFlags.monetizationPreview) return null

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
      <div className="mb-2 font-semibold text-slate-100">
        Monetization Preview
      </div>

      <ul className="space-y-1">
        {statuses.map(({ entitlement, result }) => (
          <li key={entitlement} className="flex items-center justify-between">
            <span className="text-slate-300">{entitlement}</span>
            <span
              className={
                result.entitled ? 'text-emerald-400' : 'text-slate-500'
              }
            >
              {result.entitled ? 'Allowed' : reasonLabels[result.reason]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
