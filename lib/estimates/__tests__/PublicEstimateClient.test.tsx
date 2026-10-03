import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicEstimateClient } from '@/components/estimates/PublicEstimateClient'
import type { PublicEstimateDto } from '@/lib/estimates/customerExperience'

type DetailedPublicEstimate = Exclude<
  PublicEstimateDto,
  { state: 'REPLACED' | 'UNAVAILABLE' }
>

function presentedEstimate(
  overrides: Partial<DetailedPublicEstimate> = {},
): DetailedPublicEstimate {
  return {
    state: 'PRESENTED',
    message: null,
    business: {
      displayName: 'Example Services',
      phone: '555-0110',
      address: null,
    },
    referenceNumber: 'EST-1234567890',
    revisionNumber: 2,
    title: 'Seasonal service',
    contactDisplayName: 'Customer Name',
    scopeDescription: 'Complete the proposed seasonal service.',
    serviceAddress: null,
    currency: 'USD',
    oneTimeSubtotalCents: 10_000,
    recurringPerVisitSubtotalCents: 2_500,
    expiresOn: '2026-10-10',
    lineItems: [
      {
        title: 'Initial service',
        description: null,
        billingBasis: 'ONE_TIME',
        amountCents: 10_000,
      },
      {
        title: 'Recurring visit',
        description: null,
        billingBasis: 'PER_VISIT',
        amountCents: 2_500,
      },
    ],
    decision: null,
    csrfToken: 'csrf-token-value-123456',
    canAccept: true,
    canDecline: true,
    ...overrides,
  }
}

describe('Public Estimate customer page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('presents one-time and per-visit pricing separately with plain customer actions', () => {
    render(
      <PublicEstimateClient
        publicId="public-share-a"
        initialEstimate={presentedEstimate()}
      />,
    )
    expect(screen.getByText('One-time services')).toBeTruthy()
    expect(screen.getByText('Per-visit services')).toBeTruthy()
    expect(screen.getAllByText('$100.00')).toHaveLength(2)
    expect(screen.getAllByText('$25.00 per visit')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Accept estimate' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Decline estimate' }),
    ).toBeTruthy()
    expect(screen.queryByText(/account/i)).toBeNull()
    expect(screen.queryByText(/signature/i)).toBeNull()
  })

  it('requires acknowledgment and sends the CSRF-bound exact decision', async () => {
    const accepted = presentedEstimate({
      state: 'PRESENTED',
      canAccept: false,
      canDecline: false,
      message: 'Your estimate has been accepted.',
      decision: {
        decision: 'ACCEPTED',
        source: 'CUSTOMER_LINK',
        acknowledgmentNameSnapshot: 'Customer Name',
        occurredAt: '2026-10-03T12:00:00.000Z',
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, estimate: accepted }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <PublicEstimateClient
        publicId="public-share-a"
        initialEstimate={presentedEstimate()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Accept estimate' }))
    const confirm = screen.getByRole('button', { name: 'Confirm acceptance' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText('Your name'), 'Customer Name')
    await user.click(confirm)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      decision: 'ACCEPTED',
      acknowledgmentName: 'Customer Name',
      declineReason: null,
      declineNote: null,
      csrfToken: 'csrf-token-value-123456',
    })
    expect(
      await screen.findByText('Your estimate has been accepted.'),
    ).toBeTruthy()
  })

  it('renders replaced revisions without commercial detail or decision actions', () => {
    render(
      <PublicEstimateClient
        publicId="public-share-a"
        initialEstimate={{
          state: 'REPLACED',
          message: 'This estimate was replaced.',
          businessDisplayName: 'Example Services',
          csrfToken: 'csrf-token-value-123456',
          canAccept: false,
          canDecline: false,
        }}
      />,
    )
    expect(screen.getByText('Estimate unavailable')).toBeTruthy()
    expect(screen.queryByText('Seasonal service')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
