// app/api/admin/users/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'

async function requireAdmin() {
  const { userId } = auth()
  if (!userId) throw new Error('UNAUTH')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!profile || profile.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  // Elite-only access for admin users API
  const plan = await getUserPlanByClerkId(userId)
  if (plan !== 'elite') {
    throw new Error('PLAN_FORBIDDEN')
  }

  return profile
}

// GET /api/admin/users  — list users + simple stats
export async function GET() {
  try {
    await requireAdmin()

    const users = await prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        automations: {
          select: { id: true },
        },
        subscription: true,
      },
    })

    const result = users.map((u: any) => ({
      id: u.id,
      clerkId: u.clerkId,
      role: u.role,
      createdAt: u.createdAt,
      automationCount: u.automations.length,
      subscriptionStatus: u.subscription?.status ?? 'none',
      plan: u.subscription?.plan ?? null,
    }))

    return NextResponse.json({ users: result })
  } catch (err: any) {
    if (err.message === 'UNAUTH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err.message === 'PLAN_FORBIDDEN') {
      return NextResponse.json(
        { error: 'Elite plan required' },
        { status: 403 },
      )
    }
    console.error('Admin users API error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
