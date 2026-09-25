import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  processPending: vi.fn(),
}))

vi.mock('@/lib/auth/serviceToken', () => ({
  authenticateServiceToken: mocks.authenticate,
}))
vi.mock('@/lib/domain-events/processor', () => ({
  processPendingDomainEvents: mocks.processPending,
}))

import { GET, POST } from '@/app/api/internal/domain-events/process/route'

describe('native domain event processor route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts only the configured Vercel cron bearer token for GET', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.processPending.mockResolvedValue({
      considered: 0,
      dispatched: 0,
      noOp: 0,
      failed: 0,
    })

    const rejected = await GET(
      new NextRequest('http://localhost/api/internal/domain-events/process'),
    )
    const accepted = await GET(
      new NextRequest('http://localhost/api/internal/domain-events/process', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )

    expect(rejected.status).toBe(401)
    expect(accepted.status).toBe(200)
    expect(mocks.authenticate).not.toHaveBeenCalled()
    expect(mocks.processPending).toHaveBeenCalledWith({
      limit: 25,
      workerId: expect.stringMatching(/^cron:domain-events:/),
    })
    vi.unstubAllEnvs()
  })

  it('fails closed without the scoped internal service authorization', async () => {
    mocks.authenticate.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await POST(
      new NextRequest('http://localhost/api/internal/domain-events/process', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
    expect(mocks.authenticate).toHaveBeenCalledWith(
      expect.anything(),
      'DOMAIN_EVENT_PROCESSOR',
    )
    expect(mocks.processPending).not.toHaveBeenCalled()
  })

  it('bounds an authorized recovery batch', async () => {
    mocks.authenticate.mockResolvedValue({
      ok: true,
      system: 'scheduler',
      scopes: ['DOMAIN_EVENT_PROCESSOR'],
    })
    mocks.processPending.mockResolvedValue({
      considered: 0,
      dispatched: 0,
      noOp: 0,
      failed: 0,
    })

    const response = await POST(
      new NextRequest('http://localhost/api/internal/domain-events/process', {
        method: 'POST',
        body: JSON.stringify({ batchSize: 1000 }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.processPending).toHaveBeenCalledWith({
      limit: 100,
      workerId: expect.stringMatching(/^service:scheduler:/),
    })
  })
})
