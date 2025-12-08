import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: any) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { workspaceId } = params

  // Fetch members + pending invites
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  return ok({ members, invites })
}
