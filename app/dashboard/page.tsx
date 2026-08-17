// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { ensureUserProfileFromClerkIdentity } from '@/lib/auth/userProfileLifecycle'
import { resolveOnboardingAccessState } from '@/lib/billing/onboardingAccess'

export default async function DashboardIndexPage() {
  const { userId } = auth()

  // Not signed in → Clerk sign in
  if (!userId) {
    redirect('/sign-in')
  }

  let profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      subscription: true,
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!profile) {
    const user = await currentUser()
    if (!user) redirect('/sign-in')
    const createdProfile = await ensureUserProfileFromClerkIdentity({
      clerkId: userId,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.primaryEmailAddress?.emailAddress ?? null,
    })
    profile = {
      ...createdProfile,
      subscription: null,
      memberships: [],
    }
  }

  const state = resolveOnboardingAccessState({
    hasUserProfile: true,
    subscription: profile.subscription as any,
    workspaceCount: profile.memberships.length,
    setupCompleted: profile.memberships[0]?.workspace ? true : undefined,
  })

  if (state === 'PLAN_REQUIRED' || state === 'ACCOUNT_CREATED') {
    redirect('/onboarding/plan')
  }

  if (state === 'WORKSPACE_REQUIRED') {
    redirect('/onboarding/create-workspace')
  }

  const firstWs = profile.memberships[0]?.workspace
  if (!firstWs) redirect('/onboarding/create-workspace')

  redirect(`/dashboard/${firstWs.slug}`)
}
