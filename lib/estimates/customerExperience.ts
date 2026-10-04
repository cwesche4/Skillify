import { randomBytes } from 'crypto'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { EstimateExperienceError } from '@/lib/estimates/customerExperienceError'
import {
  createEstimateSharePublicId,
  createSignedEstimateShareToken,
} from '@/lib/estimates/customerExperienceSecurity'
import {
  EstimateDecisionKind,
  EstimateDecisionSource,
  EstimateDeliveryStatus,
  EstimateStatus,
} from '@/lib/prisma/enums'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import {
  getEndOfWorkspaceDay,
  getWorkspaceDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import { cancelPendingEstimateFollowUps } from '@/lib/estimates/followUp'

const SHARE_BASE_LIFETIME_MS = 180 * 24 * 60 * 60_000
const SHARE_COMMERCIAL_GRACE_MS = 30 * 24 * 60 * 60_000
const DELIVERY_HISTORY_DEFAULT = 20
const DELIVERY_HISTORY_MAX = 50

export type SellerIdentitySnapshot = {
  displayName: string
  phone: string | null
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    region: string | null
    postalCode: string | null
    countryCode: string | null
  } | null
}

export type EstimateCustomerExperienceSummary = {
  share: {
    id: string
    state: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
    expiresAt: Date
    revokedAt: Date | null
    createdAt: Date
    signedUrl: string | null
  } | null
  deliveries: Array<{
    id: string
    channel: 'EMAIL'
    recipientEmail: string
    status:
      | 'PENDING'
      | 'PROCESSING'
      | 'SENT'
      | 'FAILED'
      | 'PERMANENTLY_FAILED'
      | 'CANCELED'
    attempts: number
    origin: 'MANUAL' | 'AUTOMATED_FOLLOW_UP'
    provider: string | null
    providerMessageId: string | null
    lastErrorCode: string | null
    lastErrorMessage: string | null
    requestedAt: Date
    sentAt: Date | null
    failedAt: Date | null
  }>
  deliveryHistoryTruncated: boolean
  followUp: { status: string; dueAt: Date } | null
  decision: {
    decision: 'ACCEPTED' | 'DECLINED'
    source: 'MANAGEMENT' | 'CUSTOMER_LINK'
    acknowledgmentNameSnapshot: string | null
    declineReason: string | null
    declineNote: string | null
    occurredAt: Date
    managementActor: {
      id: string
      fullName: string | null
      email: string | null
    } | null
  } | null
}

export type PublicEstimateDto =
  | {
      state: 'REPLACED' | 'UNAVAILABLE'
      message: string
      businessDisplayName: string
      csrfToken: string
      canAccept: false
      canDecline: false
    }
  | {
      state: 'PRESENTED' | 'EXPIRED' | 'ACCEPTED' | 'DECLINED'
      message: string | null
      business: SellerIdentitySnapshot
      referenceNumber: string
      revisionNumber: number
      title: string
      contactDisplayName: string | null
      scopeDescription: string | null
      serviceAddress: {
        line1: string | null
        line2: string | null
        city: string | null
        region: string | null
        postalCode: string | null
        country: string | null
      } | null
      currency: string
      oneTimeSubtotalCents: number
      recurringPerVisitSubtotalCents: number
      expiresOn: string | null
      lineItems: Array<{
        title: string
        description: string | null
        billingBasis: 'ONE_TIME' | 'PER_VISIT'
        amountCents: number
      }>
      decision: {
        decision: 'ACCEPTED' | 'DECLINED'
        source: 'MANAGEMENT' | 'CUSTOMER_LINK'
        acknowledgmentNameSnapshot: string | null
        occurredAt: string
      } | null
      csrfToken: string
      canAccept: boolean
      canDecline: boolean
    }

const lifecycleInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
})

export const deliveryInputSchema = lifecycleInputSchema.extend({
  recipientEmail: z.string().trim().toLowerCase().email().max(320),
  idempotencyKey: z.string().trim().min(1).max(200),
})

export const deliveryHistoryQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(1000).optional(),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(DELIVERY_HISTORY_MAX)
    .default(DELIVERY_HISTORY_DEFAULT),
})

export const customerDecisionSchema = z
  .object({
    decision: z.enum(['ACCEPTED', 'DECLINED']),
    acknowledgmentName: z.string().trim().min(1).max(200),
    declineReason: z.string().trim().max(100).optional().nullable(),
    declineNote: z.string().trim().max(1000).optional().nullable(),
    csrfToken: z.string().min(16).max(200),
  })
  .superRefine((input, context) => {
    if (
      input.decision === 'ACCEPTED' &&
      (input.declineReason || input.declineNote)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: 'Decline details are only allowed when declining.',
      })
    }
  })

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown) {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new EstimateExperienceError(
      'The Estimate request is invalid.',
      400,
      'VALIDATION_ERROR',
      result.error.flatten().fieldErrors,
    )
  }
  return result.data as z.output<T>
}

function unavailable() {
  return new EstimateExperienceError(
    'This Estimate link is unavailable.',
    404,
    'NOT_FOUND',
  )
}

function workspaceTimezone(workspace: {
  businessModel: string
  settings: { scheduling: unknown } | null
}) {
  return normalizeSchedulingSettings({
    businessModel: workspace.businessModel as any,
    settings: (workspace.settings?.scheduling ?? undefined) as any,
  }).timezone
}

export function calculateEstimateShareExpiration({
  now,
  expiresOn,
  timezone,
}: {
  now: Date
  expiresOn: string | null
  timezone: string
}) {
  const baseline = new Date(now.getTime() + SHARE_BASE_LIFETIME_MS)
  if (!expiresOn) return baseline
  const commercialGrace = new Date(
    getEndOfWorkspaceDay(expiresOn, timezone).getTime() +
      SHARE_COMMERCIAL_GRACE_MS,
  )
  return commercialGrace > baseline ? commercialGrace : baseline
}

function sellerIdentity(workspace: {
  name: string
  businessName: string | null
  workspaceLocations: Array<{
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    region: string | null
    postalCode: string | null
    countryCode: string | null
    phone: string | null
  }>
}): SellerIdentitySnapshot {
  const location = workspace.workspaceLocations[0] ?? null
  const hasAddress = Boolean(
    location &&
    (location.addressLine1 ||
      location.addressLine2 ||
      location.city ||
      location.region ||
      location.postalCode ||
      location.countryCode),
  )
  return {
    displayName: workspace.businessName?.trim() || workspace.name,
    phone: location?.phone ?? null,
    address:
      location && hasAddress
        ? {
            line1: location.addressLine1,
            line2: location.addressLine2,
            city: location.city,
            region: location.region,
            postalCode: location.postalCode,
            countryCode: location.countryCode,
          }
        : null,
  }
}

async function lockEstimate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  estimateId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Estimate"
    WHERE "id" = ${estimateId} AND "workspaceId" = ${workspaceId}
    FOR UPDATE
  `)
  if (rows.length !== 1) return null
  return tx.estimate.findFirst({
    where: { id: estimateId, workspaceId },
    include: {
      workspace: {
        select: {
          name: true,
          businessName: true,
          businessModel: true,
          settings: { select: { scheduling: true } },
          workspaceLocations: {
            where: { isActive: true, archivedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: {
              addressLine1: true,
              addressLine2: true,
              city: true,
              region: true,
              postalCode: true,
              countryCode: true,
              phone: true,
            },
          },
        },
      },
    },
  })
}

async function lockShare(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  estimateId: string,
  publicId?: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "EstimateShare"
    WHERE "workspaceId" = ${workspaceId}
      AND "estimateId" = ${estimateId}
      AND "revokedAt" IS NULL
      ${publicId ? Prisma.sql`AND "publicId" = ${publicId}` : Prisma.empty}
    ORDER BY "createdAt" DESC
    LIMIT 1
    FOR UPDATE
  `)
  if (!rows[0]) return null
  return tx.estimateShare.findUnique({ where: { id: rows[0].id } })
}

function assertPresentedEstimate(
  estimate: {
    status: string
    archivedAt: Date | null
    version: number
    expiresOn: string | null
    workspace: {
      businessModel: string
      settings: { scheduling: unknown } | null
    }
  },
  expectedVersion: number,
  now: Date,
) {
  if (estimate.archivedAt || estimate.status !== EstimateStatus.PRESENTED) {
    throw new EstimateExperienceError(
      'Only an active Presented Estimate can be shared.',
      409,
      'CONFLICT',
    )
  }
  if (estimate.version !== expectedVersion) {
    throw new EstimateExperienceError(
      'This Estimate changed before the action was saved. Refresh and try again.',
      409,
      'CONFLICT',
    )
  }
  if (
    estimate.expiresOn &&
    estimate.expiresOn <
      getWorkspaceDateKey(now, workspaceTimezone(estimate.workspace))
  ) {
    throw new EstimateExperienceError(
      'This Estimate has expired. Create and present a new revision before sharing it.',
      409,
      'CONFLICT',
    )
  }
}

function createShareRecord(
  tx: Prisma.TransactionClient,
  estimate: NonNullable<Awaited<ReturnType<typeof lockEstimate>>>,
  actorUserId: string,
  now: Date,
) {
  const timezone = workspaceTimezone(estimate.workspace)
  return tx.estimateShare.create({
    data: {
      workspaceId: estimate.workspaceId,
      estimateId: estimate.id,
      publicId: createEstimateSharePublicId(),
      businessIdentitySnapshot: sellerIdentity(estimate.workspace) as any,
      expiresAt: calculateEstimateShareExpiration({
        now,
        expiresOn: estimate.expiresOn,
        timezone,
      }),
      createdByUserId: actorUserId,
    },
  })
}

export async function getOrCreateEstimateShare({
  workspaceId,
  estimateId,
  actorUserId,
  rawInput,
  now = new Date(),
}: {
  workspaceId: string
  estimateId: string
  actorUserId: string
  rawInput: unknown
  now?: Date
}) {
  const { expectedVersion } = parse(lifecycleInputSchema, rawInput)
  return prisma.$transaction(async (tx) => {
    const estimate = await lockEstimate(tx, workspaceId, estimateId)
    if (!estimate) throw unavailable()
    assertPresentedEstimate(estimate, expectedVersion, now)
    const current = await lockShare(tx, workspaceId, estimateId)
    if (current && current.expiresAt > now) return current
    if (current) {
      await tx.estimateShare.update({
        where: { id: current.id },
        data: { revokedAt: safeRevocationTime(current, now) },
      })
    }
    return createShareRecord(tx, estimate, actorUserId, now)
  })
}

export async function revokeEstimateShare({
  workspaceId,
  estimateId,
  rawInput,
  now = new Date(),
}: {
  workspaceId: string
  estimateId: string
  rawInput: unknown
  now?: Date
}) {
  const { expectedVersion } = parse(lifecycleInputSchema, rawInput)
  return prisma.$transaction(async (tx) => {
    const estimate = await lockEstimate(tx, workspaceId, estimateId)
    if (!estimate) throw unavailable()
    if (estimate.version !== expectedVersion) {
      throw new EstimateExperienceError(
        'This Estimate changed before the action was saved. Refresh and try again.',
        409,
        'CONFLICT',
      )
    }
    const current = await lockShare(tx, workspaceId, estimateId)
    if (!current) return null
    const revoked = await tx.estimateShare.update({
      where: { id: current.id },
      data: { revokedAt: safeRevocationTime(current, now) },
    })
    await cancelPendingEstimateFollowUps(tx, {
      workspaceId,
      estimateId,
      reason: 'ESTIMATE_SHARE_REVOKED',
      now,
    })
    return revoked
  })
}

export async function rotateEstimateShare({
  workspaceId,
  estimateId,
  actorUserId,
  rawInput,
  now = new Date(),
}: {
  workspaceId: string
  estimateId: string
  actorUserId: string
  rawInput: unknown
  now?: Date
}) {
  const { expectedVersion } = parse(lifecycleInputSchema, rawInput)
  return prisma.$transaction(async (tx) => {
    const estimate = await lockEstimate(tx, workspaceId, estimateId)
    if (!estimate) throw unavailable()
    assertPresentedEstimate(estimate, expectedVersion, now)
    const current = await lockShare(tx, workspaceId, estimateId)
    if (current) {
      await tx.estimateShare.update({
        where: { id: current.id },
        data: { revokedAt: safeRevocationTime(current, now) },
      })
      await cancelPendingEstimateFollowUps(tx, {
        workspaceId,
        estimateId,
        reason: 'ESTIMATE_SHARE_ROTATED',
        now,
      })
    }
    return createShareRecord(tx, estimate, actorUserId, now)
  })
}

export function publicEstimateBaseUrl(requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (requestUrl) return new URL(requestUrl).origin
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'
  throw new EstimateExperienceError(
    'Customer Estimate links are not configured.',
    503,
    'CONFIGURATION_REQUIRED',
  )
}

export function signedEstimateShareUrl(publicId: string, baseUrl: string) {
  const token = createSignedEstimateShareToken(publicId)
  return `${baseUrl.replace(/\/$/, '')}/e/${encodeURIComponent(token)}`
}

function shareState(
  share: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
) {
  if (share.revokedAt) return 'REVOKED' as const
  if (share.expiresAt <= now) return 'EXPIRED' as const
  return 'ACTIVE' as const
}

function safeRevocationTime(share: { createdAt: Date }, requestedAt: Date) {
  return share.createdAt > requestedAt ? share.createdAt : requestedAt
}

export async function getEstimateCustomerExperienceSummary({
  workspaceId,
  estimateId,
  baseUrl,
  now = new Date(),
}: {
  workspaceId: string
  estimateId: string
  baseUrl: string
  now?: Date
}): Promise<EstimateCustomerExperienceSummary> {
  const [share, deliveries, decision, followUp] = await Promise.all([
    prisma.estimateShare.findFirst({
      where: { workspaceId, estimateId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.estimateDelivery.findMany({
      where: { workspaceId, estimateId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: DELIVERY_HISTORY_DEFAULT + 1,
    }),
    prisma.estimateDecision.findFirst({
      where: { workspaceId, estimateId },
      include: {
        managementActor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    }),
    prisma.estimateFollowUpSchedule.findFirst({
      where: { workspaceId, estimateId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, dueAt: true },
    }),
  ])
  const state = share ? shareState(share, now) : null
  return {
    share: share
      ? {
          id: share.id,
          state: state!,
          expiresAt: share.expiresAt,
          revokedAt: share.revokedAt,
          createdAt: share.createdAt,
          signedUrl:
            state === 'ACTIVE'
              ? signedEstimateShareUrl(share.publicId, baseUrl)
              : null,
        }
      : null,
    deliveries: deliveries.slice(0, DELIVERY_HISTORY_DEFAULT),
    deliveryHistoryTruncated: deliveries.length > DELIVERY_HISTORY_DEFAULT,
    followUp,
    decision: decision
      ? {
          decision: decision.decision,
          source: decision.source,
          acknowledgmentNameSnapshot: decision.acknowledgmentNameSnapshot,
          declineReason: decision.declineReason,
          declineNote: decision.declineNote,
          occurredAt: decision.occurredAt,
          managementActor: decision.managementActor,
        }
      : null,
  }
}

function decodeBusinessIdentity(value: unknown): SellerIdentitySnapshot {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const address =
    record.address &&
    typeof record.address === 'object' &&
    !Array.isArray(record.address)
      ? (record.address as Record<string, unknown>)
      : null
  const stringOrNull = (entry: unknown) =>
    typeof entry === 'string' && entry.trim() ? entry.trim() : null
  return {
    displayName: stringOrNull(record.displayName) ?? 'Service provider',
    phone: stringOrNull(record.phone),
    address: address
      ? {
          line1: stringOrNull(address.line1),
          line2: stringOrNull(address.line2),
          city: stringOrNull(address.city),
          region: stringOrNull(address.region),
          postalCode: stringOrNull(address.postalCode),
          countryCode: stringOrNull(address.countryCode),
        }
      : null,
  }
}

export async function getPublicEstimate({
  publicId,
  csrfToken,
  now = new Date(),
}: {
  publicId: string
  csrfToken: string
  now?: Date
}): Promise<PublicEstimateDto> {
  const share = await prisma.estimateShare.findUnique({
    where: { publicId },
    include: {
      estimate: {
        include: {
          lineItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          decisionEvidence: true,
          workspace: {
            select: {
              businessModel: true,
              settings: { select: { scheduling: true } },
            },
          },
        },
      },
    },
  })
  if (!share || share.revokedAt || share.expiresAt <= now) throw unavailable()
  const estimate = share.estimate
  const business = decodeBusinessIdentity(share.businessIdentitySnapshot)
  if (estimate.archivedAt) throw unavailable()
  if (estimate.status === EstimateStatus.SUPERSEDED) {
    return {
      state: 'REPLACED',
      message:
        'This estimate was replaced. Please contact the business for the current estimate.',
      businessDisplayName: business.displayName,
      csrfToken,
      canAccept: false,
      canDecline: false,
    }
  }
  if (
    estimate.status === EstimateStatus.VOIDED ||
    estimate.status === EstimateStatus.DRAFT
  ) {
    return {
      state: 'UNAVAILABLE',
      message: 'This estimate is no longer available.',
      businessDisplayName: business.displayName,
      csrfToken,
      canAccept: false,
      canDecline: false,
    }
  }
  const timezone = workspaceTimezone(estimate.workspace)
  const commerciallyExpired = Boolean(
    estimate.status === EstimateStatus.PRESENTED &&
    estimate.expiresOn &&
    estimate.expiresOn < getWorkspaceDateKey(now, timezone),
  )
  const state =
    estimate.status === EstimateStatus.ACCEPTED
      ? 'ACCEPTED'
      : estimate.status === EstimateStatus.DECLINED
        ? 'DECLINED'
        : commerciallyExpired
          ? 'EXPIRED'
          : 'PRESENTED'
  const hasServiceAddress = Boolean(
    estimate.serviceAddressLine1Snapshot ||
    estimate.serviceAddressLine2Snapshot ||
    estimate.serviceAddressCitySnapshot ||
    estimate.serviceAddressRegionSnapshot ||
    estimate.serviceAddressPostalCodeSnapshot ||
    estimate.serviceAddressCountrySnapshot,
  )
  return {
    state,
    message:
      state === 'EXPIRED'
        ? 'This estimate has expired. Contact the business for an updated estimate.'
        : state === 'ACCEPTED'
          ? 'Your estimate has been accepted. The business will coordinate next steps.'
          : state === 'DECLINED'
            ? 'This estimate was declined.'
            : null,
    business,
    referenceNumber: estimate.referenceNumber,
    revisionNumber: estimate.revisionNumber,
    title: estimate.title,
    contactDisplayName: estimate.contactNameSnapshot,
    scopeDescription: estimate.scopeDescription,
    serviceAddress: hasServiceAddress
      ? {
          line1: estimate.serviceAddressLine1Snapshot,
          line2: estimate.serviceAddressLine2Snapshot,
          city: estimate.serviceAddressCitySnapshot,
          region: estimate.serviceAddressRegionSnapshot,
          postalCode: estimate.serviceAddressPostalCodeSnapshot,
          country: estimate.serviceAddressCountrySnapshot,
        }
      : null,
    currency: estimate.currency,
    oneTimeSubtotalCents: estimate.oneTimeSubtotalCents,
    recurringPerVisitSubtotalCents: estimate.recurringPerVisitSubtotalCents,
    expiresOn: estimate.expiresOn,
    lineItems: estimate.lineItems.map((line) => ({
      title: line.title,
      description: line.description,
      billingBasis: line.billingBasis,
      amountCents: line.amountCents,
    })),
    decision: estimate.decisionEvidence
      ? {
          decision: estimate.decisionEvidence.decision,
          source: estimate.decisionEvidence.source,
          acknowledgmentNameSnapshot:
            estimate.decisionEvidence.acknowledgmentNameSnapshot,
          occurredAt: estimate.decisionEvidence.occurredAt.toISOString(),
        }
      : null,
    csrfToken,
    canAccept: state === 'PRESENTED',
    canDecline: state === 'PRESENTED',
  }
}

export async function decidePublicEstimate({
  publicId,
  rawInput,
  now = new Date(),
}: {
  publicId: string
  rawInput: unknown
  now?: Date
}) {
  const input = parse(customerDecisionSchema, rawInput)
  return prisma.$transaction(async (tx) => {
    const shareRecord = await tx.estimateShare.findUnique({
      where: { publicId },
      select: { workspaceId: true, estimateId: true },
    })
    if (!shareRecord) throw unavailable()
    const estimate = await lockEstimate(
      tx,
      shareRecord.workspaceId,
      shareRecord.estimateId,
    )
    if (!estimate) throw unavailable()
    const share = await lockShare(
      tx,
      shareRecord.workspaceId,
      shareRecord.estimateId,
      publicId,
    )
    if (!share || share.revokedAt || share.expiresAt <= now) throw unavailable()
    const existing = await tx.estimateDecision.findFirst({
      where: {
        workspaceId: estimate.workspaceId,
        estimateId: estimate.id,
      },
    })
    if (existing) {
      if (existing.decision === input.decision) {
        return { decision: existing, estimate, replayed: true }
      }
      throw new EstimateExperienceError(
        'This Estimate already has a different final decision.',
        409,
        'CONFLICT',
      )
    }
    if (estimate.archivedAt || estimate.status !== EstimateStatus.PRESENTED) {
      throw new EstimateExperienceError(
        'This Estimate is no longer available for a decision.',
        409,
        'CONFLICT',
      )
    }
    const timezone = workspaceTimezone(estimate.workspace)
    if (
      estimate.expiresOn &&
      estimate.expiresOn < getWorkspaceDateKey(now, timezone)
    ) {
      throw new EstimateExperienceError(
        'This Estimate has expired. Contact the business for an updated estimate.',
        409,
        'CONFLICT',
      )
    }
    const decision = await tx.estimateDecision.create({
      data: {
        workspaceId: estimate.workspaceId,
        estimateId: estimate.id,
        estimateShareId: share.id,
        decision: input.decision,
        source: EstimateDecisionSource.CUSTOMER_LINK,
        acknowledgmentNameSnapshot: input.acknowledgmentName,
        declineReason:
          input.decision === EstimateDecisionKind.DECLINED
            ? input.declineReason || null
            : null,
        declineNote:
          input.decision === EstimateDecisionKind.DECLINED
            ? input.declineNote || null
            : null,
        occurredAt: now,
      },
    })
    const updated = await tx.estimate.update({
      where: { id: estimate.id },
      data:
        input.decision === EstimateDecisionKind.ACCEPTED
          ? {
              status: EstimateStatus.ACCEPTED,
              acceptedAt: now,
              acceptedByUserId: null,
              version: { increment: 1 },
            }
          : {
              status: EstimateStatus.DECLINED,
              declinedAt: now,
              declinedByUserId: null,
              version: { increment: 1 },
            },
    })
    await cancelPendingEstimateFollowUps(tx, {
      workspaceId: estimate.workspaceId,
      estimateId: estimate.id,
      reason: 'ESTIMATE_DECIDED',
      now,
    })
    return { decision, estimate: updated, replayed: false }
  })
}

function encodeDeliveryCursor(input: {
  workspaceId: string
  estimateId: string
  requestedAt: Date
  id: string
}) {
  return Buffer.from(
    JSON.stringify([
      input.workspaceId,
      input.estimateId,
      input.requestedAt.toISOString(),
      input.id,
    ]),
  ).toString('base64url')
}

function decodeDeliveryCursor(
  cursor: string,
  workspaceId: string,
  estimateId: string,
) {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown
    if (
      !Array.isArray(value) ||
      value.length !== 4 ||
      value[0] !== workspaceId ||
      value[1] !== estimateId ||
      typeof value[2] !== 'string' ||
      typeof value[3] !== 'string'
    ) {
      throw new Error()
    }
    const requestedAt = new Date(value[2])
    if (requestedAt.toISOString() !== value[2]) throw new Error()
    return { requestedAt, id: value[3] }
  } catch {
    throw new EstimateExperienceError(
      'The delivery history cursor is invalid.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export async function listEstimateDeliveries({
  workspaceId,
  estimateId,
  rawQuery,
}: {
  workspaceId: string
  estimateId: string
  rawQuery: unknown
}) {
  const query = parse(deliveryHistoryQuerySchema, rawQuery)
  const cursor = query.cursor
    ? decodeDeliveryCursor(query.cursor, workspaceId, estimateId)
    : null
  const rows = await prisma.estimateDelivery.findMany({
    where: {
      workspaceId,
      estimateId,
      ...(cursor
        ? {
            OR: [
              { requestedAt: { lt: cursor.requestedAt } },
              { requestedAt: cursor.requestedAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: query.pageSize + 1,
  })
  const items = rows.slice(0, query.pageSize)
  return {
    deliveries: items,
    nextCursor:
      rows.length > query.pageSize && items.length
        ? encodeDeliveryCursor({
            workspaceId,
            estimateId,
            requestedAt: items.at(-1)!.requestedAt,
            id: items.at(-1)!.id,
          })
        : null,
  }
}

export async function queueEstimateDelivery({
  workspaceId,
  estimateId,
  actorUserId,
  rawInput,
  now = new Date(),
}: {
  workspaceId: string
  estimateId: string
  actorUserId: string
  rawInput: unknown
  now?: Date
}) {
  const input = parse(deliveryInputSchema, rawInput)
  return prisma.$transaction(async (tx) => {
    const estimate = await lockEstimate(tx, workspaceId, estimateId)
    if (!estimate) throw unavailable()

    const replay = await tx.estimateDelivery.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { estimateShare: true },
    })
    if (replay) {
      if (
        replay.estimateId !== estimateId ||
        replay.recipientEmail !== input.recipientEmail
      ) {
        throw new EstimateExperienceError(
          'That delivery idempotency key was already used for another request.',
          409,
          'CONFLICT',
        )
      }
      return { delivery: replay, share: replay.estimateShare, replayed: true }
    }

    assertPresentedEstimate(estimate, input.expectedVersion, now)

    await cancelPendingEstimateFollowUps(tx, {
      workspaceId,
      estimateId,
      reason: 'SUPERSEDED_BY_MANUAL_DELIVERY',
      now,
    })

    let share = await lockShare(tx, workspaceId, estimateId)
    if (share && share.expiresAt <= now) {
      await tx.estimateShare.update({
        where: { id: share.id },
        data: { revokedAt: safeRevocationTime(share, now) },
      })
      share = null
    }
    if (!share) share = await createShareRecord(tx, estimate, actorUserId, now)

    const delivery = await tx.estimateDelivery.create({
      data: {
        workspaceId,
        estimateId,
        estimateShareId: share.id,
        recipientEmail: input.recipientEmail,
        requestedByUserId: actorUserId,
        status: EstimateDeliveryStatus.PENDING,
        origin: 'MANUAL',
        idempotencyKey: input.idempotencyKey,
        nextAttemptAt: now,
      },
    })
    return { delivery, share, replayed: false }
  })
}

export function newDeliveryIdempotencyKey() {
  return randomBytes(24).toString('base64url')
}

export { lifecycleInputSchema }
