import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EstimatesClient } from '@/components/dashboard/estimates/EstimatesClient'
import type { EstimateClientRecord } from '@/lib/estimates/clientTypes'
import type {
  EstimateClientOperationalCustomer,
  EstimateClientOperationalization,
} from '@/lib/estimates/clientTypes'

function estimate(
  overrides: Partial<EstimateClientRecord> = {},
): EstimateClientRecord {
  return {
    id: 'estimate-a',
    workspaceId: 'ws-a',
    referenceNumber: 'EST-A1B2C3D4E5',
    revisionNumber: 1,
    previousRevisionId: null,
    leadId: 'lead-a',
    customerId: null,
    title: 'Spring cleanup and mowing',
    scopeDescription: 'Clean beds, spread mulch, and mow weekly.',
    contactNameSnapshot: 'Jamie Rivera',
    contactEmailSnapshot: 'jamie@example.com',
    contactPhoneSnapshot: '555-0101',
    serviceAddressLine1Snapshot: '12 Oak Lane',
    serviceAddressLine2Snapshot: null,
    serviceAddressCitySnapshot: 'Raleigh',
    serviceAddressRegionSnapshot: 'NC',
    serviceAddressPostalCodeSnapshot: '27601',
    serviceAddressCountrySnapshot: 'US',
    currency: 'USD',
    oneTimeSubtotalCents: 45_000,
    recurringPerVisitSubtotalCents: 7_500,
    status: 'DRAFT',
    expiresOn: '2026-10-15',
    version: 1,
    presentedAt: null,
    acceptedAt: null,
    declinedAt: null,
    voidedAt: null,
    createdAt: '2026-09-30T12:00:00.000Z',
    updatedAt: '2026-09-30T12:00:00.000Z',
    archivedAt: null,
    lineItems: [
      {
        id: 'line-a',
        title: 'Spring cleanup',
        description: null,
        billingBasis: 'ONE_TIME',
        amountCents: 45_000,
        sortOrder: 0,
      },
      {
        id: 'line-b',
        title: 'Weekly mowing',
        description: null,
        billingBasis: 'PER_VISIT',
        amountCents: 7_500,
        sortOrder: 1,
      },
    ],
    lead: { id: 'lead-a', displayName: 'Jamie Rivera', archivedAt: null },
    customer: null,
    createdBy: {
      id: 'profile-manager',
      fullName: 'Morgan Manager',
      email: 'morgan@example.com',
    },
    presentedBy: null,
    acceptedBy: null,
    declinedBy: null,
    voidedBy: null,
    ...overrides,
  }
}

function installApi(
  record = estimate(),
  options: {
    revisionHistoryTruncated?: boolean
    operationalCustomer?: EstimateClientOperationalCustomer | null
    operationalization?: EstimateClientOperationalization | null
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      const response = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.pathname.endsWith('/leads')) {
        return response({ leads: [record.lead] })
      }
      if (url.pathname.endsWith('/customers')) {
        return response({ customers: [] })
      }
      if (url.pathname.endsWith(`/estimates/${record.id}`)) {
        return response({
          estimate: record,
          revisions: options.revisionHistoryTruncated
            ? [record, { ...record, id: 'estimate-revision-2' }]
            : [record],
          revisionHistoryTruncated: options.revisionHistoryTruncated ?? false,
          workspaceDateKey: '2026-09-30',
          operationalCustomer: options.operationalCustomer ?? null,
          operationalization: options.operationalization ?? null,
        })
      }
      if (url.pathname.endsWith('/estimates') && !init?.method) {
        return response({
          estimates: [record],
          nextCursor: null,
          workspaceDateKey: '2026-09-30',
        })
      }
      return response({ estimate: record }, 200)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Estimate management UI', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows bounded saved views and separate one-time/per-visit totals', async () => {
    installApi()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    expect(await screen.findByText('Spring cleanup and mowing')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Past expiry' })).toBeTruthy()
    expect(screen.getByText('$450.00 one-time')).toBeTruthy()
    expect(screen.getByText('$75.00 / visit')).toBeTruthy()
  })

  it('uses truthful manual presentation and acceptance language', async () => {
    installApi()
    const user = userEvent.setup()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Mark Presented' }),
    )
    expect(
      screen.getByText(/presented the revision outside Skillify/i),
    ).toBeTruthy()
    expect(screen.getByText(/does not send or deliver anything/i)).toBeTruthy()
  })

  it('opens a mobile-stacked contextual Draft editor from a Lead', async () => {
    installApi()
    render(
      <EstimatesClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        initialLeadId="lead-a"
        initialCreate
      />,
    )
    expect(screen.getAllByText('Create Estimate').length).toBeGreaterThan(1)
    await waitFor(() =>
      expect((screen.getByLabelText('Lead') as HTMLSelectElement).value).toBe(
        'lead-a',
      ),
    )
    expect(screen.getByLabelText('Item 1')).toBeTruthy()
    expect(screen.getByText('One-time subtotal')).toBeTruthy()
    expect(screen.getByText('Per-visit subtotal')).toBeTruthy()
  })

  it('creates with server-derived snapshots instead of sending blank client snapshot fields', async () => {
    const fetchMock = installApi()
    const user = userEvent.setup()
    render(
      <EstimatesClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        initialLeadId="lead-a"
        initialCreate
      />,
    )

    await user.type(screen.getByLabelText('Estimate title'), 'Spring cleanup')
    await user.type(screen.getByLabelText('Item 1'), 'Cleanup')
    await user.type(screen.getByLabelText('Amount'), '125.00')
    await user.click(screen.getByRole('button', { name: 'Create Draft' }))

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith('/estimates') && init?.method === 'POST',
      )
      expect(request).toBeTruthy()
      const body = JSON.parse(String(request?.[1]?.body)) as Record<
        string,
        unknown
      >
      expect(body).toMatchObject({
        leadId: 'lead-a',
        title: 'Spring cleanup',
        lineItems: [
          {
            title: 'Cleanup',
            billingBasis: 'ONE_TIME',
            amountCents: 12_500,
          },
        ],
      })
      expect(body).not.toHaveProperty('contactNameSnapshot')
      expect(body).not.toHaveProperty('serviceAddressLine1Snapshot')
    })
  })

  it('keeps the editor usable while a currency code is being typed', async () => {
    installApi()
    const user = userEvent.setup()
    render(
      <EstimatesClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        initialLeadId="lead-a"
        initialCreate
      />,
    )
    const currency = screen.getByLabelText('Currency')
    await user.clear(currency)
    await user.type(currency, 'EUR')
    expect((currency as HTMLInputElement).value).toBe('EUR')
    expect(screen.getAllByText('€0.00')).toHaveLength(2)
  })

  it('renders archived commercial history as read-only', async () => {
    installApi(estimate({ archivedAt: '2026-10-01T12:00:00.000Z' }))
    const user = userEvent.setup()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    expect(await screen.findAllByText('Archived · Draft')).toHaveLength(2)
    expect(screen.getByText(/read-only commercial history/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Draft' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark Presented' })).toBeNull()
  })

  it('discloses when bounded revision history is truncated', async () => {
    installApi(estimate(), { revisionHistoryTruncated: true })
    const user = userEvent.setup()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    expect(
      await screen.findByText(/Additional revision history is not shown/i),
    ).toBeTruthy()
  })

  it('shows Convert Lead first when accepted work has no durable Customer', async () => {
    installApi(estimate({ status: 'ACCEPTED' }))
    const user = userEvent.setup()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    expect(
      await screen.findByText('Convert Lead to Customer first'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Work' })).toBeNull()
  })

  it('opens the explicit mobile handoff for accepted Customer work', async () => {
    installApi(estimate({ status: 'ACCEPTED', customerId: 'customer-a' }), {
      operationalCustomer: {
        id: 'customer-a',
        displayName: 'Jamie Rivera',
        contactName: 'Jamie Rivera',
        email: 'jamie@example.com',
        phone: '555-0101',
        serviceAddressLine1: '12 Oak Lane',
        serviceAddressLine2: null,
        serviceAddressCity: 'Raleigh',
        serviceAddressRegion: 'NC',
        serviceAddressPostalCode: '27601',
        serviceAddressCountry: 'US',
      },
    })
    const user = userEvent.setup()
    render(
      <EstimatesClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        timezone="America/New_York"
        members={[{ id: 'member-a', name: 'Morgan Manager' }]}
        teams={[{ id: 'team-a', name: 'Crew A' }]}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    await user.click(await screen.findByRole('button', { name: 'Create Work' }))
    expect(
      screen.getByRole('button', { name: 'Create Operational Work' }),
    ).toBeTruthy()
    expect(screen.getByText('Proposed Job Steps')).toBeTruthy()
    expect(screen.getAllByText('Weekly mowing')).toHaveLength(2)
    expect(screen.getByDisplayValue('America/New_York')).toBeTruthy()
  })

  it('shows management source links after work is created', async () => {
    installApi(estimate({ status: 'ACCEPTED', customerId: 'customer-a' }), {
      operationalization: {
        id: 'handoff-a',
        customerId: 'customer-a',
        operationalizedAt: '2026-10-01T12:00:00.000Z',
        jobId: 'job-a',
        recurringServiceIds: ['service-a'],
        mappings: [],
      },
    })
    const user = userEvent.setup()
    render(<EstimatesClient workspaceId="ws-a" workspaceSlug="acme" />)
    await user.click(
      await screen.findByRole('button', { name: /Spring cleanup and mowing/i }),
    )
    expect(await screen.findByText('Work Created')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Job' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Open Recurring Service 1' }),
    ).toBeTruthy()
  })
})
