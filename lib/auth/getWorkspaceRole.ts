import { prisma } from '@/lib/db'

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member'

/**
 * Resolve the current user's role in a workspace by slug.
 * Returns null if not a member.
 */
export async function getWorkspaceRole(params: {
  workspaceSlug: string
  clerkId: string
}): Promise<WorkspaceRole | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspace: { slug: params.workspaceSlug },
      user: { clerkId: params.clerkId },
    },
    select: { role: true },
  })

  if (!membership) return null
  const role = membership.role.toLowerCase() as WorkspaceRole
  if (role === 'owner' || role === 'admin') return role
  return 'member'
}
