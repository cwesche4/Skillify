import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

function hashJson(value: Record<string, any> | null | undefined) {
  try {
    const json = JSON.stringify(value ?? {})
    return createHash('sha256').update(json).digest('hex')
  } catch {
    return ''
  }
}

async function computeIntegrityHash(params: {
  workspaceId: string
  action: string
  beforeData?: Record<string, any> | null
  afterData?: Record<string, any> | null
}) {
  const last = await prisma.aiActionAudit.findFirst({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { integrityHash: true },
  })

  const beforeHash = hashJson(params.beforeData)
  const afterHash = hashJson(params.afterData)
  const prevHash = last?.integrityHash ?? ''

  const base = `${params.workspaceId}:${params.action}:${beforeHash}:${afterHash}:${prevHash}:${Date.now()}`
  return createHash('sha256').update(base).digest('hex')
}

type AuditInput = {
  workspaceId: string
  automationId?: string | null
  nodeId?: string | null
  actorUserId: string
  action: string
  beforeData?: Record<string, any> | null
  afterData?: Record<string, any> | null
  wasDenied?: boolean
  reason?: string | null
  undoOfId?: string | null
}

/**
 * Append-only AI action audit log. Stores minimal node-level snapshots/diffs.
 * Do not pass PII; callers are responsible for scrubbing payloads.
 */
export async function recordAiActionAudit(input: AuditInput) {
  const integrityHash = await computeIntegrityHash({
    workspaceId: input.workspaceId,
    action: input.action,
    beforeData: input.beforeData ?? undefined,
    afterData: input.afterData ?? undefined,
  })

  await prisma.aiActionAudit.create({
    data: {
      workspaceId: input.workspaceId,
      automationId: input.automationId ?? null,
      nodeId: input.nodeId ?? null,
      actorUserId: input.actorUserId,
      action: input.action,
      beforeData: input.beforeData ?? undefined,
      afterData: input.afterData ?? undefined,
      wasDenied: input.wasDenied ?? false,
      reason: input.reason ?? null,
      undoOfId: input.undoOfId ?? null,
      integrityHash,
    },
  })
}
