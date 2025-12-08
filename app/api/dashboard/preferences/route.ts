// app/api/dashboard/preferences/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  const user = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 },
    )
  }

  const pref = await prisma.dashboardPreference.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  })

  return NextResponse.json(pref ?? { layout: null })
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { workspaceId, layout } = body as {
    workspaceId?: string
    layout?: unknown
  }

  if (!workspaceId || !layout) {
    return NextResponse.json(
      { error: 'workspaceId & layout required' },
      { status: 400 },
    )
  }

  const user = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 },
    )
  }

  const pref = await prisma.dashboardPreference.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
    update: { layout },
    create: {
      userId: user.id,
      workspaceId,
      layout,
    },
  })

  return NextResponse.json(pref)
}
