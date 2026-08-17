import { prisma } from '@/lib/db'

type AuditFilters = {
  from?: Date
  to?: Date
  actorUserId?: string
  action?: string
  nodeId?: string
  automationId?: string
  wasDenied?: boolean
}

export async function queryAiActionAudits(
  workspaceId: string,
  filters: AuditFilters = {},
) {
  const where: any = { workspaceId }

  if (filters.actorUserId) where.actorUserId = filters.actorUserId
  if (filters.action) where.action = filters.action
  if (filters.nodeId) where.nodeId = filters.nodeId
  if (filters.automationId) where.automationId = filters.automationId
  if (typeof filters.wasDenied === 'boolean')
    where.wasDenied = filters.wasDenied

  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = filters.from
    if (filters.to) where.createdAt.lte = filters.to
  }

  return prisma.aiActionAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
}
