// app/dashboard/admin/users/page.tsx

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'

export default async function AdminUsersPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  })

  // Must be global admin
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // Must also be on Elite to access system-wide admin users page
  const plan = await getUserPlanByClerkId(userId)
  if (plan !== 'elite') {
    redirect('/dashboard')
  }

  return <div>Admin Users Page</div>
}
