// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export default async function DashboardIndexPage() {
  const { userId } = auth()

  // Not signed in → Clerk sign in
  if (!userId) {
    redirect('/sign-in')
  }

  // Find user profile & memberships
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // No profile yet → force onboarding (which will create workspace via bootstrap)
  if (!profile) {
    redirect('/onboarding/create-workspace')
  }

  // Profile exists but no workspaces → onboarding
  if (!profile.memberships.length) {
    redirect('/onboarding/create-workspace')
  }

  // Redirect to first workspace dashboard
  const firstWs = profile.memberships[0]?.workspace
  if (!firstWs) {
    // Safety fallback: go to onboarding
    redirect('/onboarding/create-workspace')
  }

  redirect(`/dashboard/${firstWs.slug}`)
}
