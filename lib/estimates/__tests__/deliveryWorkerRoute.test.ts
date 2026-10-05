import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ processQueue: vi.fn() }))

vi.mock('@/lib/estimates/deliveryWorker', () => ({
  processEstimateDeliveryQueue: mocks.processQueue,
}))

import {
  GET,
  POST,
} from '@/app/api/internal/estimates/deliveries/process/route'

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

  it.each([
    ['missing header', undefined],
    ['wrong scheme', 'Basic cron-secret'],
    ['missing token', 'Bearer '],
    ['wrong casing', 'bearer cron-secret'],
    ['extra whitespace', 'Bearer  cron-secret'],
  ])('rejects %s before claiming work', async (_label, authorization) => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const headers = authorization ? { authorization } : undefined

    const response = await GET(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process',
        { headers },
      ),
    )

    expect(response.status).toBe(401)
    expect(mocks.processQueue).not.toHaveBeenCalled()
  })

  it.each([
    ['0', 1],
    ['-10', 1],
    ['1', 1],
    ['12.9', 12],
    ['50', 50],
    ['51', 50],
    ['999999999', 50],
    ['not-a-number', undefined],
    ['NaN', undefined],
  ])('bounds authenticated GET batchSize=%s to %s', async (input, expected) => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.processQueue.mockResolvedValue({
      claimed: 0,
      sent: 0,
      failed: 0,
      canceled: 0,
    })

    const response = await GET(
      new Request(
        `https://app.example.test/api/internal/estimates/deliveries/process?batchSize=${input}`,
        { headers: { authorization: 'Bearer cron-secret' } },
      ),
    )

    expect(response.status).toBe(200)
    expect(mocks.processQueue).toHaveBeenCalledOnce()
    expect(mocks.processQueue).toHaveBeenCalledWith({ batchSize: expected })
  })

  it.each([
    [0, 1],
    [-5, 1],
    [1, 1],
    [50, 50],
    [51, 50],
    [Number.NaN, 1],
  ])(
    'bounds authenticated POST batchSize=%s to %s',
    async (input, expected) => {
      vi.stubEnv('CRON_SECRET', 'cron-secret')
      mocks.processQueue.mockResolvedValue({
        claimed: 0,
        sent: 0,
        failed: 0,
        canceled: 0,
      })

      const response = await POST(
        new Request(
          'https://app.example.test/api/internal/estimates/deliveries/process',
          {
            method: 'POST',
            headers: {
              authorization: 'Bearer cron-secret',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ batchSize: input }),
          },
        ),
      )

      expect(response.status).toBe(200)
      expect(mocks.processQueue).toHaveBeenCalledOnce()
      expect(mocks.processQueue).toHaveBeenCalledWith({ batchSize: expected })
    },
  )

  it('supports the authenticated bounded GET used by the scheduler', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.processQueue.mockResolvedValue({
      claimed: 1,
      sent: 1,
      failed: 0,
      canceled: 0,
    })

    const rejected = await GET(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process',
      ),
    )
    const accepted = await GET(
      new Request(
        'https://app.example.test/api/internal/estimates/deliveries/process?batchSize=500',
        { headers: { authorization: 'Bearer cron-secret' } },
      ),
    )

    expect(rejected.status).toBe(401)
    expect(accepted.status).toBe(200)
    expect(mocks.processQueue).toHaveBeenCalledTimes(1)
    expect(mocks.processQueue).toHaveBeenCalledWith({ batchSize: 50 })
  })

  it('registers one operational one-minute cron invocation', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { crons: Array<{ path: string; schedule: string }> }
    const registrations = config.crons.filter(
      (cron) => cron.path === '/api/internal/estimates/deliveries/process',
    )

    expect(registrations).toEqual([
      {
        path: '/api/internal/estimates/deliveries/process',
        schedule: '* * * * *',
      },
    ])
  })
})
