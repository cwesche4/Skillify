import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ plan: 'Free' })

  const sub = await prisma.subscription.findFirst({
    where: { user: { clerkId: userId } },
  })

  return NextResponse.json({
    plan: sub?.plan ?? 'Free',
    status: sub?.status ?? 'inactive',
  })
}
