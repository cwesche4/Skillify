import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { resolveOnboardingAccessState } from '@/lib/billing/onboardingAccess'

export async function getOnboardingDestinationForCurrentUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) return '/sign-in'

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: {
      subscription: true,
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const firstWorkspace = profile?.memberships[0]?.workspace ?? null
  const state = resolveOnboardingAccessState({
    hasUserProfile: Boolean(profile),
    subscription: profile?.subscription as any,
    workspaceCount: profile?.memberships.length ?? 0,
    setupCompleted: firstWorkspace ? true : undefined,
  })

  if (state === 'ACCOUNT_CREATED' || state === 'PLAN_REQUIRED') {
    return '/onboarding/plan'
  }
  if (state === 'WORKSPACE_REQUIRED') {
    return '/onboarding/create-workspace'
  }
  if (firstWorkspace) return `/dashboard/${firstWorkspace.slug}`
  return '/onboarding/plan'
}

export async function redirectToCurrentOnboardingDestination() {
  redirect(await getOnboardingDestinationForCurrentUser())
}
