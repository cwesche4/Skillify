import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OperationalDashboard } from '@/components/dashboard/operations/OperationalDashboard'
import type { OperationalDashboardData } from '@/lib/dashboard/operationalDashboard'

const base = {
  workspaceId: 'workspace-a',
  workspaceSlug: 'acme',
  workspaceName: 'Acme Services',
  timezone: 'America/New_York',
  todayDateKey: '2026-09-29',
  today: {
    jobsCount: 0,
    jobs: [],
  },
  upcomingJobs: [],
} satisfies Omit<OperationalDashboardData, 'mode'>

describe('OperationalDashboard', () => {
  it('renders a management-first overview without financial or vanity metrics', () => {
    const data: OperationalDashboardData = {
      ...base,
      mode: 'management',
      attention: {
        unableJobsCount: 0,
        unableJobs: [],
        overdueLeadsCount: 0,
        overdueLeads: [],
        failedAutomationsCount: 0,
        failedAutomations: [],
        failedAutomationsHref: '/dashboard/acme/automations',
        failureWindowDays: 7,
      },
      today: {
        ...base.today,
        leadsCount: 0,
        leads: [],
      },
    }

    render(<OperationalDashboard data={data} />)

    expect(
      screen.getByRole('heading', { name: 'Operations overview' }),
    ).toBeTruthy()
    expect(screen.getByText('Needs your attention')).toBeTruthy()
    expect(screen.getByText('Nothing needs attention')).toBeTruthy()
    expect(screen.queryByText(/revenue/i)).toBeNull()
    expect(screen.queryByText(/conversion/i)).toBeNull()
  })

  it('shows Members only their authorized work sections', () => {
    const data: OperationalDashboardData = { ...base, mode: 'member' }

    render(<OperationalDashboard data={data} />)

    expect(screen.getByRole('heading', { name: 'My work' })).toBeTruthy()
    expect(screen.getByText('My work today')).toBeTruthy()
    expect(screen.queryByText('Needs your attention')).toBeNull()
    expect(screen.queryByText('Automation failures')).toBeNull()
    expect(screen.queryByRole('link', { name: /Leads/ })).toBeNull()
  })

  it('uses supported deep links for Jobs, Leads, and each Automation owner', () => {
    const data: OperationalDashboardData = {
      ...base,
      mode: 'management',
      attention: {
        unableJobsCount: 1,
        unableJobs: [
          {
            id: 'job-unable',
            title: 'Blocked visit',
            customerDisplayName: 'Jamie Customer',
            scheduledStartAt: null,
            scheduledEndAt: null,
            status: 'UNABLE_TO_COMPLETE',
            priority: 'HIGH',
            unableToCompleteReason: 'ACCESS_ISSUE',
            unableToCompleteAt: '2026-09-29T13:00:00.000Z',
          },
        ],
        overdueLeadsCount: 1,
        overdueLeads: [
          {
            id: 'lead-overdue',
            displayName: 'Morgan Lead',
            companyName: null,
            followUpAt: '2026-09-28T14:00:00.000Z',
            nextStep: 'Call',
          },
        ],
        failedAutomationsCount: 2,
        failedAutomations: [
          {
            id: 'run-simple',
            automationName: 'Appointment reminder',
            managedBySimple: true,
            startedAt: '2026-09-29T13:00:00.000Z',
          },
          {
            id: 'run-advanced',
            automationName: 'Custom workflow',
            managedBySimple: false,
            startedAt: '2026-09-29T12:00:00.000Z',
          },
        ],
        failedAutomationsHref: '/dashboard/acme/automations',
        failureWindowDays: 7,
      },
      today: {
        ...base.today,
        leadsCount: 0,
        leads: [],
      },
    }

    render(<OperationalDashboard data={data} />)

    expect(screen.getByRole('link', { name: /Blocked visit/ })).toHaveAttribute(
      'href',
      '/dashboard/acme/service-requests?jobId=job-unable#request-queue',
    )
    expect(screen.getByRole('link', { name: /Morgan Lead/ })).toHaveAttribute(
      'href',
      '/dashboard/acme/leads?view=overdue&leadId=lead-overdue#leads-workspace',
    )
    expect(
      screen.getByRole('link', { name: /Appointment reminder/ }),
    ).toHaveAttribute('href', '/dashboard/acme/automations/simple/executions')
    expect(
      screen.getByRole('link', { name: /Custom workflow/ }),
    ).toHaveAttribute(
      'href',
      '/dashboard/acme/automations/advanced/executions?view=failed&executionId=run-advanced#execution-history',
    )
    expect(
      screen.getByRole('link', { name: /Review Automations/ }),
    ).toHaveAttribute('href', '/dashboard/acme/automations')
  })
})
