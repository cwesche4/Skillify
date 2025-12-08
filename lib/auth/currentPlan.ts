// lib/auth/currentPlan.ts
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function getAuthUser() {
  const clerk = await currentUser()
  if (!clerk) return null

  const user = await prisma.userProfile.findUnique({
    where: { clerkId: clerk.id },
  })

  return user
}
