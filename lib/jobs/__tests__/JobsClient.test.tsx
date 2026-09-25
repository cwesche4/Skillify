import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JobsClient } from '@/components/dashboard/jobs/JobsClient'
import type {
  JobClientRecord,
  WorkItemClientRecord,
} from '@/lib/jobs/clientTypes'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/service-requests',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
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

function renderJobs(canManage = true, durableCustomersEnabled = true) {
  return render(
    <JobsClient
      workspaceId="ws-a"
      currentMemberId="member-a"
      members={members}
      canManage={canManage}
      durableCustomersEnabled={durableCustomersEnabled}
    />,
  )
}

describe('durable Jobs UI', () => {
  beforeEach(() => {
    replace.mockReset()
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

  it('creates a durable Job through the API-backed form', async () => {
    const { state } = installJobsApi({ jobs: [], steps: [] })
    const user = userEvent.setup()
    renderJobs()
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
    await user.click(within(dialog).getByRole('button', { name: 'Create Job' }))

    expect(
      await screen.findByRole('dialog', { name: /fall cleanup/i }),
    ).toBeTruthy()
    expect(state.jobs[0]).toMatchObject({
      title: 'Fall cleanup',
      customerId: 'customer-a',
      customerDisplayName: 'Morgan Home',
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

  it('lets Members execute only their assigned Job Steps while Jobs stay read-only', async () => {
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

    expect(await screen.findByText(/Job details are read-only/i)).toBeTruthy()
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
      within(detail).queryByRole('button', {
        name: 'Complete Other crew step',
      }),
    ).toBeNull()
    expect(
      within(detail).queryByRole('button', {
        name: 'Complete Unassigned step',
      }),
    ).toBeNull()

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
