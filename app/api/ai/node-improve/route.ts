import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { assertAiActionsEnabled } from '@/lib/builder/ai/server/assertAiActionsEnabled'
import { recordAiActionAudit } from '@/lib/builder/ai/server/audit'
import { checkAiActionRate } from '@/lib/rate-limit/aiActions'
import { buildAiMetric, emitAiMetric } from '@/lib/observability/aiMetrics'
import { emitAiAlert } from '@/lib/observability/aiAlerts'

type Body = {
  workspaceId?: string
  automationId?: string
  nodeId?: string
  type?: string
  data?: Record<string, any>
}

function buildImprovedPatch(data: Record<string, any>, type?: string) {
  const patch: Record<string, any> = {}

  if (!data.label && type) {
    patch.label = type.replace(/^ai[-_]?/i, 'AI ').replace(/-/g, ' ')
  }

  if (!data.description && type) {
    patch.description = `AI-suggested configuration for ${type}`
  }

  if (typeof data.prompt === 'string') {
    const trimmed = data.prompt.trim()
    if (trimmed && trimmed.length > 0 && !trimmed.endsWith('.')) {
      patch.prompt = `${trimmed}.`
    }
  }

  return patch
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const workspaceId = body.workspaceId?.trim()
  const automationId = body.automationId?.trim()
  const nodeId = body.nodeId?.trim()
  const nodeType = body.type?.trim()
  const data = (body.data ?? {}) as Record<string, any>

  if (!workspaceId || !automationId || !nodeId || !nodeType) {
    return NextResponse.json(
      { error: 'workspaceId, automationId, nodeId, and type are required' },
      { status: 400 },
    )
  }

  const aiGuard = await assertAiActionsEnabled(workspaceId)
  if (aiGuard) {
    const actor = await prisma.userProfile.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (actor) {
      await recordAiActionAudit({
        workspaceId,
        automationId,
        nodeId,
        actorUserId: actor.id,
        action: 'node_improve',
        beforeData: data,
        wasDenied: true,
        reason: 'ai_actions_disabled',
      })
      emitAiMetric(
        buildAiMetric({
          name: 'ai_action_denied',
          workspaceId,
          action: 'node_improve',
          result: 'denied',
          reason: 'ai_actions_disabled',
        }),
      )
      emitAiAlert('denial_spike', workspaceId)
    }

    return aiGuard
  }

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 },
    )
  }

  const rate = checkAiActionRate({ workspaceId, userId: profile.id })
  if (!rate.allowed) {
    emitAiMetric(
      buildAiMetric({
        name: 'ai_action_rate_limited',
        workspaceId,
        action: 'node_improve',
        result: 'denied',
        reason: 'rate_limited',
      }),
    )
    emitAiAlert('rate_limit_spike', workspaceId)
    return NextResponse.json(
      {
        error: 'Too many AI actions. Please wait before trying again.',
        retryAfterMs: rate.retryAfterMs,
      },
      { status: 429 },
    )
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: profile.id },
    select: { id: true },
  })
  if (!membership) {
    await recordAiActionAudit({
      workspaceId,
      automationId,
      nodeId,
      actorUserId: profile.id,
      action: 'node_improve',
      beforeData: data,
      wasDenied: true,
      reason: 'not_workspace_member',
    })
    emitAiMetric(
      buildAiMetric({
        name: 'ai_action_denied',
        workspaceId,
        action: 'node_improve',
        result: 'denied',
        reason: 'not_workspace_member',
      }),
    )
    emitAiAlert('denial_spike', workspaceId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  emitAiMetric(
    buildAiMetric({
      name: 'ai_action_attempted',
      workspaceId,
      action: 'node_improve',
      result: 'applied',
    }),
  )

  const patch = buildImprovedPatch(data, nodeType)
  const afterData = { ...data, ...patch }

  await recordAiActionAudit({
    workspaceId,
    automationId,
    nodeId,
    actorUserId: profile.id,
    action: 'node_improve',
    beforeData: data,
    afterData,
  })

  emitAiMetric(
    buildAiMetric({
      name: 'ai_action_applied',
      workspaceId,
      action: 'node_improve',
      result: 'applied',
    }),
  )

  return NextResponse.json(patch)
}
