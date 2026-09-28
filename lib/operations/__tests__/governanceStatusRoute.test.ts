import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    aiActionAudit: {
      findFirst: mocks.findFirst,
    },
  },
}))

import { dynamic, GET } from '@/app/api/internal/governance/status/route'

function request(token?: string) {
  return new NextRequest(
    'https://skillify.test/api/internal/governance/status',
    {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    },
  )
}

describe('governance status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTOMATION_SERVICE_TOKEN', 'governance-secret')
    vi.stubEnv('AUTOMATION_SERVICE_SCOPES', 'AUTOMATION_OPERATIONS')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('fails closed before querying governance data without authorization', async () => {
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects an authenticated service token without the operations scope', async () => {
    vi.stubEnv('AUTOMATION_SERVICE_SCOPES', 'DOMAIN_EVENT_PROCESSOR')

    const response = await GET(request('governance-secret'))

    expect(response.status).toBe(403)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('returns status timestamps to the authorized operations service', async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ createdAt: new Date('2026-09-27T12:00:00Z') })
      .mockResolvedValueOnce({ createdAt: new Date('2026-09-27T11:00:00Z') })
      .mockResolvedValueOnce(null)

    const response = await GET(request('governance-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lastAuditAt: '2026-09-27T12:00:00.000Z',
      lastRateLimitAt: '2026-09-27T11:00:00.000Z',
      lastAlertAt: null,
    })
    expect(mocks.findFirst).toHaveBeenCalledTimes(3)
    expect(dynamic).toBe('force-dynamic')
  })
})
