import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  normalizeAccessCode,
  resolveAccessCode,
} from '@/lib/billing/accessCodes'
import { normalizeBillingPlan } from '@/lib/billing/plans'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code = normalizeAccessCode(body?.code)
  const plan = normalizeBillingPlan(body?.plan)
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })

  const record = code
    ? await (prisma.accessCode as any).findUnique({ where: { code } })
    : null
  const userUses =
    record && profile
      ? await (prisma.accessCodeRedemption as any).count({
          where: { accessCodeId: record.id, userId: profile.id },
        })
      : 0
  const access = resolveAccessCode({
    code,
    record,
    selectedPlan: plan,
    userUses,
  })

  if (!access.valid) {
    return NextResponse.json(
      { error: 'That code is invalid or no longer available.' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    access: {
      message: access.message,
      trialDays: access.trialDays,
      paymentMethodRequired: access.paymentMethodRequired,
      complimentaryEndsAt: access.complimentaryEndsAt?.toISOString() ?? null,
      discountPercent: access.discountPercent ?? null,
      discountAmountCents: access.discountAmountCents ?? null,
    },
  })
}
