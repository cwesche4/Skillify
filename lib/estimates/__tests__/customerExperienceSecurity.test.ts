import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  checkEstimatePublicRate,
  clearEstimatePublicRateBucketsForTests,
  createEstimateSharePublicId,
  createEstimateShareSession,
  createSignedEstimateShareToken,
  csrfTokensEqual,
  estimatePublicRateBucketCountForTests,
  estimatePublicSecurityHeaders,
  hasSameOrigin,
  verifyEstimateShareSession,
  verifySignedEstimateShareToken,
} from '@/lib/estimates/customerExperienceSecurity'

const signingKey = Buffer.alloc(32, 7).toString('base64')

describe('Estimate customer access security', () => {
  beforeEach(() => {
    process.env.ESTIMATE_SHARE_SIGNING_KEY = signingKey
    clearEstimatePublicRateBucketsForTests()
  })

  afterEach(() => {
    delete process.env.ESTIMATE_SHARE_SIGNING_KEY
  })

  it('creates a 256-bit public selector and verifies only its valid signature', () => {
    const publicId = createEstimateSharePublicId()
    expect(Buffer.from(publicId, 'base64url')).toHaveLength(32)
    const token = createSignedEstimateShareToken(publicId)
    expect(verifySignedEstimateShareToken(token)).toBe(publicId)
    expect(verifySignedEstimateShareToken(`${token}x`)).toBeNull()
    expect(
      verifySignedEstimateShareToken(
        `${createEstimateSharePublicId()}.${token.split('.')[1]}`,
      ),
    ).toBeNull()
  })

  it('uses expiring share-scoped sessions with independent CSRF authority', () => {
    const now = new Date('2026-10-03T12:00:00.000Z')
    const session = createEstimateShareSession({
      publicId: 'p'.repeat(43),
      now,
    })
    const verified = verifyEstimateShareSession(session.value, now)
    expect(verified?.publicId).toBe('p'.repeat(43))
    expect(verified?.csrfToken).toHaveLength(32)
    expect(
      csrfTokensEqual(verified!.csrfToken, session.payload.csrfToken),
    ).toBe(true)
    expect(
      verifyEstimateShareSession(
        session.value,
        new Date('2026-10-03T12:31:00.000Z'),
      ),
    ).toBeNull()
    expect(verifyEstimateShareSession(`${session.value}x`, now)).toBeNull()
  })

  it('fails closed for missing or undersized signing configuration', () => {
    delete process.env.ESTIMATE_SHARE_SIGNING_KEY
    expect(() => createSignedEstimateShareToken('p'.repeat(43))).toThrow(
      'ESTIMATE_SHARE_SIGNING_KEY',
    )
    process.env.ESTIMATE_SHARE_SIGNING_KEY = Buffer.alloc(16).toString('base64')
    expect(() => createSignedEstimateShareToken('p'.repeat(43))).toThrow(
      'at least 32 bytes',
    )
  })

  it('rejects malformed or noncanonical Base64 signing configuration', () => {
    for (const malformed of [
      `${signingKey}!`,
      ` ${signingKey}`,
      `${signingKey} `,
      `${signingKey}=`,
      'A===',
    ]) {
      process.env.ESTIMATE_SHARE_SIGNING_KEY = malformed
      expect(() => createSignedEstimateShareToken('p'.repeat(43))).toThrow(
        'canonical Base64',
      )
    }
  })

  it('requires a matching Origin/Host and emits private anti-indexing headers', () => {
    expect(
      hasSameOrigin(
        new Request('https://app.example.test/api/public/estimates/a', {
          headers: {
            origin: 'https://app.example.test',
            host: 'app.example.test',
          },
        }),
      ),
    ).toBe(true)
    expect(
      hasSameOrigin(
        new Request('https://app.example.test/api/public/estimates/a', {
          headers: {
            origin: 'https://attacker.example',
            host: 'app.example.test',
          },
        }),
      ),
    ).toBe(false)
    const headers = estimatePublicSecurityHeaders()
    expect(headers['Cache-Control']).toBe('private, no-store')
    expect(headers['Referrer-Policy']).toBe('no-referrer')
    expect(headers['X-Robots-Tag']).toContain('noindex')
    expect(headers['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    )
  })

  it('applies a narrow selector-scoped in-memory throttle', () => {
    expect(
      checkEstimatePublicRate({
        scope: 'decision',
        selector: 'share-a',
        limit: 1,
        now: 1_000,
      }).allowed,
    ).toBe(true)
    const blocked = checkEstimatePublicRate({
      scope: 'decision',
      selector: 'share-a',
      limit: 1,
      now: 1_001,
    })
    expect(blocked.allowed).toBe(false)
  })

  it('expires stale throttle buckets and caps attacker-controlled selectors', () => {
    checkEstimatePublicRate({
      scope: 'exchange',
      selector: 'stale',
      limit: 1,
      windowMs: 10,
      now: 0,
    })
    checkEstimatePublicRate({
      scope: 'exchange',
      selector: 'fresh',
      limit: 1,
      now: 60_001,
    })
    expect(estimatePublicRateBucketCountForTests()).toBe(1)

    clearEstimatePublicRateBucketsForTests()
    for (let index = 0; index < 4_100; index += 1) {
      checkEstimatePublicRate({
        scope: 'exchange',
        selector: `attacker-${index}`,
        limit: 1,
        now: 1_000,
      })
    }
    expect(estimatePublicRateBucketCountForTests()).toBe(4_096)
  })

  it('keeps middleware public matchers limited to the Estimate route segments', () => {
    const middleware = readFileSync(
      resolve(process.cwd(), 'middleware.ts'),
      'utf8',
    )
    expect(middleware).toContain("'/e/(.*)'")
    expect(middleware).toContain("'/api/public/estimates/(.*)'")
    expect(middleware).not.toContain("'/e(.*)'")
    expect(middleware).not.toContain("'/api/public/estimates(.*)'")
  })
})
