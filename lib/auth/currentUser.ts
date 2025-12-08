// -------------------------------------------------------------
// FILE: lib/auth/currentUser.ts
// -------------------------------------------------------------

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'

// Return Prisma user
export async function getCurrentUserProfile() {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  return prisma.userProfile.findUnique({
    where: { clerkId },
  })
}

// Require login
export async function requireUser() {
  const user = await getCurrentUserProfile()
  if (!user) redirect('/sign-in')
  return user
}

// Require GLOBAL ADMIN (not workspace admin)
export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/')
  return user
}

// Require workspace-level admin or owner
export async function requireWorkspaceAdmin(workspaceId: string) {
  const user = await requireUser()

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: user.id,
      role: { in: ['OWNER', 'ADMIN'] },
    },
  })

  if (!membership) redirect('/')

  return { user, membership }
}
