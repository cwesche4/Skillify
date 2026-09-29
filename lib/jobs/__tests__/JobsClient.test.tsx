import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JobsClient } from '@/components/dashboard/jobs/JobsClient'
import type {
  JobClientRecord,
  WorkItemClientRecord,
} from '@/lib/jobs/clientTypes'

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: '',
}))
const replace = navigation.replace
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/service-requests',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

function makeJob(overrides: Partial<JobClientRecord> = {}): JobClientRecord {
  return {
    id: 'job-1',
    workspaceId: 'ws-a',
    title: 'Weekly lawn service',
    description: 'Mow and edge the front and back lawn.',
    notes: null,
    status: 'OPEN',
    priority: 'NORMAL',
    customerReferenceId: null,
    customerId: null,
    customerDisplayName: 'Rivera Family',
    valueCents: 15000,
    currency: 'USD',
    scheduledStartAt: '2026-09-22T14:00:00.000Z',
    scheduledEndAt: '2026-09-22T16:00:00.000Z',
    completedAt: null,
    assigneeMemberId: 'member-a',
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    canCurrentMemberExecute: true,
    ...overrides,
  }
}

function makeStep(
  overrides: Partial<WorkItemClientRecord> = {},
): WorkItemClientRecord {
  return {
    id: 'step-1',
    workspaceId: 'ws-a',
    kind: 'JOB_STEP',
    jobId: 'job-1',
    title: 'Edge sidewalks',
    description: null,
    notes: null,
    status: 'OPEN',
    priority: 'NORMAL',
    dueAt: '2026-09-22T15:00:00.000Z',
    completedAt: null,
    assigneeMemberId: 'member-a',
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

function installJobsApi({
  jobs = [makeJob()],
  steps = [makeStep()],
  customers = [
    {
      id: 'customer-a',
      displayName: 'Morgan Home',
      companyName: null,
      phone: '555-0110',
    },
    {
      id: 'customer-b',
      displayName: 'Jones Residence',
      companyName: null,
      phone: null,
    },
  ],
  failInitial = false,
  failCreate = false,
}: {
  jobs?: JobClientRecord[]
  steps?: WorkItemClientRecord[]
  customers?: Array<{
    id: string
    displayName: string
    companyName: string | null
    phone: string | null
  }>
  failInitial?: boolean
  failCreate?: boolean
} = {}) {
  const state = { jobs: [...jobs], steps: [...steps] }
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

      if (failInitial && method === 'GET' && url.endsWith('/jobs')) {
        return response({ message: 'Jobs are temporarily unavailable.' }, 503)
      }
      if (method === 'GET' && url.endsWith('/jobs')) {
        return response({ ok: true, jobs: state.jobs })
      }
      if (method === 'GET' && url.endsWith('/customers')) {
        return response({ ok: true, customers })
      }
      const nestedMatch = url.match(/\/jobs\/([^/]+)\/work-items$/)
      if (method === 'GET' && nestedMatch) {
        const jobId = decodeURIComponent(nestedMatch[1])
        return response({
          ok: true,
          workItems: state.steps.filter(
            (step) =>
              step.jobId === jobId &&
              step.kind === 'JOB_STEP' &&
              !step.archivedAt,
          ),
        })
      }
      if (method === 'POST' && url.endsWith('/jobs')) {
        if (failCreate) {
          return response({ message: 'The Job could not be created.' }, 500)
        }
        const created = makeJob({
          ...body,
          id: `job-${state.jobs.length + 1}`,
          valueCents: body.valueCents ?? null,
          customerId: body.customerId ?? null,
          customerDisplayName:
            customers.find((customer) => customer.id === body.customerId)
              ?.displayName ?? null,
        })
        state.jobs.unshift(created)
        return response({ ok: true, job: created }, 201)
      }
      if (method === 'POST' && nestedMatch) {
        const created = makeStep({
          ...body,
          id: `step-${state.steps.length + 1}`,
          jobId: decodeURIComponent(nestedMatch[1]),
        })
        state.steps.push(created)
        return response({ ok: true, workItem: created }, 201)
      }
      const lifecycleMatch = url.match(
        /\/jobs\/([^/]+)\/lifecycle\/(start|complete|update|unable-to-complete|skip|reschedule)$/,
      )
      if (method === 'POST' && lifecycleMatch) {
        const id = decodeURIComponent(lifecycleMatch[1])
        const action = lifecycleMatch[2]
        const index = state.jobs.findIndex((job) => job.id === id)
        const current = state.jobs[index]
        const updated = {
          ...current,
          ...body,
          status:
            action === 'start'
              ? ('IN_PROGRESS' as const)
              : action === 'complete'
                ? ('COMPLETED' as const)
                : action === 'unable-to-complete'
                  ? ('UNABLE_TO_COMPLETE' as const)
                  : current.status,
          unableToCompleteReason:
            action === 'unable-to-complete'
              ? body.reason
              : current.unableToCompleteReason,
          unableToCompleteNote:
            action === 'unable-to-complete'
              ? body.note
              : current.unableToCompleteNote,
        }
        state.jobs[index] = updated
        return response({ ok: true, job: updated })
      }
      const jobMatch = url.match(/\/jobs\/([^/]+)$/)
      if (jobMatch && method === 'PATCH') {
        const id = decodeURIComponent(jobMatch[1])
        const index = state.jobs.findIndex((job) => job.id === id)
        const current = state.jobs[index]
        const updated = {
          ...current,
          ...body,
          ...(body.customerId
            ? {
                customerDisplayName:
                  customers.find((customer) => customer.id === body.customerId)
                    ?.displayName ?? current.customerDisplayName,
              }
            : {}),
          completedAt:
            body.status === 'COMPLETED'
              ? '2026-09-22T16:00:00.000Z'
              : body.status
                ? null
                : current.completedAt,
        }
        state.jobs[index] = updated
        return response({ ok: true, job: updated })
      }
      if (jobMatch && method === 'DELETE') {
        const id = decodeURIComponent(jobMatch[1])
        state.jobs = state.jobs.filter((job) => job.id !== id)
        return response({ ok: true, job: makeJob({ id, archivedAt: 'now' }) })
      }
      const stepMatch = url.match(/\/work-items\/([^/]+)$/)
      if (stepMatch && method === 'PATCH') {
        const id = decodeURIComponent(stepMatch[1])
        const index = state.steps.findIndex((step) => step.id === id)
        const current = state.steps[index]
        const updated = {
          ...current,
          ...body,
          completedAt:
            body.status === 'COMPLETED'
              ? '2026-09-22T16:00:00.000Z'
              : body.status
                ? null
                : current.completedAt,
        }
        state.steps[index] = updated
        return response({ ok: true, workItem: updated })
      }
      if (stepMatch && method === 'DELETE') {
        const id = decodeURIComponent(stepMatch[1])
        state.steps = state.steps.filter((step) => step.id !== id)
        return response({
          ok: true,
          workItem: makeStep({ id, archivedAt: 'now' }),
        })
      }
      return response({ message: 'Unexpected request' }, 500)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return { state, fetchMock }
}

const members = [{ id: 'member-a', name: 'Alex Rivera', role: 'MANAGER' }]

function renderJobs(
  canManage = true,
  durableCustomersEnabled = true,
  teams: Array<{ id: string; name: string }> = [],
) {
  return render(
    <JobsClient
      workspaceId="ws-a"
      workspaceSlug="acme"
      currentMemberId="member-a"
      members={members}
      teams={teams}
      canManage={canManage}
      durableCustomersEnabled={durableCustomersEnabled}
    />,
  )
}

describe('durable Jobs UI', () => {
  beforeEach(() => {
    replace.mockReset()
    navigation.search = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an honest durable empty state without reading preview storage', async () => {
    installJobsApi({ jobs: [], steps: [] })
    const storageRead = vi.spyOn(window.sessionStorage, 'getItem')
    renderJobs()

    expect(await screen.findByText('No Jobs yet')).toBeTruthy()
    expect(storageRead).not.toHaveBeenCalled()
    expect(
      screen.getAllByRole('button', { name: 'Create Job' }).length,
    ).toBeGreaterThan(0)
  })

  it('renders durable Jobs and loads only the selected Job Steps', async () => {
    installJobsApi({
      jobs: [makeJob(), makeJob({ id: 'job-2', title: 'Hedge trimming' })],
      steps: [
        makeStep(),
        makeStep({ id: 'step-2', jobId: 'job-2', title: 'Trim east hedge' }),
        makeStep({
          id: 'todo-1',
          kind: 'TODO',
          jobId: null,
          title: 'Office To-Do',
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs()

    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: /weekly lawn service/i,
    })
    expect(await within(dialog).findByText('Edge sidewalks')).toBeTruthy()
    expect(within(dialog).queryByText('Trim east hedge')).toBeNull()
    expect(within(dialog).queryByText('Office To-Do')).toBeNull()
  })

  it('renders normalized Team assignments instead of calling a recurring Job unassigned', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          assigneeMemberId: null,
          assignments: [
            {
              id: 'assignment-team',
              workspaceId: 'ws-a',
              jobId: 'job-1',
              assignmentType: 'TEAM',
              workspaceMemberId: null,
              teamId: 'team-1',
              roleLabel: null,
              displaySnapshot: 'Crew One',
              createdAt: '2026-09-20T12:00:00.000Z',
              updatedAt: '2026-09-20T12:00:00.000Z',
            },
          ],
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs()

    expect(await screen.findByText('Crew One')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Open Job Weekly lawn service' }),
    )
    expect(
      within(
        screen.getByRole('dialog', { name: /weekly lawn service/i }),
      ).getByText('Crew One'),
    ).toBeTruthy()
  })

  it('shows Job-scoped field context and management-only related-record links', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          customerId: 'customer-a',
          recurringServiceId: 'service-1',
          schedulingEventId: 'event-1',
          serviceLocationSnapshot: '10 Main Street\nHartford, CT 06103',
          customerContactNameSnapshot: 'Morgan Rivera',
          customerPhoneSnapshot: '555-0110',
          customerEmailSnapshot: 'morgan@example.com',
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs()

    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const detail = screen.getByRole('dialog', { name: /weekly lawn service/i })
    expect(within(detail).getByText(/10 Main Street/)).toBeTruthy()
    expect(within(detail).getByText('Morgan Rivera')).toBeTruthy()
    expect(
      within(detail)
        .getByRole('link', { name: '555-0110' })
        .getAttribute('href'),
    ).toBe('tel:555-0110')
    expect(
      within(detail)
        .getByRole('link', { name: 'morgan@example.com' })
        .getAttribute('href'),
    ).toBe('mailto:morgan@example.com')
    expect(
      within(detail)
        .getByRole('link', { name: 'Open Customer' })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/clients?customerId=customer-a')
    expect(
      within(detail)
        .getByRole('link', { name: 'Open Recurring Services' })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/scheduling/recurring-services')
    expect(
      within(detail)
        .getByRole('link', { name: 'Open Scheduling' })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/scheduling/jobs')
  })

  it('keeps finalized recurring Job history read-only in management UI', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          status: 'COMPLETED',
          completedAt: '2026-09-22T16:00:00.000Z',
          recurringServiceId: 'service-1',
          schedulingEventId: 'occurrence-1',
          canCurrentMemberExecute: true,
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs()

    await user.click(await screen.findByRole('button', { name: /All Jobs/i }))
    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const detail = screen.getByRole('dialog', {
      name: /weekly lawn service/i,
    })
    expect(await within(detail).findByText('Edge sidewalks')).toBeTruthy()
    expect(within(detail).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(
      within(detail).queryByRole('button', { name: 'Archive Job' }),
    ).toBeNull()
    expect(
      within(detail).queryByRole('button', { name: 'Add Job Step' }),
    ).toBeNull()
    expect(
      within(detail).queryByRole('button', {
        name: 'Complete Edge sidewalks',
      }),
    ).toBeNull()
  })

  it('creates a durable Job with mixed normalized assignments through the API-backed form', async () => {
    const { state } = installJobsApi({ jobs: [], steps: [] })
    const user = userEvent.setup()
    renderJobs(true, true, [{ id: 'team-a', name: 'Crew One' }])
    await screen.findByText('No Jobs yet')

    await user.click(screen.getAllByRole('button', { name: 'Create Job' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Create Job' })
    await user.type(
      within(dialog).getByLabelText('Job title *'),
      'Fall cleanup',
    )
    await user.selectOptions(
      within(dialog).getByLabelText('Customer'),
      'customer-a',
    )
    await user.click(
      within(dialog).getByRole('checkbox', { name: /Alex Rivera/ }),
    )
    await user.click(within(dialog).getByRole('checkbox', { name: /Crew One/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Create Job' }))

    expect(
      await screen.findByRole('dialog', { name: /fall cleanup/i }),
    ).toBeTruthy()
    expect(state.jobs[0]).toMatchObject({
      title: 'Fall cleanup',
      customerId: 'customer-a',
      customerDisplayName: 'Morgan Home',
      assignments: [
        { assignmentType: 'MEMBER', workspaceMemberId: 'member-a' },
        { assignmentType: 'TEAM', teamId: 'team-a' },
      ],
    })
  })

  it('keeps the create form open and reports a server failure honestly', async () => {
    const { state } = installJobsApi({ jobs: [], steps: [], failCreate: true })
    const user = userEvent.setup()
    renderJobs()
    await screen.findByText('No Jobs yet')

    await user.click(screen.getAllByRole('button', { name: 'Create Job' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Create Job' })
    await user.type(
      within(dialog).getByLabelText('Job title *'),
      'Fall cleanup',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Create Job' }))

    expect(
      await within(dialog).findByText('The Job could not be created.'),
    ).toBeTruthy()
    expect(state.jobs).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'Create Job' })).toBeTruthy()
  })

  it('edits, completes, reopens, and archives a Job only after server success', async () => {
    const { state } = installJobsApi()
    const user = userEvent.setup()
    renderJobs()
    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    let detail = screen.getByRole('dialog', { name: /weekly lawn service/i })

    await user.click(within(detail).getByRole('button', { name: 'Edit' }))
    const editDialog = screen.getByRole('dialog', { name: 'Edit Job' })
    const title = within(editDialog).getByLabelText('Job title *')
    await user.clear(title)
    await user.type(title, 'Updated lawn service')
    await user.selectOptions(
      within(editDialog).getByLabelText('Customer'),
      'customer-b',
    )
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save Changes' }),
    )
    expect(
      await screen.findByRole('dialog', { name: /updated lawn service/i }),
    ).toBeTruthy()
    expect(state.jobs[0]).toMatchObject({
      customerId: 'customer-b',
      customerDisplayName: 'Jones Residence',
    })

    detail = screen.getByRole('dialog', { name: /updated lawn service/i })
    await user.click(
      within(detail).getByRole('button', { name: 'Mark Job Complete' }),
    )
    await user.click(
      await within(detail).findByRole('button', { name: 'Reopen Job' }),
    )
    expect(
      await within(detail).findByRole('button', { name: 'Mark Job Complete' }),
    ).toBeTruthy()

    await user.click(
      within(detail).getByRole('button', { name: 'Archive Job' }),
    )
    await user.click(
      within(
        screen.getByRole('alertdialog', { name: 'Archive this Job?' }),
      ).getByRole('button', { name: 'Archive Job' }),
    )
    await waitFor(() => expect(state.jobs).toHaveLength(0))
    expect(
      screen.queryByRole('dialog', { name: /updated lawn service/i }),
    ).toBeNull()
  })

  it('creates, completes, reopens, and edits a durable Job Step', async () => {
    const { state } = installJobsApi({ steps: [] })
    const user = userEvent.setup()
    renderJobs()
    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const detail = screen.getByRole('dialog', { name: /weekly lawn service/i })
    await within(detail).findByText('No Job Steps yet')

    await user.click(
      within(detail).getByRole('button', { name: 'Add Job Step' }),
    )
    const createDialog = screen.getByRole('dialog', { name: 'Add Job Step' })
    await user.type(
      within(createDialog).getByLabelText('Job Step title *'),
      'Blow clippings',
    )
    await user.click(
      within(createDialog).getByRole('button', { name: 'Add Job Step' }),
    )

    expect(await within(detail).findByText('Blow clippings')).toBeTruthy()
    await user.click(
      within(detail).getByRole('button', { name: 'Complete Blow clippings' }),
    )
    expect(await within(detail).findByText('Completed')).toBeTruthy()
    await user.click(
      within(detail).getByRole('button', { name: 'Reopen Blow clippings' }),
    )
    expect(
      await within(detail).findByRole('button', {
        name: 'Complete Blow clippings',
      }),
    ).toBeTruthy()
    await user.click(
      within(detail).getByRole('button', { name: 'Edit Blow clippings' }),
    )
    const editDialog = screen.getByRole('dialog', { name: 'Edit Job Step' })
    const stepTitle = within(editDialog).getByLabelText('Job Step title *')
    await user.clear(stepTitle)
    await user.type(stepTitle, 'Blow all clippings')
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save Job Step' }),
    )
    expect(await within(detail).findByText('Blow all clippings')).toBeTruthy()
    expect(state.steps[0].jobId).toBe('job-1')

    await user.click(
      within(detail).getByRole('button', {
        name: 'Archive Blow all clippings',
      }),
    )
    const archiveDialog = screen.getByRole('alertdialog', {
      name: 'Archive this Job Step?',
    })
    await user.click(
      within(archiveDialog).getByRole('button', {
        name: 'Archive Job Step',
      }),
    )
    await waitFor(() => expect(state.steps).toHaveLength(0))
    expect(within(detail).queryByText('Blow all clippings')).toBeNull()
  })

  it('lets authorized Job crew execute its Job Steps while management stays read-only', async () => {
    const { state, fetchMock } = installJobsApi({
      steps: [
        makeStep(),
        makeStep({
          id: 'step-other',
          title: 'Other crew step',
          assigneeMemberId: 'member-b',
        }),
        makeStep({
          id: 'step-unassigned',
          title: 'Unassigned step',
          assigneeMemberId: null,
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs(false)

    expect(
      await screen.findByText(/Open an assigned Job to start work/i),
    ).toBeTruthy()
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/customers'),
      ),
    ).toBe(false)
    expect(screen.queryByRole('button', { name: 'Create Job' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Open Job Weekly lawn service' }),
    )
    const detail = screen.getByRole('dialog', { name: /weekly lawn service/i })
    expect(await within(detail).findByText('Edge sidewalks')).toBeTruthy()
    expect(within(detail).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(
      within(detail).queryByRole('button', { name: 'Add Job Step' }),
    ).toBeNull()
    expect(
      within(detail).getByRole('button', { name: 'Complete Edge sidewalks' }),
    ).toBeTruthy()
    expect(
      within(detail).getByRole('button', {
        name: 'Update status and notes for Edge sidewalks',
      }),
    ).toBeTruthy()
    expect(
      within(detail).getByRole('button', {
        name: 'Complete Other crew step',
      }),
    ).toBeTruthy()
    expect(
      within(detail).getByRole('button', {
        name: 'Complete Unassigned step',
      }),
    ).toBeTruthy()

    await user.click(
      within(detail).getByRole('button', {
        name: 'Update status and notes for Edge sidewalks',
      }),
    )
    const updateDialog = screen.getByRole('dialog', {
      name: 'Update Job Step',
    })
    await user.selectOptions(
      within(updateDialog).getByLabelText('Status'),
      'IN_PROGRESS',
    )
    await user.type(
      within(updateDialog).getByLabelText('Notes'),
      'Started edging.',
    )
    await user.click(
      within(updateDialog).getByRole('button', { name: 'Save Update' }),
    )

    await waitFor(() =>
      expect(state.steps[0]).toMatchObject({
        status: 'IN_PROGRESS',
        notes: 'Started edging.',
      }),
    )
  })

  it('uses server-derived Team eligibility for explicit field Job execution', async () => {
    const { state, fetchMock } = installJobsApi({
      jobs: [
        makeJob({
          status: 'SCHEDULED',
          assigneeMemberId: null,
          recurringServiceId: 'service-1',
          schedulingEventId: 'event-1',
          serviceInstructionsSnapshot: 'Use the side gate.',
          serviceLocationSnapshot: '10 Main Street',
          customerContactNameSnapshot: 'Morgan Rivera',
          customerPhoneSnapshot: '555-0110',
          canCurrentMemberExecute: true,
          assignments: [
            {
              id: 'assignment-1',
              workspaceId: 'ws-a',
              jobId: 'job-1',
              assignmentType: 'TEAM',
              workspaceMemberId: null,
              teamId: 'team-1',
              roleLabel: null,
              displaySnapshot: 'Crew One',
              createdAt: '2026-09-20T12:00:00.000Z',
              updatedAt: '2026-09-20T12:00:00.000Z',
            },
          ],
        }),
      ],
      steps: [makeStep({ assigneeMemberId: null })],
    })
    const user = userEvent.setup()
    renderJobs(false)

    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const detail = screen.getByRole('dialog', { name: /weekly lawn service/i })
    expect(within(detail).getByText('Crew One')).toBeTruthy()
    expect(within(detail).getByText('Use the side gate.')).toBeTruthy()
    expect(within(detail).getByText('10 Main Street')).toBeTruthy()
    expect(within(detail).getByText('Morgan Rivera')).toBeTruthy()
    expect(within(detail).getByRole('link', { name: '555-0110' })).toBeTruthy()
    expect(
      within(detail).queryByRole('link', { name: 'Open Scheduling' }),
    ).toBeNull()
    expect(
      within(detail).queryByRole('button', { name: 'Skip Visit' }),
    ).toBeNull()
    await user.click(within(detail).getByRole('button', { name: 'Start Job' }))
    await waitFor(() => expect(state.jobs[0].status).toBe('IN_PROGRESS'))
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/jobs/job-1/lifecycle/start'),
      ),
    ).toBe(true)
    expect(
      await within(detail).findByRole('button', { name: 'Complete Job' }),
    ).toBeTruthy()
    expect(
      within(detail).getByRole('button', { name: 'Complete Edge sidewalks' }),
    ).toBeTruthy()
  })

  it('removes an unable recurring Job from My Jobs after field reporting', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          status: 'IN_PROGRESS',
          recurringServiceId: 'service-1',
          schedulingEventId: 'event-1',
          canCurrentMemberExecute: true,
        }),
      ],
    })
    const user = userEvent.setup()
    renderJobs(false)

    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: /weekly lawn service/i }),
      ).getByRole('button', { name: 'Unable to Complete' }),
    )
    const reportDialog = screen.getByRole('dialog', {
      name: 'Report Unable to Complete',
    })
    await user.click(
      within(reportDialog).getByRole('button', {
        name: 'Report Unable to Complete',
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /My Jobs/ }).textContent,
      ).toContain('0'),
    )
  })

  it('provides management a durable Needs Attention queue and preserves resolved Unable context', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          id: 'unable-job',
          title: 'Unable visit',
          status: 'UNABLE_TO_COMPLETE',
          unableToCompleteReason: 'ACCESS_ISSUE',
          unableToCompleteNote: 'Gate code did not work.',
          unableToCompleteAt: '2026-09-28T14:00:00.000Z',
          unableToCompleteReportedByMemberId: 'member-a',
        }),
        makeJob({
          id: 'rescheduled-job',
          title: 'Rescheduled visit',
          status: 'SCHEDULED',
          unableToCompleteReason: 'WEATHER',
          unableToCompleteNote: 'Lightning nearby.',
          unableToCompleteAt: '2026-09-27T14:00:00.000Z',
          unableToCompleteReportedByMemberId: 'member-a',
        }),
        makeJob({ id: 'open-job', title: 'Ordinary open Job' }),
      ],
    })
    const user = userEvent.setup()
    renderJobs(true)

    const attention = await screen.findByRole('button', {
      name: /Needs Attention.*1/,
    })
    await user.click(attention)
    expect(screen.getByText('Unable visit')).toBeTruthy()
    expect(screen.queryByText('Rescheduled visit')).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Open Job Unable visit' }),
    )
    const current = screen.getByRole('dialog', { name: 'Unable visit' })
    expect(within(current).getByText('Access issue')).toBeTruthy()
    expect(within(current).getByText('Gate code did not work.')).toBeTruthy()
    expect(within(current).getByText(/by Alex Rivera/)).toBeTruthy()

    await user.click(within(current).getByRole('button', { name: /close/i }))
    await user.click(screen.getByRole('button', { name: /All Jobs/ }))
    await user.click(
      screen.getByRole('button', { name: 'Open Job Rescheduled visit' }),
    )
    const resolved = screen.getByRole('dialog', {
      name: 'Rescheduled visit',
    })
    expect(
      within(resolved).getByText('Previously Unable to Complete'),
    ).toBeTruthy()
    expect(within(resolved).getByText('Lightning nearby.')).toBeTruthy()
  })

  it('does not expose the management exception view to a Member', async () => {
    installJobsApi({ jobs: [makeJob({ status: 'UNABLE_TO_COMPLETE' })] })
    renderJobs(false)
    await screen.findByRole('button', { name: /My Jobs/ })
    expect(screen.queryByRole('button', { name: /Needs Attention/ })).toBeNull()
  })

  it('rejects a management-only Needs Attention URL for a Member', async () => {
    navigation.search = 'view=needs-attention'
    installJobsApi({
      jobs: [
        makeJob({
          id: 'unable-job',
          title: 'Unable visit',
          status: 'UNABLE_TO_COMPLETE',
          canCurrentMemberExecute: false,
        }),
        makeJob({ id: 'assigned-job', title: 'Assigned visit' }),
      ],
    })
    renderJobs(false)

    expect(await screen.findByText('Assigned visit')).toBeTruthy()
    expect(screen.queryByText('Unable visit')).toBeNull()
    expect(screen.queryByRole('button', { name: /Needs Attention/ })).toBeNull()
  })

  it('does not show field controls to an unrelated Member', async () => {
    installJobsApi({
      jobs: [
        makeJob({
          status: 'SCHEDULED',
          assigneeMemberId: null,
          recurringServiceId: 'service-1',
          schedulingEventId: 'event-1',
          canCurrentMemberExecute: false,
        }),
      ],
      steps: [makeStep({ assigneeMemberId: null })],
    })
    const user = userEvent.setup()
    renderJobs(false)
    await user.click(await screen.findByRole('button', { name: /All Jobs/ }))
    await user.click(
      await screen.findByRole('button', {
        name: 'Open Job Weekly lawn service',
      }),
    )
    const detail = screen.getByRole('dialog', { name: /weekly lawn service/i })
    expect(await within(detail).findByText('Edge sidewalks')).toBeTruthy()
    expect(
      within(detail).queryByRole('button', { name: 'Start Job' }),
    ).toBeNull()
    expect(
      within(detail).queryByRole('button', { name: 'Complete Edge sidewalks' }),
    ).toBeNull()
  })

  it('shows an API error without falling back to preview Jobs', async () => {
    installJobsApi({ failInitial: true })
    renderJobs()

    expect(
      await screen.findByText('Jobs are temporarily unavailable.'),
    ).toBeTruthy()
    expect(screen.queryByText('Weekly lawn service')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy()
  })

  it('preserves legacy Customer-name behavior outside Simple Service', async () => {
    const { fetchMock } = installJobsApi({ jobs: [], steps: [] })
    const user = userEvent.setup()
    renderJobs(true, false)
    await screen.findByText('No Jobs yet')

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/customers'),
      ),
    ).toBe(false)
    await user.click(screen.getAllByRole('button', { name: 'Create Job' })[0])
    expect(
      within(screen.getByRole('dialog', { name: 'Create Job' })).getByLabelText(
        'Customer name',
      ),
    ).toBeTruthy()
  })
})
