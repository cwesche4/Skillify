import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  publicEstimateBaseUrl,
  signedEstimateShareUrl,
} from '@/lib/estimates/customerExperience'
import {
  resolveVerifiedEstimateSender,
  sendEstimateEmailWithResend,
  type EstimateEmailMessage,
  type EstimateEmailResult,
  type VerifiedEstimateSender,
} from '@/lib/estimates/estimateEmail'
import { EstimateStatus } from '@/lib/prisma/enums'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'
import { isSupportedSchedulingTimezone } from '@/lib/scheduling/schedulingTimezones'
import {
  ESTIMATE_FOLLOW_UP_DEFINITION_VERSION,
  estimateFollowUpConfigurationFingerprint,
  scheduleEstimateFollowUpForSentDelivery,
} from '@/lib/estimates/followUp'
import { processEstimateFollowUpSchedules } from '@/lib/estimates/followUpWorker'

const MAX_BATCH_SIZE = 50
const MAX_ATTEMPTS = 5
const LEASE_MS = 5 * 60_000

const deliveryInclude = {
  estimateShare: true,
  estimate: {
    include: {
      decisionEvidence: { select: { id: true } },
      workspace: {
        select: {
          businessModel: true,
          settings: { select: { scheduling: true } },
        },
      },
    },
  },
} as const

type ClaimedDelivery = Prisma.EstimateDeliveryGetPayload<{
  include: typeof deliveryInclude
}>

function retryDelayMs(attempts: number) {
  const minutes = [1, 5, 15, 60][Math.min(Math.max(attempts - 1, 0), 3)]
  return minutes * 60_000
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function identityName(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Your service provider'
  }
  const name = (value as Record<string, unknown>).displayName
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : 'Your service provider'
}

function estimateMessage(input: {
  deliveryId: string
  recipientEmail: string
  publicId: string
  businessIdentitySnapshot: unknown
  referenceNumber: string
  revisionNumber: number
  title: string
  origin: 'MANUAL' | 'AUTOMATED_FOLLOW_UP'
  expiresOn: string | null
  workspaceDateKey: string
}) {
  const business = identityName(input.businessIdentitySnapshot)
  const link = signedEstimateShareUrl(input.publicId, publicEstimateBaseUrl())
  const reminder = input.origin === 'AUTOMATED_FOLLOW_UP'
  const subject = reminder
    ? `Reminder: Estimate ${input.referenceNumber} from ${business}`
    : `${business} sent Estimate ${input.referenceNumber}`
  const expiry =
    input.expiresOn === input.workspaceDateKey
      ? 'This estimate expires today.'
      : input.expiresOn
        ? `This estimate is available through ${input.expiresOn}.`
        : null
  const text = [
    reminder
      ? `${business} is reminding you about the estimate for ${input.title}.`
      : `${business} sent you an estimate for ${input.title}.`,
    `Estimate ${input.referenceNumber}, revision ${input.revisionNumber}.`,
    ...(expiry ? [expiry] : []),
    '',
    `Review and respond securely: ${link}`,
    '',
    'This secure link is specific to this estimate revision. Do not forward it.',
  ].join('\n')
  const html = `
    <main style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:22px;margin:0 0 16px">${reminder ? 'Estimate reminder' : 'Estimate'} from ${escapeHtml(business)}</h1>
      <p>${escapeHtml(business)} ${reminder ? 'is reminding you about' : 'sent you'} an estimate for <strong>${escapeHtml(input.title)}</strong>.</p>
      <p>Estimate ${escapeHtml(input.referenceNumber)}, revision ${input.revisionNumber}.</p>
      ${expiry ? `<p>${escapeHtml(expiry)}</p>` : ''}
      <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#3157d5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Review estimate</a></p>
      <p style="font-size:13px;color:#5f687a">This secure link is specific to this estimate revision. Do not forward it.</p>
    </main>
  `
  return {
    to: input.recipientEmail,
    subject,
    text,
    html,
    idempotencyKey: `estimate-delivery:${input.deliveryId}`,
  } satisfies EstimateEmailMessage
}

async function claimDeliveries({
  now,
  workerId,
  batchSize,
}: {
  now: Date
  workerId: string
  batchSize: number
}) {
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS)
  return prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "EstimateDelivery"
      WHERE (
        ("status" = 'PENDING' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now}))
        OR ("status" = 'FAILED' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now}))
        OR ("status" = 'PROCESSING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" <= ${now})
      )
      ORDER BY "nextAttemptAt" ASC NULLS FIRST, "requestedAt" ASC, "id" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "EstimateDelivery" delivery
    SET "status" = 'PROCESSING',
        "attempts" = delivery."attempts" + 1,
        "claimedAt" = ${now},
        "claimedBy" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "lastAttemptAt" = ${now},
        "updatedAt" = ${now}
    FROM candidates
    WHERE delivery."id" = candidates."id"
    RETURNING delivery."id"
  `)
}

async function finishClaim(
  deliveryId: string,
  workerId: string,
  data: Prisma.EstimateDeliveryUpdateManyMutationInput,
) {
  return prisma.estimateDelivery.updateMany({
    where: {
      id: deliveryId,
      status: 'PROCESSING',
      claimedBy: workerId,
    },
    data: {
      ...data,
      claimedAt: null,
      claimedBy: null,
      leaseExpiresAt: null,
    },
  })
}

async function deliveryIsStale(delivery: ClaimedDelivery, now: Date) {
  if (
    delivery.estimate.archivedAt !== null ||
    delivery.estimate.status !== EstimateStatus.PRESENTED ||
    delivery.estimate.decisionEvidence !== null ||
    delivery.estimateShare.revokedAt !== null ||
    delivery.estimateShare.expiresAt <= now
  ) {
    return true
  }
  const timezone = normalizeSchedulingSettings({
    businessModel: delivery.estimate.workspace.businessModel as any,
    settings: (delivery.estimate.workspace.settings?.scheduling ??
      undefined) as any,
  }).timezone
  if (
    delivery.estimate.expiresOn &&
    delivery.estimate.expiresOn < getWorkspaceDateKey(now, timezone)
  ) {
    return true
  }
  if (delivery.origin !== 'AUTOMATED_FOLLOW_UP') return false

  const persistedScheduling = delivery.estimate.workspace.settings
    ?.scheduling as { timezone?: unknown } | null | undefined
  if (
    typeof persistedScheduling?.timezone !== 'string' ||
    !isSupportedSchedulingTimezone(persistedScheduling.timezone)
  ) {
    return true
  }

  const schedule = await prisma.estimateFollowUpSchedule.findUnique({
    where: { generatedDeliveryId: delivery.id },
    include: {
      sourceDelivery: { select: { id: true, requestedAt: true } },
      installation: {
        include: { automation: { select: { status: true } } },
      },
    },
  })
  if (
    !schedule ||
    schedule.workspaceId !== delivery.workspaceId ||
    schedule.estimateId !== delivery.estimateId ||
    schedule.status !== 'DISPATCHED' ||
    schedule.installation.removedAt ||
    schedule.installation.definitionKey !== 'estimate-follow-up' ||
    schedule.installation.definitionVersion !==
      ESTIMATE_FOLLOW_UP_DEFINITION_VERSION ||
    schedule.installation.automation.status !== 'ACTIVE' ||
    schedule.configurationFingerprint !==
      estimateFollowUpConfigurationFingerprint({
        definitionVersion: schedule.installation.definitionVersion,
        config: schedule.installation.config,
      })
  ) {
    return true
  }
  const newerManual = await prisma.estimateDelivery.findFirst({
    where: {
      workspaceId: delivery.workspaceId,
      estimateId: delivery.estimateId,
      origin: 'MANUAL',
      id: { not: schedule.sourceDelivery.id },
      OR: [
        { requestedAt: { gt: schedule.sourceDelivery.requestedAt } },
        {
          requestedAt: schedule.sourceDelivery.requestedAt,
          id: { gt: schedule.sourceDelivery.id },
        },
      ],
    },
    select: { id: true },
  })
  return Boolean(newerManual)
}

async function readOwnedClaim(deliveryId: string, workerId: string) {
  return prisma.estimateDelivery.findFirst({
    where: { id: deliveryId, status: 'PROCESSING', claimedBy: workerId },
    include: deliveryInclude,
  })
}

async function cancelStaleClaim(deliveryId: string, workerId: string) {
  return finishClaim(deliveryId, workerId, {
    status: 'CANCELED',
    nextAttemptAt: null,
    failedAt: null,
    lastErrorCode: 'ESTIMATE_NO_LONGER_SENDABLE',
    lastErrorMessage:
      'The queued Estimate email was canceled because the share or commercial revision is no longer active.',
  })
}

export async function processEstimateDeliveryQueue({
  now = new Date(),
  workerId = `estimate-delivery:${randomUUID()}`,
  batchSize = 20,
  resolveSender = resolveVerifiedEstimateSender,
  send = sendEstimateEmailWithResend,
}: {
  now?: Date
  workerId?: string
  batchSize?: number
  resolveSender?: (workspaceId: string) => Promise<VerifiedEstimateSender>
  send?: (input: {
    sender: VerifiedEstimateSender
    message: EstimateEmailMessage
  }) => Promise<EstimateEmailResult>
} = {}) {
  const boundedBatch = Math.max(1, Math.min(MAX_BATCH_SIZE, batchSize))
  await processEstimateFollowUpSchedules({
    now,
    workerId: `${workerId}:follow-up`,
    batchSize: boundedBatch,
  })
  const claimed = await claimDeliveries({
    now,
    workerId,
    batchSize: boundedBatch,
  })
  const result = {
    claimed: claimed.length,
    sent: 0,
    failed: 0,
    canceled: 0,
  }

  for (const claim of claimed) {
    let delivery = await readOwnedClaim(claim.id, workerId)
    if (!delivery) continue

    if (await deliveryIsStale(delivery, now)) {
      const update = await cancelStaleClaim(delivery.id, workerId)
      if (update.count) result.canceled += 1
      continue
    }
    let ownedDeliveryId = delivery.id
    let ownedDeliveryAttempts = delivery.attempts

    let sendResult: EstimateEmailResult
    try {
      const sender = await resolveSender(delivery.workspaceId)
      delivery = await readOwnedClaim(delivery.id, workerId)
      if (!delivery) continue
      if (await deliveryIsStale(delivery, now)) {
        const update = await cancelStaleClaim(delivery.id, workerId)
        if (update.count) result.canceled += 1
        continue
      }
      ownedDeliveryId = delivery.id
      ownedDeliveryAttempts = delivery.attempts
      sendResult = await send({
        sender,
        message: estimateMessage({
          deliveryId: delivery.id,
          recipientEmail: delivery.recipientEmail,
          publicId: delivery.estimateShare.publicId,
          businessIdentitySnapshot:
            delivery.estimateShare.businessIdentitySnapshot,
          referenceNumber: delivery.estimate.referenceNumber,
          revisionNumber: delivery.estimate.revisionNumber,
          title: delivery.estimate.title,
          origin: delivery.origin,
          expiresOn: delivery.estimate.expiresOn,
          workspaceDateKey: getWorkspaceDateKey(
            now,
            normalizeSchedulingSettings({
              businessModel: delivery.estimate.workspace.businessModel as any,
              settings: (delivery.estimate.workspace.settings?.scheduling ??
                undefined) as any,
            }).timezone,
          ),
        }),
      })
    } catch (error) {
      sendResult = {
        status: 'failed',
        provider: 'resend',
        code: 'SENDER_CONFIGURATION_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'The verified workspace sender is unavailable.',
        retryable: false,
      }
    }

    if (sendResult.status === 'sent') {
      const update = await prisma.$transaction(async (tx) => {
        const sent = await tx.estimateDelivery.updateMany({
          where: {
            id: ownedDeliveryId,
            status: 'PROCESSING',
            claimedBy: workerId,
          },
          data: {
            status: 'SENT',
            provider: sendResult.provider,
            providerMessageId: sendResult.providerMessageId,
            sentAt: now,
            failedAt: null,
            nextAttemptAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            claimedAt: null,
            claimedBy: null,
            leaseExpiresAt: null,
          },
        })
        if (sent.count === 1) {
          await scheduleEstimateFollowUpForSentDelivery(tx, {
            deliveryId: ownedDeliveryId,
            now,
          })
        }
        return sent
      })
      if (update.count) result.sent += 1
      continue
    }

    const permanent =
      !sendResult.retryable || ownedDeliveryAttempts >= MAX_ATTEMPTS
    const update = await finishClaim(ownedDeliveryId, workerId, {
      status: permanent ? 'PERMANENTLY_FAILED' : 'FAILED',
      provider: sendResult.provider,
      failedAt: now,
      nextAttemptAt: permanent
        ? null
        : new Date(now.getTime() + retryDelayMs(ownedDeliveryAttempts)),
      lastErrorCode: sendResult.code.slice(0, 100),
      lastErrorMessage: sendResult.message.slice(0, 500),
    })
    if (update.count) result.failed += 1
  }

  return result
}
