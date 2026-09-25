import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DurableLeadsClient } from '@/components/dashboard/leads/DurableLeadsClient'
import type { LeadClientRecord } from '@/lib/leads/clientTypes'

const members = [{ id: 'member-a', name: 'Alex Manager', role: 'MANAGER' }]

function makeLead(overrides: Partial<LeadClientRecord> = {}): LeadClientRecord {
  return {
    id: 'lead-a',
    workspaceId: 'ws-a',
    displayName: 'Smith Residence',
    companyName: null,
    email: 'smith@example.com',
    phone: '555-0100',
    stage: 'NEW',
    source: 'Referral',
    estimatedValueCents: 400_000,
    currency: 'USD',
    nextStep: 'Schedule a site visit',
    followUpAt: '2026-09-25T15:00:00.000Z',
    assignedMemberId: 'member-a',
    notes: 'Front and back yard service.',
    convertedCustomerId: null,
    convertedAt: null,
    convertedCustomer: null,
    createdByUserId: 'user-a',
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-23T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

function installApi(
  initial: LeadClientRecord[] = [],
  failLoad = false,
  failCreate = false,
  duplicateCandidates: Array<{
    id: string
    displayName: string
    companyName: string | null
    email: string | null
    phone: string | null
    archivedAt: string | null
  }> = [],
) {
  const state = { leads: [...initial] }
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const response = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      if (!url.includes('/api/workspaces/ws-a/leads')) return response({}, 404)
      if (failLoad && method === 'GET')
        return response({ message: 'Leads unavailable.' }, 503)
      if (method === 'GET') return response({ ok: true, leads: state.leads })
      if (method === 'POST' && url.endsWith('/convert')) {
        const id = decodeURIComponent(url.split('/').at(-2)!)
        const index = state.leads.findIndex((lead) => lead.id === id)
        const lead = state.leads[index]
        if (lead.convertedCustomer) {
          return response({
            ok: true,
            status: 'ALREADY_CONVERTED',
            lead,
            customer: lead.convertedCustomer,
          })
        }
        if (duplicateCandidates.length && !body.confirmDuplicate) {
          return response({
            ok: true,
            status: 'DUPLICATE_WARNING',
            lead,
            candidates: duplicateCandidates,
          })
        }
        const customer = {
          id: 'customer-converted',
          displayName: lead.companyName ?? lead.displayName,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          archivedAt: null,
        }
        state.leads[index] = {
          ...lead,
          stage: 'WON',
          convertedCustomerId: customer.id,
          convertedAt: '2026-09-23T13:00:00.000Z',
          convertedCustomer: customer,
        }
        return response({
          ok: true,
          status: 'SUCCESS',
          lead: state.leads[index],
          customer,
        })
      }
      if (method === 'POST') {
        if (failCreate) {
          return response({ message: 'Lead could not be saved.' }, 500)
        }
        const lead = makeLead({ ...body, id: `lead-${state.leads.length + 1}` })
        state.leads.unshift(lead)
        return response({ ok: true, lead }, 201)
      }
      const id = decodeURIComponent(url.split('/').pop()!)
      const index = state.leads.findIndex((lead) => lead.id === id)
      if (method === 'PATCH') {
        state.leads[index] = { ...state.leads[index], ...body }
        return response({ ok: true, lead: state.leads[index] })
      }
      if (method === 'DELETE') {
        const [lead] = state.leads.splice(index, 1)
        return response({
          ok: true,
          lead: { ...lead, archivedAt: new Date().toISOString() },
        })
      }
      return response({}, 405)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return { state, fetchMock }
}

afterEach(() => vi.unstubAllGlobals())

describe('DurableLeadsClient', () => {
  it('shows honest loading/empty states and creates a durable Lead', async () => {
    const { state } = installApi()
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    expect(screen.getByText('Loading durable Leads…')).toBeTruthy()
    expect(await screen.findByText('No Leads yet')).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Add Lead' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })
    await user.type(
      within(dialog).getByLabelText('Lead name *'),
      'New Prospect',
    )
    await user.selectOptions(within(dialog).getByLabelText('Owner'), 'member-a')
    await user.click(within(dialog).getByRole('button', { name: 'Add Lead' }))
    expect(await screen.findByText('New Prospect was added.')).toBeTruthy()
    expect(state.leads[0]).toMatchObject({
      displayName: 'New Prospect',
      assignedMemberId: 'member-a',
    })
  })

  it('supports search, saved views, detail, editing, and archive', async () => {
    const { state } = installApi([
      makeLead(),
      makeLead({
        id: 'lead-b',
        displayName: 'Other Prospect',
        stage: 'LOST',
        estimatedValueCents: 1000,
      }),
    ])
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    expect(await screen.findByText('Smith Residence')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /High Value/ }))
    expect(screen.queryByText('Other Prospect')).toBeNull()
    await user.clear(screen.getByLabelText('Search Leads'))
    await user.type(screen.getByLabelText('Search Leads'), 'Smith')
    await user.click(screen.getByRole('button', { name: /All Leads/ }))
    await user.click(screen.getByRole('button', { name: /Smith Residence/ }))
    const detail = screen.getByRole('dialog', { name: 'Smith Residence' })
    await user.click(within(detail).getByRole('button', { name: 'Edit Lead' }))
    const edit = screen.getByRole('dialog', { name: 'Edit Lead' })
    const nextStep = within(edit).getByLabelText('Next step')
    await user.clear(nextStep)
    await user.type(nextStep, 'Send estimate')
    await user.click(within(edit).getByRole('button', { name: 'Save Lead' }))
    expect(await screen.findByText('Smith Residence was updated.')).toBeTruthy()
    expect(state.leads[0].nextStep).toBe('Send estimate')
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(state.leads).toHaveLength(1))
  })

  it('keeps Won explicit and converts only after a clear confirmation', async () => {
    const { fetchMock } = installApi([makeLead({ stage: 'FOLLOW_UP' })])
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: /Smith Residence/ }),
    )
    const detail = screen.getByRole('dialog', { name: 'Smith Residence' })
    await user.selectOptions(within(detail).getByLabelText('Stage'), 'WON')
    expect(
      await screen.findByRole('button', { name: 'Convert to Customer' }),
    ).toBeTruthy()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith('/convert')),
    ).toBe(false)
    await user.click(
      screen.getByRole('button', { name: 'Convert to Customer' }),
    )
    const confirm = screen.getByRole('dialog', {
      name: 'Convert to Customer?',
    })
    expect(within(confirm).getByText(/Lead will be marked Won/)).toBeTruthy()
    expect(within(confirm).getByText(/No Job will be created/)).toBeTruthy()
    await user.click(
      within(confirm).getByRole('button', { name: 'Convert to Customer' }),
    )
    expect(
      await screen.findByText(/was converted to Smith Residence/),
    ).toBeTruthy()
    expect(screen.getByText(/Converted to Customer/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Open Customer' }).getAttribute('href'),
    ).toBe('/dashboard/acme/clients?customerId=customer-converted')
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('preview')),
    ).toBe(false)
  })

  it('shows duplicate candidates, cancels safely, and converts only on override', async () => {
    const duplicate = {
      id: 'customer-existing',
      displayName: 'Existing Smith',
      companyName: null,
      email: 'smith@example.com',
      phone: null,
      archivedAt: null,
    }
    const { state } = installApi([makeLead()], false, false, [duplicate])
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: /Smith Residence/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Convert to Customer' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Convert to Customer?' }),
      ).getByRole('button', { name: 'Convert to Customer' }),
    )
    const warning = await screen.findByRole('dialog', {
      name: 'Potential duplicate Customers',
    })
    expect(within(warning).getByText('Existing Smith')).toBeTruthy()
    await user.click(within(warning).getByRole('button', { name: 'Cancel' }))
    expect(state.leads[0].convertedCustomerId).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Convert to Customer' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Convert to Customer?' }),
      ).getByRole('button', { name: 'Convert to Customer' }),
    )
    const repeatedWarning = await screen.findByRole('dialog', {
      name: 'Potential duplicate Customers',
    })
    await user.click(
      within(repeatedWarning).getByRole('button', {
        name: 'Convert Anyway',
      }),
    )
    expect(await screen.findByText(/was converted/)).toBeTruthy()
    expect(state.leads[0].stage).toBe('WON')
  })

  it('keeps an archived converted Customer visible as historical conversion', async () => {
    installApi([
      makeLead({
        stage: 'WON',
        convertedCustomerId: 'customer-archived',
        convertedAt: '2026-09-23T13:00:00.000Z',
        convertedCustomer: {
          id: 'customer-archived',
          displayName: 'Archived Smith',
          companyName: null,
          email: 'smith@example.com',
          phone: null,
          archivedAt: '2026-09-24T13:00:00.000Z',
        },
      }),
    ])
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: /Smith Residence/ }),
    )
    expect(screen.getByText(/Converted to Customer/).textContent).toContain(
      'Archived Smith (archived)',
    )
    expect(
      screen.queryByRole('button', { name: 'Convert to Customer' }),
    ).toBeNull()
  })

  it('shows fetch failures without falling back to demo Leads', async () => {
    installApi([], true)
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    expect(await screen.findByText('Leads unavailable.')).toBeTruthy()
    expect(screen.queryByText('Rachel Adams')).toBeNull()
  })

  it('keeps the create form open when persistence fails', async () => {
    installApi([], false, true)
    const user = userEvent.setup()
    render(
      <DurableLeadsClient
        workspaceId="ws-a"
        workspaceSlug="acme"
        members={members}
      />,
    )
    await screen.findByText('No Leads yet')
    await user.click(screen.getAllByRole('button', { name: 'Add Lead' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })
    await user.type(within(dialog).getByLabelText('Lead name *'), 'Failed Lead')
    await user.click(within(dialog).getByRole('button', { name: 'Add Lead' }))
    expect(
      await within(dialog).findByText('Lead could not be saved.'),
    ).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Add Lead' })).toBeTruthy()
  })
})
