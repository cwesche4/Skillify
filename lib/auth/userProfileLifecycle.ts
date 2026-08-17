import { prisma } from '@/lib/db'

export type ClerkIdentityInput = {
  clerkId: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  fullName?: string | null
}

export function getDisplayNameFromClerkIdentity(identity: ClerkIdentityInput) {
  return (
    identity.fullName ||
    `${identity.firstName ?? ''} ${identity.lastName ?? ''}`.trim() ||
    identity.username ||
    null
  )
}

export async function ensureUserProfileFromClerkIdentity(
  identity: ClerkIdentityInput,
) {
  const fullName = getDisplayNameFromClerkIdentity(identity)
  const email = identity.email ?? null

  const existing = await prisma.userProfile.findUnique({
    where: { clerkId: identity.clerkId },
  })

  if (!existing) {
    return prisma.userProfile.create({
      data: {
        clerkId: identity.clerkId,
        role: 'user',
        fullName,
        email,
      },
    })
  }

  const updateData: { fullName?: string; email?: string } = {}
  if (!existing.fullName && fullName) updateData.fullName = fullName
  if (!existing.email && email) updateData.email = email

  if (!Object.keys(updateData).length) return existing

  return prisma.userProfile.update({
    where: { clerkId: identity.clerkId },
    data: updateData,
  })
}

export function clerkWebhookIdentity(data: any): ClerkIdentityInput {
  return {
    clerkId: String(data?.id ?? ''),
    email: data?.email_addresses?.[0]?.email_address ?? null,
    firstName: data?.first_name ?? null,
    lastName: data?.last_name ?? null,
    username: data?.username ?? null,
  }
}
