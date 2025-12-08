// lib/auth/getUserPlan.ts
import { prisma } from '@/lib/db'
import type { TierKey } from '@/lib/subscriptions/features'

export async function getUserPlanByClerkId(clerkId: string): Promise<TierKey> {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  if (!profile) return 'basic'

  const sub = await prisma.subscription.findUnique({
    where: { userId: profile.id },
    select: { plan: true },
  })

  const raw = sub?.plan?.toLowerCase() ?? 'basic'
  if (raw === 'pro' || raw === 'elite' || raw === 'basic') {
    return raw
  }

  // Anything weird falls back to basic
  return 'basic'
}
