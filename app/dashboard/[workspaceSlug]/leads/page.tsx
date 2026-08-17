import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { LeadsClient } from '@/components/dashboard/sales/LeadsClient'
import { prisma } from '@/lib/db'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function LeadsPage({ params }: PageProps) {
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
  if (!capabilities.modules.leads) redirect(`/dashboard/${workspace.slug}`)

  return (
    <LeadsClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      workspaceTimezone={(workspace as any).timezone ?? 'America/New_York'}
      workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
      capabilities={capabilities}
      canEditOwners={canManageWorkspaceOwners(membership.role)}
    />
  )
}
