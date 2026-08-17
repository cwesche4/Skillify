import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { handleWorkspaceMemberCalendarConnectionLifecycle } from '@/lib/scheduling/providers/calendarGovernance'

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

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: params.workspaceId,
      },
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 400 })
  }

  if (membership.role === WorkspaceMemberRole.OWNER) {
    const owners = await prisma.workspaceMember.count({
      where: {
        workspaceId: params.workspaceId,
        role: WorkspaceMemberRole.OWNER,
      },
    })

    if (owners <= 1) {
      return NextResponse.json(
        { error: 'Owner must transfer ownership before leaving' },
        { status: 400 },
      )
    }
  }

  await handleWorkspaceMemberCalendarConnectionLifecycle({
    workspaceId: params.workspaceId,
    workspaceMemberId: membership.id,
    transition: 'removed',
    actor: { workspaceMemberId: membership.id, userId: profile.id },
  })
  await prisma.workspaceMember.delete({
    where: { id: membership.id },
  })

  return NextResponse.json({ ok: true })
}
