import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  normalizeAccessCode,
  resolveAccessCode,
  resolveDefaultAccess,
} from '@/lib/billing/accessCodes'
import { normalizeBillingPlan } from '@/lib/billing/plans'
import { resolveCheckoutExecutionMode } from '@/lib/billing/stripeClient'
import { activateSignupAccess } from '@/lib/billing/subscriptionService'
import { ensureUserProfileFromClerkIdentity } from '@/lib/auth/userProfileLifecycle'

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = normalizeBillingPlan(body?.plan)
  const code = normalizeAccessCode(body?.code)

  const clerkUser = await clerkClient.users.getUser(clerkId)
  const profile = await ensureUserProfileFromClerkIdentity({
    clerkId,
    fullName: clerkUser.fullName,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    username: clerkUser.username,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
  })

  const record = code
    ? await (prisma.accessCode as any).findUnique({ where: { code } })
    : null
  const userUses = record
    ? await (prisma.accessCodeRedemption as any).count({
        where: { accessCodeId: record.id, userId: profile.id },
      })
    : 0
  const resolvedAccess = code
    ? resolveAccessCode({ code, record, selectedPlan: plan, userUses })
    : resolveDefaultAccess(plan)

  if (!resolvedAccess.valid) {
    return NextResponse.json(
      { error: 'That code is invalid or no longer available.' },
      { status: 400 },
    )
  }

  const checkoutMode = resolveCheckoutExecutionMode({
    planId: plan,
    paymentMethodRequired: resolvedAccess.paymentMethodRequired,
  })

  if (
    checkoutMode === 'stripe_configuration_required' &&
    process.env.NODE_ENV === 'production'
  ) {
    return NextResponse.json(
      {
        error:
          'Stripe billing is not configured for payment-method collection.',
        code: 'STRIPE_CONFIGURATION_REQUIRED',
      },
      { status: 503 },
    )
  }

  const subscription = await activateSignupAccess({
    userId: profile.id,
    resolvedAccess,
  })

  return NextResponse.json({
    ok: true,
    subscriptionId: subscription.id,
    checkoutMode,
    next: '/onboarding/create-workspace',
  })
}
