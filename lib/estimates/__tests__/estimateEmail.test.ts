import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listConnections: vi.fn(),
  readCredentials: vi.fn(),
  resolveProvider: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/integrations/workspaceConnections', () => ({
  listWorkspaceIntegrationConnections: mocks.listConnections,
  readWorkspaceConnectionCredentials: mocks.readCredentials,
}))
vi.mock('@/lib/integrations/emailDeliveryPolicy', () => ({
  resolveEmailDeliveryProvider: mocks.resolveProvider,
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send }
  },
}))

import {
  resolveVerifiedEstimateSender,
  sendEstimateEmailWithResend,
} from '@/lib/estimates/estimateEmail'

describe('Estimate email provider policy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires a verified workspace-owned Resend sender with no platform fallback', async () => {
    mocks.listConnections.mockResolvedValue([])
    mocks.resolveProvider.mockReturnValue({
      provider: 'unavailable',
      reason: 'workspaceSenderUnavailable',
    })

    await expect(
      resolveVerifiedEstimateSender('workspace-a'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'UNAVAILABLE',
    })
    expect(mocks.resolveProvider).toHaveBeenCalledWith({
      purpose: 'quote',
      workspaceConnections: [],
      platformEmailAvailable: false,
    })
    expect(mocks.readCredentials).not.toHaveBeenCalled()
  })

  it('reads credentials only after policy selects the verified workspace connection', async () => {
    mocks.listConnections.mockResolvedValue([{ id: 'connection-a' }])
    mocks.resolveProvider.mockReturnValue({
      provider: 'workspaceResend',
      connectionId: 'connection-a',
      fromName: 'Example Services',
      fromEmail: 'estimates@example.test',
      replyTo: 'office@example.test',
    })
    mocks.readCredentials.mockResolvedValue({ apiKey: 'encrypted-at-rest-key' })

    await expect(resolveVerifiedEstimateSender('workspace-a')).resolves.toEqual(
      {
        connectionId: 'connection-a',
        apiKey: 'encrypted-at-rest-key',
        from: 'Example Services <estimates@example.test>',
        replyTo: 'office@example.test',
      },
    )
  })

  it('treats provider acceptance as sent and forwards the stable idempotency header', async () => {
    mocks.send.mockResolvedValue({
      data: { id: 'provider-message-a' },
      error: null,
    })
    const result = await sendEstimateEmailWithResend({
      sender: {
        connectionId: 'connection-a',
        apiKey: 'not-a-real-key',
        from: 'estimates@example.test',
      },
      message: {
        to: 'customer@example.test',
        subject: 'Estimate',
        html: '<p>Estimate</p>',
        text: 'Estimate',
        idempotencyKey: 'estimate-delivery:delivery-a',
      },
    })
    expect(result).toEqual({
      status: 'sent',
      provider: 'resend',
      providerMessageId: 'provider-message-a',
    })
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'estimate-delivery:delivery-a' },
      }),
    )
  })

  it('classifies provider throttling as retryable without leaking provider details', async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { statusCode: 429, message: 'provider-private-detail' },
    })
    const result = await sendEstimateEmailWithResend({
      sender: {
        connectionId: 'connection-a',
        apiKey: 'not-a-real-key',
        from: 'estimates@example.test',
      },
      message: {
        to: 'customer@example.test',
        subject: 'Estimate',
        html: '<p>Estimate</p>',
        text: 'Estimate',
        idempotencyKey: 'estimate-delivery:delivery-a',
      },
    })
    expect(result).toMatchObject({
      status: 'failed',
      code: 'RESEND_429',
      retryable: true,
    })
    expect(JSON.stringify(result)).not.toContain('provider-private-detail')
  })
})
