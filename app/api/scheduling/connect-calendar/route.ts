// app/api/scheduling/connect-calendar/route.ts
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId, provider, email, externalId, timezone } =
    await req.json()

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })

  if (!profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 },
    )
  }

  const account = await prisma.calendarAccount.create({
    data: {
      userId: profile.id,
      workspaceId,
      provider,
      email,
      externalId,
      timezone,
    },
  })

  return NextResponse.json({ account })
}
