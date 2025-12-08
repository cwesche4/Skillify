// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export default async function DashboardIndex() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  // grab first workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: { user: { clerkId: userId } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!membership?.workspace) {
    redirect('/onboarding/create-workspace')
  }

  redirect(`/dashboard/${membership.workspace.slug}`)
}
