import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import type { WorkspaceModuleKey } from '@/lib/workspaces/businessModelRegistry'

export async function requireCommerceModuleAccess({
  workspaceSlug,
  capability,
}: {
  workspaceSlug: string
  capability: WorkspaceModuleKey
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      members: {
        where: { userId: profile.id },
        select: { role: true },
      },
    },
  })
  if (!workspace) redirect('/dashboard')

  const membership = workspace.members[0]
  if (!membership) redirect('/dashboard')

  const capabilities = getWorkspaceCapabilities(workspace as any)
  if (!capabilities.modules[capability])
    redirect(`/dashboard/${workspace.slug}`)

  return {
    workspace,
    capabilities,
    membership,
  }
}
