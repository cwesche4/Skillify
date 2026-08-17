import { describe, it, expect, beforeEach, vi } from 'vitest'

import { processWebhookPayload } from '@/lib/integrations/webhookProcessor'

const prismaMocks = vi.hoisted(() => ({
  integration: {
    findFirst: vi.fn(),
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
}))

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

describe('processWebhookPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.integration.findFirst.mockResolvedValue({
      id: 'int1',
      workspaceId: 'ws1',
      provider: 'hubspot',
      status: 'connected',
      metadata: {},
    })
    prismaMocks.automation.findMany.mockResolvedValue([
      { id: 'auto1', flow: { nodes: [{ type: 'crm-trigger', data: {} }] } },
    ])
    prismaMocks.auditLog.findFirst.mockResolvedValue(null)
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
      {},
    )
    expect(res.ok).toBe(true)
    expect(res.triggered).toBe(1)
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
      {},
    )
    expect(res.ok).toBe(true)
    expect(res.triggered).toBe(0)
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
      {},
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
      {},
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })
})
