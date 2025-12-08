// lib/auth/requireWorkspaceAdmin.ts
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

type RequireAdminResult = {
  workspace: {
    id: string
    slug: string
    name: string
  }
  profile: {
    id: string
    clerkId: string
  }
}

/**
 * Use in server/admin pages:
 *   const { workspace, profile } = await requireWorkspaceAdmin(params.workspaceSlug)
 */
export async function requireWorkspaceAdmin(
  workspaceSlug: string,
): Promise<RequireAdminResult> {
  const { userId: clerkId } = auth()

  if (!clerkId) {
    redirect('/sign-in')
  }

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!profile) {
    redirect('/sign-in')
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      members: {
        where: {
          userId: profile!.id,
        },
        select: { role: true },
      },
    },
  })

  if (!workspace) {
    notFound()
  }

  const membership = workspace.members[0]
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    // Non-admins get a 404 so they can't even tell the admin route exists
    notFound()
  }

  return {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    },
    profile: {
      id: profile!.id,
      clerkId: profile!.clerkId,
    },
  }
}
