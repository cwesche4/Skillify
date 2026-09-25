import crypto from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn() }))

import {
  hubspotAdapter,
  verifyHubSpotV3Signature,
} from '@/lib/integrations/hubspot/adapter'

const originalSecret = process.env.HUBSPOT_CLIENT_SECRET

afterEach(() => {
  if (originalSecret === undefined) delete process.env.HUBSPOT_CLIENT_SECRET
  else process.env.HUBSPOT_CLIENT_SECRET = originalSecret
})

function signature(input: {
  method: string
  url: string
  body: string
  timestamp: string
  secret: string
}) {
  return crypto
    .createHmac('sha256', input.secret)
    .update(input.method + input.url + input.body + input.timestamp)
    .digest('base64')
}

describe('HubSpot webhook verification', () => {
  it('verifies v3 headers, reads the signed body once, and preserves a batch', async () => {
    const secret = 'hubspot-test-secret'
    const url = 'https://skillify.test/api/integrations/hubspot/webhook'
    const timestamp = String(Date.now())
    const body = JSON.stringify([
      {
        eventId: 101,
        portalId: 12,
        objectId: 501,
        occurredAt: 1_700_000_000_000,
        subscriptionType: 'contact.creation',
      },
      {
        eventId: 102,
        portalId: 12,
        objectId: 502,
        occurredAt: 1_700_000_000_100,
        subscriptionType: 'contact.creation',
      },
    ])
    process.env.HUBSPOT_CLIENT_SECRET = secret

    const request = new Request(url, {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-hubspot-request-timestamp': timestamp,
        'x-hubspot-signature-v3': signature({
          method: 'POST',
          url,
          body,
          timestamp,
          secret,
        }),
      },
    })

    const verified = await hubspotAdapter.verifyWebhook(request)

    expect(verified).toEqual([
      expect.objectContaining({
        provider: 'hubspot',
        externalId: '501',
        event: 'created',
        eventId: '101',
      }),
      expect.objectContaining({
        provider: 'hubspot',
        externalId: '502',
        event: 'created',
        eventId: '102',
      }),
    ])
  })

  it('rejects stale timestamps and invalid signatures', () => {
    const input = {
      method: 'POST',
      url: 'https://skillify.test/webhook',
      body: '[]',
      timestamp: '1000',
      secret: 'secret',
      signature: 'invalid',
      now: 1_000 + 5 * 60_000 + 1,
    }

    expect(verifyHubSpotV3Signature(input)).toBe(false)
    expect(
      verifyHubSpotV3Signature({
        ...input,
        timestamp: String(input.now),
      }),
    ).toBe(false)
  })
})
