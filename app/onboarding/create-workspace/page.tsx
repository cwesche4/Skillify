import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { ensureUserProfileFromClerkIdentity } from '@/lib/auth/userProfileLifecycle'
import { hasActiveSubscriptionAccess } from '@/lib/billing/onboardingAccess'
import { CreateFirstWorkspaceClient } from '@/components/workspaces/CreateFirstWorkspaceClient'

export default async function CreateWorkspacePage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  let profile = await prisma.userProfile.findUnique({
    where: { clerkId },
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
      clerkId,
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

  const firstWorkspace = profile.memberships[0]?.workspace
  if (firstWorkspace) redirect(`/dashboard/${firstWorkspace.slug}`)

  if (!hasActiveSubscriptionAccess(profile.subscription as any)) {
    redirect('/onboarding/plan')
  }

  return <CreateFirstWorkspaceClient />
}
