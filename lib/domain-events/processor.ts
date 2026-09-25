import { randomUUID } from 'crypto'

import { dispatchSimpleAutomationEvent } from '@/lib/automations/simpleAutomationDispatch'
import {
  getSimpleAutomationReadiness,
  type SimpleAutomationReadiness,
} from '@/lib/automations/simpleAutomationReadiness'
import {
  NATIVE_LEAD_AGGREGATE_TYPE,
  NATIVE_LEAD_CREATED_TOPIC,
  NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
  nativeLeadCreatedPayloadSchema,
  nativeLeadFollowUpDuePayloadSchema,
  nativeLeadEventKey,
} from '@/lib/domain-events/nativeLeadEvents'
import {
  NATIVE_JOB_AGGREGATE_TYPE,
  NATIVE_JOB_COMPLETED_TOPIC,
  nativeJobCompletedPayloadSchema,
  nativeJobEventKey,
} from '@/lib/domain-events/nativeJobEvents'
import {
  HUBSPOT_WEBHOOK_AGGREGATE_TYPE,
  HUBSPOT_WEBHOOK_TOPIC,
  durableHubSpotWebhookPayloadSchema,
} from '@/lib/domain-events/hubspotWebhookEvents'
import type {
  ProcessResult as WebhookProcessResult,
} from '@/lib/integrations/webhookProcessor'
import type { IntegrationWebhookPayload } from '@/lib/integrations/types'

const EVENT_LEASE_MS = 5 * 60_000
const MAX_EVENT_ATTEMPTS = 5

type ClaimedEvent = {
  id: string
  workspaceId: string
  topic: string
  aggregateType: string
  aggregateId: string
  payload: unknown
  attempts: number
  claimedBy: string
}

type Installation = {
  id: string
  workspaceId: string
  definitionKey: string
  definitionVersion: number
  config: unknown
  automation: { id: string; flow: unknown }
}

type DispatchRecord = {
  id: string
  status: string
  runId: string | null
}

type LeadFollowUpState = {
  stage: string
  followUpAt: Date | null
  convertedCustomerId: string | null
  archivedAt: Date | null
}

type JobCompletionState = {
  status: string
  completedAt: Date | null
  archivedAt: Date | null
}

const NATIVE_LEAD_TOPICS = [
  NATIVE_LEAD_CREATED_TOPIC,
  NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
] as const

export const SUPPORTED_DOMAIN_EVENT_TOPICS = [
  ...NATIVE_LEAD_TOPICS,
  NATIVE_JOB_COMPLETED_TOPIC,
  HUBSPOT_WEBHOOK_TOPIC,
] as const

export const SUPPORTED_DOMAIN_EVENT_IDENTITIES = [
  {
    topic: { in: [...NATIVE_LEAD_TOPICS] },
    aggregateType: NATIVE_LEAD_AGGREGATE_TYPE,
  },
  {
    topic: NATIVE_JOB_COMPLETED_TOPIC,
    aggregateType: NATIVE_JOB_AGGREGATE_TYPE,
  },
  {
    topic: HUBSPOT_WEBHOOK_TOPIC,
    aggregateType: HUBSPOT_WEBHOOK_AGGREGATE_TYPE,
  },
]

export type DomainEventProcessorDependencies = {
  claim: (input: {
    eventId: string
    workerId: string
    now: Date
  }) => Promise<ClaimedEvent | null>
  findInstallation: (input: {
    workspaceId: string
    definitionKey:
      | 'new-lead-alert'
      | 'lead-follow-up'
      | 'job-completion-message'
  }) => Promise<Installation | null>
  findLeadFollowUpState: (input: {
    workspaceId: string
    leadId: string
  }) => Promise<LeadFollowUpState | null>
  findJobCompletionState: (input: {
    workspaceId: string
    jobId: string
  }) => Promise<JobCompletionState | null>
  getReadiness: (input: {
    workspaceId: string
    definitionKey: string
    definitionVersion: number
    config: unknown
  }) => Promise<SimpleAutomationReadiness>
  dispatch: typeof dispatchSimpleAutomationEvent
  processWebhook: (input: {
    workspaceId: string
    integrationId: string
    payload: IntegrationWebhookPayload
  }) => Promise<WebhookProcessResult>
  findDispatch: (input: {
    installationId: string
    eventKey: string
  }) => Promise<DispatchRecord | null>
  complete: (input: {
    eventId: string
    workerId: string
    now: Date
    outcome: string
    dispatchId?: string | null
    runId?: string | null
  }) => Promise<void>
  fail: (input: {
    event: ClaimedEvent
    now: Date
    error: unknown
  }) => Promise<void>
  listPendingIds: (input: { now: Date; limit: number }) => Promise<string[]>
}

function hasExecutableFlow(flow: unknown) {
  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) return false
  const nodes = (flow as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.length > 0
}

export const defaultDomainEventProcessorDependencies: DomainEventProcessorDependencies =
  {
    async claim({ eventId, workerId, now }) {
      const { prisma } = await import('@/lib/db')
      const staleBefore = new Date(now.getTime() - EVENT_LEASE_MS)
      const leaseExpiresAt = new Date(now.getTime() + EVENT_LEASE_MS)
      const claimed = await prisma.domainOutboxEvent.updateMany({
        where: {
          id: eventId,
          availableAt: { lte: now },
          AND: [
            { OR: [...SUPPORTED_DOMAIN_EVENT_IDENTITIES] },
            {
              OR: [
                { status: 'PENDING' },
                {
                  status: 'FAILED',
                  OR: [
                    { nextAttemptAt: null },
                    { nextAttemptAt: { lte: now } },
                  ],
                },
                {
                  status: 'PROCESSING',
                  OR: [
                    { leaseExpiresAt: { lte: now } },
                    { leaseExpiresAt: null, claimedAt: { lte: staleBefore } },
                  ],
                },
              ],
            },
          ],
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          claimedAt: now,
          claimedBy: workerId,
          leaseExpiresAt,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
      if (claimed.count !== 1) return null
      const event = await prisma.domainOutboxEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          workspaceId: true,
          topic: true,
          aggregateType: true,
          aggregateId: true,
          payload: true,
          attempts: true,
          claimedBy: true,
        },
      })
      return event?.claimedBy ? { ...event, claimedBy: event.claimedBy } : null
    },
    async findInstallation({ workspaceId, definitionKey }) {
      const { prisma } = await import('@/lib/db')
      return prisma.simpleAutomationInstallation.findFirst({
        where: {
          workspaceId,
          definitionKey,
          removedAt: null,
          automation: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          workspaceId: true,
          definitionKey: true,
          definitionVersion: true,
          config: true,
          automation: { select: { id: true, flow: true } },
        },
      })
    },
    async findLeadFollowUpState({ workspaceId, leadId }) {
      const { prisma } = await import('@/lib/db')
      return prisma.lead.findFirst({
        where: { id: leadId, workspaceId },
        select: {
          stage: true,
          followUpAt: true,
          convertedCustomerId: true,
          archivedAt: true,
        },
      })
    },
    async findJobCompletionState({ workspaceId, jobId }) {
      const { prisma } = await import('@/lib/db')
      return prisma.job.findFirst({
        where: { id: jobId, workspaceId },
        select: { status: true, completedAt: true, archivedAt: true },
      })
    },
    getReadiness: getSimpleAutomationReadiness,
    dispatch: dispatchSimpleAutomationEvent,
    async processWebhook({ workspaceId, integrationId, payload }) {
      const { processWebhookPayload } = await import(
        '@/lib/integrations/webhookProcessor'
      )
      return processWebhookPayload('hubspot', payload, {
        workspaceId,
        expectedIntegrationId: integrationId,
        failOnAutomationError: true,
      })
    },
    async findDispatch({ installationId, eventKey }) {
      const { prisma } = await import('@/lib/db')
      return prisma.simpleAutomationDispatch.findUnique({
        where: { installationId_eventKey: { installationId, eventKey } },
        select: { id: true, status: true, runId: true },
      })
    },
    async complete(input) {
      const { prisma } = await import('@/lib/db')
      const completed = await prisma.domainOutboxEvent.updateMany({
        where: {
          id: input.eventId,
          status: 'PROCESSING',
          claimedBy: input.workerId,
        },
        data: {
          status: 'PROCESSED',
          processedAt: input.now,
          processingOutcome: input.outcome,
          dispatchId: input.dispatchId ?? null,
          automationRunId: input.runId ?? null,
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
      if (completed.count !== 1) {
        throw new Error('Native event processing lease was lost.')
      }
    },
    async fail({ event, now, error }) {
      const { prisma } = await import('@/lib/db')
      const dead = event.attempts >= MAX_EVENT_ATTEMPTS
      const retryDelayMs = Math.min(
        30_000 * 2 ** (event.attempts - 1),
        15 * 60_000,
      )
      await prisma.domainOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: 'PROCESSING',
          claimedBy: event.claimedBy,
        },
        data: {
          status: dead ? 'DEAD' : 'FAILED',
          nextAttemptAt: dead ? null : new Date(now.getTime() + retryDelayMs),
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
          processingOutcome: dead ? 'FAILED_PERMANENTLY' : 'RETRY_PENDING',
          lastErrorCode: dead
            ? 'NATIVE_EVENT_DEAD'
            : 'NATIVE_EVENT_PROCESSING_FAILED',
          lastErrorMessage: (error instanceof Error
            ? error.message
            : 'Native domain event processing failed.'
          ).slice(0, 500),
        },
      })
    },
    async listPendingIds({ now, limit }) {
      const { prisma } = await import('@/lib/db')
      const staleBefore = new Date(now.getTime() - EVENT_LEASE_MS)
      const rows = await prisma.domainOutboxEvent.findMany({
        where: {
          availableAt: { lte: now },
          AND: [
            { OR: [...SUPPORTED_DOMAIN_EVENT_IDENTITIES] },
            {
              OR: [
                { status: 'PENDING' },
                {
                  status: 'FAILED',
                  OR: [
                    { nextAttemptAt: null },
                    { nextAttemptAt: { lte: now } },
                  ],
                },
                {
                  status: 'PROCESSING',
                  OR: [
                    { leaseExpiresAt: { lte: now } },
                    { leaseExpiresAt: null, claimedAt: { lte: staleBefore } },
                  ],
                },
              ],
            },
          ],
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        select: { id: true },
      })
      return rows.map((row) => row.id)
    },
  }

export type DomainEventProcessingResult =
  | { status: 'not-claimed' }
  | { status: 'dispatched'; runId: string }
  | { status: 'processed'; triggered: number }
  | { status: 'no-op'; reason: string }
  | { status: 'failed'; error: string }

export async function processDomainEvent(
  eventId: string,
  dependencies: DomainEventProcessorDependencies = defaultDomainEventProcessorDependencies,
  options: { now?: Date; workerId?: string } = {},
): Promise<DomainEventProcessingResult> {
  const now = options.now ?? new Date()
  const event = await dependencies.claim({
    eventId,
    workerId: options.workerId ?? `native-event-${randomUUID()}`,
    now,
  })
  if (!event) return { status: 'not-claimed' }

  try {
    if (event.workspaceId.length === 0) {
      throw new Error('Native event identity or payload is invalid.')
    }

    if (
      event.topic === HUBSPOT_WEBHOOK_TOPIC &&
      event.aggregateType === HUBSPOT_WEBHOOK_AGGREGATE_TYPE
    ) {
      const parsed = durableHubSpotWebhookPayloadSchema.safeParse(event.payload)
      if (
        !parsed.success ||
        parsed.data.workspaceId !== event.workspaceId ||
        parsed.data.integrationId !== event.aggregateId
      ) {
        throw new Error('HubSpot webhook event identity or payload is invalid.')
      }
      const result = await dependencies.processWebhook({
        workspaceId: event.workspaceId,
        integrationId: event.aggregateId,
        payload: {
          ...parsed.data.webhook,
          payload: parsed.data.webhook.payload ?? null,
        },
      })
      if (!result.ok) {
        throw new Error(`HubSpot webhook processing failed: ${result.error}`)
      }
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'HUBSPOT_WEBHOOK_PROCESSED',
      })
      return { status: 'processed', triggered: result.triggered }
    }

    let definitionKey:
      | 'new-lead-alert'
      | 'lead-follow-up'
      | 'job-completion-message'
    let triggerPayload: Record<string, unknown>
    if (
      event.topic === NATIVE_LEAD_CREATED_TOPIC &&
      event.aggregateType === NATIVE_LEAD_AGGREGATE_TYPE
    ) {
      const parsed = nativeLeadCreatedPayloadSchema.safeParse(event.payload)
      if (
        !parsed.success ||
        parsed.data.workspaceId !== event.workspaceId ||
        parsed.data.leadId !== event.aggregateId
      ) {
        throw new Error('Native Lead event identity or payload is invalid.')
      }
      definitionKey = 'new-lead-alert'
      triggerPayload = {
        source: 'skillify-native',
        provider: 'Skillify',
        objectType: 'lead',
        event: NATIVE_LEAD_CREATED_TOPIC,
        externalId: parsed.data.leadId,
        occurredAt: parsed.data.occurredAt,
        raw: parsed.data,
        simpleEventKey: nativeLeadEventKey(event.id),
        domainEventId: event.id,
      }
    } else if (
      event.topic === NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC &&
      event.aggregateType === NATIVE_LEAD_AGGREGATE_TYPE
    ) {
      const parsed = nativeLeadFollowUpDuePayloadSchema.safeParse(event.payload)
      if (
        !parsed.success ||
        parsed.data.workspaceId !== event.workspaceId ||
        parsed.data.leadId !== event.aggregateId
      ) {
        throw new Error('Native Lead event identity or payload is invalid.')
      }
      const lead = await dependencies.findLeadFollowUpState({
        workspaceId: event.workspaceId,
        leadId: event.aggregateId,
      })
      const scheduledFor = new Date(parsed.data.scheduledFor)
      const eligible =
        lead !== null &&
        !lead.archivedAt &&
        !lead.convertedCustomerId &&
        lead.stage !== 'WON' &&
        lead.stage !== 'LOST' &&
        lead.followUpAt?.getTime() === scheduledFor.getTime()
      if (!eligible) {
        await dependencies.complete({
          eventId: event.id,
          workerId: event.claimedBy,
          now,
          outcome: 'NO_OP_FOLLOW_UP_STALE_OR_INELIGIBLE',
        })
        return { status: 'no-op', reason: 'follow-up-stale-or-ineligible' }
      }
      definitionKey = 'lead-follow-up'
      triggerPayload = {
        source: 'skillify-native',
        provider: 'Skillify',
        objectType: 'lead',
        event: NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
        externalId: parsed.data.leadId,
        occurredAt: parsed.data.occurredAt,
        scheduledFor: parsed.data.scheduledFor,
        scheduleRevision: parsed.data.scheduleRevision,
        raw: parsed.data,
        simpleEventKey: nativeLeadEventKey(event.id),
        domainEventId: event.id,
      }
    } else if (
      event.topic === NATIVE_JOB_COMPLETED_TOPIC &&
      event.aggregateType === NATIVE_JOB_AGGREGATE_TYPE
    ) {
      const parsed = nativeJobCompletedPayloadSchema.safeParse(event.payload)
      if (
        !parsed.success ||
        parsed.data.workspaceId !== event.workspaceId ||
        parsed.data.jobId !== event.aggregateId
      ) {
        throw new Error('Native Job event identity or payload is invalid.')
      }
      const job = await dependencies.findJobCompletionState({
        workspaceId: event.workspaceId,
        jobId: event.aggregateId,
      })
      const completedAt = new Date(parsed.data.completedAt)
      if (
        !job ||
        job.status !== 'COMPLETED' ||
        job.completedAt?.getTime() !== completedAt.getTime()
      ) {
        await dependencies.complete({
          eventId: event.id,
          workerId: event.claimedBy,
          now,
          outcome: 'NO_OP_JOB_COMPLETION_STALE',
        })
        return { status: 'no-op', reason: 'job-completion-stale' }
      }
      definitionKey = 'job-completion-message'
      triggerPayload = {
        source: 'skillify-native',
        provider: 'Skillify',
        objectType: 'job',
        event: NATIVE_JOB_COMPLETED_TOPIC,
        externalId: parsed.data.jobId,
        occurredAt: parsed.data.occurredAt,
        completedAt: parsed.data.completedAt,
        completionRevision: parsed.data.completionRevision,
        raw: parsed.data,
        simpleEventKey: nativeJobEventKey(event.id),
        domainEventId: event.id,
      }
    } else {
      throw new Error('Native event identity or payload is invalid.')
    }

    const installation = await dependencies.findInstallation({
      workspaceId: event.workspaceId,
      definitionKey,
    })
    if (!installation) {
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'NO_OP_NO_ACTIVE_INSTALLATION',
      })
      return { status: 'no-op', reason: 'no-active-installation' }
    }
    if (
      installation.workspaceId !== event.workspaceId ||
      installation.definitionKey !== definitionKey ||
      !hasExecutableFlow(installation.automation.flow)
    ) {
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'NO_OP_INSTALLATION_NOT_EXECUTABLE',
      })
      return { status: 'no-op', reason: 'installation-not-executable' }
    }

    const readiness = await dependencies.getReadiness({
      workspaceId: event.workspaceId,
      definitionKey: installation.definitionKey,
      definitionVersion: installation.definitionVersion,
      config: installation.config,
    })
    if (
      !readiness.ready ||
      (definitionKey !== 'job-completion-message' &&
        !readiness.nativeLeadEvents)
    ) {
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'NO_OP_NOT_ELIGIBLE',
      })
      return { status: 'no-op', reason: 'not-eligible' }
    }

    const eventKey =
      definitionKey === 'job-completion-message'
        ? nativeJobEventKey(event.id)
        : nativeLeadEventKey(event.id)
    let result
    try {
      result = await dependencies.dispatch({
        installationId: installation.id,
        automationId: installation.automation.id,
        workspaceId: event.workspaceId,
        eventKey,
        triggerPayload,
      })
    } catch (error) {
      const cancelled = await dependencies.findDispatch({
        installationId: installation.id,
        eventKey,
      })
      if (cancelled?.status === 'CANCELLED') {
        await dependencies.complete({
          eventId: event.id,
          workerId: event.claimedBy,
          now,
          outcome: 'NO_OP_LIFECYCLE_CHANGED',
          dispatchId: cancelled.id,
        })
        return { status: 'no-op', reason: 'lifecycle-changed' }
      }
      throw error
    }

    let dispatch = await dependencies.findDispatch({
      installationId: installation.id,
      eventKey,
    })
    if (result.dispatched) {
      dispatch ??= {
        id: '',
        status: 'SUCCEEDED',
        runId: result.runId,
      }
    }
    if (dispatch?.status === 'SUCCEEDED' && dispatch.runId) {
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'DISPATCHED',
        dispatchId: dispatch.id || null,
        runId: dispatch.runId,
      })
      return { status: 'dispatched', runId: dispatch.runId }
    }
    if (dispatch?.status === 'CANCELLED') {
      await dependencies.complete({
        eventId: event.id,
        workerId: event.claimedBy,
        now,
        outcome: 'NO_OP_LIFECYCLE_CHANGED',
        dispatchId: dispatch.id,
      })
      return { status: 'no-op', reason: 'lifecycle-changed' }
    }
    throw new Error(
      'Native event dispatch did not reach a durable terminal state.',
    )
  } catch (error) {
    await dependencies.fail({ event, now, error })
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Processing failed.',
    }
  }
}

export async function processPendingDomainEvents(
  input: { limit?: number; now?: Date; workerId?: string } = {},
  dependencies: DomainEventProcessorDependencies = defaultDomainEventProcessorDependencies,
) {
  const now = input.now ?? new Date()
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const workerId = input.workerId ?? `native-event-batch-${randomUUID()}`
  const ids = await dependencies.listPendingIds({ now, limit })
  const results = []
  for (const eventId of ids) {
    results.push(
      await processDomainEvent(eventId, dependencies, { now, workerId }),
    )
  }
  return {
    considered: ids.length,
    dispatched: results.filter((result) => result.status === 'dispatched')
      .length + results.filter((result) => result.status === 'processed').length,
    noOp: results.filter((result) => result.status === 'no-op').length,
    failed: results.filter((result) => result.status === 'failed').length,
  }
}
