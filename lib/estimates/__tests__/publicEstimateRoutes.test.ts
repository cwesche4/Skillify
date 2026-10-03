import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  getPublic: vi.fn(),
}))

vi.mock('@/lib/estimates/customerExperience', () => ({
  decidePublicEstimate: mocks.decide,
  getPublicEstimate: mocks.getPublic,
}))

import { POST } from '@/app/api/public/estimates/[publicId]/decision/route'
import {
  clearEstimatePublicRateBucketsForTests,
  createEstimateShareSession,
  ESTIMATE_SHARE_SESSION_COOKIE,
} from '@/lib/estimates/customerExperienceSecurity'

const publicId = 'p'.repeat(43)

function request({
  origin = 'https://app.example.test',
  sessionPublicId = publicId,
  csrfToken,
}: {
  origin?: string
  sessionPublicId?: string
  csrfToken?: string
} = {}) {
  const session = createEstimateShareSession({ publicId: sessionPublicId })
  return {
    session,
    request: new NextRequest(
      `https://app.example.test/api/public/estimates/${publicId}/decision`,
      {
        method: 'POST',
        headers: {
          origin,
          host: 'app.example.test',
          cookie: `${ESTIMATE_SHARE_SESSION_COOKIE}=${session.value}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'ACCEPTED',
          acknowledgmentName: 'Customer Name',
          csrfToken: csrfToken ?? session.payload.csrfToken,
        }),
      },
    ),
  }
}

describe('public Estimate decision route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv(
      'ESTIMATE_SHARE_SIGNING_KEY',
      Buffer.alloc(32, 9).toString('base64'),
    )
    clearEstimatePublicRateBucketsForTests()
    mocks.decide.mockResolvedValue({ replayed: false })
    mocks.getPublic.mockResolvedValue({ state: 'ACCEPTED' })
  })

  it('requires same-origin requests', async () => {
    const input = request({ origin: 'https://attacker.example.test' })
    const response = await POST(input.request, { params: { publicId } })
    expect(response.status).toBe(403)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('binds the secure session to the exact public share', async () => {
    const input = request({ sessionPublicId: 'q'.repeat(43) })
    const response = await POST(input.request, { params: { publicId } })
    expect(response.status).toBe(404)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('rejects an invalid CSRF token', async () => {
    const input = request({ csrfToken: 'wrong-csrf-token-value' })
    const response = await POST(input.request, { params: { publicId } })
    expect(response.status).toBe(403)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('records an authorized exact-share decision and returns hardened headers', async () => {
    const input = request()
    const response = await POST(input.request, { params: { publicId } })
    expect(response.status).toBe(200)
    expect(mocks.decide).toHaveBeenCalledWith({
      publicId,
      rawInput: expect.objectContaining({ decision: 'ACCEPTED' }),
    })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    )
  })
})
