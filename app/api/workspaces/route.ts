import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json([])

  const workspaces = await prisma.workspaceMember.findMany({
    where: { user: { clerkId: userId } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(workspaces.map((w: any) => w.workspace)) // <-- FIXED
}
