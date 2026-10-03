import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ processQueue: vi.fn() }))

vi.mock('@/lib/estimates/deliveryWorker', () => ({
  processEstimateDeliveryQueue: mocks.processQueue,
}))

import { POST } from '@/app/api/internal/estimates/deliveries/process/route'

describe('Estimate delivery worker route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('fails closed when CRON_SECRET is absent', async () => {
    const response = await POST(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process',
        {
          method: 'POST',
          body: '{}',
        },
      ),
    )
    expect(response.status).toBe(401)
    expect(mocks.processQueue).not.toHaveBeenCalled()
  })

  it('runs only with the exact cron bearer secret', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.processQueue.mockResolvedValue({
      claimed: 0,
      sent: 0,
      failed: 0,
      canceled: 0,
    })
    const rejected = await POST(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process',
        {
          method: 'POST',
          headers: { authorization: 'Bearer wrong-secret' },
          body: '{}',
        },
      ),
    )
    const accepted = await POST(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process',
        {
          method: 'POST',
          headers: { authorization: 'Bearer cron-secret' },
          body: JSON.stringify({ batchSize: 25 }),
        },
      ),
    )
    expect(rejected.status).toBe(401)
    expect(accepted.status).toBe(200)
    expect(mocks.processQueue).toHaveBeenCalledTimes(1)
    expect(mocks.processQueue).toHaveBeenCalledWith({ batchSize: 25 })
  })
})
