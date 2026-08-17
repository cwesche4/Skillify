import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TasksClient } from '@/components/dashboard/tasks/TasksClient'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { demoLeads, demoOpportunities } from '@/lib/sales/demoSalesRecords'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import { createMockWorkspaceTasks } from '@/lib/tasks/demoTasks'
import { readPreviewTasks } from '@/lib/tasks/previewTaskStorage'
import { createDemoWorkspaceOwners } from '@/lib/workspace-ownership'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/tasks',
  useRouter: () => ({ replace: vi.fn() }),
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
    LinkedRecordsCard: ({ records }: { records: Array<{ value: string }> }) =>
      React.createElement(
        'div',
        {},
        ...records.map((record) =>
          React.createElement('span', { key: record.value }, record.value),
        ),
      ),
    RecommendedActionsCard: () => null,
    RecordTimeline: () => null,
    SavedViewTabs: ({
      views,
      trailingAction,
    }: {
      views: Array<{ id: string; label: string; count: number }>
      trailingAction?: React.ReactNode
    }) =>
      React.createElement(
        'div',
        {},
        ...views.map((view) =>
          React.createElement(
            'button',
            { key: view.id, type: 'button' },
            view.label,
          ),
        ),
        trailingAction,
      ),
    SignalMatrix: () => null,
  }),
)

vi.mock('@/components/ui/TableColumnVisibility', () => ({
  TableColumnsButton: () => null,
  useTableColumnVisibility: () => ({
    visibleColumns: [],
    isColumnVisible: () => true,
    toggleColumn: vi.fn(),
    resetColumns: vi.fn(),
  }),
}))

function renderTasks() {
  const workspaceId = 'workspace-task-test'
  render(
    React.createElement(TasksClient, {
      tasks: createMockWorkspaceTasks(workspaceId),
      clients: createMockWorkspaceClients(workspaceId),
      serviceRequests: createMockServiceRequests(workspaceId),
      leads: demoLeads,
      opportunities: demoOpportunities,
      workspaceOwners: createDemoWorkspaceOwners(workspaceId),
      canManageOwners: true,
    }),
  )
  return workspaceId
}

describe('TasksClient create task flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('uses one Related to selector and persists checklist items under the task', async () => {
    const user = userEvent.setup()
    const workspaceId = renderTasks()

    await user.click(screen.getByRole('button', { name: /new task/i }))
    const dialog = screen.getByRole('dialog', { name: /new task/i })

    expect(within(dialog).getByLabelText(/Related to/i)).toBeTruthy()
    expect(within(dialog).queryByLabelText(/Related Lead/i)).toBeNull()
    expect(within(dialog).queryByLabelText(/Related Opportunity/i)).toBeNull()
    expect(within(dialog).queryByLabelText(/Related Client/i)).toBeNull()

    await user.type(
      within(dialog).getByLabelText(/Task Name/i),
      'Inspect furnace',
    )
    await user.selectOptions(
      within(dialog).getByLabelText(/^Service Request$/i),
      'request-commonwealth-homepage',
    )
    expect(within(dialog).getByText('Jason Miller')).toBeTruthy()
    expect(
      within(dialog).getByText('Commonwealth Gas & Well Service'),
    ).toBeTruthy()

    await user.click(
      within(dialog).getByRole('button', { name: /add checklist/i }),
    )
    await user.type(
      within(dialog).getByPlaceholderText(/Checklist item 1/i),
      'Verify filter',
    )
    await user.click(within(dialog).getByRole('button', { name: /add item/i }))
    await user.type(
      within(dialog).getByPlaceholderText(/Checklist item 2/i),
      'Photograph unit',
    )
    await user.click(
      within(dialog).getByRole('button', { name: /create task/i }),
    )

    const created = readPreviewTasks(workspaceId).find(
      (task) => task.title === 'Inspect furnace',
    )
    expect(created).toMatchObject({
      relatedRecordType: 'serviceRequest',
      parentType: 'serviceRequest',
      parentId: 'request-commonwealth-homepage',
      clientId: 'client-jason-miller',
    })
    expect(created?.checklist?.map((item) => item.title)).toEqual([
      'Verify filter',
      'Photograph unit',
    ])
    expect(
      readPreviewTasks(workspaceId).some(
        (task) => task.title === 'Verify filter',
      ),
    ).toBe(false)
  })

  it('allows internal tasks without a parent record', async () => {
    const user = userEvent.setup()
    const workspaceId = renderTasks()

    await user.click(screen.getByRole('button', { name: /new task/i }))
    const dialog = screen.getByRole('dialog', { name: /new task/i })
    await user.type(
      within(dialog).getByLabelText(/Task Name/i),
      'Review operations notes',
    )
    await user.selectOptions(
      within(dialog).getByLabelText(/Related to/i),
      'internal',
    )
    expect(
      within(dialog).getByText(/Internal tasks do not require/i),
    ).toBeTruthy()
    await user.click(
      within(dialog).getByRole('button', { name: /create task/i }),
    )

    const created = readPreviewTasks(workspaceId).find(
      (task) => task.title === 'Review operations notes',
    )
    expect(created).toMatchObject({
      relatedRecordType: 'internal',
      parentType: 'internal',
      relatedType: 'Internal',
    })
  })
})
