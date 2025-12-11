import 'dotenv/config'
import { prisma } from '@/lib/db'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// PG pool setup (required for standalone seed execution)
const url = process.env.DATABASE_URL
if (!url) throw new Error('❌ Missing DATABASE_URL')

const pool = new pg.Pool({ connectionString: url })

// ----------------------------------------------------
// Override Prisma client adapter for seed environment
// ----------------------------------------------------
prisma.$extends({
  client: {
    adapter: new PrismaPg(pool),
  },
})

// ----------------------------------------------------
// RUN SEED
// ----------------------------------------------------
async function main() {
  const devClerkId = 'dev_clerk_user'

  // --------------------------
  // 1. USER
  // --------------------------
  let user = await prisma.userProfile.findUnique({
    where: { clerkId: devClerkId },
  })

  if (!user) {
    user = await prisma.userProfile.create({
      data: {
        clerkId: devClerkId,
        role: 'user',
      },
    })
  }

  // --------------------------
  // 2. WORKSPACE
  // --------------------------
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
  })

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: 'Dev Skillify HQ',
        slug: `dev-workspace-${user.id}`,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER', // string enum
          },
        },
      },
    })
  }

  // --------------------------
  // 3. AUTOMATION + RUNS
  // --------------------------
  const exists = await prisma.automation.count({
    where: { workspaceId: workspace.id },
  })

  if (exists === 0) {
    const automation = await prisma.automation.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        name: 'Dev Demo Flow',
        description: 'A simple demo automation for local testing.',
        status: 'ACTIVE',
        flow: { nodes: [], edges: [], meta: { version: 1 } },
      },
    })

    await prisma.automationRun.createMany({
      data: [
        {
          automationId: automation.id,
          workspaceId: workspace.id,
          status: 'SUCCESS',
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          finishedAt: new Date(),
          log: 'Demo run success.',
        },
        {
          automationId: automation.id,
          workspaceId: workspace.id,
          status: 'FAILED',
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          finishedAt: new Date(),
          log: 'Demo run failed.',
        },
      ],
    })
  }

  console.log('✅ Seed completed')
}

// ----------------------------------------------------
// EXECUTE
// ----------------------------------------------------
main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
