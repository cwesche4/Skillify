// lib/auth/getUserPlan.ts
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { resolveActiveSubscriptionPlan } from '@/lib/subscriptions/getWorkspacePlan'

// Local union so we never depend on features.ts exports
export type TierKey = 'basic' | 'pro' | 'elite'

/**
 * Looks up a user's subscription tier by their Clerk id.
 */
export async function getUserPlanByClerkId(clerkId: string): Promise<TierKey> {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  if (!profile) return 'basic'

  const sub = await prisma.subscription.findUnique({
    where: { userId: profile.id },
    select: {
      plan: true,
      status: true,
      trialEndsAt: true,
      complimentaryEndsAt: true,
    },
  })

  const raw = (resolveActiveSubscriptionPlan(sub) ?? 'Basic').toLowerCase()

  if (raw === 'pro' || raw === 'elite' || raw === 'basic') {
    return raw
  }

  return 'basic'
}

/**
 * Convenience wrapper using the current authenticated Clerk user.
 */
export async function getUserPlan(): Promise<TierKey | null> {
  const { userId } = auth()
  if (!userId) return null
  return getUserPlanByClerkId(userId)
}
