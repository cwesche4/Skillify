import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import { WorkspaceMemberRole } from '@prisma/client'
import { logAudit } from '@/lib/audit/log'
import { handleWorkspaceMemberCalendarConnectionLifecycle } from '@/lib/scheduling/providers/calendarGovernance'

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string; memberId: string } },
) {
  const actor = await requireWorkspaceRole(params.workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])

  const member = await prisma.workspaceMember.findUnique({
    where: { id: params.memberId },
  })

  if (!member || member.role === WorkspaceMemberRole.OWNER) {
    throw new Error('Cannot remove owner')
  }

  await handleWorkspaceMemberCalendarConnectionLifecycle({
    workspaceId: member.workspaceId,
    workspaceMemberId: params.memberId,
    transition: 'removed',
    actor: { userId: actor.userId },
  })
  await prisma.workspaceMember.delete({
    where: { id: params.memberId },
  })

  await logAudit({
    workspaceId: member.workspaceId,
    actorId: actor.userId,
    action: 'MEMBER_REMOVED',
    targetType: 'WorkspaceMember',
    targetId: params.memberId,
    meta: { role: member.role },
  })

  return NextResponse.json({ success: true })
}
