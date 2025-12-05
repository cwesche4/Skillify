import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"
import { canManageWorkspace } from "@/lib/permissions/workspace"

export async function POST(req: Request, { params }: any) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const { workspaceId } = params
  const { inviteId } = await req.json()

  const requester = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
  })

  if (!requester || !canManageWorkspace(requester.role)) {
    return fail("Not allowed", 403)
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  })

  if (!invite) return fail("Invite not found", 404)

  return ok({ resent: true })
}
