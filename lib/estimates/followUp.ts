import { createHash } from 'crypto'

import { Prisma, WorkspaceBusinessModel } from '@prisma/client'

import { prisma } from '@/lib/db'
import { parseSimpleAutomationConfig } from '@/lib/automations/simpleAutomationConfig'
import { getAutomationCapabilities } from '@/lib/automations/capabilities'
import { resolveWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import { isSupportedSchedulingTimezone } from '@/lib/scheduling/schedulingTimezones'
import {
  addDateKeys,
  combineDateAndTimeInTimezone,
  getWorkspaceDateKey,
  getWorkspaceTimeInputValue,
} from '@/lib/scheduling/schedulingDateTime'

export const ESTIMATE_FOLLOW_UP_DEFINITION_VERSION = 1
export const ESTIMATE_FOLLOW_UP_REMINDER_ORDINAL = 1
export const ESTIMATE_FOLLOW_UP_MAX_ATTEMPTS = 5
export const ESTIMATE_FOLLOW_UP_LEASE_MS = 5 * 60_000

type Tx = Prisma.TransactionClient

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function estimateFollowUpConfigurationFingerprint(input: {
  definitionVersion: number
  config: unknown
}) {
  return createHash('sha256')
    .update(
      stableJson({
        definitionVersion: input.definitionVersion,
        config: input.config,
      }),
    )
    .digest('hex')
}

export function getEstimateFollowUpDelayDays(config: unknown) {
  const parsed = parseSimpleAutomationConfig('estimate-follow-up', config)
  if (!parsed.success) return null
  const value = (parsed.data as Record<string, unknown>)['estimate-delay']
  return value === '1-day'
    ? 1
    : value === '3-days'
      ? 3
      : value === '7-days'
        ? 7
        : null
}

export function calculateEstimateFollowUpDueAt(input: {
  sentAt: Date
  timezone: string
  delayDays: number
}) {
  const sentDateKey = getWorkspaceDateKey(input.sentAt, input.timezone)
  const dueDateKey = addDateKeys(sentDateKey, input.delayDays)
  const dueAt = combineDateAndTimeInTimezone({
    dateKey: dueDateKey,
    time: getWorkspaceTimeInputValue(input.sentAt, input.timezone),
    timezone: input.timezone,
  })
  return { dueAt, dueDateKey }
}

export async function reconcileQueuedEstimateFollowUpRun(input: {
  workspaceId: string
  installationId: string
  eventKey: string
  dispatchId: string
  runId: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "SimpleAutomationDispatch" WHERE "id" = ${input.dispatchId} AND "workspaceId" = ${input.workspaceId} FOR UPDATE`,
    )
    const dispatch = await tx.simpleAutomationDispatch.findFirst({
      where: {
        id: input.dispatchId,
        workspaceId: input.workspaceId,
        installationId: input.installationId,
        eventKey: input.eventKey,
        status: 'PROCESSING',
        runId: input.runId,
      },
      select: { id: true },
    })
    if (!dispatch) return false

    const durableQueueResult = await tx.estimateFollowUpSchedule.findFirst({
      where: {
        workspaceId: input.workspaceId,
        installationId: input.installationId,
        dispatchId: input.dispatchId,
        automationRunId: input.runId,
        status: 'DISPATCHED',
        generatedDeliveryId: { not: null },
      },
      select: { id: true },
    })
    if (!durableQueueResult) return false

    const run = await tx.automationRun.updateMany({
      where: {
        id: input.runId,
        workspaceId: input.workspaceId,
        status: 'RUNNING',
      },
      data: {
        status: 'SUCCESS',
        finishedAt: now,
        log: '[recovery] Estimate follow-up email was durably queued.',
      },
    })
    if (run.count !== 1) {
      const currentRun = await tx.automationRun.findFirst({
        where: {
          id: input.runId,
          workspaceId: input.workspaceId,
          status: 'SUCCESS',
        },
        select: { id: true },
      })
      if (!currentRun) return false
    }
    await tx.automationRunEvent.updateMany({
      where: { runId: input.runId, status: 'RUNNING' },
      data: {
        status: 'SUCCESS',
        message: 'Estimate follow-up email queued.',
      },
    })
    const completed = await tx.simpleAutomationDispatch.updateMany({
      where: {
        id: input.dispatchId,
        workspaceId: input.workspaceId,
        status: 'PROCESSING',
        runId: input.runId,
      },
      data: {
        status: 'SUCCEEDED',
        completedAt: now,
        lastError: null,
      },
    })
    if (completed.count !== 1) {
      throw new Error('Estimate Follow-Up dispatch reconciliation was lost.')
    }
    return true
  })
}

export async function cancelPendingEstimateFollowUps(
  tx: Tx,
  input: {
    workspaceId: string
    estimateId?: string
    installationId?: string
    reason: string
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  const schedules = (
    tx as Tx & {
      estimateFollowUpSchedule?: Tx['estimateFollowUpSchedule']
    }
  ).estimateFollowUpSchedule
  if (!schedules) return { count: 0 }
  return schedules.updateMany({
    where: {
      workspaceId: input.workspaceId,
      estimateId: input.estimateId,
      installationId: input.installationId,
      status: { in: ['SCHEDULED', 'PROCESSING', 'FAILED'] },
    },
    data: {
      status: 'CANCELED',
      cancellationReason: input.reason.slice(0, 200),
      canceledAt: now,
      nextAttemptAt: null,
      claimedAt: null,
      claimedBy: null,
      leaseExpiresAt: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

function followUpIdentity(installationId: string, sourceDeliveryId: string) {
  return `estimate-follow-up:${installationId}:${sourceDeliveryId}:1`
}

export async function scheduleEstimateFollowUpForSentDelivery(
  tx: Tx,
  input: { deliveryId: string; now: Date },
) {
  const delivery = await tx.estimateDelivery.findUnique({
    where: { id: input.deliveryId },
    include: {
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
    },
  })
  if (
    !delivery ||
    delivery.origin !== 'MANUAL' ||
    delivery.status !== 'SENT' ||
    !delivery.sentAt ||
    delivery.estimate.status !== 'PRESENTED' ||
    delivery.estimate.archivedAt ||
    delivery.estimate.decisionEvidence ||
    delivery.estimate.workspace.businessModel !==
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS ||
    delivery.estimateShare.revokedAt ||
    delivery.estimateShare.expiresAt <= input.now
  ) {
    return null
  }

  const newerManual = await tx.estimateDelivery.findFirst({
    where: {
      workspaceId: delivery.workspaceId,
      estimateId: delivery.estimateId,
      origin: 'MANUAL',
      id: { not: delivery.id },
      OR: [
        { requestedAt: { gt: delivery.requestedAt } },
        { requestedAt: delivery.requestedAt, id: { gt: delivery.id } },
      ],
    },
    select: { id: true },
  })
  if (newerManual) return null

  const installation = await tx.simpleAutomationInstallation.findFirst({
    where: {
      workspaceId: delivery.workspaceId,
      definitionKey: 'estimate-follow-up',
      definitionVersion: ESTIMATE_FOLLOW_UP_DEFINITION_VERSION,
      removedAt: null,
      automation: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      definitionVersion: true,
      config: true,
    },
  })
  if (!installation) return null
  const delayDays = getEstimateFollowUpDelayDays(installation.config)
  if (!delayDays) return null

  const persistedScheduling = delivery.estimate.workspace.settings
    ?.scheduling as { timezone?: unknown } | null | undefined
  if (
    typeof persistedScheduling?.timezone !== 'string' ||
    !isSupportedSchedulingTimezone(persistedScheduling.timezone)
  ) {
    return null
  }
  const timezone = normalizeSchedulingSettings({
    businessModel: delivery.estimate.workspace.businessModel as any,
    settings: persistedScheduling as any,
  }).timezone
  const today = getWorkspaceDateKey(input.now, timezone)
  if (delivery.estimate.expiresOn && delivery.estimate.expiresOn < today) {
    return null
  }
  const { dueAt, dueDateKey } = calculateEstimateFollowUpDueAt({
    sentAt: delivery.sentAt,
    timezone,
    delayDays,
  })
  const afterExpiry = Boolean(
    delivery.estimate.expiresOn && dueDateKey > delivery.estimate.expiresOn,
  )
  const fingerprint = estimateFollowUpConfigurationFingerprint({
    definitionVersion: installation.definitionVersion,
    config: installation.config,
  })
  const idempotencyKey = followUpIdentity(installation.id, delivery.id)

  try {
    return await tx.estimateFollowUpSchedule.create({
      data: {
        workspaceId: delivery.workspaceId,
        estimateId: delivery.estimateId,
        installationId: installation.id,
        sourceDeliveryId: delivery.id,
        reminderOrdinal: ESTIMATE_FOLLOW_UP_REMINDER_ORDINAL,
        dueAt,
        timezone,
        configurationFingerprint: fingerprint,
        status: afterExpiry ? 'SKIPPED' : 'SCHEDULED',
        nextAttemptAt: null,
        idempotencyKey,
        ...(afterExpiry
          ? {
              cancellationReason: 'REMINDER_DUE_AFTER_ESTIMATE_EXPIRY',
              skippedAt: input.now,
            }
          : {}),
      },
    })
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }
    return tx.estimateFollowUpSchedule.findUnique({
      where: {
        installationId_sourceDeliveryId_reminderOrdinal: {
          installationId: installation.id,
          sourceDeliveryId: delivery.id,
          reminderOrdinal: ESTIMATE_FOLLOW_UP_REMINDER_ORDINAL,
        },
      },
    })
  }
}

function assertFollowUpPayload(input: {
  scheduleId?: unknown
  claimedBy?: unknown
  simpleEventKey?: unknown
}) {
  if (
    typeof input.scheduleId !== 'string' ||
    typeof input.claimedBy !== 'string' ||
    typeof input.simpleEventKey !== 'string'
  ) {
    throw new Error('Estimate Follow-Up is missing its schedule identity.')
  }
  return {
    scheduleId: input.scheduleId,
    claimedBy: input.claimedBy,
    eventKey: input.simpleEventKey,
  }
}

export async function queueAutomatedEstimateFollowUpDelivery(input: {
  workspaceId: string
  automationId: string
  runId: string
  triggerPayload: Record<string, unknown>
  now?: Date
}) {
  const identity = assertFollowUpPayload({
    scheduleId: input.triggerPayload.followUpScheduleId,
    claimedBy: input.triggerPayload.followUpClaimedBy,
    simpleEventKey: input.triggerPayload.simpleEventKey,
  })
  const now = input.now ?? new Date()

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "EstimateFollowUpSchedule" WHERE "id" = ${identity.scheduleId} AND "workspaceId" = ${input.workspaceId} FOR UPDATE`,
    )
    const schedule = await tx.estimateFollowUpSchedule.findFirst({
      where: {
        id: identity.scheduleId,
        workspaceId: input.workspaceId,
        status: 'PROCESSING',
        claimedBy: identity.claimedBy,
      },
      include: {
        sourceDelivery: { include: { estimateShare: true } },
        estimate: {
          include: {
            decisionEvidence: { select: { id: true } },
            workspace: {
              select: {
                businessModel: true,
                settings: { select: { scheduling: true } },
                subscription: { select: { plan: true } },
                owner: { select: { subscription: { select: { plan: true } } } },
              },
            },
          },
        },
        installation: {
          include: { automation: { select: { id: true, status: true } } },
        },
      },
    })
    if (!schedule) {
      throw new Error('Managed Estimate Follow-Up is no longer current.')
    }
    const installation = schedule.installation
    const plan = resolveWorkspacePlan({
      workspaceSubscriptionPlan: schedule.estimate.workspace.subscription?.plan,
      ownerSubscriptionPlan:
        schedule.estimate.workspace.owner.subscription?.plan,
    })
    const fingerprint = estimateFollowUpConfigurationFingerprint({
      definitionVersion: installation.definitionVersion,
      config: installation.config,
    })
    const persistedScheduling = schedule.estimate.workspace.settings
      ?.scheduling as { timezone?: unknown } | null | undefined
    const schedulingTimezoneCurrent =
      typeof persistedScheduling?.timezone === 'string' &&
      isSupportedSchedulingTimezone(persistedScheduling.timezone)
    const timezone = normalizeSchedulingSettings({
      businessModel: schedule.estimate.workspace.businessModel as any,
      settings: persistedScheduling as any,
    }).timezone
    const workspaceDateKey = getWorkspaceDateKey(now, timezone)
    const currentShare = await tx.estimateShare.findFirst({
      where: {
        id: schedule.sourceDelivery.estimateShareId,
        workspaceId: input.workspaceId,
        estimateId: schedule.estimateId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    })
    const newerManual = await tx.estimateDelivery.findFirst({
      where: {
        workspaceId: input.workspaceId,
        estimateId: schedule.estimateId,
        origin: 'MANUAL',
        id: { not: schedule.sourceDeliveryId },
        OR: [
          { requestedAt: { gt: schedule.sourceDelivery.requestedAt } },
          {
            requestedAt: schedule.sourceDelivery.requestedAt,
            id: { gt: schedule.sourceDeliveryId },
          },
        ],
      },
      select: { id: true },
    })
    if (
      installation.definitionKey !== 'estimate-follow-up' ||
      installation.definitionVersion !==
        ESTIMATE_FOLLOW_UP_DEFINITION_VERSION ||
      installation.removedAt ||
      installation.automation.id !== input.automationId ||
      installation.automation.status !== 'ACTIVE' ||
      schedule.configurationFingerprint !== fingerprint ||
      !schedulingTimezoneCurrent ||
      schedule.estimate.workspace.businessModel !==
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS ||
      !getAutomationCapabilities(plan).canUseStarterAutomations ||
      schedule.estimate.archivedAt ||
      schedule.estimate.status !== 'PRESENTED' ||
      schedule.estimate.decisionEvidence ||
      (schedule.estimate.expiresOn &&
        schedule.estimate.expiresOn < workspaceDateKey) ||
      schedule.sourceDelivery.origin !== 'MANUAL' ||
      schedule.sourceDelivery.status !== 'SENT' ||
      !currentShare ||
      newerManual
    ) {
      throw new Error('Managed Estimate Follow-Up is no longer current.')
    }

    const dispatch = await tx.simpleAutomationDispatch.findUnique({
      where: {
        installationId_eventKey: {
          installationId: installation.id,
          eventKey: identity.eventKey,
        },
      },
      select: { id: true, status: true, runId: true },
    })
    if (dispatch?.status !== 'PROCESSING' || dispatch.runId !== input.runId) {
      throw new Error(
        'Managed Simple Automation dispatch is no longer current.',
      )
    }

    const idempotencyKey = `estimate-follow-up-delivery:${schedule.id}`
    const delivery = await tx.estimateDelivery.upsert({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        estimateId: schedule.estimateId,
        estimateShareId: currentShare.id,
        recipientEmail: schedule.sourceDelivery.recipientEmail,
        requestedByUserId: installation.lastConfiguredByUserId,
        status: 'PENDING',
        origin: 'AUTOMATED_FOLLOW_UP',
        idempotencyKey,
        nextAttemptAt: now,
      },
      update: {},
    })
    const updated = await tx.estimateFollowUpSchedule.updateMany({
      where: {
        id: schedule.id,
        workspaceId: input.workspaceId,
        status: 'PROCESSING',
        claimedBy: identity.claimedBy,
      },
      data: {
        status: 'DISPATCHED',
        dispatchId: dispatch.id,
        automationRunId: input.runId,
        generatedDeliveryId: delivery.id,
        dispatchedAt: now,
        nextAttemptAt: null,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        failedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    if (updated.count !== 1) {
      throw new Error('Estimate Follow-Up worker claim was lost.')
    }
    return { deliveryId: delivery.id }
  })
}
