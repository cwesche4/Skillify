import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TodosClient } from '@/components/dashboard/todos/TodosClient'
import type { WorkItemClientRecord } from '@/lib/jobs/clientTypes'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/tasks',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}))

function makeTodo(
  overrides: Partial<WorkItemClientRecord> = {},
): WorkItemClientRecord {
  return {
    id: 'todo-1',
    workspaceId: 'ws-a',
    kind: 'TODO',
    jobId: null,
    title: 'Order trimmer line',
    description: 'Restock before Friday.',
    notes: null,
    status: 'OPEN',
    priority: 'HIGH',
    dueAt: '2026-09-24T15:00:00.000Z',
    completedAt: null,
    assigneeMemberId: 'member-a',
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

function installTodoApi({
  records = [makeTodo()],
  failInitial = false,
  failCreate = false,
}: {
  records?: WorkItemClientRecord[]
  failInitial?: boolean
  failCreate?: boolean
} = {}) {
  const state = { records: [...records] }
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

      if (method === 'GET' && url.endsWith('/work-items?kind=TODO')) {
        if (failInitial) {
          return response(
            { message: 'To-Dos are temporarily unavailable.' },
            503,
          )
        }
        return response({ ok: true, workItems: state.records })
      }
      if (method === 'POST' && url.endsWith('/work-items')) {
        if (failCreate) {
          return response({ message: 'The To-Do could not be created.' }, 500)
        }
        const created = makeTodo({
          ...body,
          id: `todo-${state.records.length + 1}`,
          kind: 'TODO',
          jobId: null,
        })
        state.records.unshift(created)
        return response({ ok: true, workItem: created }, 201)
      }
      const match = url.match(/\/work-items\/([^/]+)$/)
      if (match && method === 'PATCH') {
        const id = decodeURIComponent(match[1])
        const index = state.records.findIndex((record) => record.id === id)
        const current = state.records[index]
        const updated = {
          ...current,
          ...body,
          completedAt:
            body.status === 'COMPLETED'
              ? '2026-09-23T16:00:00.000Z'
              : body.status
                ? null
                : current.completedAt,
        }
        state.records[index] = updated
        return response({ ok: true, workItem: updated })
      }
      if (match && method === 'DELETE') {
        const id = decodeURIComponent(match[1])
        state.records = state.records.filter((record) => record.id !== id)
        return response({
          ok: true,
          workItem: makeTodo({ id, archivedAt: 'now' }),
        })
      }
      return response({ message: 'Unexpected request' }, 500)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return { state, fetchMock }
}

const members = [
  { id: 'member-a', name: 'Alex Owner', role: 'OWNER' },
  { id: 'member-b', name: 'Morgan Manager', role: 'MANAGER' },
]

function renderTodos(canManage = true) {
  return render(
    <TodosClient
      workspaceId="ws-a"
      currentMemberId="member-a"
      members={members}
      canManage={canManage}
    />,
  )
}

describe('durable My To-Dos UI', () => {
  beforeEach(() => replace.mockReset())
  afterEach(() => vi.unstubAllGlobals())

  it('uses My To-Dos terminology and never reads preview storage', async () => {
    installTodoApi({ records: [] })
    const storageRead = vi.spyOn(window.sessionStorage, 'getItem')
    renderTodos()

    expect(
      await screen.findByRole('heading', { name: 'My To-Dos' }),
    ).toBeTruthy()
    expect(screen.getByText('No To-Dos yet')).toBeTruthy()
    expect(storageRead).not.toHaveBeenCalled()
  })

  it('renders only durable TODO records and excludes Job Steps', async () => {
    installTodoApi({
      records: [
        makeTodo(),
        makeTodo({
          id: 'step-1',
          kind: 'JOB_STEP',
          jobId: 'job-1',
          title: 'Edge customer lawn',
        }),
      ],
    })
    renderTodos()

    expect(await screen.findByText('Order trimmer line')).toBeTruthy()
    expect(screen.queryByText('Edge customer lawn')).toBeNull()
  })

  it('creates a durable To-Do and reports create failures without fake success', async () => {
    const successful = installTodoApi({ records: [] })
    const user = userEvent.setup()
    const view = renderTodos()
    await screen.findByText('No To-Dos yet')

    await user.click(screen.getAllByRole('button', { name: 'Create To-Do' })[0])
    let dialog = screen.getByRole('dialog', { name: 'Create To-Do' })
    await user.type(
      within(dialog).getByLabelText('To-Do title *'),
      'Call supplier',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create To-Do' }),
    )
    expect(
      await screen.findByRole('dialog', { name: /call supplier/i }),
    ).toBeTruthy()
    expect(successful.state.records[0]).toMatchObject({
      title: 'Call supplier',
      kind: 'TODO',
      jobId: null,
    })

    view.unmount()
    installTodoApi({ records: [], failCreate: true })
    renderTodos()
    await screen.findByText('No To-Dos yet')
    await user.click(screen.getAllByRole('button', { name: 'Create To-Do' })[0])
    dialog = screen.getByRole('dialog', { name: 'Create To-Do' })
    await user.type(
      within(dialog).getByLabelText('To-Do title *'),
      'Call supplier',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create To-Do' }),
    )
    expect(
      await within(dialog).findByText('The To-Do could not be created.'),
    ).toBeTruthy()
  })

  it('opens, edits, completes, reopens, and archives a durable To-Do', async () => {
    const { state } = installTodoApi()
    const user = userEvent.setup()
    renderTodos()
    await user.click(
      await screen.findByRole('button', {
        name: 'Open To-Do Order trimmer line',
      }),
    )
    let detail = screen.getByRole('dialog', { name: /order trimmer line/i })

    await user.click(within(detail).getByRole('button', { name: 'Edit' }))
    const editDialog = screen.getByRole('dialog', { name: 'Edit To-Do' })
    const title = within(editDialog).getByLabelText('To-Do title *')
    await user.clear(title)
    await user.type(title, 'Order mower blades')
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save To-Do' }),
    )
    detail = await screen.findByRole('dialog', { name: /order mower blades/i })

    await user.click(
      within(detail).getByRole('button', { name: 'Complete To-Do' }),
    )
    await user.click(
      await within(detail).findByRole('button', { name: 'Reopen To-Do' }),
    )
    expect(
      await within(detail).findByRole('button', { name: 'Complete To-Do' }),
    ).toBeTruthy()

    await user.click(
      within(detail).getByRole('button', { name: 'Archive To-Do' }),
    )
    const archiveDialog = screen.getByRole('alertdialog', {
      name: 'Archive this To-Do?',
    })
    await user.click(
      within(archiveDialog).getByRole('button', { name: 'Archive To-Do' }),
    )
    await waitFor(() => expect(state.records).toHaveLength(0))
    expect(
      screen.queryByRole('dialog', { name: /order mower blades/i }),
    ).toBeNull()
  })

  it('lets Members execute only their assigned To-Dos while management stays hidden', async () => {
    const { state } = installTodoApi({
      records: [
        makeTodo(),
        makeTodo({
          id: 'todo-other',
          title: 'Other member task',
          assigneeMemberId: 'member-b',
        }),
        makeTodo({
          id: 'todo-unassigned',
          title: 'Unassigned task',
          assigneeMemberId: null,
        }),
      ],
    })
    const user = userEvent.setup()
    renderTodos(false)

    expect(await screen.findByText(/To-Do details are read-only/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create To-Do' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Open To-Do Order trimmer line' }),
    )
    const detail = screen.getByRole('dialog', { name: /order trimmer line/i })
    expect(within(detail).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(
      within(detail).getByRole('button', { name: 'Complete To-Do' }),
    ).toBeTruthy()
    expect(
      within(detail).getByRole('button', { name: 'Update Status & Notes' }),
    ).toBeTruthy()
    expect(
      within(detail).queryByRole('button', { name: 'Archive To-Do' }),
    ).toBeNull()

    await user.click(
      within(detail).getByRole('button', { name: 'Update Status & Notes' }),
    )
    const updateDialog = screen.getByRole('dialog', { name: 'Update To-Do' })
    await user.selectOptions(
      within(updateDialog).getByLabelText('Status'),
      'IN_PROGRESS',
    )
    await user.type(
      within(updateDialog).getByLabelText('Notes'),
      'Supplies checked.',
    )
    await user.click(
      within(updateDialog).getByRole('button', { name: 'Save Update' }),
    )
    await waitFor(() =>
      expect(state.records[0]).toMatchObject({
        status: 'IN_PROGRESS',
        notes: 'Supplies checked.',
      }),
    )

    await user.click(
      within(detail).getByRole('button', { name: 'Close To-Do details' }),
    )
    await user.click(screen.getByRole('button', { name: /^Open\d+$/ }))
    await user.click(
      await screen.findByRole('button', {
        name: 'Open To-Do Other member task',
      }),
    )
    const otherDetail = screen.getByRole('dialog', {
      name: /other member task/i,
    })
    expect(
      within(otherDetail).queryByRole('button', { name: 'Complete To-Do' }),
    ).toBeNull()
    expect(
      within(otherDetail).queryByRole('button', {
        name: 'Update Status & Notes',
      }),
    ).toBeNull()

    await user.click(
      within(otherDetail).getByRole('button', {
        name: 'Close To-Do details',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Open To-Do Unassigned task' }),
    )
    const unassignedDetail = screen.getByRole('dialog', {
      name: /unassigned task/i,
    })
    expect(
      within(unassignedDetail).queryByRole('button', {
        name: 'Complete To-Do',
      }),
    ).toBeNull()
  })

  it('shows an honest API error without preview fallback', async () => {
    installTodoApi({ failInitial: true })
    renderTodos()

    expect(
      await screen.findByText('To-Dos are temporarily unavailable.'),
    ).toBeTruthy()
    expect(screen.queryByText('Order trimmer line')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy()
  })
})
