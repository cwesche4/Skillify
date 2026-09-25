import { describe, it, expect, beforeEach, vi } from 'vitest'

import { processWebhookPayload } from '@/lib/integrations/webhookProcessor'

const prismaMocks = vi.hoisted(() => ({
  integration: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  externalRecord: {
    upsert: vi.fn(),
  },
  automation: {
    findMany: vi.fn(),
  },
  domainOutboxEvent: {
    upsert: vi.fn(),
  },
}))
const dispatchSimpleAutomationEventMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: prismaMocks,
}))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: vi.fn(async () => 'Elite'),
}))
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => ({})),
}))
vi.mock('@/lib/integrations/normalize', () => ({
  matchTriggerNode: vi.fn(() => true),
}))
vi.mock('@/lib/integrations/circuit', () => ({
  resetBreakerIfNeeded: vi.fn(async () => ({ breakerOpen: false })),
}))
vi.mock('@/lib/automations/executor', () => ({
  runAutomation: vi.fn(async () => ({})),
}))
vi.mock('@/lib/automations/simpleAutomationDispatch', () => ({
  dispatchSimpleAutomationEvent: dispatchSimpleAutomationEventMock,
}))

describe('processWebhookPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.integration.findMany.mockResolvedValue([
      {
        id: 'int1',
        workspaceId: 'ws1',
        provider: 'hubspot',
        status: 'connected',
        metadata: {},
      },
    ])
    prismaMocks.automation.findMany.mockResolvedValue([
      { id: 'auto1', flow: { nodes: [{ type: 'crm-trigger', data: {} }] } },
    ])
    prismaMocks.auditLog.findFirst.mockResolvedValue(null)
    dispatchSimpleAutomationEventMock.mockResolvedValue({
      dispatched: true,
      duplicate: false,
      runId: 'run-1',
    })
    prismaMocks.domainOutboxEvent.upsert.mockResolvedValue({ id: 'event-1' })
  })

  it('durably accepts HubSpot work before automation dispatch', async () => {
    const payload = {
      provider: 'hubspot' as const,
      objectType: 'contact' as const,
      externalId: '501',
      event: 'contact.created' as const,
      eventId: '101',
      occurredAt: 1_700_000_000_000,
      portalId: 12,
      payload: { eventId: 101, objectId: 501 },
    }

    const first = await processWebhookPayload('hubspot', payload, {
      workspaceId: 'ws1',
      durableAcceptance: true,
    })
    const second = await processWebhookPayload('hubspot', payload, {
      workspaceId: 'ws1',
      durableAcceptance: true,
    })

    expect(first).toEqual({ ok: true, triggered: 0, accepted: 1 })
    expect(second).toEqual({ ok: true, triggered: 0, accepted: 1 })
    expect(prismaMocks.domainOutboxEvent.upsert).toHaveBeenCalledTimes(2)
    const firstKey = prismaMocks.domainOutboxEvent.upsert.mock.calls[0][0]
      .where.deduplicationKey
    const secondKey = prismaMocks.domainOutboxEvent.upsert.mock.calls[1][0]
      .where.deduplicationKey
    expect(firstKey).toBe(secondKey)
    expect(prismaMocks.domainOutboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workspaceId: 'ws1',
          topic: 'integration.hubspot.webhook',
          aggregateId: 'int1',
        }),
      }),
    )
    expect(prismaMocks.automation.findMany).not.toHaveBeenCalled()
    expect(dispatchSimpleAutomationEventMock).not.toHaveBeenCalled()
  })

  it('fires automation for valid webhook', async () => {
    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: '1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )
    expect(res.ok).toBe(true)
    expect(res.triggered).toBe(1)
    const executor = await import('@/lib/automations/executor')
    expect(executor.runAutomation).toHaveBeenCalledWith(
      'auto1',
      expect.objectContaining({ expectedWorkspaceId: 'ws1' }),
    )
  })

  it('rejects conflicting workspace context before dispatch', async () => {
    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: '1',
        event: 'contact.created',
        payload: {},
        workspaceId: 'ws2',
      },
      { workspaceId: 'ws1' },
    )

    expect(res).toEqual({
      ok: false,
      status: 400,
      error: 'Workspace context mismatch',
    })
    expect(prismaMocks.automation.findMany).not.toHaveBeenCalled()
  })

  it('does not guess when a webhook matches multiple workspaces', async () => {
    prismaMocks.integration.findMany.mockResolvedValueOnce([
      { id: 'int1', workspaceId: 'ws1', metadata: {} },
      { id: 'int2', workspaceId: 'ws2', metadata: {} },
    ])

    const res = await processWebhookPayload('hubspot', {
      provider: 'hubspot',
      objectType: 'contact',
      externalId: '1',
      event: 'contact.created',
      payload: {},
      portalId: 'shared-portal',
    })

    expect(res).toEqual({
      ok: false,
      status: 409,
      error: 'Ambiguous integration workspace context',
    })
    expect(prismaMocks.automation.findMany).not.toHaveBeenCalled()
  })

  it('dedupes duplicate webhook', async () => {
    prismaMocks.auditLog.findFirst.mockResolvedValueOnce({ id: 'existing' })
    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: '1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )
    expect(res.ok).toBe(true)
    expect(res.triggered).toBe(0)
  })

  it('routes a managed New Lead Alert through the durable dispatch ledger', async () => {
    prismaMocks.automation.findMany.mockResolvedValueOnce([
      {
        id: 'auto1',
        flow: {
          nodes: [
            {
              type: 'simple-new-lead-trigger',
              data: {
                sources: [
                  {
                    kind: 'crm',
                    provider: 'hubspot',
                    objectType: 'contact',
                    event: 'contact.created',
                  },
                  { kind: 'native', event: 'lead.created' },
                ],
              },
            },
          ],
        },
        simpleAutomationInstallation: {
          id: 'installation-1',
          definitionKey: 'new-lead-alert',
          removedAt: null,
        },
      },
    ])

    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: 'lead-1',
        event: 'contact.created',
        occurredAt: 123,
        eventId: 'provider-event-1',
        payload: { firstname: 'Sam' },
      },
      { workspaceId: 'ws1' },
    )

    expect(res).toEqual({ ok: true, triggered: 1 })
    expect(dispatchSimpleAutomationEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: 'installation-1',
        automationId: 'auto1',
        workspaceId: 'ws1',
        eventKey:
          'hubspot:contact:lead-1:contact.created:provider-event-1:123',
      }),
    )
    const executor = await import('@/lib/automations/executor')
    expect(executor.runAutomation).not.toHaveBeenCalled()
  })

  it('does not count a duplicate managed event as another execution', async () => {
    prismaMocks.automation.findMany.mockResolvedValueOnce([
      {
        id: 'auto1',
        flow: { nodes: [{ type: 'crm-trigger', data: {} }] },
        simpleAutomationInstallation: {
          id: 'installation-1',
          definitionKey: 'new-lead-alert',
          removedAt: null,
        },
      },
    ])
    dispatchSimpleAutomationEventMock.mockResolvedValueOnce({
      dispatched: false,
      duplicate: true,
    })

    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: 'lead-1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )

    expect(res).toEqual({ ok: true, triggered: 0 })
  })

  it('fails closed for a soft-removed managed installation', async () => {
    prismaMocks.automation.findMany.mockResolvedValueOnce([
      {
        id: 'auto1',
        flow: { nodes: [{ type: 'crm-trigger', data: {} }] },
        simpleAutomationInstallation: {
          id: 'installation-1',
          definitionKey: 'new-lead-alert',
          removedAt: new Date(),
        },
      },
    ])

    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: 'lead-1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )

    expect(res).toEqual({ ok: true, triggered: 0 })
    expect(dispatchSimpleAutomationEventMock).not.toHaveBeenCalled()
    const executor = await import('@/lib/automations/executor')
    expect(executor.runAutomation).not.toHaveBeenCalled()
  })

  it('rejects when circuit open', async () => {
    const reset = await import('@/lib/integrations/circuit')
    ;(reset.resetBreakerIfNeeded as any).mockResolvedValue({
      breakerOpen: true,
    })
    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: '1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(202)
  })

  it('rejects when plan not Elite', async () => {
    const plan = await import('@/lib/subscriptions/getWorkspacePlan')
    ;(plan.getWorkspacePlan as any).mockResolvedValue('Pro')
    const res = await processWebhookPayload(
      'hubspot',
      {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: '1',
        event: 'contact.created',
        payload: {},
      },
      { workspaceId: 'ws1' },
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })
})
