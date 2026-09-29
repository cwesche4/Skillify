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
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Archive,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Play,
  AlertTriangle,
  Mail,
  MapPin,
  Phone,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
import { WorkItemExecutionDialog } from '@/components/dashboard/operations/WorkItemExecutionDialog'
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
  archiveJob,
  archiveJobStep,
  createJob,
  createJobStep,
  JobsApiError,
  listJobs,
  listJobSteps,
  runJobLifecycleAction,
  updateJob,
  updateJobStep,
} from '@/lib/jobs/client'
import type {
  JobClientRecord,
  JobMutationInput,
  JobStepMutationInput,
  WorkItemClientRecord,
  WorkspaceMemberOption,
  WorkspaceTeamOption,
} from '@/lib/jobs/clientTypes'
import {
  filterJobs,
  getAllowedJobStatuses,
  getAllowedWorkItemStatuses,
  jobSavedViews,
  jobStatusLabels,
  matchesJobSavedView,
  priorityLabels,
  workItemStatusLabels,
  type JobSavedView,
} from '@/lib/jobs/presentation'
import {
  JobStatus,
  OperationsPriority,
  WorkItemStatus,
  type JobStatus as JobStatusValue,
  type OperationsPriority as OperationsPriorityValue,
  type WorkItemStatus as WorkItemStatusValue,
} from '@/lib/prisma/enums'
import { formatRevenueCurrency } from '@/lib/revenue/money'
import { cn } from '@/lib/utils'
import { listCustomers as listDurableCustomers } from '@/lib/customers/client'
import type { CustomerClientRecord } from '@/lib/customers/clientTypes'

const jobStatusVariant: Record<JobStatusValue, BadgeVariant> = {
  OPEN: 'blue',
  SCHEDULED: 'purple',
  IN_PROGRESS: 'brand',
  WAITING_ON_CLIENT: 'yellow',
  UNABLE_TO_COMPLETE: 'orange',
  COMPLETED: 'green',
  CANCELED: 'gray',
}

const workItemStatusVariant: Record<WorkItemStatusValue, BadgeVariant> = {
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

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

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

function apiErrorMessage(error: unknown) {
  return error instanceof JobsApiError
    ? error.message
    : 'Something went wrong. Please try again.'
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function toDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIsoDate(value: string) {
  return value ? new Date(value).toISOString() : null
}

function memberName(members: WorkspaceMemberOption[], memberId: string | null) {
  if (!memberId) return 'Unassigned'
  return members.find((member) => member.id === memberId)?.name ?? 'Team member'
}

function jobAssignmentName(
  members: WorkspaceMemberOption[],
  job: JobClientRecord,
) {
  if (!job.assignments?.length) {
    return memberName(members, job.assigneeMemberId)
  }
  return job.assignments
    .map((assignment) =>
      assignment.assignmentType === 'MEMBER'
        ? memberName(members, assignment.workspaceMemberId)
        : assignment.displaySnapshot || 'Assigned team',
    )
    .join(', ')
}

const unableReasonLabels: Record<string, string> = {
  WEATHER: 'Weather',
  CUSTOMER_UNAVAILABLE: 'Customer unavailable',
  ACCESS_ISSUE: 'Access issue',
  EQUIPMENT: 'Equipment issue',
  RAN_OUT_OF_TIME: 'Ran out of time',
  OTHER: 'Other',
}

function unableReasonLabel(reason: string | null | undefined) {
  return reason ? (unableReasonLabels[reason] ?? reason) : 'Reason unavailable'
}

export function JobsClient({
  workspaceId,
  workspaceSlug,
  currentMemberId,
  members,
  teams,
  canManage,
  durableCustomersEnabled,
}: {
  workspaceId: string
  workspaceSlug: string
  currentMemberId: string
  members: WorkspaceMemberOption[]
  teams: WorkspaceTeamOption[]
  canManage: boolean
  durableCustomersEnabled: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view')
  const availableSavedViews = useMemo(
    () =>
      canManage
        ? jobSavedViews.filter((view) => view.id !== 'my-jobs')
        : jobSavedViews.filter((view) => view.id !== 'needs-attention'),
    [canManage],
  )
  const availableSavedViewIds = useMemo(
    () => new Set(availableSavedViews.map((view) => view.id)),
    [availableSavedViews],
  )
  const defaultView: JobSavedView = canManage ? 'open' : 'my-jobs'
  const requestedSavedView: JobSavedView =
    requestedView && availableSavedViewIds.has(requestedView as JobSavedView)
      ? (requestedView as JobSavedView)
      : defaultView
  const [activeView, setActiveView] = useState<JobSavedView>(requestedSavedView)
  const [jobs, setJobs] = useState<JobClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState<JobClientRecord | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerClientRecord[]>([])
  const [customersLoading, setCustomersLoading] = useState(
    canManage && durableCustomersEnabled,
  )
  const [customersError, setCustomersError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listJobs(workspaceId)
      setJobs(records)
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
    setActiveView(requestedSavedView)
  }, [requestedSavedView])

  const loadCustomers = useCallback(async () => {
    if (!canManage || !durableCustomersEnabled) return
    setCustomersLoading(true)
    setCustomersError(null)
    try {
      setCustomers(await listDurableCustomers(workspaceId))
    } catch (loadError) {
      setCustomersError(apiErrorMessage(loadError))
    } finally {
      setCustomersLoading(false)
    }
  }, [canManage, durableCustomersEnabled, workspaceId])

  useEffect(() => {
    if (canManage && durableCustomersEnabled) void loadCustomers()
  }, [canManage, durableCustomersEnabled, loadCustomers])

  useEffect(() => {
    if (loading) return
    const requestedJobId =
      searchParams.get('jobId') ?? searchParams.get('requestId')
    if (!requestedJobId) return
    const match = jobs.find((job) => job.id === requestedJobId)
    if (match) {
      setSelectedJob(match)
      return
    }
    setNotice('That Job is no longer available in this workspace.')
  }, [jobs, loading, searchParams])

  const filteredJobs = useMemo(
    () => filterJobs(jobs, activeView, search),
    [activeView, jobs, search],
  )

  const savedViews = useMemo(
    () =>
      availableSavedViews.map((view) => ({
        ...view,
        count: jobs.filter(
          (job) => !job.archivedAt && matchesJobSavedView(job, view.id),
        ).length,
      })),
    [availableSavedViews, jobs],
  )

  const selectView = (view: string) => {
    const next = availableSavedViewIds.has(view as JobSavedView)
      ? (view as JobSavedView)
      : defaultView
    setActiveView(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const openJob = (job: JobClientRecord) => {
    setSelectedJob(job)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('requestId')
    params.set('jobId', job.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const closeJob = () => {
    setSelectedJob(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('jobId')
    params.delete('requestId')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const replaceJob = (job: JobClientRecord) => {
    setJobs((current) =>
      current.map((candidate) => (candidate.id === job.id ? job : candidate)),
    )
    setSelectedJob(job)
  }

  return (
    <div id="request-queue" className="scroll-mt-28 space-y-6">
      <PageHeader
        title="Jobs"
        description="Keep customer work, schedules, and the steps your team needs to finish in one place."
        actions={
          canManage ? (
            <Button
              type="button"
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setCreateOpen(true)}
            >
              Create Job
            </Button>
          ) : null
        }
      />

      {!canManage ? (
        <Alert variant="info">
          Open an assigned Job to start work, update Job Steps, add notes, or
          report an issue. Management controls stay hidden.
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
        views={savedViews}
        activeViewId={activeView}
        onSelect={selectView}
      />

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <Label htmlFor="job-search" className="sr-only">
            Search Jobs
          </Label>
          <div className="relative">
            <Search
              className="text-app-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="job-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Jobs or customer names..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? <JobsLoadingState /> : null}

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

      {!loading && !error && jobs.length === 0 ? (
        <EmptyState
          title="No Jobs yet"
          description="Jobs keep the work you're doing for customers organized in one place. Create your first Job when work is ready to schedule or assign."
          actionLabel={canManage ? 'Create Job' : undefined}
          onAction={canManage ? () => setCreateOpen(true) : undefined}
        />
      ) : null}

      {!loading && !error && jobs.length > 0 && filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-app-primary text-sm font-medium">
              No Jobs match this view.
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

      {!loading && !error && filteredJobs.length > 0 ? (
        <div className="grid gap-3" aria-label="Jobs list">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              members={members}
              onOpen={() => openJob(job)}
            />
          ))}
        </div>
      ) : null}

      {createOpen ? (
        <JobFormDialog
          members={members}
          teams={teams}
          customers={customers}
          durableCustomersEnabled={durableCustomersEnabled}
          customersLoading={customersLoading}
          customersError={customersError}
          onRetryCustomers={loadCustomers}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            const created = await createJob(workspaceId, {
              ...input,
              title: input.title ?? '',
            })
            setJobs((current) => [created, ...current])
            setCreateOpen(false)
            setNotice('Job created successfully.')
            openJob(created)
          }}
        />
      ) : null}

      {selectedJob ? (
        <JobDetailDrawer
          key={selectedJob.id}
          job={selectedJob}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          currentMemberId={currentMemberId}
          members={members}
          teams={teams}
          customers={customers}
          durableCustomersEnabled={durableCustomersEnabled}
          customersLoading={customersLoading}
          customersError={customersError}
          onRetryCustomers={loadCustomers}
          canManage={canManage}
          onClose={closeJob}
          onUpdated={replaceJob}
          onRefresh={load}
          onArchived={(jobId) => {
            setJobs((current) => current.filter((job) => job.id !== jobId))
            closeJob()
            setNotice('Job archived. Its history has been preserved.')
          }}
        />
      ) : null}
    </div>
  )
}

function JobsLoadingState() {
  return (
    <div className="space-y-3" aria-label="Loading Jobs" aria-busy="true">
      {[0, 1, 2].map((value) => (
        <Skeleton key={value} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function JobCard({
  job,
  members,
  onOpen,
}: {
  job: JobClientRecord
  members: WorkspaceMemberOption[]
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-app bg-app-surface-raised hover:bg-app-surface-hover focus-visible:ring-brand-primary/60 group w-full rounded-2xl border p-4 text-left shadow-[var(--shadow-card)] transition focus-visible:outline-none focus-visible:ring-2 sm:p-5"
      aria-label={`Open Job ${job.title}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-app-primary truncate text-sm font-semibold sm:text-base">
              {job.title}
            </h2>
            <Badge variant={jobStatusVariant[job.status]}>
              {jobStatusLabels[job.status]}
            </Badge>
            {job.priority !== OperationsPriority.NORMAL ? (
              <Badge variant={priorityVariant[job.priority]}>
                {priorityLabels[job.priority]}
              </Badge>
            ) : null}
          </div>
          <p className="text-app-secondary mt-2 truncate text-sm">
            {job.customerDisplayName || 'No customer name'}
          </p>
          <div className="text-app-muted mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDateTime(job.scheduledStartAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              {jobAssignmentName(members, job)}
            </span>
            {job.valueCents !== null ? (
              <span>{formatRevenueCurrency(job.valueCents, job.currency)}</span>
            ) : null}
          </div>
        </div>
        <ChevronRight
          className="text-app-muted mt-1 h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-brand-primary"
          aria-hidden="true"
        />
      </div>
    </button>
  )
}

function JobDetailDrawer({
  job,
  workspaceId,
  workspaceSlug,
  currentMemberId,
  members,
  teams,
  customers,
  durableCustomersEnabled,
  customersLoading,
  customersError,
  onRetryCustomers,
  canManage,
  onClose,
  onUpdated,
  onRefresh,
  onArchived,
}: {
  job: JobClientRecord
  workspaceId: string
  workspaceSlug: string
  currentMemberId: string
  members: WorkspaceMemberOption[]
  teams: WorkspaceTeamOption[]
  customers: CustomerClientRecord[]
  durableCustomersEnabled: boolean
  customersLoading: boolean
  customersError: string | null
  onRetryCustomers: () => Promise<void>
  canManage: boolean
  onClose: () => void
  onUpdated: (job: JobClientRecord) => void
  onRefresh: () => Promise<void>
  onArchived: (jobId: string) => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [steps, setSteps] = useState<WorkItemClientRecord[]>([])
  const [stepsLoading, setStepsLoading] = useState(true)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [stepForm, setStepForm] = useState<WorkItemClientRecord | 'new' | null>(
    null,
  )
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [stepToArchive, setStepToArchive] =
    useState<WorkItemClientRecord | null>(null)
  const [stepToExecute, setStepToExecute] =
    useState<WorkItemClientRecord | null>(null)
  const [unableOpen, setUnableOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [fieldNotes, setFieldNotes] = useState(job.notes ?? '')

  const loadSteps = useCallback(async () => {
    setStepsLoading(true)
    setStepsError(null)
    try {
      const loaded = await listJobSteps(workspaceId, job.id)
      setSteps(
        [...loaded].sort(
          (left, right) =>
            (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
              (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
            left.id.localeCompare(right.id),
        ),
      )
    } catch (loadError) {
      setStepsError(apiErrorMessage(loadError))
    } finally {
      setStepsLoading(false)
    }
  }, [job.id, workspaceId])

  useEffect(() => {
    void loadSteps()
  }, [loadSteps])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !editOpen && !stepForm && !stepToExecute) {
        onClose()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      previous?.focus?.()
    }
  }, [editOpen, onClose, stepForm, stepToExecute])

  const mutateJob = async (input: JobMutationInput) => {
    setBusy(true)
    setMutationError(null)
    try {
      const updated = await updateJob(workspaceId, job.id, input)
      onUpdated(updated)
      return updated
    } catch (updateError) {
      setMutationError(apiErrorMessage(updateError))
      throw updateError
    } finally {
      setBusy(false)
    }
  }

  const toggleJobCompletion = async () => {
    try {
      await mutateJob({
        status:
          job.status === JobStatus.COMPLETED
            ? JobStatus.IN_PROGRESS
            : job.status === JobStatus.CANCELED
              ? JobStatus.OPEN
              : JobStatus.COMPLETED,
      })
    } catch {
      // The visible error is set by mutateJob; no optimistic state is applied.
    }
  }

  const toggleStepCompletion = async (step: WorkItemClientRecord) => {
    setMutationError(null)
    try {
      const updated = await updateJobStep(workspaceId, step.id, {
        status:
          step.status === WorkItemStatus.COMPLETED
            ? WorkItemStatus.OPEN
            : WorkItemStatus.COMPLETED,
      })
      setSteps((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      )
    } catch (updateError) {
      setMutationError(apiErrorMessage(updateError))
    }
  }

  const runLifecycle = async (
    action:
      | 'start'
      | 'complete'
      | 'update'
      | 'unable-to-complete'
      | 'skip'
      | 'reschedule',
    input: Record<string, unknown> = {},
  ) => {
    setBusy(true)
    setMutationError(null)
    try {
      const updated = await runJobLifecycleAction(
        workspaceId,
        job.id,
        action,
        input,
      )
      onUpdated({
        ...updated,
        canCurrentMemberExecute:
          updated.status === JobStatus.UNABLE_TO_COMPLETE
            ? false
            : job.canCurrentMemberExecute,
      })
      setFieldNotes(updated.notes ?? '')
      return updated
    } catch (lifecycleError) {
      setMutationError(apiErrorMessage(lifecycleError))
      if (
        lifecycleError instanceof JobsApiError &&
        lifecycleError.status === 409
      ) {
        await onRefresh()
      }
      throw lifecycleError
    } finally {
      setBusy(false)
    }
  }

  const canExecuteJob = canManage || Boolean(job.canCurrentMemberExecute)
  const isFinal =
    job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELED

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close Job details"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
        onKeyDown={(event) => trapFocus(event, panelRef.current)}
        className="border-app bg-app-surface relative z-10 flex h-full w-full max-w-3xl flex-col border-l shadow-2xl shadow-black/40"
      >
        <header className="border-app bg-app-surface/95 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">
                Job details
              </p>
              <h2
                id="job-detail-title"
                className="text-app-primary mt-1 break-words text-lg font-semibold"
              >
                {job.title}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={jobStatusVariant[job.status]}>
                  {jobStatusLabels[job.status]}
                </Badge>
                <Badge variant={priorityVariant[job.priority]}>
                  {priorityLabels[job.priority]}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {canManage && !job.recurringServiceId ? (
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
                className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary focus-visible:ring-brand-primary/70 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2"
                aria-label="Close Job details"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {mutationError ? (
            <Alert variant="error" role="alert">
              {mutationError}
            </Alert>
          ) : null}

          <section aria-labelledby="job-overview-heading">
            <h3
              id="job-overview-heading"
              className="text-app-primary text-sm font-semibold"
            >
              Overview
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label="Customer"
                value={job.customerDisplayName || 'No customer name'}
              />
              <DetailItem
                label="Scheduled"
                value={formatDateTime(job.scheduledStartAt)}
              />
              <DetailItem
                label="Assigned to"
                value={jobAssignmentName(members, job)}
              />
              <DetailItem
                label="Value"
                value={
                  job.valueCents === null
                    ? 'No value set'
                    : formatRevenueCurrency(job.valueCents, job.currency)
                }
              />
              <DetailItem
                label="Priority"
                value={priorityLabels[job.priority]}
              />
              <DetailItem label="Status" value={jobStatusLabels[job.status]} />
            </div>
          </section>

          {(job.serviceLocationSnapshot ||
            job.customerContactNameSnapshot ||
            job.customerPhoneSnapshot ||
            job.customerEmailSnapshot) && (
            <section
              className="border-brand-primary/25 bg-brand-primary/[0.06] rounded-2xl border p-4"
              aria-labelledby="job-field-context-heading"
            >
              <h3
                id="job-field-context-heading"
                className="text-app-primary text-sm font-semibold"
              >
                Service location & contact
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {job.serviceLocationSnapshot ? (
                  <div className="flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                      aria-hidden="true"
                    />
                    <p className="text-app-secondary whitespace-pre-wrap text-sm">
                      {job.serviceLocationSnapshot}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {job.customerContactNameSnapshot ? (
                    <p className="text-app-secondary text-sm">
                      {job.customerContactNameSnapshot}
                    </p>
                  ) : null}
                  {job.customerPhoneSnapshot ? (
                    <a
                      href={`tel:${job.customerPhoneSnapshot}`}
                      className="text-app-secondary flex items-center gap-2 text-sm hover:text-brand-primary"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      {job.customerPhoneSnapshot}
                    </a>
                  ) : null}
                  {job.customerEmailSnapshot ? (
                    <a
                      href={`mailto:${job.customerEmailSnapshot}`}
                      className="text-app-secondary flex items-center gap-2 break-all text-sm hover:text-brand-primary"
                    >
                      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {job.customerEmailSnapshot}
                    </a>
                  ) : null}
                </div>
              </div>
            </section>
          )}

          {canManage &&
          (job.customerId ||
            job.recurringServiceId ||
            job.schedulingEventId) ? (
            <section aria-labelledby="job-related-records-heading">
              <h3
                id="job-related-records-heading"
                className="text-app-primary text-sm font-semibold"
              >
                Related records
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.customerId ? (
                  <Link
                    href={`/dashboard/${workspaceSlug}/clients?customerId=${encodeURIComponent(job.customerId)}`}
                    className="border-app text-app-primary hover:bg-app-surface-hover inline-flex h-8 items-center rounded-xl border px-3 text-xs font-medium"
                  >
                    Open Customer
                  </Link>
                ) : null}
                {job.recurringServiceId ? (
                  <Link
                    href={`/dashboard/${workspaceSlug}/scheduling/recurring-services`}
                    className="border-app text-app-primary hover:bg-app-surface-hover inline-flex h-8 items-center rounded-xl border px-3 text-xs font-medium"
                  >
                    Open Recurring Services
                  </Link>
                ) : null}
                {job.schedulingEventId ? (
                  <Link
                    href={`/dashboard/${workspaceSlug}/scheduling/jobs`}
                    className="border-app text-app-primary hover:bg-app-surface-hover inline-flex h-8 items-center rounded-xl border px-3 text-xs font-medium"
                  >
                    Open Scheduling
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {job.recurringServiceId ? (
            <Alert variant="info">
              Recurring Service visit. Schedule changes and skips are managed
              through the linked Scheduling occurrence.
            </Alert>
          ) : null}

          {job.serviceInstructionsSnapshot ? (
            <section
              className="border-brand-primary/25 bg-brand-primary/[0.06] rounded-2xl border p-4"
              aria-labelledby="service-instructions-heading"
            >
              <h3
                id="service-instructions-heading"
                className="text-app-primary text-sm font-semibold"
              >
                Service Instructions
              </h3>
              <p className="text-app-secondary mt-2 whitespace-pre-wrap text-sm leading-6">
                {job.serviceInstructionsSnapshot}
              </p>
            </section>
          ) : null}

          {(job.description || job.notes) && (
            <section
              className="border-app bg-app-surface-raised rounded-2xl border p-4"
              aria-labelledby="job-notes-heading"
            >
              <h3
                id="job-notes-heading"
                className="text-app-primary text-sm font-semibold"
              >
                Details
              </h3>
              {job.description ? (
                <p className="text-app-secondary mt-3 whitespace-pre-wrap text-sm leading-6">
                  {job.description}
                </p>
              ) : null}
              {job.notes ? (
                <div className="border-app mt-3 border-t pt-3">
                  <p className="text-app-muted text-[11px] font-semibold uppercase tracking-wide">
                    Job Notes
                  </p>
                  <p className="text-app-secondary mt-1 whitespace-pre-wrap text-sm leading-6">
                    {job.notes}
                  </p>
                </div>
              ) : null}
            </section>
          )}

          {job.unableToCompleteAt ? (
            <Alert variant="warning">
              <div className="space-y-1">
                <p className="font-medium">
                  {job.status === JobStatus.UNABLE_TO_COMPLETE
                    ? 'Unable to Complete'
                    : 'Previously Unable to Complete'}
                </p>
                <p>{unableReasonLabel(job.unableToCompleteReason)}</p>
                {job.unableToCompleteNote ? (
                  <p>{job.unableToCompleteNote}</p>
                ) : null}
                <p className="text-xs opacity-80">
                  Reported{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(job.unableToCompleteAt))}
                  {job.unableToCompleteReportedByMemberId
                    ? ` by ${memberName(
                        members,
                        job.unableToCompleteReportedByMemberId,
                      )}`
                    : ''}
                  .
                </p>
                {job.status === JobStatus.UNABLE_TO_COMPLETE && !canManage ? (
                  <p>
                    Management action is required to reschedule or skip this
                    visit.
                  </p>
                ) : null}
              </div>
            </Alert>
          ) : null}

          {canExecuteJob &&
          !isFinal &&
          job.status !== JobStatus.UNABLE_TO_COMPLETE ? (
            <section
              className="border-app bg-app-surface-raised space-y-3 rounded-2xl border p-4"
              aria-label="Field execution controls"
            >
              <div className="flex flex-wrap gap-2">
                {job.status === JobStatus.SCHEDULED ||
                job.status === JobStatus.OPEN ? (
                  <Button
                    type="button"
                    loading={busy}
                    leftIcon={<Play className="h-4 w-4" />}
                    onClick={() => void runLifecycle('start')}
                  >
                    Start Job
                  </Button>
                ) : null}
                {job.status === JobStatus.IN_PROGRESS ? (
                  <>
                    <Button
                      type="button"
                      loading={busy}
                      onClick={() => void runLifecycle('complete')}
                    >
                      Complete Job
                    </Button>
                    {job.recurringServiceId ? (
                      <Button
                        type="button"
                        variant="outline"
                        leftIcon={<AlertTriangle className="h-4 w-4" />}
                        onClick={() => setUnableOpen(true)}
                      >
                        Unable to Complete
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              {job.status === JobStatus.IN_PROGRESS ? (
                <div>
                  <Label htmlFor={`job-notes-${job.id}`}>Job Notes</Label>
                  <Textarea
                    id={`job-notes-${job.id}`}
                    className="mt-1"
                    value={fieldNotes}
                    onChange={(event) => setFieldNotes(event.target.value)}
                    placeholder="Add an operational note from the field"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    loading={busy}
                    onClick={() =>
                      void runLifecycle('update', {
                        notes: fieldNotes.trim() || null,
                      })
                    }
                  >
                    Save Notes
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {job.recurringServiceId && !isFinal ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSkipOpen(true)}
                >
                  Skip Visit
                </Button>
              ) : null}
              {job.recurringServiceId &&
              job.status === JobStatus.UNABLE_TO_COMPLETE ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRescheduleOpen(true)}
                >
                  Reschedule
                </Button>
              ) : null}
              {!job.recurringServiceId ? (
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  onClick={() => void toggleJobCompletion()}
                >
                  {job.status === JobStatus.COMPLETED ||
                  job.status === JobStatus.CANCELED
                    ? 'Reopen Job'
                    : 'Mark Job Complete'}
                </Button>
              ) : null}
              {!job.recurringServiceId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  leftIcon={
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                  onClick={() => setArchiveOpen(true)}
                >
                  Archive Job
                </Button>
              ) : null}
            </div>
          ) : null}

          <section aria-labelledby="job-steps-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  id="job-steps-heading"
                  className="text-app-primary text-sm font-semibold"
                >
                  Job Steps
                </h3>
                <p className="text-app-secondary mt-1 text-xs">
                  The work required to finish this Job.
                </p>
              </div>
              {canManage && !(job.recurringServiceId && isFinal) ? (
                <Button
                  type="button"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => setStepForm('new')}
                >
                  Add Job Step
                </Button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {stepsLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : null}
              {!stepsLoading && stepsError ? (
                <div className="space-y-2">
                  <Alert variant="error">{stepsError}</Alert>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadSteps()}
                  >
                    Retry Job Steps
                  </Button>
                </div>
              ) : null}
              {!stepsLoading && !stepsError && steps.length === 0 ? (
                <div className="border-app bg-app-surface-raised rounded-2xl border border-dashed p-6 text-center">
                  <ClipboardList
                    className="mx-auto h-7 w-7 text-brand-primary"
                    aria-hidden="true"
                  />
                  <p className="text-app-primary mt-3 text-sm font-medium">
                    No Job Steps yet
                  </p>
                  <p className="text-app-secondary mt-1 text-xs">
                    {canManage
                      ? 'Add the first step your team needs to complete.'
                      : 'No steps have been added to this Job.'}
                  </p>
                </div>
              ) : null}
              {!stepsLoading && !stepsError
                ? steps.map((step) => (
                    <JobStepRow
                      key={step.id}
                      step={step}
                      members={members}
                      canManage={
                        canManage && !(job.recurringServiceId && isFinal)
                      }
                      canExecute={
                        !isFinal &&
                        job.status !== JobStatus.UNABLE_TO_COMPLETE &&
                        (canManage ||
                          Boolean(job.canCurrentMemberExecute) ||
                          step.assigneeMemberId === currentMemberId)
                      }
                      onToggle={() => void toggleStepCompletion(step)}
                      onExecute={() => setStepToExecute(step)}
                      onEdit={() => setStepForm(step)}
                      onArchive={() => setStepToArchive(step)}
                    />
                  ))
                : null}
            </div>
          </section>
        </div>
      </aside>

      {editOpen ? (
        <JobFormDialog
          job={job}
          members={members}
          teams={teams}
          customers={customers}
          durableCustomersEnabled={durableCustomersEnabled}
          customersLoading={customersLoading}
          customersError={customersError}
          onRetryCustomers={onRetryCustomers}
          onClose={() => setEditOpen(false)}
          onSubmit={async (input) => {
            await mutateJob(input)
            setEditOpen(false)
          }}
        />
      ) : null}

      {stepForm ? (
        <JobStepFormDialog
          step={stepForm === 'new' ? undefined : stepForm}
          members={members}
          onClose={() => setStepForm(null)}
          onSubmit={async (input) => {
            const saved =
              stepForm === 'new'
                ? await createJobStep(workspaceId, job.id, {
                    ...input,
                    title: input.title ?? '',
                  })
                : await updateJobStep(workspaceId, stepForm.id, input)
            setSteps((current) =>
              stepForm === 'new'
                ? [...current, saved]
                : current.map((candidate) =>
                    candidate.id === saved.id ? saved : candidate,
                  ),
            )
            setStepForm(null)
          }}
        />
      ) : null}

      {stepToExecute ? (
        <WorkItemExecutionDialog
          itemLabel="Job Step"
          title={stepToExecute.title}
          status={stepToExecute.status}
          notes={stepToExecute.notes}
          onClose={() => setStepToExecute(null)}
          onSubmit={async (input) => {
            setMutationError(null)
            try {
              const saved = await updateJobStep(
                workspaceId,
                stepToExecute.id,
                input,
              )
              setSteps((current) =>
                current.map((candidate) =>
                  candidate.id === saved.id ? saved : candidate,
                ),
              )
              setStepToExecute(null)
            } catch (updateError) {
              setMutationError(apiErrorMessage(updateError))
              throw updateError
            }
          }}
        />
      ) : null}

      {unableOpen ? (
        <JobLifecycleDialog
          title="Report Unable to Complete"
          submitLabel="Report Unable to Complete"
          onClose={() => setUnableOpen(false)}
          onSubmit={async ({ reason, note }) => {
            await runLifecycle('unable-to-complete', { reason, note })
            setUnableOpen(false)
          }}
          reasons={Object.entries(unableReasonLabels)}
        />
      ) : null}

      {skipOpen ? (
        <JobLifecycleDialog
          title="Skip this visit"
          description="This affects only this visit, not the entire Recurring Service."
          submitLabel="Skip Visit"
          destructive
          onClose={() => setSkipOpen(false)}
          onSubmit={async ({ reason, note }) => {
            await runLifecycle('skip', { reason, note })
            setSkipOpen(false)
          }}
          reasons={[
            ['CUSTOMER_REQUEST', 'Customer request'],
            ['WEATHER', 'Weather'],
            ['ACCESS_ISSUE', 'Access issue'],
            ['STAFFING', 'Staffing'],
            ['EQUIPMENT', 'Equipment'],
            ['HOLIDAY', 'Holiday'],
            ['OTHER', 'Other'],
          ]}
        />
      ) : null}

      {rescheduleOpen ? (
        <RescheduleJobDialog
          job={job}
          onClose={() => setRescheduleOpen(false)}
          onSubmit={async (startsAt, endsAt) => {
            await runLifecycle('reschedule', { startsAt, endsAt })
            setRescheduleOpen(false)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this Job?"
        description="The Job and its Job Steps will leave normal operational views, but their history will be preserved."
        confirmLabel="Archive Job"
        destructive
        onOpenChange={setArchiveOpen}
        onConfirm={async () => {
          try {
            await archiveJob(workspaceId, job.id)
            onArchived(job.id)
          } catch (archiveError) {
            setArchiveOpen(false)
            setMutationError(apiErrorMessage(archiveError))
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(stepToArchive)}
        title="Archive this Job Step?"
        description="The step will be removed from this Job's active details while its history remains stored."
        confirmLabel="Archive Job Step"
        destructive
        onOpenChange={(open) => {
          if (!open) setStepToArchive(null)
        }}
        onConfirm={async () => {
          if (!stepToArchive) return
          try {
            await archiveJobStep(workspaceId, stepToArchive.id)
            setSteps((current) =>
              current.filter((step) => step.id !== stepToArchive.id),
            )
            setStepToArchive(null)
          } catch (archiveError) {
            setStepToArchive(null)
            setMutationError(apiErrorMessage(archiveError))
          }
        }}
      />
    </div>
  )
}

function JobLifecycleDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  reasons,
  onClose,
  onSubmit,
}: {
  title: string
  description?: string
  submitLabel: string
  destructive?: boolean
  reasons: Array<[string, string]>
  onClose: () => void
  onSubmit: (input: { reason: string; note: string | null }) => Promise<void>
}) {
  const [reason, setReason] = useState(reasons[0]?.[0] ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-lifecycle-dialog-title"
        className="border-app bg-app-surface-raised w-full max-w-md rounded-2xl border p-5 shadow-2xl"
      >
        <h3
          id="job-lifecycle-dialog-title"
          className="text-app-primary text-lg font-semibold"
        >
          {title}
        </h3>
        {description ? (
          <p className="text-app-secondary mt-1 text-sm">{description}</p>
        ) : null}
        {error ? (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        ) : null}
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await onSubmit({ reason, note: note.trim() || null })
            } catch (submitError) {
              setError(apiErrorMessage(submitError))
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <Label htmlFor="job-lifecycle-reason">Reason</Label>
            <Select
              id="job-lifecycle-reason"
              className="mt-1"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="job-lifecycle-note">Notes</Label>
            <Textarea
              id="job-lifecycle-note"
              className="mt-1"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context for management"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function RescheduleJobDialog({
  job,
  onClose,
  onSubmit,
}: {
  job: JobClientRecord
  onClose: () => void
  onSubmit: (startsAt: string, endsAt: string) => Promise<void>
}) {
  const [startsAt, setStartsAt] = useState(
    toDateTimeInput(job.scheduledStartAt),
  )
  const [endsAt, setEndsAt] = useState(toDateTimeInput(job.scheduledEndAt))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-job-title"
        className="border-app bg-app-surface-raised w-full max-w-md rounded-2xl border p-5 shadow-2xl"
      >
        <h3
          id="reschedule-job-title"
          className="text-app-primary text-lg font-semibold"
        >
          Reschedule this visit
        </h3>
        <p className="text-app-secondary mt-1 text-sm">
          This changes only this Job through Scheduling.
        </p>
        {error ? (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        ) : null}
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError(null)
            try {
              const start = toIsoDate(startsAt)
              const end = toIsoDate(endsAt)
              if (!start || !end)
                throw new Error('Choose a valid start and end time.')
              await onSubmit(start, end)
            } catch (submitError) {
              setError(apiErrorMessage(submitError))
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <Label htmlFor="reschedule-job-start">Starts</Label>
            <Input
              id="reschedule-job-start"
              type="datetime-local"
              className="mt-1"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="reschedule-job-end">Ends</Label>
            <Input
              id="reschedule-job-end"
              type="datetime-local"
              className="mt-1"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Reschedule
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function JobStepRow({
  step,
  members,
  canManage,
  canExecute,
  onToggle,
  onExecute,
  onEdit,
  onArchive,
}: {
  step: WorkItemClientRecord
  members: WorkspaceMemberOption[]
  canManage: boolean
  canExecute: boolean
  onToggle: () => void
  onExecute: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  const completed = step.status === WorkItemStatus.COMPLETED
  return (
    <div
      className={cn(
        'border-app rounded-2xl border p-3 sm:p-4',
        completed ? 'bg-emerald-500/[0.04]' : 'bg-app-surface-raised',
      )}
    >
      <div className="flex items-start gap-3">
        {canExecute ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              completed ? `Reopen ${step.title}` : `Complete ${step.title}`
            }
            className={cn(
              'focus-visible:ring-brand-primary/60 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2',
              completed
                ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                : 'border-app-strong text-app-muted hover:border-brand-primary/50 hover:text-brand-primary',
            )}
          >
            {completed ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'text-app-primary break-words text-sm font-medium',
                completed && 'text-app-secondary line-through',
              )}
            >
              {step.title}
            </p>
            <Badge variant={workItemStatusVariant[step.status]} size="xs">
              {workItemStatusLabels[step.status]}
            </Badge>
            {step.priority === OperationsPriority.URGENT ||
            step.priority === OperationsPriority.HIGH ? (
              <Badge variant={priorityVariant[step.priority]} size="xs">
                {priorityLabels[step.priority]}
              </Badge>
            ) : null}
          </div>
          <div className="text-app-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{memberName(members, step.assigneeMemberId)}</span>
            <span>{formatDueDate(step.dueAt)}</span>
          </div>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="text-app-secondary hover:bg-app-surface-hover focus-visible:ring-brand-primary/60 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2"
              aria-label={`Edit ${step.title}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onArchive}
              className="text-app-secondary rounded-lg p-2 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
              aria-label={`Archive ${step.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : canExecute ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onExecute}
            aria-label={`Update status and notes for ${step.title}`}
          >
            Update
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function JobFormDialog({
  job,
  members,
  teams,
  customers,
  durableCustomersEnabled,
  customersLoading,
  customersError,
  onRetryCustomers,
  onClose,
  onSubmit,
}: {
  job?: JobClientRecord
  members: WorkspaceMemberOption[]
  teams: WorkspaceTeamOption[]
  customers: CustomerClientRecord[]
  durableCustomersEnabled: boolean
  customersLoading: boolean
  customersError: string | null
  onRetryCustomers: () => Promise<void>
  onClose: () => void
  onSubmit: (input: JobMutationInput) => Promise<void>
}) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState(job?.title ?? '')
  const [customerId, setCustomerId] = useState(job?.customerId ?? '')
  const [legacyCustomerName, setLegacyCustomerName] = useState(
    job?.customerDisplayName ?? '',
  )
  const [scheduledStart, setScheduledStart] = useState(
    toDateTimeInput(job?.scheduledStartAt ?? null),
  )
  const [scheduledEnd, setScheduledEnd] = useState(
    toDateTimeInput(job?.scheduledEndAt ?? null),
  )
  const [value, setValue] = useState(
    job?.valueCents === null || job?.valueCents === undefined
      ? ''
      : String(job.valueCents / 100),
  )
  const [status, setStatus] = useState<JobStatusValue>(
    job?.status ?? JobStatus.OPEN,
  )
  const [priority, setPriority] = useState<OperationsPriorityValue>(
    job?.priority ?? OperationsPriority.NORMAL,
  )
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>(() => {
    const normalized = job?.assignments?.flatMap((assignment) =>
      assignment.assignmentType === 'MEMBER' && assignment.workspaceMemberId
        ? [assignment.workspaceMemberId]
        : [],
    )
    return normalized?.length
      ? normalized
      : job?.assigneeMemberId
        ? [job.assigneeMemberId]
        : []
  })
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>(
    () =>
      job?.assignments?.flatMap((assignment) =>
        assignment.assignmentType === 'TEAM' && assignment.teamId
          ? [assignment.teamId]
          : [],
      ) ?? [],
  )
  const [description, setDescription] = useState(job?.description ?? '')
  const [notes, setNotes] = useState(job?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => titleRef.current?.focus(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Enter a Job title.')
      return
    }
    if (
      scheduledStart &&
      scheduledEnd &&
      new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()
    ) {
      setError('Scheduled end must be after scheduled start.')
      return
    }
    const parsedValue = value.trim() ? Number(value) : null
    if (
      parsedValue !== null &&
      (!Number.isFinite(parsedValue) || parsedValue < 0)
    ) {
      setError('Enter a valid Job value.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const input: JobMutationInput = {
        title: title.trim(),
        scheduledStartAt: toIsoDate(scheduledStart),
        scheduledEndAt: toIsoDate(scheduledEnd),
        valueCents: parsedValue === null ? null : Math.round(parsedValue * 100),
        currency: 'USD',
        status,
        priority,
        assignments: [
          ...assignedMemberIds.map((workspaceMemberId) => ({
            assignmentType: 'MEMBER' as const,
            workspaceMemberId,
          })),
          ...assignedTeamIds.map((teamId) => ({
            assignmentType: 'TEAM' as const,
            teamId,
          })),
        ],
        description: description.trim() || null,
        notes: notes.trim() || null,
      }
      if (!job || customerId !== (job.customerId ?? '')) {
        input.customerId = customerId || null
      }
      if (!durableCustomersEnabled) {
        delete input.customerId
        input.customerDisplayName = legacyCustomerName.trim() || null
      }
      await onSubmit(input)
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogSurface
      title={job ? 'Edit Job' : 'Create Job'}
      description={
        job
          ? 'Update the details your team uses to deliver this work.'
          : 'Add the essentials now. You can add Job Steps after creation.'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        {error ? (
          <Alert variant="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <Field label="Job title" htmlFor="job-title" required>
          <Input
            ref={titleRef}
            id="job-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly lawn service"
            maxLength={200}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {durableCustomersEnabled ? (
            <Field label="Customer" htmlFor="job-customer">
              <Select
                id="job-customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                disabled={customersLoading || Boolean(customersError)}
              >
                <option value="">No Customer</option>
                {job?.customerId &&
                !customers.some(
                  (customer) => customer.id === job.customerId,
                ) ? (
                  <option value={job.customerId}>
                    {job.customerDisplayName || 'Previously linked Customer'}{' '}
                    (archived or unavailable)
                  </option>
                ) : null}
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                    {customer.companyName &&
                    customer.companyName !== customer.displayName
                      ? ` — ${customer.companyName}`
                      : customer.phone
                        ? ` — ${customer.phone}`
                        : ''}
                  </option>
                ))}
              </Select>
              {customersLoading ? (
                <p className="text-app-muted mt-1 text-[11px]">
                  Loading active Customers…
                </p>
              ) : customersError ? (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-rose-300">{customersError}</p>
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-primary underline underline-offset-2"
                    onClick={() => void onRetryCustomers()}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="text-app-muted mt-1 text-[11px]">
                  Only active durable Customers are available.
                </p>
              )}
            </Field>
          ) : (
            <Field label="Customer name" htmlFor="job-customer">
              <Input
                id="job-customer"
                value={legacyCustomerName}
                onChange={(event) => setLegacyCustomerName(event.target.value)}
                placeholder="Jane Smith"
                maxLength={300}
              />
            </Field>
          )}
          <Field label="Job value" htmlFor="job-value">
            <Input
              id="job-value"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="250.00"
            />
          </Field>
          <Field label="Scheduled start" htmlFor="job-start">
            <Input
              id="job-start"
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
            />
          </Field>
          <Field label="Scheduled end" htmlFor="job-end">
            <Input
              id="job-end"
              type="datetime-local"
              value={scheduledEnd}
              onChange={(event) => setScheduledEnd(event.target.value)}
            />
          </Field>
        </div>

        <details
          className="border-app bg-app-surface-muted rounded-xl border p-4"
          open={Boolean(job)}
        >
          <summary className="text-app-primary cursor-pointer text-sm font-medium">
            Additional details
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {job ? (
              <Field label="Status" htmlFor="job-status">
                <Select
                  id="job-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as JobStatusValue)
                  }
                >
                  {getAllowedJobStatuses(job.status).map((option) => (
                    <option key={option} value={option}>
                      {jobStatusLabels[option]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Priority" htmlFor="job-priority">
              <Select
                id="job-priority"
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
            <Field label="Assigned crew" htmlFor="job-assignment-members" wide>
              <div className="border-app bg-app-surface rounded-xl border p-3">
                <p className="text-app-muted text-xs">
                  Select any combination of individual Members and Teams.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="text-app-secondary flex items-center gap-2 text-sm"
                    >
                      <input
                        id={
                          member.id === members[0]?.id
                            ? 'job-assignment-members'
                            : undefined
                        }
                        type="checkbox"
                        checked={assignedMemberIds.includes(member.id)}
                        onChange={(event) =>
                          setAssignedMemberIds((current) =>
                            event.target.checked
                              ? [...current, member.id]
                              : current.filter((id) => id !== member.id),
                          )
                        }
                      />
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      {member.name}
                    </label>
                  ))}
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className="text-app-secondary flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={assignedTeamIds.includes(team.id)}
                        onChange={(event) =>
                          setAssignedTeamIds((current) =>
                            event.target.checked
                              ? [...current, team.id]
                              : current.filter((id) => id !== team.id),
                          )
                        }
                      />
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      {team.name}
                    </label>
                  ))}
                </div>
                {!members.length && !teams.length ? (
                  <p className="text-app-muted mt-3 text-sm">
                    No active Members or Teams are available.
                  </p>
                ) : null}
              </div>
            </Field>
            <Field label="Description" htmlFor="job-description" wide>
              <Textarea
                id="job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What work is included?"
                className="min-h-24"
              />
            </Field>
            <Field label="Internal notes" htmlFor="job-notes" wide>
              <Textarea
                id="job-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Access instructions, materials, or team notes"
                className="min-h-20"
              />
            </Field>
          </div>
        </details>

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
            {job ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </form>
    </DialogSurface>
  )
}

function JobStepFormDialog({
  step,
  members,
  onClose,
  onSubmit,
}: {
  step?: WorkItemClientRecord
  members: WorkspaceMemberOption[]
  onClose: () => void
  onSubmit: (input: JobStepMutationInput) => Promise<void>
}) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState(step?.title ?? '')
  const [status, setStatus] = useState<WorkItemStatusValue>(
    step?.status ?? WorkItemStatus.OPEN,
  )
  const [priority, setPriority] = useState<OperationsPriorityValue>(
    step?.priority ?? OperationsPriority.NORMAL,
  )
  const [assignee, setAssignee] = useState(step?.assigneeMemberId ?? '')
  const [dueAt, setDueAt] = useState(toDateTimeInput(step?.dueAt ?? null))
  const [description, setDescription] = useState(step?.description ?? '')
  const [notes, setNotes] = useState(step?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => titleRef.current?.focus(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Enter a Job Step title.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        status,
        priority,
        assigneeMemberId: assignee || null,
        dueAt: toIsoDate(dueAt),
        description: description.trim() || null,
        notes: notes.trim() || null,
      })
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogSurface
      title={step ? 'Edit Job Step' : 'Add Job Step'}
      description="Keep this step focused on one clear piece of work."
      onClose={onClose}
      compact
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="Job Step title" htmlFor="step-title" required>
          <Input
            ref={titleRef}
            id="step-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Edge sidewalks"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {step ? (
            <Field label="Status" htmlFor="step-status">
              <Select
                id="step-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as WorkItemStatusValue)
                }
              >
                {getAllowedWorkItemStatuses(step.status).map((option) => (
                  <option key={option} value={option}>
                    {workItemStatusLabels[option]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Priority" htmlFor="step-priority">
            <Select
              id="step-priority"
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
          <Field label="Assignee" htmlFor="step-assignee">
            <Select
              id="step-assignee"
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
          <Field label="Due date" htmlFor="step-due">
            <Input
              id="step-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="step-description" wide>
            <Textarea
              id="step-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20"
            />
          </Field>
          <Field label="Notes" htmlFor="step-notes" wide>
            <Textarea
              id="step-notes"
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
            {step ? 'Save Job Step' : 'Add Job Step'}
          </Button>
        </div>
      </form>
    </DialogSurface>
  )
}

function DialogSurface({
  title,
  description,
  onClose,
  children,
  compact = false,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  compact?: boolean
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    trapFocus(event, panelRef.current)
  }
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
        aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}
        onKeyDown={handleKeyDown}
        className={cn(
          'border-app bg-app-surface my-auto w-full rounded-2xl border shadow-2xl shadow-black/40',
          compact ? 'max-w-xl' : 'max-w-2xl',
        )}
      >
        <header className="border-app flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
          <div>
            <h2
              id={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}
              className="text-app-primary text-base font-semibold"
            >
              {title}
            </h2>
            <p className="text-app-secondary mt-1 text-xs leading-5">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover focus-visible:ring-brand-primary/60 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
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
