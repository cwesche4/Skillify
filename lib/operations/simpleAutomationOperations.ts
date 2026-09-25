import { DomainOutboxStatus, RunStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  HUBSPOT_WEBHOOK_AGGREGATE_TYPE,
  HUBSPOT_WEBHOOK_TOPIC,
  durableHubSpotWebhookPayloadSchema,
} from '@/lib/domain-events/hubspotWebhookEvents'
import {
  SUPPORTED_DOMAIN_EVENT_IDENTITIES,
  SUPPORTED_DOMAIN_EVENT_TOPICS,
} from '@/lib/domain-events/processor'
import {
  NATIVE_LEAD_AGGREGATE_TYPE,
  NATIVE_LEAD_CREATED_TOPIC,
  NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
  nativeLeadCreatedPayloadSchema,
  nativeLeadFollowUpDuePayloadSchema,
} from '@/lib/domain-events/nativeLeadEvents'
import {
  NATIVE_JOB_AGGREGATE_TYPE,
  NATIVE_JOB_COMPLETED_TOPIC,
  nativeJobCompletedPayloadSchema,
} from '@/lib/domain-events/nativeJobEvents'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { getSchedulingNotificationWorkerDiagnostics } from '@/lib/scheduling/notifications/notificationService'

function ageMs(now: Date, date?: Date | null) {
  return date ? Math.max(0, now.getTime() - date.getTime()) : null
}

export async function getSimpleAutomationOperationsHealth({
  now = new Date(),
}: {
  now?: Date
} = {}) {
  const topics = [...SUPPORTED_DOMAIN_EVENT_TOPICS]
  const [
    nativePending,
    nativeProcessing,
    nativeRetryableFailed,
    nativeDead,
    oldestNativeEligible,
    lastNativeSuccess,
    failedSimpleRuns,
    failedRunsByAutomation,
    scheduling,
    lastRecurrenceMaterialization,
  ] = await Promise.all([
    prisma.domainOutboxEvent.count({
      where: { topic: { in: topics }, status: DomainOutboxStatus.PENDING },
    }),
    prisma.domainOutboxEvent.count({
      where: { topic: { in: topics }, status: DomainOutboxStatus.PROCESSING },
    }),
    prisma.domainOutboxEvent.count({
      where: { topic: { in: topics }, status: DomainOutboxStatus.FAILED },
    }),
    prisma.domainOutboxEvent.count({
      where: { topic: { in: topics }, status: DomainOutboxStatus.DEAD },
    }),
    prisma.domainOutboxEvent.findFirst({
      where: {
        topic: { in: topics },
        availableAt: { lte: now },
        OR: [
          { status: DomainOutboxStatus.PENDING },
          {
            status: DomainOutboxStatus.FAILED,
            OR: [
              { nextAttemptAt: null },
              { nextAttemptAt: { lte: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.domainOutboxEvent.findFirst({
      where: {
        topic: { in: topics },
        status: DomainOutboxStatus.PROCESSED,
        processedAt: { not: null },
      },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true },
    }),
    prisma.automationRun.count({
      where: {
        status: RunStatus.FAILED,
        automation: { simpleAutomationInstallation: { isNot: null } },
      },
    }),
    prisma.automationRun.groupBy({
      by: ['automationId'],
      where: {
        status: RunStatus.FAILED,
        automation: { simpleAutomationInstallation: { isNot: null } },
      },
      _count: { _all: true },
    }),
    getSchedulingNotificationWorkerDiagnostics({ nowUtc: now }),
    prisma.domainOutboxEvent.findFirst({
      where: {
        topic: 'scheduling.recurrence.materialized',
        status: DomainOutboxStatus.PROCESSED,
        processedAt: { not: null },
      },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true },
    }),
  ])

  const automationIds = failedRunsByAutomation.map((row) => row.automationId)
  const managedAutomations = automationIds.length
    ? await prisma.automation.findMany({
        where: {
          id: { in: automationIds },
          simpleAutomationInstallation: { isNot: null },
        },
        select: {
          id: true,
          name: true,
          simpleAutomationInstallation: {
            select: { definitionKey: true },
          },
        },
      })
    : []
  const automationById = new Map(
    managedAutomations.map((automation) => [automation.id, automation]),
  )

  return {
    generatedAt: now.toISOString(),
    nativeDomainOutbox: {
      pending: nativePending,
      processing: nativeProcessing,
      retryableFailed: nativeRetryableFailed,
      dead: nativeDead,
      oldestEligiblePendingAgeMs: ageMs(
        now,
        oldestNativeEligible?.createdAt,
      ),
    },
    schedulingOutbox: {
      pending: scheduling.outboxPending,
      processing: scheduling.outboxProcessing,
      retryableFailed: scheduling.outboxRetryableFailed,
      dead: scheduling.outboxDead,
      oldestEligiblePendingAgeMs:
        scheduling.oldestEligiblePendingAgeMs,
    },
    reminders: {
      pending: scheduling.reminderPending,
      processing: scheduling.reminderProcessing,
      retryableFailed: scheduling.reminderRetryableFailed,
      permanentlyFailed: scheduling.reminderPermanentlyFailed,
      overdue: scheduling.reminderOverdue,
      oldestOverdueAgeMs: scheduling.oldestOverdueAgeMs,
    },
    simpleAutomations: {
      failedRuns: failedSimpleRuns,
      failedRunsByRecipe: failedRunsByAutomation.flatMap((row) => {
        const automation = automationById.get(row.automationId)
        if (!automation?.simpleAutomationInstallation) return []
        return [
          {
            definitionKey:
              automation.simpleAutomationInstallation.definitionKey,
            automationName: automation.name,
            failedRuns: row._count._all,
          },
        ]
      }),
    },
    workers: {
      expectedCadence: {
        nativeDomainSeconds: 60,
        schedulingSeconds: 60,
        schedulingRecoverySeconds: 300,
        recurrenceHorizonSeconds: 86_400,
      },
      nativeDomainLastSuccessfulWorkAt:
        lastNativeSuccess?.processedAt?.toISOString() ?? null,
      schedulingLastSuccessfulWorkAt:
        scheduling.lastSuccessfulExecution,
      recurrenceLastSuccessfulMaterializationAt:
        lastRecurrenceMaterialization?.processedAt?.toISOString() ?? null,
      heartbeatSource: 'vercel-cron-invocation-logs',
      heartbeatNote:
        'Cron invocation history is authoritative for empty successful runs; durable timestamps report the latest completed work.',
    },
  }
}

export type RecoverTerminalDomainEventResult =
  | { ok: true; eventId: string; workspaceId: string }
  | {
      ok: false
      status: 404 | 409 | 422
      code: 'NOT_FOUND' | 'NOT_TERMINAL' | 'INELIGIBLE'
      message: string
    }

export async function recoverTerminalDomainEvent({
  eventId,
  workspaceId,
  operatorSystem,
  now = new Date(),
}: {
  eventId: string
  workspaceId: string
  operatorSystem: string
  now?: Date
}): Promise<RecoverTerminalDomainEventResult> {
  const event = await prisma.domainOutboxEvent.findFirst({
    where: {
      id: eventId,
      workspaceId,
      OR: [...SUPPORTED_DOMAIN_EVENT_IDENTITIES],
    },
    select: {
      id: true,
      workspaceId: true,
      topic: true,
      aggregateType: true,
      aggregateId: true,
      payload: true,
      status: true,
      attempts: true,
      lastErrorCode: true,
      processingOutcome: true,
    },
  })
  if (!event) {
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Terminal domain event not found in this workspace.',
    }
  }
  if (event.status !== DomainOutboxStatus.DEAD) {
    return {
      ok: false,
      status: 409,
      code: 'NOT_TERMINAL',
      message: 'Only a DEAD domain event can be recovered.',
    }
  }

  if (
    event.topic === HUBSPOT_WEBHOOK_TOPIC &&
    event.aggregateType === HUBSPOT_WEBHOOK_AGGREGATE_TYPE
  ) {
    const parsed = durableHubSpotWebhookPayloadSchema.safeParse(event.payload)
    const integration = parsed.success
      ? await prisma.integration.findFirst({
          where: {
            id: event.aggregateId,
            workspaceId,
            provider: 'hubspot',
            status: 'connected',
          },
          select: { id: true },
        })
      : null
    const eligiblePlan = integration
      ? (await getWorkspacePlan(workspaceId)) === 'Elite'
      : false
    if (
      !parsed.success ||
      parsed.data.workspaceId !== workspaceId ||
      parsed.data.integrationId !== event.aggregateId ||
      !integration ||
      !eligiblePlan
    ) {
      return {
        ok: false,
        status: 422,
        code: 'INELIGIBLE',
        message: 'The HubSpot event is no longer eligible for recovery.',
      }
    }
  } else if (
    event.topic === NATIVE_LEAD_CREATED_TOPIC &&
    event.aggregateType === NATIVE_LEAD_AGGREGATE_TYPE
  ) {
    const parsed = nativeLeadCreatedPayloadSchema.safeParse(event.payload)
    const lead = parsed.success
      ? await prisma.lead.findFirst({
          where: { id: event.aggregateId, workspaceId },
          select: { id: true },
        })
      : null
    if (
      !parsed.success ||
      parsed.data.workspaceId !== workspaceId ||
      parsed.data.leadId !== event.aggregateId ||
      !lead
    ) {
      return {
        ok: false,
        status: 422,
        code: 'INELIGIBLE',
        message: 'The native Lead event is no longer eligible for recovery.',
      }
    }
  } else if (
    event.topic === NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC &&
    event.aggregateType === NATIVE_LEAD_AGGREGATE_TYPE
  ) {
    const parsed = nativeLeadFollowUpDuePayloadSchema.safeParse(event.payload)
    if (
      !parsed.success ||
      parsed.data.workspaceId !== workspaceId ||
      parsed.data.leadId !== event.aggregateId
    ) {
      return {
        ok: false,
        status: 422,
        code: 'INELIGIBLE',
        message: 'The Lead follow-up event is not valid for recovery.',
      }
    }
  } else if (
    event.topic === NATIVE_JOB_COMPLETED_TOPIC &&
    event.aggregateType === NATIVE_JOB_AGGREGATE_TYPE
  ) {
    const parsed = nativeJobCompletedPayloadSchema.safeParse(event.payload)
    if (
      !parsed.success ||
      parsed.data.workspaceId !== workspaceId ||
      parsed.data.jobId !== event.aggregateId
    ) {
      return {
        ok: false,
        status: 422,
        code: 'INELIGIBLE',
        message: 'The native Job event is not valid for recovery.',
      }
    }
  }

  const recovered = await prisma.$transaction(async (tx) => {
    const updated = await tx.domainOutboxEvent.updateMany({
      where: {
        id: event.id,
        workspaceId,
        status: DomainOutboxStatus.DEAD,
      },
      data: {
        status: DomainOutboxStatus.PENDING,
        attempts: 0,
        availableAt: now,
        nextAttemptAt: null,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        processedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        processingOutcome: 'OPERATOR_RETRY_REQUESTED',
      },
    })
    if (updated.count !== 1) return false
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: null,
        action: 'DOMAIN_EVENT_RECOVERY_REQUESTED',
        objectType: 'DomainOutboxEvent',
        objectId: event.id,
        metadata: {
          operatorSystem,
          topic: event.topic,
          previousStatus: event.status,
          previousAttempts: event.attempts,
          previousErrorCode: event.lastErrorCode,
          previousOutcome: event.processingOutcome,
          requestedAt: now.toISOString(),
        },
      },
    })
    return true
  })

  if (!recovered) {
    return {
      ok: false,
      status: 409,
      code: 'NOT_TERMINAL',
      message: 'This event was already recovered or changed state.',
    }
  }
  return { ok: true, eventId: event.id, workspaceId }
}
