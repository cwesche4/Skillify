import { SubscriptionPlan } from '@/lib/prisma/enums'

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export const DEFAULT_TRIAL_DAYS = parsePositiveInteger(
  process.env.BILLING_DEFAULT_TRIAL_DAYS,
  14,
)

export const PAYMENT_METHOD_REQUIRED_DURING_TRIAL = parseBoolean(
  process.env.BILLING_PAYMENT_METHOD_REQUIRED_DURING_TRIAL,
  true,
)

export type BillingPlanId = Exclude<SubscriptionPlan, 'Free'>

export type BillingPlanDefinition = {
  id: BillingPlanId
  name: string
  monthlyPriceCents: number
  stripePriceEnvVar: string
  audience: string
  recommended?: boolean
  features: string[]
  expandedFeatures: string[]
}

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: SubscriptionPlan.Basic,
    name: 'Basic',
    monthlyPriceCents: 7900,
    stripePriceEnvVar: 'STRIPE_PRICE_BASIC_MONTHLY',
    audience: 'For small businesses getting organized in one workspace.',
    features: [
      'Lead and customer management',
      'Jobs and core scheduling',
      'Starter workflow automations',
      'Team and workspace setup',
      'Essential reporting',
    ],
    expandedFeatures: [
      'Custom business terminology',
      'Team member management',
      'Core operations tools',
    ],
  },
  {
    id: SubscriptionPlan.Pro,
    name: 'Pro',
    monthlyPriceCents: 17900,
    stripePriceEnvVar: 'STRIPE_PRICE_PRO_MONTHLY',
    audience:
      'For growing businesses managing more sales, scheduling, workflows, and team activity.',
    recommended: true,
    features: [
      'Everything in Basic',
      'Advanced CRM and scheduling',
      'Visual Workflow Builder',
      'Expanded automation capacity',
      'Workspace-aware AI assistant',
    ],
    expandedFeatures: [
      'Team availability and calendar connections',
      'AI that uses workspace context',
      'Richer analytics and operational reporting',
    ],
  },
  {
    id: SubscriptionPlan.Elite,
    name: 'Elite',
    monthlyPriceCents: 34900,
    stripePriceEnvVar: 'STRIPE_PRICE_ELITE_MONTHLY',
    audience: 'For businesses that want deeper automation and intelligence.',
    features: [
      'Everything in Pro',
      'Highest automation and AI capacity',
      'Advanced operational intelligence',
      'Deeper reporting and governance',
      'Priority rollout support',
    ],
    expandedFeatures: [
      'Advanced operations insights',
      'Higher automation and AI limits',
      'Support for larger teams and workspaces',
      'Deeper administrative controls',
    ],
  },
]

export function normalizeBillingPlan(value: unknown): BillingPlanId {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'elite') return SubscriptionPlan.Elite
  if (raw === 'pro') return SubscriptionPlan.Pro
  return SubscriptionPlan.Basic
}

export function getBillingPlan(planId: unknown) {
  const normalized = normalizeBillingPlan(planId)
  return (
    BILLING_PLANS.find((plan) => plan.id === normalized) ?? BILLING_PLANS[0]
  )
}

export function formatPlanPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
