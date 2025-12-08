// app/api/workspace-role/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { workspaceId } = await req.json()

    const { userId: clerkId } = auth()
    if (!clerkId) {
      return NextResponse.json({ role: 'member' })
    }

    const profile = await prisma.userProfile.findUnique({
      where: { clerkId },
    })

    if (!profile) {
      return NextResponse.json({ role: 'member' })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: profile.id,
      },
      select: { role: true },
    })

    return NextResponse.json({
      role: membership?.role?.toLowerCase() ?? 'member',
    })
  } catch {
    return NextResponse.json({ role: 'member' })
  }
}
