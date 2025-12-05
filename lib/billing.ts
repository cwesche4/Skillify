// lib/billing.ts

export type BillingPlan = "BASIC" | "PRO" | "ELITE"

export function planRank(plan: BillingPlan): number {
  switch (plan) {
    case "BASIC":
      return 1
    case "PRO":
      return 2
    case "ELITE":
      return 3
    default:
      return 0
  }
}

/**
 * Returns true if `current` is >= `required`.
 * Example: hasPlan("PRO", "BASIC") → true
 */
export function hasPlan(current: BillingPlan, required: BillingPlan): boolean {
  return planRank(current) >= planRank(required)
}

/**
 * React helper to gate UI by plan.
 * Use in client components.
 */
export function featureAllowed(current: BillingPlan, minPlan: BillingPlan): boolean {
  return hasPlan(current, minPlan)
}
