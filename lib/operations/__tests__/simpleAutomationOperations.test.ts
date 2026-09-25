import { DomainOutboxStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  domainOutboxEvent: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  automationRun: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  automation: { findMany: vi.fn() },
  integration: { findFirst: vi.fn() },
  lead: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}))

const schedulingDiagnostics = vi.hoisted(() => vi.fn())
const getWorkspacePlanMock = vi.hoisted(() => vi.fn(async () => 'Elite'))

vi.mock('@/lib/db', () => ({ prisma: prismaMocks }))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: getWorkspacePlanMock,
}))
vi.mock('@/lib/scheduling/notifications/notificationService', () => ({
  getSchedulingNotificationWorkerDiagnostics: schedulingDiagnostics,
}))

import {
  getSimpleAutomationOperationsHealth,
  recoverTerminalDomainEvent,
} from '@/lib/operations/simpleAutomationOperations'

const NOW = new Date('2026-09-24T16:00:00.000Z')

function deadEvent(status: DomainOutboxStatus = DomainOutboxStatus.DEAD) {
  return {
    id: 'event-a',
    workspaceId: 'workspace-a',
    topic: 'lead.created',
    aggregateType: 'Lead',
    aggregateId: 'lead-a',
    payload: {
      source: 'skillify-native',
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      displayName: 'Taylor Smith',
      companyName: null,
      email: null,
      phone: null,
      leadSource: null,
      assignedMemberId: null,
      occurredAt: NOW.toISOString(),
    },
    status,
    attempts: 5,
    lastErrorCode: 'NATIVE_EVENT_DEAD',
    processingOutcome: 'FAILED_PERMANENTLY',
  }
}

describe('Simple Automation operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.automationRun.count.mockResolvedValue(2)
    prismaMocks.automationRun.groupBy.mockResolvedValue([
      { automationId: 'automation-a', _count: { _all: 2 } },
    ])
    prismaMocks.automation.findMany.mockResolvedValue([
      {
        id: 'automation-a',
        name: 'Lead Follow-Up',
        simpleAutomationInstallation: { definitionKey: 'lead-follow-up' },
      },
    ])
    schedulingDiagnostics.mockResolvedValue({
      outboxPending: 3,
      outboxProcessing: 1,
      outboxRetryableFailed: 2,
      outboxDead: 4,
      oldestEligiblePendingAgeMs: 15_000,
      reminderPending: 5,
      reminderProcessing: 1,
      reminderRetryableFailed: 2,
      reminderPermanentlyFailed: 3,
      reminderOverdue: 4,
      oldestOverdueAgeMs: 30_000,
      lastSuccessfulExecution: '2026-09-24T15:59:00.000Z',
    })
    prismaMocks.lead.findFirst.mockResolvedValue({ id: 'lead-a' })
    getWorkspacePlanMock.mockResolvedValue('Elite')
  })

  it('separates retryable and terminal backlog without exposing payloads', async () => {
    prismaMocks.domainOutboxEvent.count.mockImplementation(async ({ where }) => {
      if (where.status === DomainOutboxStatus.PENDING) return 7
      if (where.status === DomainOutboxStatus.PROCESSING) return 1
      if (where.status === DomainOutboxStatus.FAILED) return 2
      if (where.status === DomainOutboxStatus.DEAD) return 3
      return 0
    })
    prismaMocks.domainOutboxEvent.findFirst
      .mockResolvedValueOnce({
        createdAt: new Date('2026-09-24T15:59:40.000Z'),
      })
      .mockResolvedValueOnce({
        processedAt: new Date('2026-09-24T15:59:50.000Z'),
      })
      .mockResolvedValueOnce({
        processedAt: new Date('2026-09-24T15:58:00.000Z'),
      })

    const health = await getSimpleAutomationOperationsHealth({ now: NOW })

    expect(health.nativeDomainOutbox).toEqual({
      pending: 7,
      processing: 1,
      retryableFailed: 2,
      dead: 3,
      oldestEligiblePendingAgeMs: 20_000,
    })
    expect(health.schedulingOutbox.dead).toBe(4)
    expect(health.reminders).toMatchObject({
      retryableFailed: 2,
      permanentlyFailed: 3,
      overdue: 4,
      oldestOverdueAgeMs: 30_000,
    })
    expect(health.simpleAutomations.failedRunsByRecipe).toEqual([
      expect.objectContaining({ definitionKey: 'lead-follow-up', failedRuns: 2 }),
    ])
    expect(JSON.stringify(health)).not.toMatch(/payload|customer|secret/i)
  })

  it('recovers one DEAD event transactionally and records an audit event', async () => {
    prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue(deadEvent())
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const auditCreate = vi.fn(async () => ({ id: 'audit-a' }))
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback({
        domainOutboxEvent: { updateMany },
        auditEvent: { create: auditCreate },
      }),
    )

    await expect(
      recoverTerminalDomainEvent({
        eventId: 'event-a',
        workspaceId: 'workspace-a',
        operatorSystem: 'operations',
        now: NOW,
      }),
    ).resolves.toEqual({
      ok: true,
      eventId: 'event-a',
      workspaceId: 'workspace-a',
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-a',
          status: DomainOutboxStatus.DEAD,
        }),
        data: expect.objectContaining({
          status: DomainOutboxStatus.PENDING,
          attempts: 0,
          processingOutcome: 'OPERATOR_RETRY_REQUESTED',
        }),
      }),
    )
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DOMAIN_EVENT_RECOVERY_REQUESTED',
          objectId: 'event-a',
        }),
      }),
    )
  })

  it('cannot recover successful work or repeat a lost terminal-state race', async () => {
    prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue(
      deadEvent(DomainOutboxStatus.PROCESSED),
    )
    await expect(
      recoverTerminalDomainEvent({
        eventId: 'event-a',
        workspaceId: 'workspace-a',
        operatorSystem: 'operations',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'NOT_TERMINAL' })
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()

    prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue(deadEvent())
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback({
        domainOutboxEvent: {
          updateMany: vi.fn(async () => ({ count: 0 })),
        },
        auditEvent: { create: vi.fn() },
      }),
    )
    await expect(
      recoverTerminalDomainEvent({
        eventId: 'event-a',
        workspaceId: 'workspace-a',
        operatorSystem: 'operations',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'NOT_TERMINAL' })
  })

  it('revalidates HubSpot workspace, connection, and Elite eligibility', async () => {
    prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue({
      ...deadEvent(),
      topic: 'integration.hubspot.webhook',
      aggregateType: 'HubSpotIntegration',
      aggregateId: 'integration-a',
      payload: {
        workspaceId: 'workspace-a',
        integrationId: 'integration-a',
        webhook: {
          provider: 'hubspot',
          objectType: 'contact',
          externalId: 'contact-a',
          event: 'contact.created',
          payload: {},
        },
      },
    })
    prismaMocks.integration.findFirst.mockResolvedValue({ id: 'integration-a' })
    getWorkspacePlanMock.mockResolvedValue('Basic')

    await expect(
      recoverTerminalDomainEvent({
        eventId: 'event-a',
        workspaceId: 'workspace-a',
        operatorSystem: 'operations',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INELIGIBLE' })
    expect(prismaMocks.integration.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'integration-a',
        workspaceId: 'workspace-a',
        provider: 'hubspot',
        status: 'connected',
      },
      select: { id: true },
    })
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()
  })
})
