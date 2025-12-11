// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export default async function DashboardIndexPage() {
  const { userId } = auth()

  if (!userId) redirect('/sign-in')

  // Load user profile
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // No profile → return sign-in
  if (!profile) redirect('/sign-in')

  // If user has no workspace → onboarding
  if (!profile.memberships.length) {
    redirect('/onboarding/create-workspace')
  }

  // Redirect to first workspace
  redirect(`/dashboard/${profile.memberships[0].workspace.slug}`)
}
