import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/lib/permissions/workspace'

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

  await prisma.workspaceMember.delete({
    where: { id: memberId },
  })

  return ok({ removed: true })
}
