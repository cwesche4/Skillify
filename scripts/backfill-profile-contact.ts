/**
 * Backfill UserProfile.fullName/email from Clerk.
 * Usage: npx tsx scripts/backfill-profile-contact.ts
 */
import 'dotenv/config'
import { createClerkClient } from '@clerk/backend'
import { prisma } from '@/lib/db'

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to backfill profile contact info')
  }

  const clerk = createClerkClient({ secretKey })

  const profiles = await prisma.userProfile.findMany({
    where: {
      OR: [{ fullName: null }, { email: null }],
    },
  })

  console.log(`Found ${profiles.length} profiles to backfill`)

  for (const profile of profiles) {
    try {
      const user = await clerk.users.getUser(profile.clerkId)
      const fullName =
        user.fullName ||
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
        null
      const email = user.primaryEmailAddress?.emailAddress ?? null

      await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          fullName: profile.fullName || fullName,
          email: profile.email || email,
        },
      })

      console.log(`Updated profile ${profile.id} (${profile.clerkId})`)
    } catch (err) {
      console.error(`Failed to update profile ${profile.id} (${profile.clerkId})`, err)
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
