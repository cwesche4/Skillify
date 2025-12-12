/**
 * Upsert an Elite, active subscription for a specific Clerk user.
 * Update the `clerkId` constant before running.
 *
 * Usage:
 *   npx tsx scripts/force-elite-subscription.ts
 */
import 'dotenv/config'
import { prisma } from '@/lib/db'

// TODO: Set to the target Clerk user id before running.
const clerkId = 'user_36i1OpJqIbG9XYtDX66ofvJtXEw'

async function main() {
  if (!clerkId) {
    throw new Error('Set the clerkId constant before running this script.')
  }

  // Ensure we have a profile
  let profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile) {
    profile = await prisma.userProfile.create({
      data: { clerkId, role: 'user' },
    })
  }

  const now = new Date()
  const farFuture = new Date('2099-12-31T00:00:00.000Z')
  const subscriberName = profile.fullName || null
  const subscriberEmail = profile.email || null

  await prisma.subscription.upsert({
    where: { userId: profile.id },
    create: {
      userId: profile.id,
      plan: 'Elite',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: farFuture,
      cancelAtPeriodEnd: false,
      subscriberName,
      subscriberEmail,
    },
    update: {
      plan: 'Elite',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: farFuture,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      subscriberName,
      subscriberEmail,
    },
  })

  console.log(`✅ Set Elite subscription for clerkId=${clerkId}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
