import 'dotenv/config'
import { prisma } from '@/lib/db'

async function main() {
  const subs = await prisma.subscription.findMany({
    include: { user: true },
  })

  console.log(`Found ${subs.length} subscriptions`)

  for (const s of subs) {
    await prisma.subscription.update({
      where: { id: s.id },
      data: {
        subscriberName: s.user.fullName,
        subscriberEmail: s.user.email,
      },
    })

    console.log(`Updated sub ${s.id}`)
  }

  console.log('Done.')
}

main()
