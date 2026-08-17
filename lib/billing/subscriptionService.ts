import { prisma } from '@/lib/db'
import {
  SubscriptionAccessSource,
  SubscriptionStatus,
  type SubscriptionAccessSource as SubscriptionAccessSourceValue,
} from '@/lib/prisma/enums'
import {
  DEFAULT_TRIAL_DAYS,
  normalizeBillingPlan,
  type BillingPlanId,
} from '@/lib/billing/plans'
import type { ResolvedAccess } from '@/lib/billing/accessCodes'

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getTrialEndDate(now: Date, trialDays = DEFAULT_TRIAL_DAYS) {
  return addDays(now, trialDays)
}

export async function activateSignupAccess({
  userId,
  resolvedAccess,
  now = new Date(),
}: {
  userId: string
  resolvedAccess: ResolvedAccess
  now?: Date
}) {
  const plan = normalizeBillingPlan(resolvedAccess.plan)
  const trialEndsAt = getTrialEndDate(now, resolvedAccess.trialDays)
  const currentPeriodEnd = resolvedAccess.complimentaryEndsAt ?? trialEndsAt
  const accessSource: SubscriptionAccessSourceValue =
    resolvedAccess.accessSource ?? SubscriptionAccessSource.NORMAL_TRIAL

  const subscription = await (prisma.subscription as any).upsert({
    where: { userId },
    update: {
      plan,
      status: SubscriptionStatus.trialing,
      trialEndsAt,
      complimentaryEndsAt: resolvedAccess.complimentaryEndsAt ?? null,
      paymentMethodRequired: resolvedAccess.paymentMethodRequired,
      accessSource,
      accessCodeId: resolvedAccess.accessCodeId ?? null,
      currentPeriodStart: now,
      currentPeriodEnd,
      canceledAt: null,
      cancelAtPeriodEnd: false,
    },
    create: {
      userId,
      plan,
      status: SubscriptionStatus.trialing,
      trialEndsAt,
      complimentaryEndsAt: resolvedAccess.complimentaryEndsAt ?? null,
      paymentMethodRequired: resolvedAccess.paymentMethodRequired,
      accessSource,
      accessCodeId: resolvedAccess.accessCodeId ?? null,
      currentPeriodStart: now,
      currentPeriodEnd,
    },
  })

  if (resolvedAccess.accessCodeId) {
    await (prisma.accessCodeRedemption as any).upsert({
      where: {
        accessCodeId_userId: {
          accessCodeId: resolvedAccess.accessCodeId,
          userId,
        },
      },
      update: { subscriptionId: subscription.id, redeemedAt: now },
      create: {
        accessCodeId: resolvedAccess.accessCodeId,
        userId,
        subscriptionId: subscription.id,
        redeemedAt: now,
      },
    })
    await (prisma.accessCode as any).update({
      where: { id: resolvedAccess.accessCodeId },
      data: { usesCount: { increment: 1 } },
    })
  }

  return subscription
}
