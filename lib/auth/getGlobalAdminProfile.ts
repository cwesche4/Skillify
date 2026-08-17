import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

export async function getGlobalAdminProfile() {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: {
      id: true,
      clerkId: true,
      role: true,
      subscription: {
        select: {
          plan: true,
        },
      },
      memberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!profile || profile.role !== 'admin') return null

  const firstWorkspace = profile.memberships[0]?.workspace ?? null

  return {
    id: profile.id,
    clerkId: profile.clerkId,
    role: profile.role,
    plan: profile.subscription?.plan ?? 'Free',
    firstWorkspace,
  }
}
