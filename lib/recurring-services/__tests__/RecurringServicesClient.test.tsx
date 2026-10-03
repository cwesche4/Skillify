import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listRecurringServices: vi.fn(),
  listCustomers: vi.fn(),
  changeLifecycle: vi.fn(),
  createWorkflow: vi.fn(),
}))

vi.mock('@/lib/recurring-services/client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/recurring-services/client')
  >('@/lib/recurring-services/client')
  return {
    ...actual,
    listRecurringServices: mocks.listRecurringServices,
    changeRecurringServiceLifecycle: mocks.changeLifecycle,
    createRecurringServiceWorkflow: mocks.createWorkflow,
  }
})

vi.mock('@/lib/customers/client', () => ({
  listCustomers: mocks.listCustomers,
}))

import { RecurringServicesClient } from '@/components/dashboard/recurring-services/RecurringServicesClient'
import type { RecurringServiceClientRecord } from '@/lib/recurring-services/clientTypes'

function record(
  id: string,
  status: RecurringServiceClientRecord['status'],
): RecurringServiceClientRecord {
  return {
    id,
    workspaceId: 'ws-1',
    customerId: 'customer-1',
    recurrenceSeriesId: `series-${id}`,
    name: `${status} Lawn Care`,
    description: null,
    serviceInstructions: 'Use side gate.',
    pricePerVisitCents: 6500,
    currency: 'USD',
    defaultJobPriority: 'NORMAL',
    status,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    endedAt: status === 'ENDED' ? '2026-09-20T00:00:00.000Z' : null,
    customer: { id: 'customer-1', displayName: 'Morgan Home' },
    stepTemplates: [],
    recurrenceSeries: {
      id: `series-${id}`,
      status,
      version: 1,
      timezone: 'America/New_York',
      normalizedRule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endType: 'never',
      },
      localStartDate: '2026-09-28',
      localStartTime: '09:00',
      durationMinutes: 60,
      masterEvent: {
        id: `event-${id}`,
        title: 'Lawn care',
        startsAtUtc: '2026-09-28T13:00:00.000Z',
        endsAtUtc: '2026-09-28T14:00:00.000Z',
        assignments: [
          {
            id: `assignment-${id}`,
            assignmentType: 'TEAM',
            workspaceMemberId: null,
            teamId: 'team-1',
            roleLabel: null,
            displaySnapshot: 'Crew One',
          },
        ],
      },
    },
    jobs: [],
  }
}

describe('Recurring Services UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listRecurringServices.mockResolvedValue([
      record('active', 'ACTIVE'),
      record('paused', 'PAUSED'),
      record('ended', 'ENDED'),
    ])
    mocks.listCustomers.mockResolvedValue([
      {
        id: 'customer-1',
        workspaceId: 'ws-1',
        displayName: 'Morgan Home',
        companyName: null,
        contactName: 'Morgan',
        email: null,
        phone: null,
        serviceAddressLine1: '10 Oak Lane',
        serviceAddressLine2: null,
        serviceAddressCity: 'Raleigh',
        serviceAddressRegion: 'NC',
        serviceAddressPostalCode: '27601',
        serviceAddressCountry: 'US',
        notes: null,
        assignedMemberId: null,
        createdByUserId: 'user-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        archivedAt: null,
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            teams: [
              {
                id: 'team-1',
                name: 'Crew One',
                isActive: true,
                archivedAt: null,
                members: [],
              },
            ],
          }),
        ),
      ),
    )
  })

  it('presents Active, Paused, and Ended services with customer, cadence, price, and crew', async () => {
    render(
      <RecurringServicesClient
        workspaceId="ws-1"
        workspaceSlug="acme"
        timezone="America/New_York"
        members={[]}
        canManage
      />,
    )

    expect(await screen.findByText('ACTIVE Lawn Care')).toBeTruthy()
    expect(screen.getAllByText('Morgan Home')).toHaveLength(3)
    expect(screen.getAllByText('Every week · Mon, Wed, Fri')).toHaveLength(3)
    expect(screen.getAllByText(/\$65(?:\.00)? per visit/)).toHaveLength(3)
    expect(screen.getAllByText('Crew One')).toHaveLength(3)
    expect(screen.getByText('Ended')).toBeTruthy()
  })

  it('opens the workspace-scoped service requested by a management drill-down', async () => {
    render(
      <RecurringServicesClient
        workspaceId="ws-1"
        workspaceSlug="acme"
        timezone="America/New_York"
        members={[]}
        canManage
        initialRecurringServiceId="paused"
      />,
    )

    expect(
      await screen.findByRole('dialog', { name: 'PAUSED Lawn Care' }),
    ).toBeTruthy()
  })

  it('does not present management controls to a Member', async () => {
    render(
      <RecurringServicesClient
        workspaceId="ws-1"
        workspaceSlug="acme"
        timezone="America/New_York"
        members={[]}
        canManage={false}
      />,
    )

    expect(
      await screen.findByText(/Recurring Services are read-only/i),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'End Service' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Create Recurring Service' }),
    ).toBeNull()
  })

  it('fences double submit and preserves schedule assignments, weekdays, and ordered steps', async () => {
    let finishCreate!: () => void
    mocks.createWorkflow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCreate = resolve
        }),
    )
    const user = userEvent.setup()
    render(
      <RecurringServicesClient
        workspaceId="ws-1"
        workspaceSlug="acme"
        timezone="America/New_York"
        members={[{ id: 'member-1', name: 'Alex', role: 'MEMBER' }]}
        canManage
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Create Recurring Service' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Create Recurring Service',
    })
    await user.selectOptions(
      within(dialog).getByLabelText(/Customer/),
      'customer-1',
    )
    await user.type(within(dialog).getByLabelText(/Service Name/), 'Lawn Care')
    await user.click(within(dialog).getByText('Wed'))
    await user.click(within(dialog).getByText('Fri'))
    await user.click(within(dialog).getByText('Alex'))
    await user.click(within(dialog).getByText('Crew One'))
    await user.click(within(dialog).getByRole('button', { name: 'Add Step' }))
    await user.type(within(dialog).getByLabelText('Job Step 1 title'), 'Mow')
    await user.click(within(dialog).getByRole('button', { name: 'Add Step' }))
    await user.type(within(dialog).getByLabelText('Job Step 2 title'), 'Edge')

    const submit = within(dialog).getByRole('button', {
      name: 'Create Recurring Service',
    })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(mocks.createWorkflow).toHaveBeenCalledTimes(1))
    expect(mocks.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceInput: expect.objectContaining({
          defaultSteps: [
            expect.objectContaining({ title: 'Mow' }),
            expect.objectContaining({ title: 'Edge' }),
          ],
        }),
        scheduleInput: expect.objectContaining({
          locationType: 'customerLocation',
          recurrenceRule: expect.objectContaining({ daysOfWeek: [1, 3, 5] }),
          assignments: expect.arrayContaining([
            expect.objectContaining({
              assignmentType: 'MEMBER',
              workspaceMemberId: 'member-1',
            }),
            expect.objectContaining({
              assignmentType: 'TEAM',
              teamId: 'team-1',
            }),
          ]),
        }),
      }),
    )
    finishCreate()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
