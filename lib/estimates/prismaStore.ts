import { randomBytes } from 'crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  EstimateServiceError,
  type EstimateStore,
} from '@/lib/estimates/service'
import type { EstimateLineItemInput } from '@/lib/estimates/types'
import { EstimateStatus } from '@/lib/prisma/enums'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'

const actorSelect = { id: true, fullName: true, email: true } as const

const estimateInclude = {
  lineItems: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  lead: { select: { id: true, displayName: true, archivedAt: true } },
  customer: { select: { id: true, displayName: true, archivedAt: true } },
  createdBy: { select: actorSelect },
  presentedBy: { select: actorSelect },
  acceptedBy: { select: actorSelect },
  declinedBy: { select: actorSelect },
  voidedBy: { select: actorSelect },
} satisfies Prisma.EstimateInclude

const revisionSelect = {
  id: true,
  referenceNumber: true,
  revisionNumber: true,
  status: true,
  version: true,
  presentedAt: true,
  acceptedAt: true,
  declinedAt: true,
  voidedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EstimateSelect

const estimateListSelect = {
  id: true,
  workspaceId: true,
  referenceNumber: true,
  revisionNumber: true,
  previousRevisionId: true,
  leadId: true,
  customerId: true,
  title: true,
  currency: true,
  oneTimeSubtotalCents: true,
  recurringPerVisitSubtotalCents: true,
  status: true,
  expiresOn: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  lead: { select: { id: true, displayName: true, archivedAt: true } },
  customer: { select: { id: true, displayName: true, archivedAt: true } },
} satisfies Prisma.EstimateSelect

const REVISION_HISTORY_LIMIT = 100

function invalidListCursor() {
  return new EstimateServiceError(
    'The Estimate page cursor is invalid.',
    400,
    'VALIDATION_ERROR',
  )
}

function encodeListCursor(input: {
  workspaceId: string
  updatedAt: Date
  id: string
}) {
  return Buffer.from(
    JSON.stringify([
      input.workspaceId,
      input.updatedAt.toISOString(),
      input.id,
    ]),
  ).toString('base64url')
}

function decodeListCursor(cursor: string, workspaceId: string) {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 3 ||
      decoded[0] !== workspaceId ||
      typeof decoded[1] !== 'string' ||
      typeof decoded[2] !== 'string' ||
      !decoded[2]
    ) {
      throw invalidListCursor()
    }
    const updatedAt = new Date(decoded[1])
    if (
      !Number.isFinite(updatedAt.getTime()) ||
      updatedAt.toISOString() !== decoded[1]
    ) {
      throw invalidListCursor()
    }
    return { updatedAt, id: decoded[2] }
  } catch (error) {
    if (error instanceof EstimateServiceError) throw error
    throw invalidListCursor()
  }
}

function totals(items: EstimateLineItemInput[]) {
  return items.reduce(
    (result, item) => {
      if (item.billingBasis === 'ONE_TIME') {
        result.oneTimeSubtotalCents += item.amountCents
      } else {
        result.recurringPerVisitSubtotalCents += item.amountCents
      }
      return result
    },
    { oneTimeSubtotalCents: 0, recurringPerVisitSubtotalCents: 0 },
  )
}

function lineItemData(workspaceId: string, items: EstimateLineItemInput[]) {
  return items.map((item, sortOrder) => ({
    workspaceId,
    title: item.title,
    description: item.description ?? null,
    billingBasis: item.billingBasis,
    amountCents: item.amountCents,
    sortOrder,
  }))
}

function invalidParent() {
  return new EstimateServiceError(
    'Choose an active Lead or Customer from this workspace.',
    400,
    'VALIDATION_ERROR',
    {
      leadId: ['Choose an active Lead or Customer from this workspace.'],
      customerId: ['Choose an active Lead or Customer from this workspace.'],
    },
  )
}

async function resolveCommercialContext(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string
    leadId?: string | null
    customerId?: string | null
  },
) {
  const lead = input.leadId
    ? (
        await tx.$queryRaw<
          Array<{
            id: string
            displayName: string
            companyName: string | null
            email: string | null
            phone: string | null
            convertedCustomerId: string | null
          }>
        >(Prisma.sql`
          SELECT "id", "displayName", "companyName", "email", "phone", "convertedCustomerId"
          FROM "Lead"
          WHERE "id" = ${input.leadId}
            AND "workspaceId" = ${input.workspaceId}
            AND "archivedAt" IS NULL
          FOR SHARE
        `)
      )[0]
    : null
  if (input.leadId && !lead) throw invalidParent()

  let customerId = input.customerId ?? null
  if (lead && customerId && lead.convertedCustomerId !== customerId) {
    throw invalidParent()
  }
  if (lead?.convertedCustomerId) {
    customerId = lead.convertedCustomerId
  }
  const customer = customerId
    ? (
        await tx.$queryRaw<
          Array<{
            id: string
            displayName: string
            contactName: string | null
            email: string | null
            phone: string | null
            serviceAddressLine1: string | null
            serviceAddressLine2: string | null
            serviceAddressCity: string | null
            serviceAddressRegion: string | null
            serviceAddressPostalCode: string | null
            serviceAddressCountry: string | null
          }>
        >(Prisma.sql`
          SELECT "id", "displayName", "contactName", "email", "phone",
            "serviceAddressLine1", "serviceAddressLine2", "serviceAddressCity",
            "serviceAddressRegion", "serviceAddressPostalCode", "serviceAddressCountry"
          FROM "Customer"
          WHERE "id" = ${customerId}
            AND "workspaceId" = ${input.workspaceId}
            AND "archivedAt" IS NULL
          FOR SHARE
        `)
      )[0]
    : null
  if (customerId && !customer) throw invalidParent()
  if (!lead && !customer) throw invalidParent()

  return {
    leadId: lead?.id ?? null,
    customerId: customer?.id ?? null,
    contactNameSnapshot:
      customer?.contactName ??
      customer?.displayName ??
      lead?.displayName ??
      null,
    contactEmailSnapshot: customer?.email ?? lead?.email ?? null,
    contactPhoneSnapshot: customer?.phone ?? lead?.phone ?? null,
    serviceAddressLine1Snapshot: customer?.serviceAddressLine1 ?? null,
    serviceAddressLine2Snapshot: customer?.serviceAddressLine2 ?? null,
    serviceAddressCitySnapshot: customer?.serviceAddressCity ?? null,
    serviceAddressRegionSnapshot: customer?.serviceAddressRegion ?? null,
    serviceAddressPostalCodeSnapshot:
      customer?.serviceAddressPostalCode ?? null,
    serviceAddressCountrySnapshot: customer?.serviceAddressCountry ?? null,
  }
}

async function lockEstimate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  estimateId: string,
) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Estimate"
    WHERE "id" = ${estimateId} AND "workspaceId" = ${workspaceId}
    FOR UPDATE
  `)
  if (locked.length !== 1) return null
  return tx.estimate.findFirst({
    where: { id: estimateId, workspaceId, archivedAt: null },
    include: estimateInclude,
  })
}

async function estimateWithInclude(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  estimateId: string,
) {
  return tx.estimate.findFirst({
    where: { id: estimateId, workspaceId },
    include: estimateInclude,
  })
}

export const prismaEstimateStore: EstimateStore = {
  async getWorkspaceBusinessModel(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
    return workspace?.businessModel ?? null
  },

  async getWorkspaceTimezone(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        businessModel: true,
        settings: { select: { scheduling: true } },
      },
    })
    if (!workspace) return 'UTC'
    return normalizeSchedulingSettings({
      businessModel: workspace.businessModel,
      settings: (workspace.settings?.scheduling ?? undefined) as any,
    }).timezone
  },

  async createEstimate({ actor, data }) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referenceNumber = `EST-${randomBytes(5).toString('hex').toUpperCase()}`
      try {
        return await prisma.$transaction(async (tx) => {
          const context = await resolveCommercialContext(tx, {
            workspaceId: actor.workspaceId,
            leadId: data.leadId,
            customerId: data.customerId,
          })
          const aggregate = totals(data.lineItems)
          return tx.estimate.create({
            data: {
              workspaceId: actor.workspaceId,
              referenceNumber,
              revisionNumber: 1,
              ...context,
              title: data.title,
              scopeDescription: data.scopeDescription ?? null,
              currency: data.currency,
              expiresOn: data.expiresOn ?? null,
              ...aggregate,
              createdByUserId: actor.userProfileId,
              lineItems: {
                create: lineItemData(actor.workspaceId, data.lineItems),
              },
            },
            include: estimateInclude,
          })
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 4
        ) {
          continue
        }
        throw error
      }
    }
    throw new EstimateServiceError(
      'A unique Estimate reference could not be allocated. Try again.',
      409,
      'CONFLICT',
    )
  },

  async listEstimates(input) {
    const cursor = input.cursor
      ? decodeListCursor(input.cursor, input.workspaceId)
      : null
    const archived = input.view === 'ARCHIVED'
    const status = [
      'DRAFT',
      'PRESENTED',
      'ACCEPTED',
      'DECLINED',
      'VOIDED',
    ].includes(input.view)
      ? input.view
      : undefined
    const rows = await prisma.estimate.findMany({
      where: {
        workspaceId: input.workspaceId,
        archivedAt: archived ? { not: null } : null,
        status: status as any,
        leadId: input.leadId,
        customerId: input.customerId,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
        ...(input.view === 'PAST_EXPIRY'
          ? {
              status: EstimateStatus.PRESENTED,
              expiresOn: { lt: input.workspaceDateKey },
            }
          : {}),
      },
      select: estimateListSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.pageSize + 1,
    })
    const hasMore = rows.length > input.pageSize
    const estimates = hasMore ? rows.slice(0, input.pageSize) : rows
    return {
      estimates,
      nextCursor:
        hasMore && estimates.length
          ? encodeListCursor({
              workspaceId: input.workspaceId,
              updatedAt: estimates.at(-1)!.updatedAt,
              id: estimates.at(-1)!.id,
            })
          : null,
    }
  },

  async getEstimateDetail({ workspaceId, estimateId }) {
    const estimate = await prisma.estimate.findFirst({
      where: { id: estimateId, workspaceId },
      include: estimateInclude,
    })
    if (!estimate) return null
    const revisions = await prisma.estimate.findMany({
      where: { workspaceId, referenceNumber: estimate.referenceNumber },
      select: revisionSelect,
      orderBy: [{ revisionNumber: 'asc' }, { id: 'asc' }],
      take: REVISION_HISTORY_LIMIT + 1,
    })
    return {
      estimate,
      revisions: revisions.slice(0, REVISION_HISTORY_LIMIT),
      revisionHistoryTruncated: revisions.length > REVISION_HISTORY_LIMIT,
    }
  },

  async updateDraft({ actor, estimateId, data }) {
    return prisma.$transaction(async (tx) => {
      const current = await lockEstimate(tx, actor.workspaceId, estimateId)
      if (!current) return { status: 'NOT_FOUND' as const }
      if (current.version !== data.expectedVersion) {
        return { status: 'STALE' as const }
      }
      if (current.status !== EstimateStatus.DRAFT) {
        return { status: 'IMMUTABLE' as const }
      }
      const { expectedVersion: _expectedVersion, lineItems, ...changes } = data
      const updateData: Prisma.EstimateUpdateInput = {
        ...changes,
        version: { increment: 1 },
      }
      if (lineItems) Object.assign(updateData, totals(lineItems))
      await tx.estimate.update({ where: { id: estimateId }, data: updateData })
      if (lineItems) {
        await tx.estimateLineItem.deleteMany({
          where: { estimateId, workspaceId: actor.workspaceId },
        })
        if (lineItems.length) {
          await tx.estimateLineItem.createMany({
            data: lineItemData(actor.workspaceId, lineItems).map((item) => ({
              ...item,
              estimateId,
            })),
          })
        }
      }
      return {
        status: 'OK' as const,
        estimate: (await estimateWithInclude(
          tx,
          actor.workspaceId,
          estimateId,
        ))!,
      }
    })
  },

  async transition(input) {
    return prisma.$transaction(async (tx) => {
      const current = await lockEstimate(
        tx,
        input.actor.workspaceId,
        input.estimateId,
      )
      if (!current) return { status: 'NOT_FOUND' as const }
      const target = {
        present: EstimateStatus.PRESENTED,
        accept: EstimateStatus.ACCEPTED,
        decline: EstimateStatus.DECLINED,
        void: EstimateStatus.VOIDED,
      }[input.action]
      if (current.status === target) {
        return { status: 'OK' as const, estimate: current }
      }
      if (current.version !== input.expectedVersion) {
        return { status: 'STALE' as const }
      }

      if (input.action === 'present') {
        if (current.status !== EstimateStatus.DRAFT) {
          return {
            status: 'INVALID_STATE' as const,
            message: 'Only a Draft Estimate can be presented.',
          }
        }
        if (!current.lineItems.length) {
          return {
            status: 'INVALID_STATE' as const,
            message:
              'Add at least one line item before presenting this Estimate.',
          }
        }
        if (current.expiresOn && current.expiresOn < input.workspaceDateKey) {
          return {
            status: 'INVALID_STATE' as const,
            message: 'Choose an expiry date that is not already past.',
          }
        }
        if (current.previousRevisionId) {
          const family = await tx.$queryRaw<
            Array<{ id: string; status: EstimateStatus }>
          >(Prisma.sql`
            SELECT "id", "status"
            FROM "Estimate"
            WHERE "workspaceId" = ${input.actor.workspaceId}
              AND "referenceNumber" = ${current.referenceNumber}
            FOR UPDATE
          `)
          const predecessor = family.find(
            (revision) => revision.id === current.previousRevisionId,
          )
          if (!predecessor) {
            return {
              status: 'INVALID_STATE' as const,
              message: 'The prior Estimate revision is unavailable.',
            }
          }
          if (
            predecessor.status !== EstimateStatus.PRESENTED &&
            predecessor.status !== EstimateStatus.VOIDED
          ) {
            return {
              status: 'INVALID_STATE' as const,
              message:
                'The prior revision changed before this revision was presented.',
            }
          }
          if (
            family.some(
              (revision) =>
                revision.status === EstimateStatus.ACCEPTED ||
                revision.status === EstimateStatus.DECLINED,
            )
          ) {
            return {
              status: 'INVALID_STATE' as const,
              message:
                'The Estimate family received a final decision before this revision was presented.',
            }
          }
          await tx.estimate.updateMany({
            where: {
              workspaceId: input.actor.workspaceId,
              referenceNumber: current.referenceNumber,
              status: EstimateStatus.PRESENTED,
            },
            data: {
              status: EstimateStatus.SUPERSEDED,
              version: { increment: 1 },
            },
          })
        }
        await tx.estimate.update({
          where: { id: current.id },
          data: {
            status: EstimateStatus.PRESENTED,
            presentedAt: input.now,
            presentedByUserId: input.actor.userProfileId,
            version: { increment: 1 },
          },
        })
      } else if (input.action === 'accept' || input.action === 'decline') {
        if (current.status !== EstimateStatus.PRESENTED) {
          return {
            status: 'INVALID_STATE' as const,
            message: `Only a Presented Estimate can be ${input.action === 'accept' ? 'accepted' : 'declined'}.`,
          }
        }
        if (
          input.action === 'accept' &&
          current.expiresOn &&
          current.expiresOn < input.workspaceDateKey
        ) {
          return { status: 'EXPIRED' as const }
        }
        await tx.estimate.update({
          where: { id: current.id },
          data:
            input.action === 'accept'
              ? {
                  status: EstimateStatus.ACCEPTED,
                  acceptedAt: input.now,
                  acceptedByUserId: input.actor.userProfileId,
                  version: { increment: 1 },
                }
              : {
                  status: EstimateStatus.DECLINED,
                  declinedAt: input.now,
                  declinedByUserId: input.actor.userProfileId,
                  version: { increment: 1 },
                },
        })
      } else {
        if (
          current.status !== EstimateStatus.DRAFT &&
          current.status !== EstimateStatus.PRESENTED
        ) {
          return {
            status: 'INVALID_STATE' as const,
            message: 'Only a Draft or Presented Estimate can be voided.',
          }
        }
        const successor = await tx.estimate.findFirst({
          where: {
            previousRevisionId: current.id,
            workspaceId: input.actor.workspaceId,
          },
          select: { id: true },
        })
        if (successor) {
          return {
            status: 'INVALID_STATE' as const,
            message:
              'Resolve the existing replacement revision before voiding this Estimate.',
          }
        }
        await tx.estimate.update({
          where: { id: current.id },
          data: {
            status: EstimateStatus.VOIDED,
            voidedAt: input.now,
            voidedByUserId: input.actor.userProfileId,
            version: { increment: 1 },
          },
        })
      }
      return {
        status: 'OK' as const,
        estimate: (await estimateWithInclude(
          tx,
          input.actor.workspaceId,
          input.estimateId,
        ))!,
      }
    })
  },

  async createRevision({ actor, estimateId, expectedVersion }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await lockEstimate(tx, actor.workspaceId, estimateId)
        if (!current) return { status: 'NOT_FOUND' as const }
        if (current.version !== expectedVersion)
          return { status: 'STALE' as const }
        if (
          current.status !== EstimateStatus.PRESENTED &&
          current.status !== EstimateStatus.VOIDED
        ) {
          return {
            status: 'INVALID_STATE' as const,
            message: 'Only a Presented or Voided Estimate can be revised.',
          }
        }
        const successor = await tx.estimate.findFirst({
          where: {
            previousRevisionId: current.id,
            workspaceId: actor.workspaceId,
          },
          include: estimateInclude,
        })
        if (
          successor?.status === EstimateStatus.DRAFT &&
          !successor.archivedAt
        ) {
          return { status: 'OK' as const, estimate: successor }
        }
        if (successor) {
          return {
            status: 'INVALID_STATE' as const,
            message: 'This Estimate already has a replacement revision.',
          }
        }
        const revision = await tx.estimate.create({
          data: {
            workspaceId: actor.workspaceId,
            referenceNumber: current.referenceNumber,
            revisionNumber: current.revisionNumber + 1,
            previousRevisionId: current.id,
            leadId: current.leadId,
            customerId: current.customerId,
            title: current.title,
            scopeDescription: current.scopeDescription,
            contactNameSnapshot: current.contactNameSnapshot,
            contactEmailSnapshot: current.contactEmailSnapshot,
            contactPhoneSnapshot: current.contactPhoneSnapshot,
            serviceAddressLine1Snapshot: current.serviceAddressLine1Snapshot,
            serviceAddressLine2Snapshot: current.serviceAddressLine2Snapshot,
            serviceAddressCitySnapshot: current.serviceAddressCitySnapshot,
            serviceAddressRegionSnapshot: current.serviceAddressRegionSnapshot,
            serviceAddressPostalCodeSnapshot:
              current.serviceAddressPostalCodeSnapshot,
            serviceAddressCountrySnapshot:
              current.serviceAddressCountrySnapshot,
            currency: current.currency,
            oneTimeSubtotalCents: current.oneTimeSubtotalCents,
            recurringPerVisitSubtotalCents:
              current.recurringPerVisitSubtotalCents,
            expiresOn: current.expiresOn,
            createdByUserId: actor.userProfileId,
            lineItems: {
              create: lineItemData(actor.workspaceId, current.lineItems),
            },
          },
          include: estimateInclude,
        })
        return { status: 'OK' as const, estimate: revision }
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'STALE' as const }
      }
      throw error
    }
  },

  async archiveEstimate({ actor, estimateId, expectedVersion, archivedAt }) {
    return prisma.$transaction(async (tx) => {
      const current = await lockEstimate(tx, actor.workspaceId, estimateId)
      if (!current) return { status: 'NOT_FOUND' as const }
      if (current.version !== expectedVersion)
        return { status: 'STALE' as const }
      if (current.status === EstimateStatus.PRESENTED) {
        return {
          status: 'INVALID_STATE' as const,
          message: 'Void a Presented Estimate before archiving it.',
        }
      }
      if (
        current.previousRevisionId &&
        (current.status === EstimateStatus.DRAFT ||
          current.status === EstimateStatus.VOIDED)
      ) {
        return {
          status: 'INVALID_STATE' as const,
          message:
            'A replacement revision must remain available until the Estimate family is resolved.',
        }
      }
      await tx.estimate.update({
        where: { id: current.id },
        data: { archivedAt, version: { increment: 1 } },
      })
      return {
        status: 'OK' as const,
        estimate: (await estimateWithInclude(
          tx,
          actor.workspaceId,
          estimateId,
        ))!,
      }
    })
  },
}
