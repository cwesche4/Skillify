import { prisma } from '@/lib/db'
import { recordAiActionAudit } from './audit'
import { createHash } from 'crypto'

type UndoResult =
  | { ok: true; actionId: string; restored: Record<string, any> }
  | { ok: false; status: number; error: string }

function snapshotHash(data: Record<string, any> | null | undefined) {
  try {
    const json = JSON.stringify(data ?? {})
    return createHash('sha256').update(json).digest('hex')
  } catch {
    return null
  }
}

export async function computeAuditHash(
  data: Record<string, any> | null | undefined,
) {
  return snapshotHash(data)
}

/**
 * Undo latest AI action (or specific action) with conflict detection.
 * - Only actor with workspace membership can undo.
 * - Conflicts if current node snapshot hash differs from stored `beforeData`.
 */
export async function undoAiAction(params: {
  workspaceId: string
  automationId?: string | null
  nodeId?: string | null
  actorUserId: string
  undoActionId?: string | null
  currentNodeData?: Record<string, any> | null
}): Promise<UndoResult> {
  const { workspaceId, automationId, nodeId, actorUserId, undoActionId } =
    params

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: actorUserId },
    select: { id: true },
  })
  if (!membership) return { ok: false, status: 403, error: 'Forbidden' }

  const target = await prisma.aiActionAudit.findFirst({
    where: {
      workspaceId,
      automationId: automationId ?? undefined,
      nodeId: nodeId ?? undefined,
      wasDenied: false,
      undoOfId: null,
      ...(undoActionId ? { id: undoActionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!target) {
    return { ok: false, status: 404, error: 'No undoable action' }
  }

  const beforeHash = snapshotHash(target.beforeData as any)
  const currentHash = snapshotHash(params.currentNodeData as any)
  if (beforeHash && currentHash && beforeHash !== currentHash) {
    await recordAiActionAudit({
      workspaceId,
      automationId: automationId ?? undefined,
      nodeId: nodeId ?? undefined,
      actorUserId,
      action: 'undo',
      wasDenied: true,
      reason: 'conflict_detected',
      undoOfId: target.id,
    })
    return { ok: false, status: 409, error: 'Conflict detected' }
  }

  await recordAiActionAudit({
    workspaceId,
    automationId: automationId ?? undefined,
    nodeId: nodeId ?? undefined,
    actorUserId,
    action: 'undo',
    beforeData: target.afterData as any,
    afterData: target.beforeData as any,
    undoOfId: target.id,
  })

  return {
    ok: true,
    actionId: target.id,
    restored: (target.beforeData as Record<string, any>) ?? {},
  }
}
