import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { OpportunitiesClient } from '@/components/dashboard/sales/OpportunitiesClient'
import { prisma } from '@/lib/db'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function OpportunitiesPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
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
  if (!capabilities.modules.opportunities)
    redirect(`/dashboard/${workspace.slug}`)

  return (
    <OpportunitiesClient
      workspaceId={workspace.slug}
      workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
      canEditOwners={canManageWorkspaceOwners(membership.role)}
    />
  )
}
