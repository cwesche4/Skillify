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

import { OpportunitiesClient } from '@/components/dashboard/sales/OpportunitiesClient'
import { createDemoWorkspaceOwners } from '@/lib/workspace-ownership'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/opportunities',
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
    ChartCard: ({
      title,
      children,
    }: {
      title: string
      children: React.ReactNode
    }) => React.createElement('section', { 'aria-label': title }, children),
    DonutBreakdown: ({
      data,
      onSelect,
    }: {
      data: Array<{ label: string; value: number }>
      onSelect?: (item: { label: string; value: number }) => void
    }) =>
      React.createElement(
        'div',
        {},
        ...data.map((item) =>
          React.createElement(
            'button',
            {
              key: item.label,
              type: 'button',
              onClick: () => onSelect?.(item),
            },
            `status ${item.label}`,
          ),
        ),
      ),
    HorizontalBarList: () => null,
    LinkedRecordsCard: ({
      title,
      records,
    }: {
      title: string
      records: Array<{ label: string; value: string }>
    }) =>
      React.createElement(
        'section',
        { 'aria-label': title },
        title,
        ...records.map((record) =>
          React.createElement(
            'p',
            { key: `${record.label}-${record.value}` },
            `${record.label} ${record.value}`,
          ),
        ),
      ),
    ProgressMetricCard: () => null,
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
      actions: Array<{ cta: string; onClick: () => void }>
    }) =>
      React.createElement(
        'div',
        {},
        ...actions.map((action) =>
          React.createElement(
            'button',
            {
              key: action.cta,
              type: 'button',
              onClick: action.onClick,
            },
            action.cta,
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
    SignalMatrix: ({
      data,
    }: {
      data: Array<{ label: string; value: string; onClick?: () => void }>
    }) =>
      React.createElement(
        'div',
        {},
        ...data.map((item) =>
          React.createElement(
            'button',
            {
              key: item.label,
              type: 'button',
              onClick: item.onClick,
            },
            `${item.label} ${item.value}`,
          ),
        ),
      ),
    StageRail: ({
      data,
      onSelect,
    }: {
      data: Array<{ label: string; value: string }>
      onSelect?: (item: { label: string; value: string }) => void
    }) =>
      React.createElement(
        'div',
        {},
        ...data.map((item) =>
          React.createElement(
            'button',
            {
              key: item.label,
              type: 'button',
              onClick: () => onSelect?.(item),
            },
            `stage ${item.label}`,
          ),
        ),
      ),
  }),
)

vi.mock('@/components/ui/TableColumnVisibility', () => ({
  TableColumnsButton: () => null,
  useTableColumnVisibility: () => ({
    visibleColumns: [
      'opportunity',
      'status',
      'stage',
      'value',
      'probability',
      'expectedRevenue',
      'nextStep',
      'lastActivity',
      'owner',
    ],
    isColumnVisible: () => true,
    toggleColumn: vi.fn(),
    resetColumns: vi.fn(),
  }),
}))

const workspaceId = 'opportunity-client-test'

function renderOpportunities() {
  return render(
    React.createElement(OpportunitiesClient, {
      workspaceId,
      workspaceOwners: createDemoWorkspaceOwners(workspaceId),
      canEditOwners: true,
    }),
  )
}

function rows() {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'))
}

function rowText(index: number) {
  return rows()[index]?.textContent ?? ''
}

function selectValue(label: string) {
  return (screen.getByLabelText(label) as HTMLSelectElement).value
}

describe('OpportunitiesClient dashboard interactions', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('uses stage rail cards to filter and scroll to the workspace', async () => {
    const user = userEvent.setup()
    renderOpportunities()

    await user.click(screen.getByRole('button', { name: 'stage Negotiation' }))

    expect(selectValue('Stage filter')).toBe('Negotiation')
    expect(rowText(0)).toContain('Automation Reliability Review')
    expect(rowText(1)).toContain('Website and Client Portal')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('uses KPI cards as dashboard entry points and preserves expected-revenue sorting', async () => {
    const user = userEvent.setup()
    renderOpportunities()

    await user.click(screen.getByRole('button', { name: /Expected Revenue/i }))

    expect(rowText(0)).toContain('Automation Reliability Review')
    expect(rowText(1)).toContain('Website and Client Portal')
    expect(screen.getByText(/Active filter: Expected Revenue/i)).toBeTruthy()
  })

  it('uses the status chart to apply the real status filter', async () => {
    const user = userEvent.setup()
    renderOpportunities()

    await user.click(screen.getByRole('button', { name: 'status At Risk' }))

    expect(selectValue('Status filter')).toBe('At Risk')
    expect(rows()).toHaveLength(2)
    expect(rowText(0)).toContain('Automation Reliability Review')
    expect(rowText(1)).toContain('Review Automation Rollout')
  })

  it('uses recommendation actions to focus follow-up needs', async () => {
    const user = userEvent.setup()
    renderOpportunities()

    await user.click(
      screen.getByRole('button', { name: 'Show follow-up needs' }),
    )

    expect(screen.getByText(/Active filter: Needs Follow-Up/i)).toBeTruthy()
    expect(rows().map((row) => row.textContent ?? '')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Automation Reliability Review'),
        expect.stringContaining('Review Automation Rollout'),
      ]),
    )
  })

  it('supports inline drawer quick updates for next step and follow-up date', async () => {
    const user = userEvent.setup()
    renderOpportunities()

    await user.click(
      screen.getByRole('button', {
        name: /Open Operations Automation Package/i,
      }),
    )
    const drawer = screen.getByRole('dialog', { name: 'Opportunity details' })

    await user.selectOptions(
      within(drawer).getByLabelText('Update next step'),
      'Send proposal',
    )
    fireEvent.change(within(drawer).getByLabelText('Update follow-up date'), {
      target: { value: '2026-07-10' },
    })

    await waitFor(() => {
      expect(
        (within(drawer).getByLabelText('Update next step') as HTMLSelectElement)
          .value,
      ).toBe('Send proposal')
    })
    expect(
      (
        within(drawer).getByLabelText(
          'Update follow-up date',
        ) as HTMLInputElement
      ).value,
    ).toBe('2026-07-10')
  })
})
