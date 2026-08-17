// app/api/admin/users/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

async function requireAdmin() {
  const { userId } = auth()
  if (!userId) throw new Error('UNAUTH')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!profile || profile.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  return profile
}

// GET /api/admin/users — list users with readable identity and workspace context
export async function GET() {
  try {
    await requireAdmin()

    const users = await prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clerkId: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
          },
        },
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                ownerId: true,
              },
            },
          },
        },
      },
    })

    const result = users.map((user) => ({
      id: user.id,
      clerkId: user.clerkId,
      fullName: user.fullName,
      name: user.fullName,
      email: user.email,
      globalRole: user.role,
      createdAt: user.createdAt,
      subscription: {
        plan: user.subscription?.plan ?? 'Free',
        status: user.subscription?.status ?? 'none',
      },
      workspaces: user.memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
        isOwner: membership.workspace.ownerId === user.id,
      })),
    }))

    return NextResponse.json({ users: result })
  } catch (err: any) {
    if (err.message === 'UNAUTH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin users API error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
