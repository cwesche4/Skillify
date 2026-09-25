import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyWebhook: vi.fn(),
  processWebhook: vi.fn(),
}))

vi.mock('@/lib/integrations/register-default', () => ({
  ensureIntegrationAdapters: vi.fn(),
}))
vi.mock('@/lib/integrations/registry', () => ({
  getIntegrationAdapter: vi.fn(() => ({
    verifyWebhook: mocks.verifyWebhook,
  })),
}))
vi.mock('@/lib/integrations/webhookProcessor', () => ({
  processWebhookPayload: mocks.processWebhook,
}))

import { POST } from '@/app/api/integrations/[provider]/webhook/route'

describe('integration webhook route durability boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid HubSpot signatures before durable acceptance', async () => {
    mocks.verifyWebhook.mockResolvedValue(null)

    const response = await POST(
      new Request(
        'https://skillify.test/api/integrations/hubspot/webhook',
        { method: 'POST', body: '[]' },
      ),
      { params: { provider: 'hubspot' } },
    )

    expect(response.status).toBe(400)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it('durably accepts each verified HubSpot event', async () => {
    const payload = {
      provider: 'hubspot',
      objectType: 'contact',
      externalId: 'contact-a',
      event: 'contact.created',
      eventId: 'event-a',
      payload: {},
    }
    mocks.verifyWebhook.mockResolvedValue(payload)
    mocks.processWebhook.mockResolvedValue({
      ok: true,
      triggered: 0,
      accepted: 1,
    })

    const response = await POST(
      new Request(
        'https://skillify.test/api/integrations/hubspot/webhook',
        { method: 'POST', body: '[]' },
      ),
      { params: { provider: 'hubspot' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      triggered: 0,
      accepted: 1,
    })
    expect(mocks.processWebhook).toHaveBeenCalledWith('hubspot', payload, {
      durableAcceptance: true,
    })
  })
})
