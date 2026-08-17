import { getBillingPlan, type BillingPlanId } from '@/lib/billing/plans'

export type StripeBillingConfiguration = {
  configured: boolean
  secretKeyDetected: boolean
  publishableKeyDetected: boolean
  webhookSecretDetected: boolean
  priceId?: string | null
  missing: string[]
}

export function getStripeBillingConfiguration(
  planId: BillingPlanId,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): StripeBillingConfiguration {
  const plan = getBillingPlan(planId)
  const priceId = env[plan.stripePriceEnvVar] ?? null
  const missing = [
    !env.STRIPE_SECRET_KEY ? 'STRIPE_SECRET_KEY' : null,
    !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      ? 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
      : null,
    !priceId ? plan.stripePriceEnvVar : null,
  ].filter((value): value is string => Boolean(value))

  return {
    configured: missing.length === 0,
    secretKeyDetected: Boolean(env.STRIPE_SECRET_KEY),
    publishableKeyDetected: Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhookSecretDetected: Boolean(env.STRIPE_WEBHOOK_SECRET),
    priceId,
    missing,
  }
}

export type CheckoutExecutionMode =
  | 'stripe_test_mode_ready'
  | 'stripe_configuration_required'
  | 'skillify_entitlement_only'

export function resolveCheckoutExecutionMode({
  planId,
  paymentMethodRequired,
  env = process.env,
}: {
  planId: BillingPlanId
  paymentMethodRequired: boolean
  env?: Partial<NodeJS.ProcessEnv>
}): CheckoutExecutionMode {
  if (!paymentMethodRequired) return 'skillify_entitlement_only'
  return getStripeBillingConfiguration(planId, env).configured
    ? 'stripe_test_mode_ready'
    : 'stripe_configuration_required'
}
