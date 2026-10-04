import { Prisma, type PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'
import { addDateKeys } from '@/lib/scheduling/schedulingDateTime'

export const ESTIMATE_VIEW_KEYS = [
  'ALL',
  'DRAFT',
  'AWAITING_DECISION',
  'EXPIRING_SOON',
  'EXPIRED',
  'DELIVERY_FAILED',
  'READY_TO_CREATE_WORK',
  'WORK_CREATED',
  'PRESENTED',
  'ACCEPTED',
  'DECLINED',
  'VOIDED',
  'ARCHIVED',
] as const

export type EstimateAttentionView = (typeof ESTIMATE_VIEW_KEYS)[number]
export type EstimateAttentionKind =
  | 'READY_TO_CREATE_WORK'
  | 'DELIVERY_FAILED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'

export function estimateAttentionWhere(input: {
  view: EstimateAttentionView
  workspaceDateKey: string
  now: Date
}): Prisma.EstimateWhereInput {
  const active = { archivedAt: null }
  switch (input.view) {
    case 'DRAFT':
    case 'PRESENTED':
    case 'ACCEPTED':
    case 'DECLINED':
    case 'VOIDED':
      return { ...active, status: input.view }
    case 'ARCHIVED':
      return { archivedAt: { not: null } }
    case 'AWAITING_DECISION':
      return {
        ...active,
        status: 'PRESENTED',
        OR: [
          { expiresOn: null },
          { expiresOn: { gte: input.workspaceDateKey } },
        ],
        decisionEvidence: null,
        shares: {
          some: {
            revokedAt: null,
            expiresAt: { gt: input.now },
            deliveries: { some: { status: 'SENT' } },
          },
        },
      }
    case 'EXPIRING_SOON':
      return {
        ...active,
        status: 'PRESENTED',
        expiresOn: {
          gte: input.workspaceDateKey,
          lte: addDateKeys(input.workspaceDateKey, 3),
        },
      }
    case 'EXPIRED':
      return {
        ...active,
        status: 'PRESENTED',
        expiresOn: { lt: input.workspaceDateKey },
      }
    case 'READY_TO_CREATE_WORK':
      return { ...active, status: 'ACCEPTED' }
    case 'WORK_CREATED':
      return { ...active, status: 'ACCEPTED' }
    case 'DELIVERY_FAILED':
    case 'ALL':
    default:
      return active
  }
}

export async function findDeliveryFailedEstimateIds(input: {
  workspaceId: string
  estimateIds?: string[]
  cursor?: { updatedAt: Date; id: string } | null
  leadId?: string
  customerId?: string
  limit?: number
}) {
  if (input.estimateIds && input.estimateIds.length === 0) return []
  const ids = input.estimateIds
    ? Prisma.sql`AND estimate."id" IN (${Prisma.join(input.estimateIds)})`
    : Prisma.empty
  const cursor = input.cursor
    ? Prisma.sql`AND (estimate."updatedAt" < ${input.cursor.updatedAt} OR (estimate."updatedAt" = ${input.cursor.updatedAt} AND estimate."id" < ${input.cursor.id}))`
    : Prisma.empty
  const lead = input.leadId
    ? Prisma.sql`AND estimate."leadId" = ${input.leadId}`
    : Prisma.empty
  const customer = input.customerId
    ? Prisma.sql`AND estimate."customerId" = ${input.customerId}`
    : Prisma.empty
  const limit = input.limit
    ? Prisma.sql`LIMIT ${Math.max(1, Math.min(51, input.limit))}`
    : Prisma.empty
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT estimate."id"
    FROM "Estimate" estimate
    WHERE estimate."workspaceId" = ${input.workspaceId}
      AND estimate."archivedAt" IS NULL
      ${ids}
      ${cursor}
      ${lead}
      ${customer}
      AND EXISTS (
        SELECT 1
        FROM "EstimateDelivery" failed
        WHERE failed."workspaceId" = estimate."workspaceId"
          AND failed."estimateId" = estimate."id"
          AND failed."status" = 'PERMANENTLY_FAILED'
          AND NOT EXISTS (
            SELECT 1
            FROM "EstimateDelivery" recovered
            WHERE recovered."workspaceId" = failed."workspaceId"
              AND recovered."estimateId" = failed."estimateId"
              AND recovered."origin" = 'MANUAL'
              AND recovered."status" = 'SENT'
              AND (
                recovered."requestedAt" > failed."requestedAt"
                OR (recovered."requestedAt" = failed."requestedAt" AND recovered."id" > failed."id")
              )
          )
      )
    ORDER BY estimate."updatedAt" DESC, estimate."id" DESC
    ${limit}
  `)
  return rows.map((row) => row.id)
}

export async function findOperationalizationViewEstimateIds(input: {
  workspaceId: string
  view: 'READY_TO_CREATE_WORK' | 'WORK_CREATED'
  estimateIds?: string[]
  cursor?: { updatedAt: Date; id: string } | null
  leadId?: string
  customerId?: string
  limit?: number
}) {
  if (input.estimateIds && input.estimateIds.length === 0) return []
  const ids = input.estimateIds
    ? Prisma.sql`AND estimate."id" IN (${Prisma.join(input.estimateIds)})`
    : Prisma.empty
  const cursor = input.cursor
    ? Prisma.sql`AND (estimate."updatedAt" < ${input.cursor.updatedAt} OR (estimate."updatedAt" = ${input.cursor.updatedAt} AND estimate."id" < ${input.cursor.id}))`
    : Prisma.empty
  const lead = input.leadId
    ? Prisma.sql`AND estimate."leadId" = ${input.leadId}`
    : Prisma.empty
  const customer = input.customerId
    ? Prisma.sql`AND estimate."customerId" = ${input.customerId}`
    : Prisma.empty
  const limit = input.limit
    ? Prisma.sql`LIMIT ${Math.max(1, Math.min(51, input.limit))}`
    : Prisma.empty
  const operationalization =
    input.view === 'WORK_CREATED' ? Prisma.sql`EXISTS` : Prisma.sql`NOT EXISTS`
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT estimate."id"
    FROM "Estimate" estimate
    WHERE estimate."workspaceId" = ${input.workspaceId}
      AND estimate."archivedAt" IS NULL
      AND estimate."status" = 'ACCEPTED'
      ${ids}
      ${cursor}
      ${lead}
      ${customer}
      AND ${operationalization} (
        SELECT 1
        FROM "EstimateOperationalization" work
        WHERE work."workspaceId" = estimate."workspaceId"
          AND work."referenceNumber" = estimate."referenceNumber"
      )
    ORDER BY estimate."updatedAt" DESC, estimate."id" DESC
    ${limit}
  `)
  return rows.map((row) => row.id)
}

export type EstimateAttentionSignal = {
  attention: EstimateAttentionKind | null
  awaitingDecision: boolean
  sentThroughSkillify: boolean
  followUp: {
    status: string
    dueAt: Date
  } | null
  workCreated: boolean
}

export type EstimateDashboardAttentionItem = {
  id: string
  title: string
  referenceNumber: string
  customerDisplayName: string
  kind: EstimateAttentionKind
  view: string
  attentionAt: string
}

export async function loadEstimateDashboardAttention(
  input: {
    workspaceId: string
    workspaceDateKey: string
  },
  db: Pick<PrismaClient, '$queryRaw'> = prisma,
) {
  const expiringThrough = addDateKeys(input.workspaceDateKey, 3)
  const rows = await db.$queryRaw<
    Array<{
      id: string
      title: string
      referenceNumber: string
      customerDisplayName: string
      kind: EstimateAttentionKind
      attentionAt: Date
      total: bigint
    }>
  >(Prisma.sql`
    WITH categorized AS (
      SELECT estimate."id",
             estimate."title",
             estimate."referenceNumber",
             COALESCE(customer."displayName", lead."displayName", estimate."contactNameSnapshot", 'Customer') AS "customerDisplayName",
             CASE
               WHEN estimate."status" = 'ACCEPTED'
                 AND NOT EXISTS (
                   SELECT 1 FROM "EstimateOperationalization" work
                   WHERE work."workspaceId" = estimate."workspaceId"
                     AND work."referenceNumber" = estimate."referenceNumber"
                 ) THEN 'READY_TO_CREATE_WORK'
               WHEN EXISTS (
                 SELECT 1 FROM "EstimateDelivery" failed
                 WHERE failed."workspaceId" = estimate."workspaceId"
                   AND failed."estimateId" = estimate."id"
                   AND failed."status" = 'PERMANENTLY_FAILED'
                   AND NOT EXISTS (
                     SELECT 1 FROM "EstimateDelivery" recovered
                     WHERE recovered."workspaceId" = failed."workspaceId"
                       AND recovered."estimateId" = failed."estimateId"
                       AND recovered."origin" = 'MANUAL'
                       AND recovered."status" = 'SENT'
                       AND (recovered."requestedAt", recovered."id") > (failed."requestedAt", failed."id")
                   )
               ) THEN 'DELIVERY_FAILED'
               WHEN estimate."status" = 'PRESENTED'
                 AND estimate."expiresOn" >= ${input.workspaceDateKey}
                 AND estimate."expiresOn" <= ${expiringThrough} THEN 'EXPIRING_SOON'
               WHEN estimate."status" = 'PRESENTED'
                 AND estimate."expiresOn" < ${input.workspaceDateKey} THEN 'EXPIRED'
             END AS "kind",
             COALESCE(estimate."acceptedAt", estimate."updatedAt") AS "attentionAt"
      FROM "Estimate" estimate
      LEFT JOIN "Customer" customer ON customer."id" = estimate."customerId" AND customer."workspaceId" = estimate."workspaceId"
      LEFT JOIN "Lead" lead ON lead."id" = estimate."leadId" AND lead."workspaceId" = estimate."workspaceId"
      WHERE estimate."workspaceId" = ${input.workspaceId}
        AND estimate."archivedAt" IS NULL
    ), actionable AS (
      SELECT * FROM categorized WHERE "kind" IS NOT NULL
    )
    SELECT *, count(*) OVER() AS "total"
    FROM actionable
    ORDER BY CASE "kind"
      WHEN 'READY_TO_CREATE_WORK' THEN 1
      WHEN 'DELIVERY_FAILED' THEN 2
      WHEN 'EXPIRING_SOON' THEN 3
      ELSE 4
    END ASC, "attentionAt" ASC, "id" ASC
    LIMIT 3
  `)
  const views: Record<EstimateAttentionKind, string> = {
    READY_TO_CREATE_WORK: 'ready-to-create-work',
    DELIVERY_FAILED: 'delivery-failed',
    EXPIRING_SOON: 'expiring-soon',
    EXPIRED: 'expired',
  }
  return {
    count: Number(rows[0]?.total ?? 0n),
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      referenceNumber: row.referenceNumber,
      customerDisplayName: row.customerDisplayName,
      kind: row.kind,
      view: views[row.kind],
      attentionAt: row.attentionAt.toISOString(),
    })),
  }
}

export async function loadEstimateAttentionSignals(input: {
  workspaceId: string
  estimateIds: string[]
  workspaceDateKey: string
  now: Date
}) {
  const rows = await prisma.estimate.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: input.estimateIds },
    },
    select: {
      id: true,
      status: true,
      expiresOn: true,
      archivedAt: true,
      decisionEvidence: { select: { id: true } },
      operationalization: { select: { id: true } },
      shares: {
        where: { revokedAt: null, expiresAt: { gt: input.now } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          deliveries: {
            where: { status: 'SENT' },
            select: { id: true },
            take: 1,
          },
        },
      },
      followUpSchedules: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { status: true, dueAt: true },
      },
    },
  })
  const failed = new Set(
    typeof (prisma as typeof prisma & { $queryRaw?: unknown }).$queryRaw ===
      'function'
      ? await findDeliveryFailedEstimateIds({
          workspaceId: input.workspaceId,
          estimateIds: input.estimateIds,
        })
      : [],
  )
  const familyOperationalized = new Set(
    typeof (prisma as typeof prisma & { $queryRaw?: unknown }).$queryRaw ===
      'function'
      ? await findOperationalizationViewEstimateIds({
          workspaceId: input.workspaceId,
          view: 'WORK_CREATED',
          estimateIds: input.estimateIds,
        })
      : (rows ?? [])
          .filter((row) => Boolean(row.operationalization))
          .map((row) => row.id),
  )
  return new Map<string, EstimateAttentionSignal>(
    (rows ?? []).map((row) => {
      const sent = Boolean(row.shares?.[0]?.deliveries?.length)
      const workCreated = familyOperationalized.has(row.id)
      const awaiting =
        !row.archivedAt &&
        row.status === 'PRESENTED' &&
        (!row.expiresOn || row.expiresOn >= input.workspaceDateKey) &&
        !row.decisionEvidence &&
        sent
      let attention: EstimateAttentionKind | null = null
      if (!row.archivedAt && row.status === 'ACCEPTED' && !workCreated) {
        attention = 'READY_TO_CREATE_WORK'
      } else if (failed.has(row.id)) {
        attention = 'DELIVERY_FAILED'
      } else if (
        !row.archivedAt &&
        row.status === 'PRESENTED' &&
        row.expiresOn &&
        row.expiresOn >= input.workspaceDateKey &&
        row.expiresOn <= addDateKeys(input.workspaceDateKey, 3)
      ) {
        attention = 'EXPIRING_SOON'
      } else if (
        !row.archivedAt &&
        row.status === 'PRESENTED' &&
        row.expiresOn &&
        row.expiresOn < input.workspaceDateKey
      ) {
        attention = 'EXPIRED'
      }
      return [
        row.id,
        {
          attention,
          awaitingDecision: awaiting,
          sentThroughSkillify: sent,
          followUp: row.followUpSchedules?.[0] ?? null,
          workCreated,
        },
      ]
    }),
  )
}
