import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { SalesPipelineClient } from '@/components/dashboard/sales/SalesPipelineClient'
import { prisma } from '@/lib/db'
import { canAccessSalesPipeline } from '@/lib/permissions/workspace'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function SalesPipelinePage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
        },
      },
    },
  })

  if (!workspace) redirect('/dashboard')

  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!membership) redirect('/dashboard')

  if (
    !canAccessSalesPipeline({
      workspaceRole: membership.role,
      globalRole: profile.role,
    })
  ) {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }
  const capabilities = getWorkspaceCapabilities(workspace as any)
  if (!capabilities.modules.sales)
    redirect(`/dashboard/${params.workspaceSlug}`)

  return (
    <SalesPipelineClient
      workspaceId={workspace.slug}
      workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
      canEditOwners={canManageWorkspaceOwners(membership.role)}
    />
  )
}
