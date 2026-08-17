import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/lib/permissions/workspace'
import { handleWorkspaceMemberCalendarConnectionLifecycle } from '@/lib/scheduling/providers/calendarGovernance'

export async function POST(req: Request, { params }: any) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { workspaceId } = params
  const { memberId } = await req.json()

  const requester = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
  })

  if (!requester || !canManageWorkspace(requester.role)) {
    return fail('Not allowed', 403)
  }

  await handleWorkspaceMemberCalendarConnectionLifecycle({
    workspaceId,
    workspaceMemberId: memberId,
    transition: 'removed',
    actor: { workspaceMemberId: requester.id, userId: requester.userId },
  })
  await prisma.workspaceMember.delete({
    where: { id: memberId },
  })

  return ok({ removed: true })
}
