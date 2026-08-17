import { prisma } from '@/lib/db'

export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string,
) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  })

  if (!member) {
    throw new Error('Not a workspace member')
  }

  return member
}
