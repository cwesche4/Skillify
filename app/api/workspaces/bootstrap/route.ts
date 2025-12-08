import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  AutomationStatus,
  RunStatus,
  WorkspaceMemberRole,
} from '@prisma/client'

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
    profile = await prisma.userProfile.create({
      data: {
        clerkId,
        role: 'user',
      },
    })
  }

  return profile
}

async function getOrCreateOnboardingProgress(userId: string, tier: Tier) {
  const existing = await prisma.onboardingProgress.findUnique({
    where: { userId },
  })

  const stepsJson: any = existing?.steps ?? {}
  if (!stepsJson.plan) {
    stepsJson.plan = tier
  }

  if (!existing) {
    return prisma.onboardingProgress.create({
      data: {
        userId,
        steps: stepsJson,
        completed: false,
      },
    })
  }

  return prisma.onboardingProgress.update({
    where: { userId },
    data: {
      steps: stepsJson,
    },
  })
}

async function getOrCreateWorkspace(ownerId: string) {
  // For now, 1 primary workspace per owner
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
        // simple unique slug based on owner id
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
  // Only seed if no automations yet
  const existing = await prisma.automation.count({
    where: { workspaceId },
  })
  if (existing > 0) return

  // Common baseline flow (ReactFlow-style JSON placeholder)
  const baseFlow = {
    nodes: [],
    edges: [],
    meta: { version: 1 },
  }

  // Helper to create an automation with some runs
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

    // Create a few successful + failed runs
    const runsData = Array.from({ length: runCount }).map((_, idx) => {
      const success = idx % 4 !== 3 // ~75% success
      const started = new Date(Date.now() - (idx + 1) * 60 * 60 * 1000)

      return {
        automationId: automation.id,
        workspaceId,
        status: success ? RunStatus.SUCCESS : RunStatus.FAILED,
        startedAt: started,
        finishedAt: new Date(started.getTime() + 5 * 60 * 1000),
        log: success ? 'Run completed successfully' : 'Run failed: demo error',
      }
    })

    const createdRuns = await prisma.automationRun.createMany({
      data: runsData,
    })

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
      'Time-delayed messages after a new lead comes in.',
      AutomationStatus.PAUSED,
      4,
    )
    return
  }

  // elite
  await createAutomation(
    'AI Call Summary → CRM',
    'Summarize calls via AI and push into your CRM.',
    AutomationStatus.ACTIVE,
    10,
  )

  await createAutomation(
    'AI Intent Classifier',
    'Classify inbound messages by intent and priority.',
    AutomationStatus.ACTIVE,
    7,
  )

  await createAutomation(
    'VIP Escalation Flow',
    'Escalate high-value customers directly to your best reps.',
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
    // ignore, no body is fine
  }

  const requestedTier = normalizeTier(body?.tier)
  const profile = await ensureUserProfile(clerkUserId)

  // Sync onboarding progress + store chosen plan (hybrid flow: plan or skip)
  const progress = await getOrCreateOnboardingProgress(
    profile.id,
    requestedTier,
  )

  const effectiveTier = normalizeTier(
    (progress.steps as any)?.plan ?? requestedTier,
  )

  const { workspace, bootstrap } = await getOrCreateWorkspace(profile.id)

  // Seed demo automations only on first bootstrap
  if (bootstrap) {
    await seedDemoForTier(effectiveTier, profile.id, workspace.id)
  }

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
    },
    tier: effectiveTier,
    bootstrap,
  })
}
