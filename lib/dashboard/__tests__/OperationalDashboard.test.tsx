import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OperationalDashboard } from '@/components/dashboard/operations/OperationalDashboard'
import type {
  OperationalDashboardData,
  OperationalDashboardJob,
  OperationalDashboardLead,
} from '@/lib/dashboard/operationalDashboard'

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

function dashboardJob(
  overrides: Partial<OperationalDashboardJob> = {},
): OperationalDashboardJob {
  return {
    id: 'job-a',
    title: 'Spring cleanup',
    customerDisplayName: 'Jamie Customer',
    scheduledStartAt: '2026-09-29T13:00:00.000Z',
    scheduledEndAt: '2026-09-29T14:00:00.000Z',
    status: 'SCHEDULED',
    priority: 'NORMAL',
    serviceLocationSnapshot: '12 Main St',
    recurringVisit: false,
    assignmentLabel: 'Crew One',
    isUnassigned: false,
    unableToCompleteReason: null,
    unableToCompleteAt: null,
    unableToCompleteReporter: null,
    previouslyUnable: false,
    startTimePassed: false,
    ...overrides,
  }
}

function dashboardLead(
  overrides: Partial<OperationalDashboardLead> = {},
): OperationalDashboardLead {
  return {
    id: 'lead-a',
    displayName: 'Morgan Lead',
    companyName: null,
    stage: 'FOLLOW_UP',
    assigneeDisplayName: null,
    followUpAt: '2026-09-28T14:00:00.000Z',
    nextStep: 'Call',
    overdueCalendarDays: 1,
    ...overrides,
  }
}

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
      waitingOnClientCount: 0,
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
    expect(screen.getByText('No current attention items found')).toBeTruthy()
    expect(screen.queryByText('Keep work moving')).toBeNull()
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
          dashboardJob({
            id: 'job-unable',
            title: 'Blocked visit',
            scheduledStartAt: null,
            scheduledEndAt: null,
            status: 'UNABLE_TO_COMPLETE',
            priority: 'HIGH',
            unableToCompleteReason: 'ACCESS_ISSUE',
            unableToCompleteAt: '2026-09-29T13:00:00.000Z',
            unableToCompleteReporter: 'Alex Reporter',
          }),
        ],
        overdueLeadsCount: 1,
        overdueLeads: [
          dashboardLead({
            id: 'lead-overdue',
          }),
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
      waitingOnClientCount: 1,
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
    expect(
      screen.getByRole('link', { name: '1 Job waiting on client' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/acme/service-requests?view=waiting#request-queue',
    )
  })

  it('shows enriched factual Job and Lead context without sensitive notes', () => {
    const data: OperationalDashboardData = {
      ...base,
      mode: 'management',
      attention: {
        unableJobsCount: 1,
        unableJobs: [
          dashboardJob({
            id: 'unable-a',
            title: 'Blocked visit',
            status: 'UNABLE_TO_COMPLETE',
            priority: 'URGENT',
            recurringVisit: true,
            unableToCompleteReason: 'ACCESS_ISSUE',
            unableToCompleteAt: '2026-09-29T13:00:00.000Z',
            unableToCompleteReporter: 'Alex Reporter',
          }),
        ],
        overdueLeadsCount: 1,
        overdueLeads: [
          dashboardLead({
            companyName: 'Morgan Co',
            assigneeDisplayName: 'Taylor Manager',
            nextStep: 'Confirm site visit',
            overdueCalendarDays: 3,
          }),
        ],
        failedAutomationsCount: 0,
        failedAutomations: [],
        failedAutomationsHref: '/dashboard/acme/automations',
        failureWindowDays: 7,
      },
      waitingOnClientCount: 0,
      today: {
        jobsCount: 1,
        jobs: [
          dashboardJob({
            startTimePassed: true,
            previouslyUnable: true,
            isUnassigned: true,
            assignmentLabel: null,
          }),
        ],
        leadsCount: 0,
        leads: [],
      },
    }

    render(<OperationalDashboard data={data} />)

    expect(screen.getByText('Recurring visit')).toBeTruthy()
    expect(screen.getByText('Start time passed')).toBeTruthy()
    expect(screen.getByText('Previously unable')).toBeTruthy()
    expect(screen.getByText('Unassigned')).toBeTruthy()
    expect(screen.getByText(/Alex Reporter/)).toBeTruthy()
    expect(screen.getByText('Follow-Up')).toBeTruthy()
    expect(screen.getByText(/Morgan Co · Taylor Manager/)).toBeTruthy()
    expect(screen.getByText(/Next: Confirm site visit/)).toBeTruthy()
    expect(screen.getByText(/3 days overdue/)).toBeTruthy()
    expect(screen.queryByText(/private note/i)).toBeNull()
  })
})
