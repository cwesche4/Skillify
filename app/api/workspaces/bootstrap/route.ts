// app/api/workspaces/bootstrap/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  AutomationStatus,
  RunStatus,
  WorkspaceMemberRole,
} from '@/lib/prisma/enums'

type Tier = 'starter' | 'pro' | 'elite'

function normalizeTier(raw?: string | null): Tier {
  if (!raw) return 'starter'
  const lowered = raw.toLowerCase()
  if (lowered === 'pro') return 'pro'
  if (lowered === 'elite') return 'elite'
  return 'starter'
}

async function ensureUserProfile(clerkId: string) {
  let profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })

  if (!profile) {
    // Pull basic identity from Clerk
    const user = await clerkClient.users.getUser(clerkId)
    const fullName =
      user.fullName ||
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
      null
    const email = user.primaryEmailAddress?.emailAddress ?? null

    profile = await prisma.userProfile.create({
      data: {
        clerkId,
        role: 'user',
        fullName,
        email,
      },
    })
  }

  return profile
}

// NOTE: steps is a string[] now – no JSON plan object
async function getOrCreateOnboardingProgress(userId: string, tier: Tier) {
  const existing = await prisma.onboardingProgress.findUnique({
    where: { userId },
  })

  if (!existing) {
    return prisma.onboardingProgress.create({
      data: {
        userId,
        steps: [`plan:${tier}`], // safe string marker
        completed: false,
      },
    })
  }

  // Ensure we at least have a plan marker; keep everything as string[]
  const steps = existing.steps ?? []
  if (!steps.some((s) => s.startsWith('plan:'))) {
    steps.push(`plan:${tier}`)
  }

  return prisma.onboardingProgress.update({
    where: { userId },
    data: { steps },
  })
}

async function getOrCreateWorkspace(ownerId: string) {
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId },
  })

  let bootstrap = false

  if (!workspace) {
    bootstrap = true

    workspace = await prisma.workspace.create({
      data: {
        ownerId,
        name: 'Skillify HQ',
        slug: `workspace-${ownerId}`,
        members: {
          create: {
            userId: ownerId,
            role: WorkspaceMemberRole.OWNER,
          },
        },
      },
    })
  }

  return { workspace, bootstrap }
}

async function seedDemoForTier(
  tier: Tier,
  userId: string,
  workspaceId: string,
) {
  const existing = await prisma.automation.count({
    where: { workspaceId },
  })
  if (existing > 0) return

  const baseFlow = { nodes: [], edges: [], meta: { version: 1 } }

  async function createAutomation(
    name: string,
    description: string,
    status: AutomationStatus,
    runCount: number,
  ) {
    const automation = await prisma.automation.create({
      data: {
        userId,
        workspaceId,
        name,
        description,
        status,
        flow: baseFlow,
      },
    })

    const runsData = Array.from({ length: runCount }).map((_, idx) => {
      const success = idx % 4 !== 3
      const started = new Date(Date.now() - (idx + 1) * 60 * 60 * 1000)

      return {
        automationId: automation.id,
        workspaceId,
        status: success ? RunStatus.SUCCESS : RunStatus.FAILED,
        startedAt: started,
        finishedAt: new Date(started.getTime() + 5 * 60 * 1000),
        log: success ? 'Run completed successfully' : 'Run failed (demo)',
      } satisfies {
        automationId: string
        workspaceId: string
        status: RunStatus
        startedAt: Date
        finishedAt: Date
        log: string
      }
    })

    await prisma.automationRun.createMany({ data: runsData })
    return automation
  }

  if (tier === 'starter') {
    await createAutomation(
      'Missed Call → SMS Follow-up',
      'Sends a follow-up SMS when a call is missed.',
      AutomationStatus.ACTIVE,
      5,
    )
    return
  }

  if (tier === 'pro') {
    await createAutomation(
      'Webhook → Lead Routing',
      'Ingest leads via webhook and route to the right rep.',
      AutomationStatus.ACTIVE,
      8,
    )

    await createAutomation(
      'Lead Nurture Drip',
      'Delayed messages after a new lead arrives.',
      AutomationStatus.PAUSED,
      4,
    )
    return
  }

  await createAutomation(
    'AI Call Summary → CRM',
    'Summarize calls via AI and sync to CRM.',
    AutomationStatus.ACTIVE,
    10,
  )

  await createAutomation(
    'AI Intent Classifier',
    'Classify inbound messages automatically.',
    AutomationStatus.ACTIVE,
    7,
  )

  await createAutomation(
    'VIP Escalation Flow',
    'Escalate VIP messages quickly.',
    AutomationStatus.ACTIVE,
    6,
  )
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = auth()

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    // no body is fine
  }

  const requestedTier = normalizeTier(body?.tier)
  const profile = await ensureUserProfile(clerkUserId)

  await getOrCreateOnboardingProgress(profile.id, requestedTier)

  const { workspace, bootstrap } = await getOrCreateWorkspace(profile.id)

  if (bootstrap) {
    await seedDemoForTier(requestedTier, profile.id, workspace.id)
  }

  // IMPORTANT: keep this redirect – it’s what you had and it works
  return NextResponse.redirect(new URL(`/dashboard/${workspace.slug}`, req.url))
}
