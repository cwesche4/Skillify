import { prisma } from '@/lib/db'

type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

const normalize = (p?: string | null) => p?.trim().toLowerCase()

/**
 * Resolve the effective workspace plan in priority order:
 * 1) Workspace.subscription (linked subscription)
 * 2) Workspace owner subscription
 * 3) Current user's subscription (if provided)
 * 4) Default Free
 */
export async function getWorkspacePlan(
  workspaceId: string,
  currentClerkId?: string | null,
): Promise<Plan> {
  // Resolve workspace, owner, and subscriptions in a single pass
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      subscription: { select: { plan: true } },
      owner: { select: { subscription: { select: { plan: true } } } },
    },
  })
  if (!workspace) return 'Free'

  const ownerId = workspace.ownerId

  // Workspace subscription first
  const wsPlan = normalize(workspace.subscription?.plan)
  if (wsPlan === 'elite') return 'Elite'
  if (wsPlan === 'pro') return 'Pro'
  if (wsPlan === 'basic') return 'Basic'

  // Owner subscription fallback
  const ownerPlan =
    normalize(workspace.owner?.subscription?.plan) ||
    (await (async () => {
      if (!ownerId) return null
      const res = await prisma.subscription.findUnique({
        where: { userId: ownerId },
        select: { plan: true },
      })
      return normalize(res?.plan)
    })())
  if (ownerPlan === 'elite') return 'Elite'
  if (ownerPlan === 'pro') return 'Pro'
  if (ownerPlan === 'basic') return 'Basic'

  // Current user subscription as last resort
  if (currentClerkId) {
    const profile = await prisma.userProfile.findUnique({
      where: { clerkId: currentClerkId },
      select: { id: true, subscription: { select: { plan: true } } },
    })
    const directPlan = normalize(profile?.subscription?.plan)
    if (directPlan === 'elite') return 'Elite'
    if (directPlan === 'pro') return 'Pro'
    if (directPlan === 'basic') return 'Basic'

    if (profile?.id) {
      const fallbackUserSub = await prisma.subscription.findUnique({
        where: { userId: profile.id },
        select: { plan: true },
      })
      const userPlan = normalize(fallbackUserSub?.plan)
      if (userPlan === 'elite') return 'Elite'
      if (userPlan === 'pro') return 'Pro'
      if (userPlan === 'basic') return 'Basic'
    }
  }

  return 'Free'
}
