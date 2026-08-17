import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit/log'

// Automation forking.
// Lineage is informational only.
// No runtime or config coupling.
export async function forkAutomation({
  automationId,
  userId,
}: {
  automationId: string
  userId: string
}) {
  const source = await prisma.automation.findUnique({
    where: { id: automationId },
  })
  if (!source) throw new Error('Source automation not found')

  const now = new Date()
  const fork = await prisma.automation.create({
    data: {
      userId,
      workspaceId: source.workspaceId,
      name: `${source.name} (fork)`,
      description: source.description,
      status: 'INACTIVE',
      flow: source.flow ?? Prisma.JsonNull,
    },
  })

  await logAuditEvent({
    workspaceId: source.workspaceId,
    actorId: userId,
    action: 'automation.forked',
    objectId: fork.id,
    objectType: 'automation',
    metadata: { forkedFromId: source.id, forkedAt: now.toISOString() },
  })

  return fork
}
