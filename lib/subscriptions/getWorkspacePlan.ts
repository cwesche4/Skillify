import type { Plan } from '@/lib/subscriptions/features'
import { hasActiveSubscriptionAccess } from '@/lib/billing/onboardingAccess'

export type PlanSubscriptionInput = {
  plan?: string | null
  status?: string | null
  trialEndsAt?: Date | string | null
  complimentaryEndsAt?: Date | string | null
}

const normalize = (p?: string | null) => p?.trim().toLowerCase()

export function normalizeWorkspacePlan(value?: string | null): Plan | null {
  const plan = normalize(value)
  if (plan === 'elite') return 'Elite'
  if (plan === 'pro') return 'Pro'
  if (plan === 'basic') return 'Basic'
  if (plan === 'free') return 'Free'
  return null
}

export function resolveActiveSubscriptionPlan(
  subscription?: PlanSubscriptionInput | null,
  now = new Date(),
): Plan | null {
  if (!hasActiveSubscriptionAccess(subscription, now)) return null
  return normalizeWorkspacePlan(subscription?.plan)
}

export function resolveWorkspacePlan(input: {
  workspaceSubscription?: PlanSubscriptionInput | null
  ownerSubscription?: PlanSubscriptionInput | null
  now?: Date
}): Plan {
  const now = input.now ?? new Date()
  return (
    resolveActiveSubscriptionPlan(input.workspaceSubscription, now) ??
    resolveActiveSubscriptionPlan(input.ownerSubscription, now) ??
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
      subscription: {
        select: {
          plan: true,
          status: true,
          trialEndsAt: true,
          complimentaryEndsAt: true,
        },
      },
      owner: {
        select: {
          subscription: {
            select: {
              plan: true,
              status: true,
              trialEndsAt: true,
              complimentaryEndsAt: true,
            },
          },
        },
      },
    },
  })
  if (!workspace) return 'Free'

  return resolveWorkspacePlan({
    workspaceSubscription: workspace.subscription,
    ownerSubscription: workspace.owner?.subscription,
  })
}
