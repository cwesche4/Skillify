import 'dotenv/config'
import { prisma } from '@/lib/db'
import { createClerkClient } from '@clerk/nextjs/server'

async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

  const profiles = await prisma.userProfile.findMany({
    where: { OR: [{ fullName: null }, { email: null }] },
  })

  console.log(`Found ${profiles.length} profiles to update`)

  for (const p of profiles) {
    const user = await clerk.users.getUser(p.clerkId)

    const fullName =
      user.fullName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()

    const email = user.primaryEmailAddress?.emailAddress ?? null

    await prisma.userProfile.update({
      where: { id: p.id },
      data: { fullName, email },
    })

    console.log(`Updated ${p.clerkId}`)
  }

  console.log('Backfill complete.')
}

main()
