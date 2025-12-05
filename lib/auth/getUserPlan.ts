// lib/auth/getUserPlan.ts
import { prisma } from "@/lib/db"
import { normalizePlan } from "@/lib/subscriptions/hasFeature"

export async function getUserPlanByClerkId(clerkId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })

  if (!profile?.subscription) return "basic" as const

  return normalizePlan(profile.subscription.plan)
}
