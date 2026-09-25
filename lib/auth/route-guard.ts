// lib/auth/route-guard.ts
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceRole } from '@/lib/auth/getWorkspaceRole'
import { prisma } from '@/lib/db'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'
const planOrder: Plan[] = ['Free', 'Basic', 'Pro', 'Elite']

export async function requirePlan(required: Plan, workspaceId: string) {
  const { userId } = auth()

  if (!userId) redirect('/sign-in')

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
    select: { id: true },
  })
  if (!membership) redirect('/dashboard')

  const plan = await getWorkspacePlan(workspaceId)

  const allowed = planOrder.indexOf(plan) >= planOrder.indexOf(required)

  if (!allowed) {
    redirect(`/dashboard/${workspaceId}/upsell?need=${required}`)
  }
}

export async function requireAdmin(workspaceSlug: string) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const role = await getWorkspaceRole({ workspaceSlug, clerkId: userId })

  if (role !== 'owner' && role !== 'admin') {
    redirect(`/dashboard/${workspaceSlug}`)
  }
}
