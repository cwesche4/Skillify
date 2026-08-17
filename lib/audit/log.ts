import { prisma } from '@/lib/db'

// Audit log.
// Append-only, explicit events.
// No inference.
export async function logAuditEvent({
  workspaceId,
  actorId,
  action,
  objectId,
  objectType,
  metadata,
}: {
  workspaceId: string
  actorId?: string | null
  action: string
  objectId?: string | null
  objectType?: string | null
  metadata?: Record<string, any>
}) {
  const auditEvent = (prisma as any).auditEvent
  if (!auditEvent?.create) return

  await auditEvent.create({
    data: {
      workspaceId,
      actorId: actorId ?? null,
      action,
      objectId: objectId ?? null,
      objectType: objectType ?? null,
      metadata: metadata ?? {},
    },
  })
}

type LogAuditInput = {
  workspaceId: string
  actorId?: string | null
  action: string
  targetId?: string | null
  targetType?: string | null
  objectId?: string | null
  objectType?: string | null
  meta?: Record<string, any>
  metadata?: Record<string, any>
}

export async function logAudit(input: LogAuditInput) {
  try {
    await logAuditEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      objectId: input.objectId ?? input.targetId ?? null,
      objectType: input.objectType ?? input.targetType ?? null,
      metadata: input.metadata ?? input.meta ?? {},
    })
  } catch {
    // Audit logging must not break the user-facing action while schema drift is being resolved.
  }
}
