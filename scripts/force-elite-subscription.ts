import 'dotenv/config'
import { prisma } from '@/lib/db'

const clerkId = 'user_36i1OpJqIbG9XYtDX66ofvJtXEw'

async function main() {
  const user = await prisma.userProfile.findUnique({ where: { clerkId } })

  if (!user) {
    console.error('UserProfile missing.')
    return
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      subscriberName: user.fullName,
      subscriberEmail: user.email,
      plan: 'Elite',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date('2099-12-31T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    },
    update: {
      subscriberName: user.fullName,
      subscriberEmail: user.email,
      plan: 'Elite',
      status: 'active',
      currentPeriodEnd: new Date('2099-12-31T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    },
  })

  console.log('Elite subscription applied permanently.')
}

main()
