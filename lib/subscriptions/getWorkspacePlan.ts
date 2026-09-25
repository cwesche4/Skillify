import type { Plan } from '@/lib/subscriptions/features'

const normalize = (p?: string | null) => p?.trim().toLowerCase()

export function normalizeWorkspacePlan(value?: string | null): Plan | null {
  const plan = normalize(value)
  if (plan === 'elite') return 'Elite'
  if (plan === 'pro') return 'Pro'
  if (plan === 'basic') return 'Basic'
  if (plan === 'free') return 'Free'
  return null
}

export function resolveWorkspacePlan(input: {
  workspaceSubscriptionPlan?: string | null
  ownerSubscriptionPlan?: string | null
}): Plan {
  return (
    normalizeWorkspacePlan(input.workspaceSubscriptionPlan) ??
    normalizeWorkspacePlan(input.ownerSubscriptionPlan) ??
    'Free'
  )
}

/** Resolve the effective workspace plan without using a member's personal plan. */
export async function getWorkspacePlan(
  workspaceId: string,
  _legacyCurrentClerkId?: string | null,
): Promise<Plan> {
  const { prisma } = await import('@/lib/db')
  // Resolve workspace, owner, and subscriptions in a single pass
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      subscription: { select: { plan: true } },
      owner: { select: { subscription: { select: { plan: true } } } },
    },
  })
  if (!workspace) return 'Free'

  return resolveWorkspacePlan({
    workspaceSubscriptionPlan: workspace.subscription?.plan,
    ownerSubscriptionPlan: workspace.owner?.subscription?.plan,
  })
}
