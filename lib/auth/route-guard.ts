// lib/auth/route-guard.ts
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceRole } from '@/lib/auth/getWorkspaceRole'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'

type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'
const planOrder: Plan[] = ['Free', 'Basic', 'Pro', 'Elite']

export async function requirePlan(required: Plan, workspaceId: string) {
  const { userId } = auth()

  if (!userId) redirect('/sign-in')

  const tier = await getUserPlanByClerkId(userId)

  const plan: Plan =
    tier === 'elite'
      ? 'Elite'
      : tier === 'pro'
        ? 'Pro'
        : tier === 'basic'
          ? 'Basic'
          : 'Free'

  const allowed = planOrder.indexOf(plan) >= planOrder.indexOf(required)

  if (!allowed) {
    redirect(`/dashboard/${workspaceId}/upsell?need=${required}`)
  }
}

export async function requireAdmin(workspaceId: string) {
  const role = await getWorkspaceRole(workspaceId)

  if (role !== 'owner' && role !== 'admin') {
    redirect(`/dashboard/${workspaceId}`)
  }
}
