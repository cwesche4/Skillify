/**
 * Backfill Subscription.subscriberName/subscriberEmail from the linked UserProfile.
 * Usage: npx tsx scripts/backfill-subscription-contact.ts
 */
import 'dotenv/config'
import { prisma } from '@/lib/db'

async function main() {
  const subs = await prisma.subscription.findMany({
    include: { user: true },
  })

  console.log(`Found ${subs.length} subscriptions to check`)

  for (const sub of subs) {
    const name = sub.subscriberName || sub.user.fullName || null
    const email = sub.subscriberEmail || sub.user.email || null

    if (sub.subscriberName === name && sub.subscriberEmail === email) {
      continue
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        subscriberName: name,
        subscriberEmail: email,
      },
    })

    console.log(`Updated subscription ${sub.id} (${sub.userId})`)
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
