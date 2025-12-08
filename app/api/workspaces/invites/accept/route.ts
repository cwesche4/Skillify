import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { token } = await req.json()

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
  })

  if (!invite) return fail('Invalid invite token', 400)
  if (invite.expiresAt < new Date()) return fail('Invite expired', 400)

  const userProfile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!userProfile) return fail('User not found', 400)

  await prisma.workspaceMember.create({
    data: {
      userId: userProfile.id,
      workspaceId: invite.workspaceId,
      role: invite.role,
    },
  })

  await prisma.workspaceInvite.update({
    where: { token },
    data: { acceptedAt: new Date() },
  })

  return ok({ joined: true })
}
