import { describe, it, expect, beforeEach, vi } from 'vitest'
import { executeNode } from '@/lib/automations/executor'

const prismaMocks = vi.hoisted(() => ({
  integration: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  integrationCredential: {
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: prismaMocks,
}))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: vi.fn(async () => 'Elite'),
}))
vi.mock('@/lib/integrations/register-default', () => ({
  ensureIntegrationAdapters: vi.fn(),
}))
const executeActionMock = vi.fn(async () => ({ ok: true, data: { id: 'hs1' } }))
vi.mock('@/lib/integrations/registry', () => ({
  getIntegrationAdapter: vi.fn(() => ({
    executeAction: executeActionMock,
  })),
}))
vi.mock('@/lib/integrations/circuit', () => ({
  resetBreakerIfNeeded: vi.fn(async () => ({ breakerOpen: false })),
  isBreakerOpen: vi.fn(async () => false),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/integrations/crypto', () => ({
  decryptToken: (v: string) => v,
}))
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => ({})),
}))
vi.mock('@/lib/integrations/externalRecords', () => ({
  upsertExternalRecord: vi.fn(),
}))

describe('CRM action node', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.integration.findUnique.mockResolvedValue({
      id: 'int1',
      metadata: {},
      credentials: [
        {
          accessToken: 't',
          refreshToken: null,
        },
      ],
    })
    prismaMocks.integration.update.mockResolvedValue({})
    executeActionMock.mockResolvedValue({ ok: true, data: { id: 'hs1' } })
  })

  const ctx = {
    workspaceId: 'ws1',
    automationId: 'auto1',
    depth: 0,
  }

  it('logs success', async () => {
    const res = await executeNode(
      'crm-action',
      { provider: 'hubspot', action: 'contact.create', integrationId: 'int1' },
      ctx,
    )
    expect(res.output).toEqual({ id: 'hs1' })
  })

  it('increments failures on error', async () => {
    executeActionMock.mockResolvedValueOnce({ ok: false, error: 'fail' })
    const res = await executeNode(
      'crm-action',
      { provider: 'hubspot', action: 'contact.create', integrationId: 'int1' },
      ctx,
    )
    expect(res.output).toHaveProperty('error')
  })
})
