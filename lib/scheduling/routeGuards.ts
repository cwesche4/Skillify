import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { canRouteToSchedulingSection } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import type { SchedulingSectionKey } from '@/lib/scheduling/types'

export async function requireSchedulingAccess({
  workspaceSlug,
}: {
  workspaceSlug: string
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
  if (!capabilities.scheduling.enabled) redirect(`/dashboard/${workspace.slug}`)

  return {
    workspace,
    capabilities,
    membership,
  }
}

export async function requireSchedulingSectionAccess({
  workspaceSlug,
  section,
}: {
  workspaceSlug: string
  section: SchedulingSectionKey
}) {
  const result = await requireSchedulingAccess({ workspaceSlug })
  if (!canRouteToSchedulingSection(result.capabilities.scheduling, section)) {
    redirect(`/dashboard/${result.workspace.slug}/scheduling/calendar`)
  }
  return result
}
