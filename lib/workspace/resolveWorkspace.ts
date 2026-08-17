// lib/workspace/resolveWorkspace.ts
import { prisma } from '@/lib/db'

export async function resolveWorkspace(clerkId: string, workspaceSlug: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) throw new Error('PROFILE_NOT_FOUND')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      members: {
        where: { userId: profile.id },
      },
    },
  })

  if (!workspace || workspace.members.length === 0) {
    throw new Error('WORKSPACE_ACCESS_DENIED')
  }

  return {
    workspace,
    role: workspace.members[0].role,
    userId: profile.id,
  }
}
