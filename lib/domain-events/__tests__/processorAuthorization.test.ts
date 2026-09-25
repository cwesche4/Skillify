import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { authenticateServiceToken } from '@/lib/auth/serviceToken'

function request(token?: string) {
  return new NextRequest('http://localhost/api/internal/domain-events/process', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
}

describe('native domain event service-token authorization', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['missing token', undefined, 'DOMAIN_EVENT_PROCESSOR', 401],
    ['invalid token', 'wrong', 'DOMAIN_EVENT_PROCESSOR', 401],
    ['wrong scope', 'secret', 'SOME_OTHER_SCOPE', 403],
  ])('rejects %s', async (_label, token, scopes, status) => {
    vi.stubEnv('AUTOMATION_SERVICE_TOKEN', 'secret')
    vi.stubEnv('AUTOMATION_SERVICE_SCOPES', scopes)

    const result = await authenticateServiceToken(
      request(token),
      'DOMAIN_EVENT_PROCESSOR',
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(status)
  })

  it('accepts the configured token with the exact processor scope', async () => {
    vi.stubEnv('AUTOMATION_SERVICE_TOKEN', 'secret')
    vi.stubEnv('AUTOMATION_SERVICE_SCOPES', 'DOMAIN_EVENT_PROCESSOR')

    await expect(
      authenticateServiceToken(request('secret'), 'DOMAIN_EVENT_PROCESSOR'),
    ).resolves.toMatchObject({ ok: true })
  })
})
