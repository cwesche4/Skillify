import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LeadsClient } from '@/components/dashboard/sales/LeadsClient'
import { readContactIdentities } from '@/lib/crm/contactIdentity'
import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { createDemoWorkspaceOwners } from '@/lib/workspace-ownership'
import { readPreviewLeads } from '@/lib/sales/previewLeadStorage'
import { readPreviewClients } from '@/lib/clients/previewClientStorage'
import { readPreviewTasks } from '@/lib/tasks/previewTaskStorage'
import { readPreviewActivity } from '@/lib/workspace-records/activity'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/leads',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/dashboard/sales/SalesKpiCard', () => ({
  SalesKpiCard: ({
    label,
    value,
    onClick,
  }: {
    label: string
    value: string
    onClick: () => void
  }) =>
    React.createElement(
      'button',
      { type: 'button', onClick },
      `${label} ${value}`,
    ),
}))

vi.mock(
  '@/components/dashboard/workspace-insights/WorkspaceInsightCharts',
  () => ({
    ChartCard: ({ children }: { children: React.ReactNode }) => children,
    DonutBreakdown: () => null,
    HorizontalBarList: () => null,
    InsightAreaChart: () => null,
    LinkedRecordsCard: ({
      title,
      records,
    }: {
      title: string
      records: Array<{ label: string; value: string; href?: string }>
    }) =>
      React.createElement(
        'section',
        { 'aria-label': title },
        ...records.map((record) =>
          record.href
            ? React.createElement(
                'a',
                { key: record.label, href: record.href },
                `${record.label} ${record.value}`,
              )
            : React.createElement(
                'div',
                { key: record.label },
                `${record.label} ${record.value}`,
              ),
        ),
      ),
    RecordTimeline: ({
      events,
    }: {
      events: Array<{ title: string; description?: string }>
    }) =>
      React.createElement(
        'div',
        {},
        ...events.map((event) =>
          React.createElement(
            'article',
            { key: `${event.title}-${event.description ?? ''}` },
            event.title,
            event.description,
          ),
        ),
      ),
    RecommendedActionsCard: ({
      actions,
    }: {
      actions: Array<{ title: string; detail: string }>
    }) =>
      React.createElement(
        'section',
        { 'aria-label': 'Recommended Actions' },
        ...actions.map((action) =>
          React.createElement(
            'article',
            { key: action.title },
            action.title,
            action.detail,
          ),
        ),
      ),
    SavedViewTabs: ({
      views,
      onSelect,
      trailingAction,
    }: {
      views: Array<{ id: string; label: string; count: number }>
      onSelect: (viewId: string) => void
      trailingAction?: React.ReactNode
    }) =>
      React.createElement(
        'div',
        {},
        ...views.map((view) =>
          React.createElement(
            'button',
            {
              key: view.id,
              type: 'button',
              onClick: () => onSelect(view.id),
            },
            `${view.label} ${view.count}`,
          ),
        ),
        trailingAction,
      ),
    SignalMatrix: () => null,
    StageRail: ({ data }: { data: Array<{ label: string }> }) =>
      React.createElement(
        'div',
        { 'aria-label': 'Lead lifecycle rail' },
        ...data.map((item) =>
          React.createElement('span', { key: item.label }, item.label),
        ),
      ),
  }),
)

vi.mock('@/components/ui/TableColumnVisibility', () => ({
  TableColumnsButton: () => null,
  useTableColumnVisibility: () => ({
    visibleColumns: [
      'lead',
      'status',
      'source',
      'value',
      'nextStep',
      'followUp',
      'dateAdded',
      'owner',
    ],
    isColumnVisible: () => true,
    toggleColumn: vi.fn(),
    resetColumns: vi.fn(),
  }),
}))

const workspaceId = 'workspace-leads-client-test'
const workspaceSlug = 'acme-leads-client-test'

function dataRows() {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'))
}

function rowText(row: HTMLElement) {
  return row.textContent ?? ''
}

function renderLeadsClient() {
  return render(
    React.createElement(LeadsClient, {
      workspaceId,
      workspaceSlug,
      workspaceTimezone: 'America/New_York',
      workspaceOwners: createDemoWorkspaceOwners(workspaceId),
      capabilities: getWorkspaceCapabilities({
        opportunitiesEnabled: true,
        commerceEnabled: false,
      }),
      canEditOwners: true,
    }),
  )
}

function renderServiceBusinessLeadsClient() {
  return render(
    React.createElement(LeadsClient, {
      workspaceId,
      workspaceSlug,
      workspaceTimezone: 'America/New_York',
      workspaceOwners: createDemoWorkspaceOwners(workspaceId),
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
      canEditOwners: true,
    }),
  )
}

describe('LeadsClient Add Lead flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-30T09:15:00.000Z'))
    window.sessionStorage.clear()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    replace.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the Add Lead dialog, validates required fields, and saves to workspace preview storage', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(screen.getByRole('button', { name: 'Add Lead' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })

    expect(
      within(dialog).queryByText(
        'Complete the highlighted fields before adding this lead.',
      ),
    ).toBeNull()
    expect(within(dialog).queryByText('Lead name is required.')).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Save Lead' }))
    expect(
      await within(dialog).findByText(
        'Complete the highlighted fields before adding this lead.',
      ),
    ).toBeTruthy()
    expect(within(dialog).getByText('Lead name is required.')).toBeTruthy()

    await user.type(within(dialog).getByLabelText(/Lead name/i), 'Avery Brooks')
    await waitFor(() => {
      expect(within(dialog).queryByText('Lead name is required.')).toBeNull()
    })
    await user.type(within(dialog).getByLabelText(/Company/i), 'Brooks Studio')
    await user.type(
      within(dialog).getByLabelText(/Email/i),
      'avery@example.com',
    )
    await user.type(within(dialog).getByLabelText(/Phone/i), '+1 555 0100')
    await user.type(within(dialog).getByLabelText(/Estimated value/i), '2500')
    await user.type(
      within(dialog).getByLabelText(/Next step/i),
      'Schedule intro call',
    )
    await user.type(
      within(dialog).getByLabelText(/Lead notes/i),
      'Interested in automation.',
    )
    await user.type(
      within(dialog).getByLabelText(/Shared client notes/i),
      'Prefers email.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save Lead' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Lead' })).toBeNull()
    })

    expect(screen.getByText('Avery Brooks was added to Leads.')).toBeTruthy()
    expect(screen.getByText('Avery Brooks')).toBeTruthy()
    expect(screen.getByText('Brooks Studio')).toBeTruthy()
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toContain('Date Added')
    expect(screen.getAllByText(/Overdue by \d+ days/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Jul \d{1,2}/).length).toBeGreaterThan(0)
    expect(screen.getByText('Avery Brooks').closest('tr')?.className).toContain(
      'border-cyan-300/45',
    )

    const storedLead = readPreviewLeads(workspaceSlug).find(
      (lead) => lead.name === 'Avery Brooks',
    )
    expect(storedLead).toMatchObject({
      company: 'Brooks Studio',
      contactEmail: 'avery@example.com',
      contactPhone: '+1 555 0100',
      source: 'Manual Entry',
      stage: 'New',
      status: 'New',
      value: 2500,
      nextStep: 'Schedule intro call',
      notes: 'Interested in automation.',
      leadNotes: 'Interested in automation.',
      converted: false,
    })
    expect(readContactIdentities(workspaceSlug)[0]).toMatchObject({
      contactName: 'Avery Brooks',
      companyName: 'Brooks Studio',
      email: 'avery@example.com',
      phone: '+1 555 0100',
      sharedNotes: 'Prefers email.',
    })
  })

  it('shows a duplicate warning while still allowing a separate lead record', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(screen.getByRole('button', { name: 'Add Lead' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })

    await user.type(within(dialog).getByLabelText(/Lead name/i), 'Rachel Adams')
    await user.type(
      within(dialog).getByLabelText(/Company/i),
      'Adams Bookkeeping',
    )

    expect(
      within(dialog).getByText(/Rachel Adams is already tracked as a lead/i),
    ).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Save Lead' }))

    await waitFor(() => {
      expect(readPreviewLeads(workspaceSlug)).toHaveLength(1)
    })
  })

  it('renders sort controls and reorders rows without changing status filters', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    const sortControl = screen.getByLabelText(
      'Sort leads by',
    ) as HTMLSelectElement
    expect(sortControl.value).toBe('followUpPriority')

    await user.selectOptions(sortControl, 'newestAdded')
    expect(rowText(dataRows()[0]!)).toContain('Rachel Adams')

    await user.click(screen.getByRole('button', { name: 'Add Lead' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })
    await user.type(
      within(dialog).getByLabelText(/Lead name/i),
      'Newest Manual',
    )
    await user.type(within(dialog).getByLabelText(/Company/i), 'Manual Co')
    await user.click(within(dialog).getByRole('button', { name: 'Save Lead' }))

    await waitFor(() => {
      expect(rowText(dataRows()[0]!)).toContain('Newest Manual')
    })

    await user.click(screen.getByRole('button', { name: /Contacted/i }))
    expect(dataRows().every((row) => rowText(row).includes('Contacted'))).toBe(
      true,
    )
    expect(
      (screen.getByLabelText('Sort leads by') as HTMLSelectElement).value,
    ).toBe('newestAdded')
  })

  it('uses Service Business lead stages and hides stale generic CRM stage chips', () => {
    renderServiceBusinessLeadsClient()

    expect(screen.getAllByText('Estimate / Visit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Follow-Up').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Qualified/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nurture/i })).toBeNull()
    expect(
      screen.queryByText(/Qualified leads should become opportunities/i),
    ).toBeNull()
  })

  it('converts Service Business leads into a clickable Customer record', async () => {
    const user = userEvent.setup()
    renderServiceBusinessLeadsClient()

    await user.click(screen.getByText('Rachel Adams'))
    await user.click(
      screen.getByRole('button', { name: /Convert to Customer/i }),
    )

    await waitFor(() => {
      expect(readPreviewClients(workspaceSlug)).toHaveLength(1)
    })
    expect(readPreviewClients(workspaceSlug)[0]).toMatchObject({
      id: 'client-from-lead-lead-rachel-adams',
      sourceLeadId: 'lead-rachel-adams',
      status: 'Active',
    })
    expect(readPreviewLeads(workspaceSlug)[0]).toMatchObject({
      converted: true,
      convertedDestination: LeadConversionDestination.CUSTOMER,
      connectedRecordId: 'client-from-lead-lead-rachel-adams',
      status: 'Converted',
      stage: 'Won',
    })

    const customerLink = screen.getByRole('link', {
      name: /Customer Adams Bookkeeping/i,
    })
    expect(customerLink.getAttribute('href')).toBe(
      '/dashboard/acme-leads-client-test/clients?clientId=client-from-lead-lead-rachel-adams#clients-workspace',
    )
  })

  it('creates a linked Task from the Lead drawer primary action', async () => {
    const user = userEvent.setup()
    renderServiceBusinessLeadsClient()

    await user.click(screen.getByText('Rachel Adams'))
    await user.click(screen.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => {
      expect(readPreviewTasks(workspaceSlug)).toHaveLength(1)
    })
    expect(readPreviewTasks(workspaceSlug)[0]).toMatchObject({
      title: 'Follow up with Rachel Adams',
      relatedRecordType: 'lead',
      relatedRecordId: 'lead-rachel-adams',
      relatedRecordLabel: 'Adams Bookkeeping',
      source: 'Lead Follow-Up',
      status: 'Open',
    })
    expect(
      screen.getByText(/Task created and linked to Rachel Adams/),
    ).toBeTruthy()
  })

  it('explains when a newly created lead is hidden by the active view filter', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(screen.getByRole('button', { name: /Converted/i }))
    await user.click(screen.getByRole('button', { name: 'Add Lead' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Lead' })
    await user.type(
      within(dialog).getByLabelText(/Lead name/i),
      'Hidden New Lead',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save Lead' }))

    expect(
      await screen.findByText(
        'Hidden New Lead was added to Leads. It is not visible under the current filter.',
      ),
    ).toBeTruthy()
    expect(
      dataRows().some((row) => rowText(row).includes('Hidden New Lead')),
    ).toBe(false)
  })

  it('metric cards apply their matching filters and highlight the leads workspace', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(
      screen.getAllByRole('button', { name: /Needs Follow-Up/i })[0]!,
    )

    expect(
      (screen.getByLabelText('Sort leads by') as HTMLSelectElement).value,
    ).toBe('followUpPriority')
    expect(screen.getByText(/Active filter: Needs Follow-Up/i)).toBeTruthy()
    await waitFor(() => {
      expect(document.getElementById('leads-workspace')?.className).toContain(
        'border-cyan-300/45',
      )
    })
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /New This Month/i }))
    expect(
      (screen.getByLabelText('Sort leads by') as HTMLSelectElement).value,
    ).toBe('newestAdded')
    expect(screen.getByText(/Active filter: New This Month/i)).toBeTruthy()
  })

  it('shows Schedule Follow-Up when no active follow-up exists', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(screen.getByText('Damon Lee'))

    expect(
      screen.getByRole('button', { name: 'Schedule Follow-Up' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Mark Followed Up' }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Schedule Follow-Up' }))
    const dialog = screen.getByRole('dialog', { name: 'Schedule Follow-Up' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Schedule Follow-Up' }),
    )
    expect(
      within(dialog).getAllByText('Choose a follow-up date.').length,
    ).toBeGreaterThan(0)
    await user.type(within(dialog).getByLabelText(/Date/i), '2026-08-14')
    await user.selectOptions(within(dialog).getByLabelText(/Channel/i), 'Email')
    await user.click(
      within(dialog).getByRole('button', { name: 'Schedule Follow-Up' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Schedule Follow-Up' }),
      ).toBeNull()
    })
    expect(
      screen.getByRole('button', { name: 'Mark Followed Up' }),
    ).toBeTruthy()
    expect(
      readPreviewActivity(workspaceSlug).some(
        (activity) => activity.title === 'Follow-up scheduled',
      ),
    ).toBe(true)
  })

  it('marks an active follow-up complete, writes activity, and recalculates Needs Follow-Up', async () => {
    const user = userEvent.setup()
    renderLeadsClient()

    await user.click(screen.getByText('Rachel Adams'))
    expect(
      screen.getByRole('button', { name: 'Mark Followed Up' }),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Mark Followed Up' }))
    const dialog = screen.getByRole('dialog', { name: 'Mark Followed Up' })
    await user.selectOptions(
      within(dialog).getByLabelText(/What happens next/i),
      'Close follow-ups',
    )
    await user.selectOptions(
      within(dialog).getByLabelText(/Outcome/i),
      'Reached',
    )
    await user.type(
      within(dialog).getByLabelText(/Notes/i),
      'Confirmed the lead received the qualification questions.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Save Follow-Up' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Mark Followed Up' }),
      ).toBeNull()
    })

    expect(
      screen.getByRole('button', { name: 'Schedule Follow-Up' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Mark Followed Up' }),
    ).toBeNull()
    expect(screen.getAllByText(/Follow-up completed/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Outcome: Reached/)).toBeTruthy()
    expect(
      readPreviewActivity(workspaceSlug).some(
        (activity) =>
          activity.title === 'Follow-up completed' &&
          activity.action === 'completed' &&
          activity.description.includes('Confirmed the lead received'),
      ),
    ).toBe(true)

    await user.keyboard('{Escape}')
    await user.click(
      screen.getAllByRole('button', { name: /Needs Follow-Up/i })[0]!,
    )
    expect(
      dataRows().some((row) => rowText(row).includes('Rachel Adams')),
    ).toBe(false)
  })
})
