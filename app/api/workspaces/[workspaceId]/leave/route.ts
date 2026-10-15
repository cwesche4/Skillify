import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import {
  leaveWorkspaceSafely,
  WorkspaceMemberMutationError,
} from '@/lib/workspaces/memberMutations'

export async function POST(
  _req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  try {
    await leaveWorkspaceSafely({
      workspaceId: params.workspaceId,
      userId: profile.id,
    })
  } catch (error) {
    if (error instanceof WorkspaceMemberMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }
    throw error
  }

  return NextResponse.json({ ok: true })
}
