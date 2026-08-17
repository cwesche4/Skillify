import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { buildHubSpotAuthUrl } from '@/lib/integrations/hubspot/auth'
import { logAudit } from '@/lib/audit/log'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'

export async function GET(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getUserPlanByClerkId(clerkId)
  if (plan === 'basic') {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { user: { clerkId } },
      },
    },
  })
  if (!workspace || workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider: 'hubspot' } },
    update: {
      status: 'disconnected',
      metadata: { state, stateCreatedAt: new Date().toISOString() },
    },
    create: {
      workspaceId,
      provider: 'hubspot',
      status: 'disconnected',
      metadata: { state, stateCreatedAt: new Date().toISOString() },
    },
  })

  const authUrl = buildHubSpotAuthUrl({ workspaceId, state })
  await logAudit({
    workspaceId,
    actorId: workspace.ownerId,
    action: 'CRM_CONNECTED',
    targetType: 'Integration',
    targetId: workspaceId,
    meta: { provider: 'hubspot', event: 'start_connect' },
  })

  return NextResponse.redirect(authUrl)
}
