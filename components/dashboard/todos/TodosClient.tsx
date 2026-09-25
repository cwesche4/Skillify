'use client'

import React, {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Archive,
  CalendarDays,
  Check,
  Circle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { WorkItemExecutionDialog } from '@/components/dashboard/operations/WorkItemExecutionDialog'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SavedViewTabs } from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { Alert } from '@/components/ui/Alert'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import {
  archiveTodo,
  createTodo,
  JobsApiError,
  listTodos,
  updateTodo,
} from '@/lib/jobs/client'
import type {
  JobStepMutationInput,
  WorkItemClientRecord,
  WorkspaceMemberOption,
} from '@/lib/jobs/clientTypes'
import {
  getAllowedWorkItemStatuses,
  priorityLabels,
  workItemStatusLabels,
} from '@/lib/jobs/presentation'
import {
  filterTodos,
  matchesTodoSavedView,
  todoSavedViews,
  type TodoSavedView,
} from '@/lib/jobs/todoPresentation'
import {
  OperationsPriority,
  WorkItemStatus,
  type OperationsPriority as OperationsPriorityValue,
  type WorkItemStatus as WorkItemStatusValue,
} from '@/lib/prisma/enums'
import { cn } from '@/lib/utils'

const statusVariant: Record<WorkItemStatusValue, BadgeVariant> = {
  OPEN: 'blue',
  IN_PROGRESS: 'brand',
  COMPLETED: 'green',
  CANCELED: 'gray',
}

const priorityVariant: Record<OperationsPriorityValue, BadgeVariant> = {
  LOW: 'slate',
  NORMAL: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
}

const viewIds = new Set(todoSavedViews.map((view) => view.id))
const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function apiErrorMessage(error: unknown) {
  return error instanceof JobsApiError
    ? error.message.replace(/Work Item/gi, 'To-Do')
    : 'Something went wrong. Please try again.'
}

function requestedTodoView(value: string | null): TodoSavedView {
  if (value === 'due-or-overdue') return 'overdue'
  return value && viewIds.has(value as TodoSavedView)
    ? (value as TodoSavedView)
    : 'mine'
}

function memberName(members: WorkspaceMemberOption[], memberId: string | null) {
  if (!memberId) return 'Unassigned'
  return members.find((member) => member.id === memberId)?.name ?? 'Team member'
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function trapFocus(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !container) return
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function TodosClient({
  workspaceId,
  currentMemberId,
  members,
  canManage,
}: {
  workspaceId: string
  currentMemberId: string
  members: WorkspaceMemberOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view')
  const [activeView, setActiveView] = useState<TodoSavedView>(
    requestedTodoView(requestedView),
  )
  const [todos, setTodos] = useState<WorkItemClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTodo, setSelectedTodo] = useState<WorkItemClientRecord | null>(
    null,
  )
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listTodos(workspaceId)
      setTodos(
        records.filter(
          (record) => record.kind === 'TODO' && !record.archivedAt,
        ),
      )
    } catch (loadError) {
      setError(apiErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loading) return
    const requestedId = searchParams.get('todoId') ?? searchParams.get('taskId')
    if (!requestedId) return
    const match = todos.find((todo) => todo.id === requestedId)
    if (match) {
      setSelectedTodo(match)
    } else {
      setNotice('That To-Do is no longer available in this workspace.')
    }
  }, [loading, searchParams, todos])

  const filteredTodos = useMemo(
    () => filterTodos(todos, activeView, currentMemberId, search),
    [activeView, currentMemberId, search, todos],
  )

  const views = useMemo(
    () =>
      todoSavedViews.map((view) => ({
        ...view,
        count: todos.filter((todo) =>
          matchesTodoSavedView(todo, view.id, currentMemberId),
        ).length,
      })),
    [currentMemberId, todos],
  )

  const selectView = (view: string) => {
    const next = viewIds.has(view as TodoSavedView)
      ? (view as TodoSavedView)
      : 'mine'
    setActiveView(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const openTodo = (todo: WorkItemClientRecord) => {
    setSelectedTodo(todo)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('taskId')
    params.set('todoId', todo.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const closeTodo = () => {
    setSelectedTodo(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('todoId')
    params.delete('taskId')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const replaceTodo = (todo: WorkItemClientRecord) => {
    setTodos((current) =>
      current.map((candidate) => (candidate.id === todo.id ? todo : candidate)),
    )
    setSelectedTodo(todo)
  }

  return (
    <DashboardShell className="max-w-6xl">
      <div
        id="tasks-workspace"
        className="scroll-mt-28 space-y-6 overflow-x-hidden"
      >
        <PageHeader
          title="My To-Dos"
          description="Keep standalone responsibilities organized without mixing them into customer Jobs."
          actions={
            canManage ? (
              <Button
                type="button"
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setCreateOpen(true)}
              >
                Create To-Do
              </Button>
            ) : null
          }
        />

        {!canManage ? (
          <Alert variant="info">
            To-Do details are read-only. You can update status and notes on
            To-Dos assigned to you.
          </Alert>
        ) : null}

        {notice ? (
          <Alert variant="warning" role="status">
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => setNotice(null)}
              >
                Dismiss
              </button>
            </div>
          </Alert>
        ) : null}

        <SavedViewTabs
          views={views}
          activeViewId={activeView}
          onSelect={selectView}
        />

        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <Label htmlFor="todo-search" className="sr-only">
              Search To-Dos
            </Label>
            <div className="relative">
              <Search
                className="text-app-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="todo-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search To-Dos..."
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? <TodosLoadingState /> : null}

        {!loading && error ? (
          <div className="space-y-3" role="alert">
            <Alert variant="error">{error}</Alert>
            <Button
              type="button"
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void load()}
            >
              Try Again
            </Button>
          </div>
        ) : null}

        {!loading && !error && todos.length === 0 ? (
          <EmptyState
            title="No To-Dos yet"
            description="Use To-Dos for standalone responsibilities that are not steps inside a customer Job."
            actionLabel={canManage ? 'Create To-Do' : undefined}
            onAction={canManage ? () => setCreateOpen(true) : undefined}
          />
        ) : null}

        {!loading &&
        !error &&
        todos.length > 0 &&
        filteredTodos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-app-primary text-sm font-medium">
                No To-Dos match this view.
              </p>
              <p className="text-app-secondary mt-2 text-xs">
                Try another saved view or clear your search.
              </p>
              {search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearch('')}
                >
                  Clear Search
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && filteredTodos.length > 0 ? (
          <div className="grid gap-3" aria-label="To-Dos list">
            {filteredTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                members={members}
                onOpen={() => openTodo(todo)}
              />
            ))}
          </div>
        ) : null}

        {createOpen ? (
          <TodoFormDialog
            members={members}
            onClose={() => setCreateOpen(false)}
            onSubmit={async (input) => {
              const created = await createTodo(workspaceId, {
                ...input,
                title: input.title ?? '',
              })
              if (created.kind !== 'TODO') {
                throw new JobsApiError(
                  'The server returned an invalid To-Do record.',
                  500,
                )
              }
              setTodos((current) => [created, ...current])
              setCreateOpen(false)
              setNotice('To-Do created successfully.')
              openTodo(created)
            }}
          />
        ) : null}

        {selectedTodo ? (
          <TodoDetailDrawer
            key={selectedTodo.id}
            todo={selectedTodo}
            workspaceId={workspaceId}
            currentMemberId={currentMemberId}
            members={members}
            canManage={canManage}
            onClose={closeTodo}
            onUpdated={replaceTodo}
            onArchived={(todoId) => {
              setTodos((current) =>
                current.filter((todo) => todo.id !== todoId),
              )
              closeTodo()
              setNotice('To-Do archived. Its history has been preserved.')
            }}
          />
        ) : null}
      </div>
    </DashboardShell>
  )
}

function TodosLoadingState() {
  return (
    <div className="space-y-3" aria-label="Loading To-Dos" aria-busy="true">
      {[0, 1, 2].map((value) => (
        <Skeleton key={value} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function TodoCard({
  todo,
  members,
  onOpen,
}: {
  todo: WorkItemClientRecord
  members: WorkspaceMemberOption[]
  onOpen: () => void
}) {
  const completed = todo.status === WorkItemStatus.COMPLETED
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open To-Do ${todo.title}`}
      className="border-app bg-app-surface-raised hover:bg-app-surface-hover focus-visible:ring-brand-primary/60 w-full rounded-2xl border p-4 text-left shadow-[var(--shadow-card)] transition focus-visible:outline-none focus-visible:ring-2 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
            completed
              ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
              : 'border-app-strong text-app-muted',
          )}
        >
          {completed ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Circle className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                'text-app-primary break-words text-sm font-semibold sm:text-base',
                completed && 'text-app-secondary line-through',
              )}
            >
              {todo.title}
            </h2>
            <Badge variant={statusVariant[todo.status]}>
              {workItemStatusLabels[todo.status]}
            </Badge>
            {todo.priority !== OperationsPriority.NORMAL ? (
              <Badge variant={priorityVariant[todo.priority]}>
                {priorityLabels[todo.priority]}
              </Badge>
            ) : null}
          </div>
          <div className="text-app-muted mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDueDate(todo.dueAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              {memberName(members, todo.assigneeMemberId)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function TodoDetailDrawer({
  todo,
  workspaceId,
  currentMemberId,
  members,
  canManage,
  onClose,
  onUpdated,
  onArchived,
}: {
  todo: WorkItemClientRecord
  workspaceId: string
  currentMemberId: string
  members: WorkspaceMemberOption[]
  canManage: boolean
  onClose: () => void
  onUpdated: (todo: WorkItemClientRecord) => void
  onArchived: (todoId: string) => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [executionOpen, setExecutionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !editOpen &&
        !archiveOpen &&
        !executionOpen
      ) {
        onClose()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      previous?.focus?.()
    }
  }, [archiveOpen, editOpen, executionOpen, onClose])

  const canExecute = canManage || todo.assigneeMemberId === currentMemberId

  const mutate = async (input: JobStepMutationInput) => {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateTodo(workspaceId, todo.id, input)
      if (updated.kind !== 'TODO') {
        throw new JobsApiError(
          'The server returned an invalid To-Do record.',
          500,
        )
      }
      onUpdated(updated)
      return updated
    } catch (updateError) {
      setError(apiErrorMessage(updateError))
      throw updateError
    } finally {
      setBusy(false)
    }
  }

  const toggleCompletion = async () => {
    try {
      await mutate({
        status:
          todo.status === WorkItemStatus.COMPLETED
            ? WorkItemStatus.OPEN
            : todo.status === WorkItemStatus.CANCELED
              ? WorkItemStatus.OPEN
              : WorkItemStatus.COMPLETED,
      })
    } catch {
      // mutate exposes the server error without applying optimistic state.
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close To-Do details"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-detail-title"
        onKeyDown={(event) => trapFocus(event, panelRef.current)}
        className="border-app bg-app-surface relative z-10 flex h-full w-full max-w-2xl flex-col border-l shadow-2xl shadow-black/40"
      >
        <header className="border-app bg-app-surface/95 sticky top-0 border-b px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">
                To-Do details
              </p>
              <h2
                id="todo-detail-title"
                className="text-app-primary mt-1 break-words text-lg font-semibold"
              >
                {todo.title}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={statusVariant[todo.status]}>
                  {workItemStatusLabels[todo.status]}
                </Badge>
                <Badge variant={priorityVariant[todo.priority]}>
                  {priorityLabels[todo.priority]}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leftIcon={
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </Button>
              ) : null}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2"
                aria-label="Close To-Do details"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {error ? (
            <Alert variant="error" role="alert">
              {error}
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Due" value={formatDueDate(todo.dueAt)} />
            <DetailItem
              label="Assigned to"
              value={memberName(members, todo.assigneeMemberId)}
            />
            <DetailItem
              label="Priority"
              value={priorityLabels[todo.priority]}
            />
            <DetailItem
              label="Status"
              value={workItemStatusLabels[todo.status]}
            />
          </div>

          {(todo.description || todo.notes) && (
            <section className="border-app bg-app-surface-raised rounded-2xl border p-4">
              <h3 className="text-app-primary text-sm font-semibold">
                Details
              </h3>
              {todo.description ? (
                <p className="text-app-secondary mt-3 whitespace-pre-wrap text-sm leading-6">
                  {todo.description}
                </p>
              ) : null}
              {todo.notes ? (
                <div className="border-app mt-3 border-t pt-3">
                  <p className="text-app-muted text-[11px] font-semibold uppercase tracking-wide">
                    Notes
                  </p>
                  <p className="text-app-secondary mt-1 whitespace-pre-wrap text-sm leading-6">
                    {todo.notes}
                  </p>
                </div>
              ) : null}
            </section>
          )}

          {canExecute ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                loading={busy}
                onClick={() => void toggleCompletion()}
              >
                {todo.status === WorkItemStatus.COMPLETED ||
                todo.status === WorkItemStatus.CANCELED
                  ? 'Reopen To-Do'
                  : 'Complete To-Do'}
              </Button>
              {!canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setExecutionOpen(true)}
                >
                  Update Status &amp; Notes
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  leftIcon={
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                  onClick={() => setArchiveOpen(true)}
                >
                  Archive To-Do
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>

      {editOpen ? (
        <TodoFormDialog
          todo={todo}
          members={members}
          onClose={() => setEditOpen(false)}
          onSubmit={async (input) => {
            await mutate(input)
            setEditOpen(false)
          }}
        />
      ) : null}

      {executionOpen ? (
        <WorkItemExecutionDialog
          itemLabel="To-Do"
          title={todo.title}
          status={todo.status}
          notes={todo.notes}
          onClose={() => setExecutionOpen(false)}
          onSubmit={async (input) => {
            await mutate(input)
            setExecutionOpen(false)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this To-Do?"
        description="It will leave normal operational views while its history remains stored."
        confirmLabel="Archive To-Do"
        destructive
        onOpenChange={setArchiveOpen}
        onConfirm={async () => {
          try {
            await archiveTodo(workspaceId, todo.id)
            onArchived(todo.id)
          } catch (archiveError) {
            setArchiveOpen(false)
            setError(apiErrorMessage(archiveError))
          }
        }}
      />
    </div>
  )
}

function TodoFormDialog({
  todo,
  members,
  onClose,
  onSubmit,
}: {
  todo?: WorkItemClientRecord
  members: WorkspaceMemberOption[]
  onClose: () => void
  onSubmit: (input: JobStepMutationInput) => Promise<void>
}) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [title, setTitle] = useState(todo?.title ?? '')
  const [dueAt, setDueAt] = useState(toDateTimeInput(todo?.dueAt ?? null))
  const [assignee, setAssignee] = useState(todo?.assigneeMemberId ?? '')
  const [priority, setPriority] = useState<OperationsPriorityValue>(
    todo?.priority ?? OperationsPriority.NORMAL,
  )
  const [status, setStatus] = useState<WorkItemStatusValue>(
    todo?.status ?? WorkItemStatus.OPEN,
  )
  const [description, setDescription] = useState(todo?.description ?? '')
  const [notes, setNotes] = useState(todo?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => titleRef.current?.focus(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Enter a To-Do title.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        assigneeMemberId: assignee || null,
        priority,
        status,
        description: description.trim() || null,
        notes: notes.trim() || null,
      })
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const dialogTitle = todo ? 'Edit To-Do' : 'Create To-Do'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-form-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else {
            trapFocus(event, panelRef.current)
          }
        }}
        className="border-app bg-app-surface my-auto w-full max-w-xl rounded-2xl border shadow-2xl shadow-black/40"
      >
        <header className="border-app flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
          <div>
            <h2
              id="todo-form-title"
              className="text-app-primary text-base font-semibold"
            >
              {dialogTitle}
            </h2>
            <p className="text-app-secondary mt-1 text-xs leading-5">
              Keep this focused on one standalone responsibility.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover focus-visible:ring-brand-primary/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2"
            aria-label={`Close ${dialogTitle}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form
          onSubmit={submit}
          className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto p-4 sm:p-5"
        >
          {error ? (
            <Alert variant="error" role="alert">
              {error}
            </Alert>
          ) : null}
          <Field label="To-Do title" htmlFor="todo-title" required>
            <Input
              ref={titleRef}
              id="todo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Order replacement trimmer line"
              maxLength={200}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date" htmlFor="todo-due">
              <Input
                id="todo-due"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </Field>
            <Field label="Assignee" htmlFor="todo-assignee">
              <Select
                id="todo-assignee"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="todo-priority">
              <Select
                id="todo-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as OperationsPriorityValue)
                }
              >
                {Object.values(OperationsPriority).map((option) => (
                  <option key={option} value={option}>
                    {priorityLabels[option]}
                  </option>
                ))}
              </Select>
            </Field>
            {todo ? (
              <Field label="Status" htmlFor="todo-status">
                <Select
                  id="todo-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as WorkItemStatusValue)
                  }
                >
                  {getAllowedWorkItemStatuses(todo.status).map((option) => (
                    <option key={option} value={option}>
                      {workItemStatusLabels[option]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Description" htmlFor="todo-description" wide>
              <Textarea
                id="todo-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What needs to be done?"
                className="min-h-20"
              />
            </Field>
            <Field label="Notes" htmlFor="todo-notes" wide>
              <Textarea
                id="todo-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-16"
              />
            </Field>
          </div>
          <div className="border-app flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {todo ? 'Save To-Do' : 'Create To-Do'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  wide,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-app bg-app-surface-raised min-w-0 rounded-xl border p-3">
      <p className="text-app-muted text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-app-primary mt-1 break-words text-sm">{value}</p>
    </div>
  )
}
