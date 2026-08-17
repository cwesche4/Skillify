import { describe, it, expect, vi } from 'vitest'
import { GET as healthHandler } from '@/app/api/integrations/[provider]/health/route'

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: 'user_1' }),
}))

const prismaMocks: any = vi.hoisted(() => ({
  workspaceMember: {
    findFirst: vi.fn(async () => ({ role: 'OWNER' })),
  },
  integration: {
    findFirst: vi.fn(async () => ({
      id: 'int1',
      status: 'connected',
      metadata: {
        lastWebhookAt: '2020-01-01',
        breakerOpen: true,
        failures: [1, 2],
      },
    })),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: prismaMocks,
}))
vi.mock('@/lib/integrations/register-default', () => ({
  ensureIntegrationAdapters: vi.fn(),
}))
vi.mock('@/lib/integrations/registry', () => ({
  getIntegrationAdapter: vi.fn(() => ({})),
}))

describe('Integration health endpoint', () => {
  it('returns metadata and breaker state', async () => {
    const req = new Request('https://app/health?workspaceId=ws1')
    const res = await healthHandler(
      req as any,
      { params: { provider: 'hubspot' } } as any,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.breakerOpen).toBe(true)
    expect(json.failures).toBe(2)
    expect(json.lastWebhookAt).toBe('2020-01-01')
  })
})
