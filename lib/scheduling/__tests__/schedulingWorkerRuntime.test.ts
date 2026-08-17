import { describe, expect, it, vi } from 'vitest'

import {
  isSchedulingWorkerAuthorized,
  parseSchedulingWorkerRequest,
} from '@/app/api/internal/scheduling/_lib/workerRuntime'

function workerRequest({
  authorization,
  body,
  url = 'https://skillify.test/api/internal/scheduling/notifications',
}: {
  authorization?: string
  body?: unknown
  url?: string
}) {
  return {
    headers: new Headers(authorization ? { authorization } : undefined),
    nextUrl: new URL(url),
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as never
}

describe('scheduling worker runtime', () => {
  it('requires the configured worker bearer token', () => {
    vi.stubEnv('SCHEDULING_WORKER_SECRET', 'worker-secret')

    expect(
      isSchedulingWorkerAuthorized(
        workerRequest({ authorization: 'Bearer worker-secret' }),
      ),
    ).toBe(true)
    expect(
      isSchedulingWorkerAuthorized(
        workerRequest({ authorization: 'Bearer wrong-secret' }),
      ),
    ).toBe(false)
    expect(isSchedulingWorkerAuthorized(workerRequest({}))).toBe(false)

    vi.unstubAllEnvs()
  })

  it('parses dry-run worker controls from the request body', async () => {
    const request = workerRequest({
      body: {
        batchSize: 12,
        cursor: 'outbox-12',
        dryRun: true,
        nowUtc: '2026-07-28T13:45:00.000Z',
      },
    })

    await expect(parseSchedulingWorkerRequest(request)).resolves.toMatchObject({
      batchSize: 12,
      cursor: 'outbox-12',
      dryRun: true,
      nowUtc: new Date('2026-07-28T13:45:00.000Z'),
    })
  })

  it('clamps batch size and falls back to query-string controls', async () => {
    const request = workerRequest({
      url: 'https://skillify.test/api/internal/scheduling/notifications?batchSize=500&cursor=delivery-9&dryRun=true&nowUtc=2026-07-29T09%3A00%3A00.000Z',
    })

    await expect(parseSchedulingWorkerRequest(request)).resolves.toMatchObject({
      batchSize: 100,
      cursor: 'delivery-9',
      dryRun: true,
      nowUtc: new Date('2026-07-29T09:00:00.000Z'),
    })
  })
})
