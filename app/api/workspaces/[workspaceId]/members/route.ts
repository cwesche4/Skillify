// app/api/workspaces/[workspaceId]/members/route.ts
import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/lib/permissions/workspace'

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) return fail('Unauthorized', 401)

  const { workspaceId } = params

  // 🔐 Ensure caller is actually a member of this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
  })

  if (!membership) {
    return fail('Not a member of this workspace', 403)
  }

  // Fetch members + pending invites in parallel
  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workspaceInvite.findMany({
      where: { workspaceId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return ok({
    members,
    invites,
    // Helpful flag for the Team Settings UI:
    // OWNER / ADMIN → true, MEMBER → false
    canManage: canManageWorkspace(membership.role),
  })
}
