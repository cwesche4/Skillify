import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { dispatchSimpleAutomationEvent } from '@/lib/automations/simpleAutomationDispatch'
import { prisma } from '@/lib/db'
import {
  ESTIMATE_FOLLOW_UP_LEASE_MS,
  ESTIMATE_FOLLOW_UP_MAX_ATTEMPTS,
} from '@/lib/estimates/followUp'

const MAX_BATCH_SIZE = 50

function retryDelayMs(attempts: number) {
  const minutes = [1, 5, 15, 60][Math.min(Math.max(attempts - 1, 0), 3)]
  return minutes * 60_000
}

export async function claimDueEstimateFollowUps(input: {
  now: Date
  workerId: string
  batchSize: number
}) {
  const leaseExpiresAt = new Date(
    input.now.getTime() + ESTIMATE_FOLLOW_UP_LEASE_MS,
  )
  return prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "EstimateFollowUpSchedule"
      WHERE (
        ("status" = 'SCHEDULED' AND "dueAt" <= ${input.now})
        OR ("status" = 'FAILED' AND "nextAttemptAt" IS NOT NULL AND "nextAttemptAt" <= ${input.now})
        OR ("status" = 'PROCESSING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" <= ${input.now})
      )
      ORDER BY COALESCE("nextAttemptAt", "dueAt") ASC, "id" ASC
      LIMIT ${input.batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "EstimateFollowUpSchedule" schedule
    SET "status" = 'PROCESSING',
        "attempts" = schedule."attempts" + 1,
        "claimedAt" = ${input.now},
        "claimedBy" = ${input.workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "nextAttemptAt" = NULL,
        "failedAt" = NULL,
        "lastErrorCode" = NULL,
        "lastErrorMessage" = NULL,
        "updatedAt" = ${input.now}
    FROM candidates
    WHERE schedule."id" = candidates."id"
    RETURNING schedule."id"
  `)
}

const lifecycleCancellationMessages = new Set([
  'Automation is not active',
  'Automation not found',
  'Managed Simple Automation is no longer active.',
  'Managed Simple Automation is no longer eligible.',
  'Managed Simple Automation dispatch is no longer current.',
  'Managed Estimate Follow-Up is no longer current.',
  'Estimate Follow-Up worker claim was lost.',
])

export async function processEstimateFollowUpSchedules({
  now = new Date(),
  workerId = `estimate-follow-up:${randomUUID()}`,
  batchSize = 20,
}: {
  now?: Date
  workerId?: string
  batchSize?: number
} = {}) {
  if (
    !(prisma as typeof prisma & { estimateFollowUpSchedule?: unknown })
      .estimateFollowUpSchedule
  ) {
    return { claimed: 0, dispatched: 0, failed: 0, canceled: 0 }
  }
  const boundedBatch = Math.max(1, Math.min(MAX_BATCH_SIZE, batchSize))
  const claimed = await claimDueEstimateFollowUps({
    now,
    workerId,
    batchSize: boundedBatch,
  })
  const result = {
    claimed: claimed.length,
    dispatched: 0,
    failed: 0,
    canceled: 0,
  }

  for (const claim of claimed) {
    const schedule = await prisma.estimateFollowUpSchedule.findFirst({
      where: {
        id: claim.id,
        status: 'PROCESSING',
        claimedBy: workerId,
      },
      include: {
        installation: { select: { automationId: true } },
      },
    })
    if (!schedule) continue

    try {
      await dispatchSimpleAutomationEvent({
        workspaceId: schedule.workspaceId,
        installationId: schedule.installationId,
        automationId: schedule.installation.automationId,
        eventKey: `estimate-follow-up:${schedule.id}`,
        triggerPayload: {
          source: 'skillify-native',
          event: 'estimate.follow_up_due',
          simpleEventKey: `estimate-follow-up:${schedule.id}`,
          followUpScheduleId: schedule.id,
          followUpClaimedBy: workerId,
          externalId: schedule.estimateId,
        },
      })
      const dispatched = await prisma.estimateFollowUpSchedule.count({
        where: { id: schedule.id, status: 'DISPATCHED' },
      })
      if (dispatched) result.dispatched += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Estimate Follow-Up failed.'
      const canceled = lifecycleCancellationMessages.has(message)
      const permanent =
        !canceled && schedule.attempts >= ESTIMATE_FOLLOW_UP_MAX_ATTEMPTS
      const update = await prisma.estimateFollowUpSchedule.updateMany({
        where: {
          id: schedule.id,
          workspaceId: schedule.workspaceId,
          status: 'PROCESSING',
          claimedBy: workerId,
        },
        data: canceled
          ? {
              status: 'CANCELED',
              cancellationReason: message.slice(0, 200),
              canceledAt: now,
              claimedAt: null,
              claimedBy: null,
              leaseExpiresAt: null,
              nextAttemptAt: null,
            }
          : {
              status: permanent ? 'PERMANENTLY_FAILED' : 'FAILED',
              failedAt: now,
              nextAttemptAt: permanent
                ? null
                : new Date(now.getTime() + retryDelayMs(schedule.attempts)),
              lastErrorCode: permanent
                ? 'ESTIMATE_FOLLOW_UP_PERMANENT_FAILURE'
                : 'ESTIMATE_FOLLOW_UP_RETRYABLE_FAILURE',
              lastErrorMessage: message.slice(0, 500),
              claimedAt: null,
              claimedBy: null,
              leaseExpiresAt: null,
            },
      })
      if (!update.count) continue
      if (canceled) result.canceled += 1
      else result.failed += 1
    }
  }

  return result
}
