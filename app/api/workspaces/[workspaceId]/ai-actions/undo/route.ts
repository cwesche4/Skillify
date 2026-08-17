import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { undoAiAction, computeAuditHash } from '@/lib/builder/ai/server/undo'
import { buildAiMetric, emitAiMetric } from '@/lib/observability/aiMetrics'
import { emitAiAlert } from '@/lib/observability/aiAlerts'

type UndoBody = {
  automationId?: string
  nodeId?: string
  undoActionId?: string
  currentNodeData?: Record<string, any>
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: UndoBody = {}
  try {
    body = (await req.json()) as UndoBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
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

  const result = await undoAiAction({
    workspaceId: params.workspaceId,
    automationId: body.automationId,
    nodeId: body.nodeId,
    actorUserId: profile.id,
    undoActionId: body.undoActionId,
    currentNodeData: body.currentNodeData,
  })

  if (!result.ok) {
    if (result.status === 409) {
      emitAiMetric(
        buildAiMetric({
          name: 'ai_action_denied',
          workspaceId: params.workspaceId,
          action: 'undo',
          result: 'denied',
          reason: 'conflict_detected',
        }),
      )
      emitAiAlert('undo_conflict_spike', params.workspaceId)
    }
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  emitAiMetric(
    buildAiMetric({
      name: 'ai_action_undone',
      workspaceId: params.workspaceId,
      action: 'undo',
      result: 'undone',
    }),
  )

  const restoredHash = await computeAuditHash(result.restored)

  return NextResponse.json({
    restored: result.restored,
    actionId: result.actionId,
    hash: restoredHash,
  })
}
