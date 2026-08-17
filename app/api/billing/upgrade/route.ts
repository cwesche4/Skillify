import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SubscriptionPlan } from '@prisma/client'

const VALID_PLANS = [
  SubscriptionPlan.Free,
  SubscriptionPlan.Basic,
  SubscriptionPlan.Pro,
  SubscriptionPlan.Elite,
] as const

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { plan, workspaceId } = body as { plan?: string; workspaceId?: string }
  if (!plan || !VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  const normalizedPlan = plan as (typeof VALID_PLANS)[number]
  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      owner: { select: { id: true, clerkId: true } },
      subscriptionId: true,
    },
  })
  if (!workspace || workspace.owner.clerkId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Upsert subscription on owner and link workspace
    const sub = await prisma.subscription.upsert({
      where: { userId: workspace.owner.id },
      update: { plan: normalizedPlan, status: 'active' },
      create: {
        userId: workspace.owner.id,
        plan: normalizedPlan,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { subscriptionId: sub.id },
    })

    return NextResponse.json({ ok: true, plan: normalizedPlan })
  } catch (err) {
    console.error('Upgrade failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
