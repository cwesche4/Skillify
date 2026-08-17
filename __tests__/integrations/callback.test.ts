import { describe, it, expect, beforeEach, vi } from 'vitest'

import { GET as callbackHandler } from '@/app/api/integrations/[provider]/callback/route'

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: 'user_1' }),
}))

const integrationMock: any = {
  id: 'int_1',
  workspaceId: 'ws_1',
  provider: 'hubspot',
  metadata: { state: 'abc' },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    integration: {
      findFirst: vi.fn(async () => integrationMock),
      update: vi.fn(async () => ({})),
    },
    integrationCredential: {
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
  },
}))

vi.mock('@/lib/integrations/register-default', () => ({
  ensureIntegrationAdapters: vi.fn(),
}))
vi.mock('@/lib/integrations/registry', () => ({
  getIntegrationAdapter: vi.fn(() => ({})),
}))
vi.mock('@/lib/integrations/env', () => ({
  ensureIntegrationEnv: vi.fn(),
}))
vi.mock('@/lib/integrations/hubspot/auth', () => ({
  exchangeHubSpotCode: vi.fn(async () => ({
    accessToken: 'enc_access',
    refreshToken: 'enc_refresh',
    expiresAt: new Date(),
    hubId: 'hub1',
  })),
}))
vi.mock('@/lib/integrations/crypto', () => ({
  encryptToken: (v: string) => v,
}))
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(),
}))

describe('HubSpot callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts valid state and connects', async () => {
    const req = new Request(
      'https://app/callback?provider=hubspot&workspaceId=ws_1&code=xyz&state=' +
        encodeURIComponent(
          JSON.stringify({ workspaceId: 'ws_1', state: 'abc' }),
        ),
    )
    const res = await callbackHandler(
      req as any,
      { params: { provider: 'hubspot' } } as any,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('connected')
  })

  it('rejects invalid state', async () => {
    const req = new Request(
      'https://app/callback?provider=hubspot&workspaceId=ws_1&code=xyz&state=' +
        encodeURIComponent(
          JSON.stringify({ workspaceId: 'ws_1', state: 'wrong' }),
        ),
    )
    const res = await callbackHandler(
      req as any,
      { params: { provider: 'hubspot' } } as any,
    )
    expect(res.status).toBe(400)
  })
})
