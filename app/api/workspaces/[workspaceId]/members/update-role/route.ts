import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/lib/permissions/workspace'
import { logAudit } from '@/lib/audit/log'

export async function POST(req: Request, { params }: any) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { workspaceId } = params
  const { memberId, role } = await req.json()

  // Permission check
  const requester = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
  })

  if (!requester || !canManageWorkspace(requester.role)) {
    return fail('Not allowed', 403)
  }

  // Update role
  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
  })

  await logAudit({
    workspaceId,
    actorId: requester.userId,
    action: 'MEMBER_ROLE_CHANGED',
    targetType: 'WorkspaceMember',
    targetId: memberId,
    meta: { role },
  })

  return ok(updated)
}
