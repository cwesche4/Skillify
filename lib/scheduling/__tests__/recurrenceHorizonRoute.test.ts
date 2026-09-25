import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const extendHorizon = vi.hoisted(() => vi.fn())

vi.mock('@/lib/scheduling/repository', () => ({
  extendSchedulingRecurrenceHorizon: extendHorizon,
}))

import {
  GET,
  POST,
} from '@/app/api/internal/scheduling/recurrence-horizon/route'

describe('recurrence horizon worker route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    extendHorizon.mockResolvedValue({
      considered: 1,
      extended: 1,
      hasMore: false,
      targetThroughUtc: '2026-12-23T00:00:00.000Z',
    })
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('SCHEDULING_WORKER_SECRET', 'worker-secret')
  })

  it('rejects unauthenticated scheduler requests', async () => {
    const response = await GET(
      new NextRequest(
        'https://skillify.test/api/internal/scheduling/recurrence-horizon',
      ),
    )
    expect(response.status).toBe(401)
    expect(extendHorizon).not.toHaveBeenCalled()
  })

  it('accepts Vercel cron and bounds the batch', async () => {
    const response = await GET(
      new NextRequest(
        'https://skillify.test/api/internal/scheduling/recurrence-horizon?batchSize=500&nowUtc=2026-09-24T00:00:00.000Z',
        { headers: { authorization: 'Bearer cron-secret' } },
      ),
    )
    expect(response.status).toBe(200)
    expect(extendHorizon).toHaveBeenCalledWith({
      batchSize: 25,
      nowUtc: new Date('2026-09-24T00:00:00.000Z'),
    })
  })

  it('keeps the existing Scheduling worker POST authorization', async () => {
    const response = await POST(
      new NextRequest(
        'https://skillify.test/api/internal/scheduling/recurrence-horizon',
        {
          method: 'POST',
          headers: { authorization: 'Bearer worker-secret' },
          body: JSON.stringify({ batchSize: 10 }),
        },
      ),
    )
    expect(response.status).toBe(200)
    expect(extendHorizon).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 10 }),
    )
  })
})
