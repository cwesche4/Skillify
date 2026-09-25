import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomersClient } from '@/components/dashboard/customers/CustomersClient'
import type { CustomerClientRecord } from '@/lib/customers/clientTypes'
import type { JobClientRecord } from '@/lib/jobs/clientTypes'

function makeCustomer(
  overrides: Partial<CustomerClientRecord> = {},
): CustomerClientRecord {
  return {
    id: 'customer-1',
    workspaceId: 'ws-a',
    displayName: 'Rivera Family',
    companyName: null,
    contactName: 'Jamie Rivera',
    email: 'jamie@example.com',
    phone: '555-0101',
    serviceAddressLine1: '12 Oak Lane',
    serviceAddressLine2: null,
    serviceAddressCity: 'Raleigh',
    serviceAddressRegion: 'NC',
    serviceAddressPostalCode: '27601',
    serviceAddressCountry: 'US',
    notes: 'Gate code is 2468.',
    assignedMemberId: 'member-a',
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

function makeJob(
  overrides: Partial<JobClientRecord> = {},
): JobClientRecord {
  return {
    id: 'job-1',
    workspaceId: 'ws-a',
    title: 'Weekly lawn service',
    description: null,
    notes: null,
    status: 'SCHEDULED',
    priority: 'HIGH',
    customerReferenceId: null,
    customerId: 'customer-1',
    customerDisplayName: 'Rivera Family',
    valueCents: 15_000,
    currency: 'USD',
    scheduledStartAt: '2026-09-25T14:00:00.000Z',
    scheduledEndAt: '2026-09-25T15:00:00.000Z',
    completedAt: null,
    assigneeMemberId: null,
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

function installCustomerApi({
  customers = [makeCustomer()],
  jobs = [],
  failList = false,
  failCreate = false,
  failUpdate = false,
  failArchive = false,
}: {
  customers?: CustomerClientRecord[]
  jobs?: JobClientRecord[]
  failList?: boolean
  failCreate?: boolean
  failUpdate?: boolean
  failArchive?: boolean
} = {}) {
  const state = { customers: [...customers] }
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const response = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })

      if (method === 'GET' && url.pathname.endsWith('/jobs')) {
        const customerId = url.searchParams.get('customerId')
        return response({
          ok: true,
          jobs: jobs.filter(
            (job) => !customerId || job.customerId === customerId,
          ),
        })
      }
      if (method === 'GET') {
        if (failList) {
          return response(
            { message: 'Customers are temporarily unavailable.' },
            503,
          )
        }
        const search = url.searchParams.get('search')?.toLowerCase()
        const records = search
          ? state.customers.filter((customer) =>
              [
                customer.displayName,
                customer.companyName,
                customer.contactName,
                customer.email,
                customer.phone,
              ].some((value) => value?.toLowerCase().includes(search)),
            )
          : state.customers
        return response({ ok: true, customers: records })
      }
      if (method === 'POST') {
        if (failCreate) {
          return response(
            { message: 'The Customer could not be created.' },
            500,
          )
        }
        const created = makeCustomer({
          ...body,
          id: `customer-${state.customers.length + 1}`,
          companyName: body.companyName ?? null,
          contactName: body.contactName ?? null,
          assignedMemberId: body.assignedMemberId ?? null,
        })
        state.customers.push(created)
        return response({ ok: true, customer: created }, 201)
      }
      const customerId = decodeURIComponent(url.pathname.split('/').at(-1)!)
      const index = state.customers.findIndex(
        (customer) => customer.id === customerId,
      )
      if (method === 'PATCH') {
        if (failUpdate) {
          return response(
            { message: 'The Customer could not be updated.' },
            500,
          )
        }
        const updated = {
          ...state.customers[index],
          ...body,
          updatedAt: '2026-09-22T12:00:00.000Z',
        }
        state.customers[index] = updated
        return response({ ok: true, customer: updated })
      }
      if (method === 'DELETE') {
        if (failArchive) {
          return response(
            { message: 'The Customer could not be archived.' },
            500,
          )
        }
        const [archived] = state.customers.splice(index, 1)
        return response({
          ok: true,
          customer: { ...archived, archivedAt: '2026-09-22T12:00:00.000Z' },
        })
      }
      return response({ message: 'Unexpected request.' }, 500)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return { state, fetchMock }
}

const members = [
  { id: 'member-a', name: 'Alex Manager', role: 'MANAGER' },
  { id: 'member-b', name: 'Sam Owner', role: 'OWNER' },
]

function renderCustomers(initialCustomerId?: string) {
  return render(
    <CustomersClient
      workspaceId="ws-a"
      workspaceSlug="acme"
      initialCustomerId={initialCustomerId}
      members={members}
    />,
  )
}

async function openCustomer(name = 'Rivera Family') {
  renderCustomers()
  const user = userEvent.setup()
  const buttons = await screen.findAllByRole('button', {
    name: `Open Customer ${name}`,
  })
  await user.click(buttons[0])
  return { user, dialog: screen.getByRole('dialog', { name }) }
}

describe('durable Simple Service Customers UI', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows an honest empty state without preview or browser-storage fallback', async () => {
    const { fetchMock } = installCustomerApi({ customers: [] })
    const sessionRead = vi.spyOn(window.sessionStorage, 'getItem')
    const localRead = vi.spyOn(window.localStorage, 'getItem')
    renderCustomers()

    expect(await screen.findByText('No Customers yet')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Add Customer' }).length,
    ).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/ws-a/customers',
      expect.objectContaining({ cache: 'no-store' }),
    )
    expect(sessionRead).not.toHaveBeenCalled()
    expect(localRead).not.toHaveBeenCalled()
  })

  it('renders individual and business Customers using only durable fields', async () => {
    installCustomerApi({
      customers: [
        makeCustomer(),
        makeCustomer({
          id: 'customer-2',
          displayName: 'Greenview HOA',
          companyName: 'Greenview Homeowners Association',
          contactName: 'Morgan Lee',
          email: 'morgan@greenview.test',
        }),
      ],
    })
    renderCustomers()

    expect(
      (await screen.findAllByText('Rivera Family')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Greenview HOA').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Greenview Homeowners Association').length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText(/CLV|health|pipeline|service request|recurring/i),
    ).toBeNull()
  })

  it('opens the requested active Customer from the conversion deep link', async () => {
    installCustomerApi({
      customers: [
        makeCustomer(),
        makeCustomer({ id: 'customer-converted', displayName: 'Converted Co' }),
      ],
    })
    renderCustomers('customer-converted')
    expect(
      await screen.findByRole('dialog', { name: 'Converted Co' }),
    ).toBeTruthy()
  })

  it('uses backend search across durable Customer fields', async () => {
    const { fetchMock } = installCustomerApi({
      customers: [
        makeCustomer(),
        makeCustomer({
          id: 'customer-2',
          displayName: 'Morgan Home',
          email: 'morgan@test.dev',
        }),
      ],
    })
    const user = userEvent.setup()
    renderCustomers()
    await screen.findAllByText('Rivera Family')

    await user.type(
      screen.getByRole('textbox', { name: 'Search Customers' }),
      'morgan@test.dev',
    )
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/workspaces/ws-a/customers?search=morgan%40test.dev',
        expect.any(Object),
      ),
    )
    expect((await screen.findAllByText('Morgan Home')).length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText('Rivera Family')).toBeNull()
  })

  it('creates a durable Customer with address and account-manager assignment', async () => {
    const { state } = installCustomerApi({ customers: [] })
    const user = userEvent.setup()
    renderCustomers()
    await screen.findByText('No Customers yet')

    await user.click(screen.getAllByRole('button', { name: 'Add Customer' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Add Customer' })
    await user.type(
      within(dialog).getByLabelText('Display name *'),
      'Lake House',
    )
    await user.type(within(dialog).getByLabelText('Contact name'), 'Taylor Kim')
    await user.type(
      within(dialog).getByLabelText('Address line 1'),
      '8 Lake Road',
    )
    await user.selectOptions(
      within(dialog).getByLabelText('Account manager'),
      'member-b',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Add Customer' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Lake House' }),
    ).toBeTruthy()
    expect(state.customers[0]).toMatchObject({
      displayName: 'Lake House',
      contactName: 'Taylor Kim',
      serviceAddressLine1: '8 Lake Road',
      assignedMemberId: 'member-b',
    })
    expect(screen.getByText('Lake House was added.')).toBeTruthy()
  })

  it('keeps failed creation honest and does not insert a local Customer', async () => {
    const { state } = installCustomerApi({ customers: [], failCreate: true })
    const user = userEvent.setup()
    renderCustomers()
    await screen.findByText('No Customers yet')
    await user.click(screen.getAllByRole('button', { name: 'Add Customer' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Add Customer' })
    await user.type(
      within(dialog).getByLabelText('Display name *'),
      'Unsaved Home',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Add Customer' }),
    )

    expect(
      await within(dialog).findByText('The Customer could not be created.'),
    ).toBeTruthy()
    expect(state.customers).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'Add Customer' })).toBeTruthy()
  })

  it('shows durable detail data, edits it, and supports unassignment', async () => {
    const { state } = installCustomerApi()
    const { user, dialog } = await openCustomer()

    expect(within(dialog).getByText('jamie@example.com')).toBeTruthy()
    expect(within(dialog).getByText('12 Oak Lane')).toBeTruthy()
    expect(within(dialog).getByText('Gate code is 2468.')).toBeTruthy()
    expect(within(dialog).getByText('Alex Manager')).toBeTruthy()
    expect(
      await within(dialog).findByText(
        'No Jobs are linked to this Customer yet.',
      ),
    ).toBeTruthy()
    expect(
      within(dialog).queryByText(/Revenue|CLV|Estimate|Invoice/),
    ).toBeNull()

    await user.click(
      within(dialog).getByRole('button', { name: 'Edit Customer' }),
    )
    const editDialog = screen.getByRole('dialog', {
      name: 'Edit Rivera Family',
    })
    const displayName = within(editDialog).getByLabelText('Display name *')
    await user.clear(displayName)
    await user.type(displayName, 'Rivera Residence')
    await user.selectOptions(
      within(editDialog).getByLabelText('Account manager'),
      '',
    )
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save changes' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Rivera Residence' }),
    ).toBeTruthy()
    expect(state.customers[0]).toMatchObject({
      displayName: 'Rivera Residence',
      assignedMemberId: null,
    })
    expect(screen.getByText('Rivera Residence was updated.')).toBeTruthy()
  })

  it('shows only real durable Jobs linked to the selected Customer', async () => {
    installCustomerApi({
      jobs: [
        {
          id: 'job-1',
          workspaceId: 'ws-a',
          title: 'Weekly lawn service',
          description: null,
          notes: null,
          status: 'SCHEDULED',
          priority: 'HIGH',
          customerReferenceId: null,
          customerId: 'customer-1',
          customerDisplayName: 'Rivera Family',
          valueCents: 15000,
          currency: 'USD',
          scheduledStartAt: '2026-09-25T14:00:00.000Z',
          scheduledEndAt: '2026-09-25T15:00:00.000Z',
          completedAt: null,
          assigneeMemberId: null,
          createdByUserId: 'user-a',
          createdAt: '2026-09-20T12:00:00.000Z',
          updatedAt: '2026-09-20T12:00:00.000Z',
          archivedAt: null,
        },
        {
          id: 'job-other',
          workspaceId: 'ws-a',
          title: 'Other Customer Job',
          description: null,
          notes: null,
          status: 'OPEN',
          priority: 'NORMAL',
          customerReferenceId: null,
          customerId: 'customer-other',
          customerDisplayName: 'Other Customer',
          valueCents: null,
          currency: 'USD',
          scheduledStartAt: null,
          scheduledEndAt: null,
          completedAt: null,
          assigneeMemberId: null,
          createdByUserId: 'user-a',
          createdAt: '2026-09-20T12:00:00.000Z',
          updatedAt: '2026-09-20T12:00:00.000Z',
          archivedAt: null,
        },
      ],
    })

    const { dialog } = await openCustomer()
    expect(await within(dialog).findByText('Weekly lawn service')).toBeTruthy()
    expect(within(dialog).queryByText('Other Customer Job')).toBeNull()
    expect(
      within(dialog)
        .getByRole('link', { name: /weekly lawn service/i })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/service-requests?jobId=job-1')
    expect(
      within(dialog).queryByText(/CLV|recurring service|invoice/i),
    ).toBeNull()
  })

  it('does not show stale Jobs when an earlier Customer request resolves late', async () => {
    const customers = [
      makeCustomer(),
      makeCustomer({ id: 'customer-2', displayName: 'Morgan Home' }),
    ]
    let resolveFirstJobs!: (response: Response) => void
    const firstJobs = new Promise<Response>((resolve) => {
      resolveFirstJobs = resolve
    })
    const response = (value: unknown) =>
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' },
      })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost')
        if (!url.pathname.endsWith('/jobs')) {
          return Promise.resolve(response({ ok: true, customers }))
        }
        if (url.searchParams.get('customerId') === 'customer-1') {
          return firstJobs
        }
        return Promise.resolve(
          response({
            ok: true,
            jobs: [
              makeJob({
                id: 'job-2',
                title: 'Morgan hedge trim',
                customerId: 'customer-2',
                customerDisplayName: 'Morgan Home',
              }),
            ],
          }),
        )
      }),
    )

    const user = userEvent.setup()
    renderCustomers()
    await user.click(
      (await screen.findAllByRole('button', {
        name: 'Open Customer Rivera Family',
      }))[0],
    )
    expect(screen.getByLabelText('Loading Customer Jobs')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close Customer panel' }),
    )
    await user.click(
      screen.getAllByRole('button', { name: 'Open Customer Morgan Home' })[0],
    )
    expect(await screen.findByText('Morgan hedge trim')).toBeTruthy()

    await act(async () => {
      resolveFirstJobs(
        response({ ok: true, jobs: [makeJob({ title: 'Stale Rivera Job' })] }),
      )
      await firstJobs
    })

    expect(screen.queryByText('Stale Rivera Job')).toBeNull()
    expect(screen.getByText('Morgan hedge trim')).toBeTruthy()
  })

  it('preserves the visible Customer and edit form when update fails', async () => {
    installCustomerApi({ failUpdate: true })
    const { user, dialog } = await openCustomer()
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit Customer' }),
    )
    const editDialog = screen.getByRole('dialog', {
      name: 'Edit Rivera Family',
    })
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save changes' }),
    )

    expect(
      await within(editDialog).findByText('The Customer could not be updated.'),
    ).toBeTruthy()
    expect(
      screen.getByRole('dialog', { name: 'Edit Rivera Family' }),
    ).toBeTruthy()
  })

  it('archives only after confirmation and preserves detail on archive failure', async () => {
    const { state } = installCustomerApi()
    let opened = await openCustomer()
    await opened.user.click(
      within(opened.dialog).getByRole('button', { name: 'Archive Customer' }),
    )
    expect(state.customers).toHaveLength(1)
    const confirmation = screen.getByRole('alertdialog', {
      name: 'Archive Customer',
    })
    expect(
      within(confirmation).getByText(/without destroying the record/i),
    ).toBeTruthy()
    await opened.user.click(
      within(confirmation).getByRole('button', { name: 'Archive Customer' }),
    )
    await waitFor(() => expect(state.customers).toHaveLength(0))
    expect(screen.queryByRole('dialog', { name: 'Rivera Family' })).toBeNull()
    expect(await screen.findByText('No Customers yet')).toBeTruthy()

    installCustomerApi({ failArchive: true })
    renderCustomers()
    opened = await openCustomer()
    await opened.user.click(
      within(opened.dialog).getByRole('button', { name: 'Archive Customer' }),
    )
    await opened.user.click(
      within(
        screen.getByRole('alertdialog', { name: 'Archive Customer' }),
      ).getByRole('button', { name: 'Archive Customer' }),
    )
    expect(
      await screen.findByText('The Customer could not be archived.'),
    ).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Rivera Family' })).toBeTruthy()
  })

  it('shows loading and API failure states without fabricated Customers', async () => {
    installCustomerApi({ failList: true })
    renderCustomers()
    expect(screen.getByLabelText('Loading Customers')).toBeTruthy()
    expect(
      await screen.findByText('Customers are temporarily unavailable.'),
    ).toBeTruthy()
    expect(screen.queryByText('Rivera Family')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
