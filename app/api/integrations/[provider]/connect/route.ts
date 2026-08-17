import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider } from '@/lib/integrations/types'
import { buildHubSpotAuthUrl } from '@/lib/integrations/hubspot/auth'
import crypto from 'crypto'
import {
  getIntegrationProviderDefinition,
  resolveIntegrationProviderAvailability,
} from '@/lib/integrations/providerRegistry'

ensureIntegrationAdapters()

async function assertProPlan(userId: string) {
  const plan = await getUserPlanByClerkId(userId)
  if (plan === 'basic') {
    return false
  }
  return true
}

async function handleConnect(
  provider: IntegrationProvider,
  workspaceId: string,
  clerkId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { user: { clerkId } },
        select: { id: true, role: true },
      },
    },
  })
  const member = workspace?.members?.[0]
  if (!workspace || !member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // For HubSpot, kick off OAuth redirect with state
  if (provider === 'hubspot') {
    const definition = getIntegrationProviderDefinition('hubspot')
    const availability = definition
      ? resolveIntegrationProviderAvailability({
          provider: definition,
          workspaceId,
        })
      : null
    if (!availability?.canStartConnection) {
      return NextResponse.json(
        {
          error: availability?.status ?? 'configurationRequired',
          message:
            availability?.safeMessage ??
            'HubSpot requires Skillify deployment configuration.',
          missing: availability?.missingPlatformEnv ?? [],
        },
        { status: 503 },
      )
    }
    const state = crypto.randomBytes(16).toString('hex')
    const integration = await prisma.integration.upsert({
      where: {
        workspaceId_provider: { workspaceId, provider },
      },
      update: {
        status: 'disconnected',
        metadata: {
          state,
          stateCreatedAt: new Date().toISOString(),
        },
      },
      create: {
        workspaceId,
        provider,
        status: 'disconnected',
        metadata: { state, stateCreatedAt: new Date().toISOString() },
      },
    })

    const authUrl = buildHubSpotAuthUrl({ workspaceId, state })
    return NextResponse.redirect(authUrl)
  }

  return NextResponse.json(
    {
      error: 'comingSoon',
      message: `${provider} connection is not implemented yet.`,
    },
    { status: 409 },
  )
}

export async function POST(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as IntegrationProvider
  const adapter = getIntegrationAdapter(provider)
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await assertProPlan(clerkId))) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string
  }
  const workspaceId = body.workspaceId
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  return handleConnect(provider, workspaceId, clerkId)
}

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as IntegrationProvider
  const adapter = getIntegrationAdapter(provider)
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await assertProPlan(clerkId))) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  return handleConnect(provider, workspaceId, clerkId)
}
