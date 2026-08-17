import { SubscriptionStatus, type SubscriptionPlan } from '@/lib/prisma/enums'

export type OnboardingAccessState =
  | 'ACCOUNT_CREATED'
  | 'PLAN_REQUIRED'
  | 'PAYMENT_METHOD_REQUIRED'
  | 'TRIAL_ACTIVE'
  | 'WORKSPACE_REQUIRED'
  | 'SETUP_PENDING'
  | 'READY'

export type OnboardingAccessInput = {
  hasUserProfile: boolean
  subscription?: {
    plan?: SubscriptionPlan | string | null
    status?: string | null
    trialEndsAt?: Date | string | null
    complimentaryEndsAt?: Date | string | null
    paymentMethodRequired?: boolean | null
  } | null
  workspaceCount: number
  setupCompleted?: boolean
  now?: Date
}

function isFuture(value: Date | string | null | undefined, now: Date) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime()
}

export function hasActiveSubscriptionAccess(
  subscription: OnboardingAccessInput['subscription'],
  now = new Date(),
) {
  if (!subscription) return false
  if (subscription.status === SubscriptionStatus.active) return true
  if (subscription.status !== SubscriptionStatus.trialing) return false
  return (
    isFuture(subscription.trialEndsAt, now) ||
    isFuture(subscription.complimentaryEndsAt, now)
  )
}

export function resolveOnboardingAccessState(
  input: OnboardingAccessInput,
): OnboardingAccessState {
  const now = input.now ?? new Date()
  if (!input.hasUserProfile) return 'ACCOUNT_CREATED'
  if (!input.subscription) return 'PLAN_REQUIRED'
  if (!hasActiveSubscriptionAccess(input.subscription, now))
    return 'PLAN_REQUIRED'
  if (input.workspaceCount === 0) return 'WORKSPACE_REQUIRED'
  if (input.setupCompleted === false) return 'SETUP_PENDING'
  return 'READY'
}
