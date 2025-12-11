// lib/subscriptions/normalizePlan.ts
import type { TierKey } from '@/lib/auth/getUserPlan'
import type { Plan } from '@/lib/subscriptions/features'

export function normalizePlan(tier: TierKey): Plan {
  switch (tier) {
    case 'elite':
      return 'Elite'
    case 'pro':
      return 'Pro'
    case 'basic':
    default:
      return 'Basic'
  }
}
