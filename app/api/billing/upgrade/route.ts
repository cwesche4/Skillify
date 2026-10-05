import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { SubscriptionPlan } from '@prisma/client'
import { prisma } from '@/lib/db'

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

  return NextResponse.json(
    {
      error:
        'Self-service plan changes are unavailable during the controlled launch.',
      code: 'SELF_SERVICE_BILLING_DISABLED',
      requestedPlan: normalizedPlan,
    },
    { status: 503 },
  )
}
