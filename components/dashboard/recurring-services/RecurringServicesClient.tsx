'use client'

import React, {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  UsersRound,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
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
import { listCustomers } from '@/lib/customers/client'
import type { CustomerClientRecord } from '@/lib/customers/clientTypes'
import {
  changeRecurringServiceLifecycle,
  createRecurringServiceWorkflow,
  listRecurringServices,
  RecurringServicesApiError,
  updateRecurringService,
  updateRecurringServiceSchedule,
} from '@/lib/recurring-services/client'
import type {
  RecurringServiceClientRecord,
  RecurringServiceMutation,
  RecurringServiceScheduleMutation,
} from '@/lib/recurring-services/clientTypes'
import {
  boundedUpcomingJobs,
  formatRecurringServiceCadence,
  recurringServiceAssignmentLabel,
  recurringServiceStatusLabels,
} from '@/lib/recurring-services/presentation'
import { buildSchedulingRecurrenceRule } from '@/lib/scheduling/recurrenceForm'
import {
  combineDateAndTimeInTimezone,
  getWorkspaceDateKey,
  type SchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type { WorkspaceTeamSummary } from '@/lib/workspaceStructure/types'
import { formatRevenueCurrency } from '@/lib/revenue/money'

type MemberOption = { id: string; name: string; role: string }
type StepDraft = { key: string; title: string; description: string }

type ServiceFormState = {
  customerId: string
  name: string
  description: string
  serviceInstructions: string
  price: string
  currency: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  steps: StepDraft[]
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
  weekdays: number[]
  startDate: string
  endType: 'never' | 'onDate' | 'afterOccurrences'
  endDate: string
  occurrenceCount: number
  startTime: string
  durationMinutes: number
  memberIds: string[]
  teamIds: string[]
}

const statusVariant: Record<
  RecurringServiceClientRecord['status'],
  BadgeVariant
> = { ACTIVE: 'green', PAUSED: 'yellow', ENDED: 'gray' }

const weekdays = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

function errorMessage(error: unknown) {
  return error instanceof RecurringServicesApiError
    ? error.message
    : 'Something went wrong. Please try again.'
}

function emptyForm(timezone: string): ServiceFormState {
  const startDate = getWorkspaceDateKey(new Date(), timezone)
  return {
    customerId: '',
    name: '',
    description: '',
    serviceInstructions: '',
    price: '',
    currency: 'USD',
    priority: 'NORMAL',
    steps: [],
    frequency: 'weekly',
    interval: 1,
    weekdays: [1],
    startDate,
    endType: 'never',
    endDate: '',
    occurrenceCount: 12,
    startTime: '09:00',
    durationMinutes: 60,
    memberIds: [],
    teamIds: [],
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function mutationFromForm(form: ServiceFormState): RecurringServiceMutation {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    serviceInstructions: form.serviceInstructions.trim() || null,
    pricePerVisitCents: Math.round(Number(form.price || 0) * 100),
    currency: form.currency.trim().toUpperCase(),
    defaultJobPriority: form.priority,
    defaultSteps: form.steps.map((step) => ({
      title: step.title.trim(),
      description: step.description.trim() || null,
    })),
  }
}

function scheduleFromForm({
  form,
  timezone,
  customer,
  members,
  teams,
}: {
  form: ServiceFormState
  timezone: string
  customer: CustomerClientRecord
  members: MemberOption[]
  teams: WorkspaceTeamSummary[]
}): RecurringServiceScheduleMutation {
  const startsAt = combineDateAndTimeInTimezone({
    dateKey: form.startDate as SchedulingDateKey,
    time: form.startTime,
    timezone,
  })
  const recurrenceRule = buildSchedulingRecurrenceRule({
    repeat: 'custom',
    date: form.startDate,
    customInterval: form.interval,
    customFrequency: form.frequency,
    customWeekdays: form.frequency === 'weekly' ? form.weekdays : [],
    customEndType: form.endType,
    customEndDate: form.endDate,
    customCount: form.occurrenceCount,
  })
  if (!recurrenceRule) throw new Error('Choose a valid recurring schedule.')
  const memberNames = new Map(members.map((member) => [member.id, member.name]))
  const teamNames = new Map(teams.map((team) => [team.id, team.name]))
  const customerAddress = [
    customer.serviceAddressLine1,
    customer.serviceAddressLine2,
    [
      customer.serviceAddressCity,
      customer.serviceAddressRegion,
      customer.serviceAddressPostalCode,
    ]
      .filter(Boolean)
      .join(', '),
    customer.serviceAddressCountry,
  ]
    .filter(Boolean)
    .join('\n')
  return {
    title: form.name.trim(),
    startsAt: startsAt.toISOString(),
    endsAt: new Date(
      startsAt.getTime() + Math.max(15, form.durationMinutes) * 60_000,
    ).toISOString(),
    timezone,
    assignedMemberIds: form.memberIds,
    assignments: [
      ...form.memberIds.map((workspaceMemberId) => ({
        assignmentType: 'MEMBER' as const,
        workspaceMemberId,
        displaySnapshot: memberNames.get(workspaceMemberId) ?? null,
      })),
      ...form.teamIds.map((teamId) => ({
        assignmentType: 'TEAM' as const,
        teamId,
        displaySnapshot: teamNames.get(teamId) ?? null,
      })),
    ],
    locationType: customerAddress ? 'customerLocation' : 'toBeDetermined',
    locationLabel: customerAddress ? customer.displayName : undefined,
    locationAddress: customerAddress || undefined,
    recurrenceRule,
    linkedRecord: {
      recordType: 'customer',
      recordId: customer.id,
      label: customer.displayName,
    },
  }
}

function Dialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      previousFocusRef.current?.focus?.()
    }
  }, [onClose])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
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

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-service-dialog-title"
        className="border-app bg-app-surface relative z-10 flex h-full w-full max-w-3xl flex-col border-l shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <header className="border-app flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
          <div>
            <h2
              id="recurring-service-dialog-title"
              className="text-app-primary text-lg font-semibold"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-app-secondary mt-1 text-sm">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="border-app bg-app-surface-muted focus-visible:ring-brand-primary/60 inline-flex h-10 w-10 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  )
}

export function RecurringServicesClient({
  workspaceId,
  workspaceSlug,
  timezone,
  members,
  canManage,
}: {
  workspaceId: string
  workspaceSlug: string
  timezone: string
  members: MemberOption[]
  canManage: boolean
}) {
  const [services, setServices] = useState<RecurringServiceClientRecord[]>([])
  const [customers, setCustomers] = useState<CustomerClientRecord[]>([])
  const [teams, setTeams] = useState<WorkspaceTeamSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<RecurringServiceClientRecord | null>(
    null,
  )
  const [editMode, setEditMode] = useState<'business' | 'schedule' | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextServices, nextCustomers, teamsResponse] = await Promise.all([
        listRecurringServices(workspaceId),
        listCustomers(workspaceId),
        fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/teams`, {
          cache: 'no-store',
        }),
      ])
      const teamsBody = teamsResponse.ok
        ? ((await teamsResponse.json()) as { teams?: WorkspaceTeamSummary[] })
        : { teams: [] }
      setServices(nextServices)
      setCustomers(nextCustomers)
      setTeams(
        (teamsBody.teams ?? []).filter(
          (team) => team.isActive && !team.archivedAt,
        ),
      )
      setSelected((current) =>
        current
          ? (nextServices.find((service) => service.id === current.id) ?? null)
          : null,
      )
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members],
  )
  const teamNames = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  )

  const replaceService = (service: RecurringServiceClientRecord) => {
    setServices((current) =>
      current.map((candidate) =>
        candidate.id === service.id ? service : candidate,
      ),
    )
    setSelected(service)
  }

  const lifecycle = async (
    service: RecurringServiceClientRecord,
    action: 'pause' | 'resume' | 'end',
  ) => {
    setBusyAction(`${service.id}:${action}`)
    setError(null)
    try {
      const updated = await changeRecurringServiceLifecycle(
        workspaceId,
        service.id,
        action,
        service.recurrenceSeries?.version,
      )
      replaceService(updated)
      await load()
      setNotice(
        action === 'pause'
          ? 'Recurring Service paused.'
          : action === 'resume'
            ? 'Recurring Service resumed.'
            : 'Recurring Service ended. Future service has been stopped.',
      )
    } catch (actionError) {
      setError(errorMessage(actionError))
      if (
        actionError instanceof RecurringServicesApiError &&
        actionError.status === 409
      ) {
        await load()
      }
    } finally {
      setBusyAction(null)
      setEndOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Services"
        description="Plan repeat customer work, keep upcoming visits visible, and give crews clear instructions."
        actions={
          canManage ? (
            <Button
              type="button"
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setCreateOpen(true)}
            >
              Create Recurring Service
            </Button>
          ) : null
        }
      />

      {!canManage ? (
        <Alert variant="info">
          Recurring Services are read-only. Open an assigned Job to complete
          field work.
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <div className="space-y-3" role="alert">
          <Alert variant="error">{error}</Alert>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="grid gap-4 lg:grid-cols-2"
          aria-label="Loading Recurring Services"
        >
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : null}

      {!loading && !error && services.length === 0 ? (
        <EmptyState
          title="No Recurring Services yet"
          description="Create repeat work once, then manage each upcoming Job as the schedule unfolds."
          actionLabel={canManage ? 'Create Recurring Service' : undefined}
          onAction={canManage ? () => setCreateOpen(true) : undefined}
        />
      ) : null}

      {!loading && services.length ? (
        <div
          className="grid gap-4 lg:grid-cols-2"
          aria-label="Recurring Services list"
        >
          {services.map((service) => {
            const nextJob = boundedUpcomingJobs(service.jobs ?? [], 1)[0]
            return (
              <Card key={service.id} className="overflow-hidden">
                <CardContent className="space-y-4 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-app-primary text-base font-semibold">
                          {service.name}
                        </h2>
                        <Badge variant={statusVariant[service.status]}>
                          {recurringServiceStatusLabels[service.status]}
                        </Badge>
                      </div>
                      <p className="text-app-secondary mt-1 text-sm">
                        {service.customer?.displayName ??
                          'Customer unavailable'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(service)}
                    >
                      {canManage && service.status !== 'ENDED'
                        ? 'View / Edit'
                        : 'View'}
                    </Button>
                  </div>
                  <div className="text-app-secondary grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <span>
                        {formatRecurringServiceCadence(
                          service.recurrenceSeries?.normalizedRule,
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <span>
                        {service.recurrenceSeries?.localStartTime ??
                          'Time unavailable'}{' '}
                        · {service.recurrenceSeries?.durationMinutes ?? 0} min
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <span>
                        {recurringServiceAssignmentLabel(
                          service,
                          memberNames,
                          teamNames,
                        )}
                      </span>
                    </div>
                    <div>
                      {formatRevenueCurrency(
                        service.pricePerVisitCents,
                        service.currency,
                      )}{' '}
                      per visit
                    </div>
                  </div>
                  <div className="border-app bg-app-surface-muted rounded-xl border p-3 text-sm">
                    <span className="text-app-muted">Next visit: </span>
                    <span className="text-app-primary font-medium">
                      {formatDateTime(nextJob?.scheduledStartAt)}
                    </span>
                  </div>
                  {canManage && service.status !== 'ENDED' ? (
                    <div className="flex flex-wrap gap-2">
                      {service.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={busyAction === `${service.id}:pause`}
                          disabled={busyAction !== null}
                          leftIcon={<Pause className="h-3.5 w-3.5" />}
                          onClick={() => void lifecycle(service, 'pause')}
                        >
                          Pause
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={busyAction === `${service.id}:resume`}
                          disabled={busyAction !== null}
                          leftIcon={<Play className="h-3.5 w-3.5" />}
                          onClick={() => void lifecycle(service, 'resume')}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelected(service)
                          setEndOpen(true)
                        }}
                      >
                        End Service
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {createOpen ? (
        <ServiceFormDialog
          title="Create Recurring Service"
          timezone={timezone}
          customers={customers}
          members={members}
          teams={teams}
          onClose={() => setCreateOpen(false)}
          onSubmit={async ({ form, serviceInput, scheduleInput }) => {
            await createRecurringServiceWorkflow({
              workspaceId,
              customerId: form.customerId,
              serviceInput,
              scheduleInput,
            })
            setCreateOpen(false)
            setNotice(
              'Recurring Service created. Upcoming Jobs will appear as Scheduling processes the series.',
            )
            await load()
          }}
        />
      ) : null}

      {selected && !editMode ? (
        <ServiceDetailDialog
          service={selected}
          workspaceSlug={workspaceSlug}
          canManage={canManage}
          memberNames={memberNames}
          teamNames={teamNames}
          onClose={() => setSelected(null)}
          onEditBusiness={() => setEditMode('business')}
          onEditSchedule={() => setEditMode('schedule')}
          onPause={() => void lifecycle(selected, 'pause')}
          onResume={() => void lifecycle(selected, 'resume')}
          onEnd={() => setEndOpen(true)}
        />
      ) : null}

      {selected && editMode === 'business' ? (
        <BusinessEditDialog
          service={selected}
          onClose={() => setEditMode(null)}
          onSubmit={async (input) => {
            const updated = await updateRecurringService(
              workspaceId,
              selected.id,
              input,
            )
            replaceService(updated)
            setEditMode(null)
            setNotice(
              'Recurring Service details updated. Existing completed Jobs were not changed.',
            )
            await load()
          }}
        />
      ) : null}

      {selected && editMode === 'schedule' ? (
        <ScheduleEditDialog
          service={selected}
          timezone={timezone}
          customers={customers}
          members={members}
          teams={teams}
          onClose={() => setEditMode(null)}
          onSubmit={async (input) => {
            const masterEventId = selected.recurrenceSeries?.masterEvent.id
            if (!masterEventId)
              throw new Error('This service schedule is unavailable.')
            await updateRecurringServiceSchedule(
              workspaceId,
              masterEventId,
              input,
              selected.recurrenceSeries?.version,
            )
            setEditMode(null)
            setNotice(
              'Future schedule updated. Completed Job history was not changed.',
            )
            await load()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={endOpen}
        title="End this Recurring Service?"
        description="Ending stops future service. It is permanent and is different from skipping one visit. Historical Jobs remain available."
        confirmLabel="End Service"
        destructive
        onOpenChange={setEndOpen}
        onConfirm={async () => {
          if (selected) await lifecycle(selected, 'end')
        }}
      />
    </div>
  )
}

function ServiceFormDialog({
  title,
  timezone,
  customers,
  members,
  teams,
  initialForm,
  scheduleOnly = false,
  onClose,
  onSubmit,
}: {
  title: string
  timezone: string
  customers: CustomerClientRecord[]
  members: MemberOption[]
  teams: WorkspaceTeamSummary[]
  initialForm?: ServiceFormState
  scheduleOnly?: boolean
  onClose: () => void
  onSubmit: (input: {
    form: ServiceFormState
    serviceInput: RecurringServiceMutation
    scheduleInput: RecurringServiceScheduleMutation
  }) => Promise<void>
}) {
  const [form, setForm] = useState(initialForm ?? emptyForm(timezone))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const customer = customers.find((item) => item.id === form.customerId)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    setError(null)
    if (!customer) return setError('Choose a Customer.')
    if (!form.name.trim()) return setError('Enter a service name.')
    if (form.frequency === 'weekly' && !form.weekdays.length)
      return setError('Choose at least one service day.')
    if (form.steps.some((step) => !step.title.trim()))
      return setError('Every Job Step needs a title.')
    submitting.current = true
    setBusy(true)
    try {
      await onSubmit({
        form,
        serviceInput: mutationFromForm(form),
        scheduleInput: scheduleFromForm({
          form,
          timezone,
          customer,
          members,
          teams,
        }),
      })
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={title}
      description={
        scheduleOnly
          ? 'Changes apply to future work. Completed Jobs remain historical.'
          : 'Set up repeat customer work in one workflow.'
      }
      onClose={onClose}
    >
      <form className="space-y-7" onSubmit={submit}>
        {error ? (
          <Alert variant="error" role="alert">
            {error}
          </Alert>
        ) : null}
        {!scheduleOnly ? (
          <>
            <FormSection title="Service">
              <Field label="Customer" required>
                <Select
                  value={form.customerId}
                  onChange={(event) =>
                    setForm({ ...form, customerId: event.target.value })
                  }
                  required
                >
                  <option value="">Choose a Customer</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Service Name" required>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </Field>
              <Field label="Service Instructions">
                <Textarea
                  value={form.serviceInstructions}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      serviceInstructions: event.target.value,
                    })
                  }
                  placeholder="Gate codes, access notes, or standing service requirements"
                />
              </Field>
            </FormSection>
            <FormSection title="Pricing and Job defaults">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Price per Visit">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    maxLength={3}
                    value={form.currency}
                    onChange={(event) =>
                      setForm({ ...form, currency: event.target.value })
                    }
                  />
                </Field>
                <Field label="Priority">
                  <Select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target
                          .value as ServiceFormState['priority'],
                      })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </Field>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Default Job Steps</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        ...form,
                        steps: [
                          ...form.steps,
                          {
                            key: crypto.randomUUID(),
                            title: '',
                            description: '',
                          },
                        ],
                      })
                    }
                  >
                    Add Step
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {form.steps.map((step, index) => (
                    <div
                      key={step.key}
                      className="border-app bg-app-surface-muted rounded-xl border p-3"
                    >
                      <div className="flex gap-2">
                        <Input
                          aria-label={`Job Step ${index + 1} title`}
                          value={step.title}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              steps: form.steps.map((item) =>
                                item.key === step.key
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Move Job Step ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() =>
                            setForm({
                              ...form,
                              steps: move(form.steps, index, index - 1),
                            })
                          }
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Move Job Step ${index + 1} down`}
                          disabled={index === form.steps.length - 1}
                          onClick={() =>
                            setForm({
                              ...form,
                              steps: move(form.steps, index, index + 1),
                            })
                          }
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setForm({
                              ...form,
                              steps: form.steps.filter(
                                (item) => item.key !== step.key,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <Textarea
                        className="mt-2"
                        aria-label={`Job Step ${index + 1} description`}
                        value={step.description}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            steps: form.steps.map((item) =>
                              item.key === step.key
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="Optional instructions"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </FormSection>
          </>
        ) : null}

        <FormSection title="Schedule">
          {scheduleOnly ? (
            <Field label="Customer">
              <Select value={form.customerId} disabled>
                <option value={form.customerId}>
                  {customer?.displayName ?? 'Customer'}
                </option>
              </Select>
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Repeat">
              <Select
                value={form.frequency}
                onChange={(event) =>
                  setForm({
                    ...form,
                    frequency: event.target
                      .value as ServiceFormState['frequency'],
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field
              label={`Every ${form.frequency === 'daily' ? 'day(s)' : form.frequency === 'weekly' ? 'week(s)' : 'month(s)'}`}
            >
              <Input
                type="number"
                min="1"
                max="99"
                value={form.interval}
                onChange={(event) =>
                  setForm({ ...form, interval: Number(event.target.value) })
                }
              />
            </Field>
          </div>
          {form.frequency === 'weekly' ? (
            <div>
              <Label>Service Days</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <label
                    key={day.value}
                    className="border-app bg-app-surface-muted inline-flex min-h-10 cursor-pointer items-center rounded-xl border px-3 text-sm has-[:checked]:border-brand-primary has-[:checked]:text-brand-primary"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.weekdays.includes(day.value)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          weekdays: event.target.checked
                            ? [...form.weekdays, day.value].sort()
                            : form.weekdays.filter(
                                (value) => value !== day.value,
                              ),
                        })
                      }
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start Date" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
                required
              />
            </Field>
            <Field label="End">
              <Select
                value={form.endType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    endType: event.target.value as ServiceFormState['endType'],
                  })
                }
              >
                <option value="never">Never</option>
                <option value="onDate">On date</option>
                <option value="afterOccurrences">After visits</option>
              </Select>
            </Field>
          </div>
          {form.endType === 'onDate' ? (
            <Field label="End Date" required>
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm({ ...form, endDate: event.target.value })
                }
                required
              />
            </Field>
          ) : null}
          {form.endType === 'afterOccurrences' ? (
            <Field label="Number of Visits" required>
              <Input
                type="number"
                min="1"
                value={form.occurrenceCount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    occurrenceCount: Number(event.target.value),
                  })
                }
                required
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start Time" required>
              <Input
                type="time"
                value={form.startTime}
                onChange={(event) =>
                  setForm({ ...form, startTime: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Estimated Duration (minutes)" required>
              <Input
                type="number"
                min="15"
                step="15"
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    durationMinutes: Number(event.target.value),
                  })
                }
                required
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Assignment">
          <p className="text-app-secondary text-sm">
            Choose members, teams, or both. Scheduling remains the assignment
            authority for future Jobs.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Members</Label>
              <div className="mt-2 space-y-2">
                {members.map((member) => (
                  <Checkbox
                    key={member.id}
                    label={member.name}
                    checked={form.memberIds.includes(member.id)}
                    onChange={(checked) =>
                      setForm({
                        ...form,
                        memberIds: checked
                          ? [...form.memberIds, member.id]
                          : form.memberIds.filter((id) => id !== member.id),
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Teams / crews</Label>
              <div className="mt-2 space-y-2">
                {teams.length ? (
                  teams.map((team) => (
                    <Checkbox
                      key={team.id}
                      label={team.name}
                      checked={form.teamIds.includes(team.id)}
                      onChange={(checked) =>
                        setForm({
                          ...form,
                          teamIds: checked
                            ? [...form.teamIds, team.id]
                            : form.teamIds.filter((id) => id !== team.id),
                        })
                      }
                    />
                  ))
                ) : (
                  <p className="text-app-muted text-sm">No active teams.</p>
                )}
              </div>
            </div>
          </div>
        </FormSection>
        <div className="border-app sticky bottom-0 flex justify-end gap-2 border-t bg-[var(--surface)] py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={busy}>
            {scheduleOnly ? 'Save Schedule' : 'Create Recurring Service'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ServiceDetailDialog({
  service,
  workspaceSlug,
  canManage,
  memberNames,
  teamNames,
  onClose,
  onEditBusiness,
  onEditSchedule,
  onPause,
  onResume,
  onEnd,
}: {
  service: RecurringServiceClientRecord
  workspaceSlug: string
  canManage: boolean
  memberNames: Map<string, string>
  teamNames: Map<string, string>
  onClose: () => void
  onEditBusiness: () => void
  onEditSchedule: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
}) {
  const [limit, setLimit] = useState(12)
  const jobs = boundedUpcomingJobs(service.jobs ?? [], limit)
  const totalUpcoming = boundedUpcomingJobs(
    service.jobs ?? [],
    Number.MAX_SAFE_INTEGER,
  )
  const completedCount = (service.jobs ?? []).filter(
    (job) => job.status === 'COMPLETED',
  ).length
  return (
    <Dialog
      title={service.name}
      description={`${service.customer?.displayName ?? 'Customer'} · ${recurringServiceStatusLabels[service.status]}`}
      onClose={onClose}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant[service.status]}>
            {recurringServiceStatusLabels[service.status]}
          </Badge>
          <Badge variant="slate">
            {formatRecurringServiceCadence(
              service.recurrenceSeries?.normalizedRule,
            )}
          </Badge>
        </div>
        {canManage && service.status !== 'ENDED' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={onEditBusiness}
            >
              Edit Details
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEditSchedule}
            >
              Edit Future Schedule
            </Button>
            {service.status === 'ACTIVE' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onPause}
              >
                Pause Service
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onResume}
              >
                Resume Service
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onEnd}>
              End Service
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail
            label="Customer"
            value={service.customer?.displayName ?? 'Unavailable'}
          />
          <Detail
            label="Price per Visit"
            value={formatRevenueCurrency(
              service.pricePerVisitCents,
              service.currency,
            )}
          />
          <Detail
            label="Schedule"
            value={`${formatRecurringServiceCadence(service.recurrenceSeries?.normalizedRule)} · ${service.recurrenceSeries?.localStartTime ?? 'Time unavailable'}`}
          />
          <Detail
            label="Assignment"
            value={recurringServiceAssignmentLabel(
              service,
              memberNames,
              teamNames,
            )}
          />
          <Detail
            label="Priority"
            value={
              service.defaultJobPriority.charAt(0) +
              service.defaultJobPriority.slice(1).toLowerCase()
            }
          />
          <Detail
            label="History"
            value={`${completedCount} completed Job${completedCount === 1 ? '' : 's'}`}
          />
        </div>
        {service.description ? (
          <TextBlock title="Description" text={service.description} />
        ) : null}
        <TextBlock
          title="Service Instructions"
          text={
            service.serviceInstructions || 'No standing service instructions.'
          }
        />
        <section>
          <h3 className="text-app-primary text-sm font-semibold">
            Default Job Steps
          </h3>
          {service.stepTemplates.length ? (
            <ol className="mt-3 space-y-2">
              {service.stepTemplates.map((step, index) => (
                <li
                  key={step.id}
                  className="border-app bg-app-surface-muted rounded-xl border p-3 text-sm"
                >
                  <span className="text-app-primary font-medium">
                    {index + 1}. {step.title}
                  </span>
                  {step.description ? (
                    <p className="text-app-secondary mt-1">
                      {step.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-app-muted mt-2 text-sm">No default Job Steps.</p>
          )}
        </section>
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-app-primary text-sm font-semibold">
                Upcoming Jobs
              </h3>
              <p className="text-app-muted mt-1 text-xs">
                Future work is shown in bounded operational groups.
              </p>
            </div>
          </div>
          {jobs.length ? (
            <div className="mt-3 space-y-2">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/${workspaceSlug}/service-requests?jobId=${encodeURIComponent(job.id)}`}
                  className="border-app bg-app-surface-muted hover:bg-app-surface-hover block rounded-xl border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-app-primary text-sm font-medium">
                        {job.title}
                      </p>
                      <p className="text-app-secondary mt-1 text-xs">
                        {formatDateTime(job.scheduledStartAt)} ·{' '}
                        {job.status.replaceAll('_', ' ').toLowerCase()}
                      </p>
                    </div>
                    <span className="text-app-muted text-xs">Open Job</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="border-app bg-app-surface-muted text-app-muted mt-3 rounded-xl border border-dashed p-5 text-center text-sm">
              No upcoming Jobs are currently materialized.
            </p>
          )}
          {jobs.length < totalUpcoming.length ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLimit((current) => current + 12)}
            >
              Load More
            </Button>
          ) : null}
        </section>
        {service.status === 'ENDED' ? (
          <Alert variant="info">
            This service has ended. Its history is read-only and it cannot be
            resumed.
          </Alert>
        ) : (
          <Alert variant="info">
            Changes to service details and schedule apply to future work.
            Completed Jobs remain unchanged.
          </Alert>
        )}
      </div>
    </Dialog>
  )
}

function BusinessEditDialog({
  service,
  onClose,
  onSubmit,
}: {
  service: RecurringServiceClientRecord
  onClose: () => void
  onSubmit: (input: RecurringServiceMutation) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: service.name,
    description: service.description ?? '',
    instructions: service.serviceInstructions ?? '',
    price: String(service.pricePerVisitCents / 100),
    currency: service.currency,
    priority: service.defaultJobPriority,
    steps: service.stepTemplates.map((step) => ({
      key: step.id,
      title: step.title,
      description: step.description ?? '',
    })),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      title="Edit Recurring Service Details"
      description="Changes apply to future work; completed Jobs stay unchanged."
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await onSubmit({
              name: form.name.trim(),
              description: form.description.trim() || null,
              serviceInstructions: form.instructions.trim() || null,
              pricePerVisitCents: Math.round(Number(form.price || 0) * 100),
              currency: form.currency.toUpperCase(),
              defaultJobPriority: form.priority,
              defaultSteps: form.steps.map((step) => ({
                title: step.title.trim(),
                description: step.description.trim() || null,
              })),
            })
          } catch (submitError) {
            setError(errorMessage(submitError))
          } finally {
            setBusy(false)
          }
        }}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="Service Name" required>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Field label="Service Instructions">
          <Textarea
            value={form.instructions}
            onChange={(event) =>
              setForm({ ...form, instructions: event.target.value })
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price per Visit">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
            />
          </Field>
          <Field label="Currency">
            <Input
              maxLength={3}
              value={form.currency}
              onChange={(event) =>
                setForm({ ...form, currency: event.target.value })
              }
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(event) =>
                setForm({
                  ...form,
                  priority: event.target.value as typeof form.priority,
                })
              }
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Default Job Steps</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  steps: [
                    ...form.steps,
                    { key: crypto.randomUUID(), title: '', description: '' },
                  ],
                })
              }
            >
              Add Step
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {form.steps.map((step) => (
              <div key={step.key} className="flex gap-2">
                <Input
                  value={step.title}
                  aria-label="Job Step title"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      steps: form.steps.map((item) =>
                        item.key === step.key
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      ...form,
                      steps: form.steps.filter((item) => item.key !== step.key),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save Details
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ScheduleEditDialog({
  service,
  timezone,
  customers,
  members,
  teams,
  onClose,
  onSubmit,
}: {
  service: RecurringServiceClientRecord
  timezone: string
  customers: CustomerClientRecord[]
  members: MemberOption[]
  teams: WorkspaceTeamSummary[]
  onClose: () => void
  onSubmit: (input: RecurringServiceScheduleMutation) => Promise<void>
}) {
  const rule = service.recurrenceSeries?.normalizedRule
  const assignments = service.recurrenceSeries?.masterEvent.assignments ?? []
  const form: ServiceFormState = {
    ...emptyForm(timezone),
    customerId: service.customerId,
    name: service.name,
    frequency:
      rule?.frequency === 'daily' || rule?.frequency === 'monthly'
        ? rule.frequency
        : 'weekly',
    interval: rule?.interval ?? 1,
    weekdays: rule?.daysOfWeek ?? [1],
    startDate:
      service.recurrenceSeries?.localStartDate ??
      getWorkspaceDateKey(new Date(), timezone),
    startTime: service.recurrenceSeries?.localStartTime ?? '09:00',
    durationMinutes: service.recurrenceSeries?.durationMinutes ?? 60,
    endType: rule?.endType ?? 'never',
    endDate: rule?.endDate ?? '',
    occurrenceCount: rule?.occurrenceCount ?? 12,
    memberIds: assignments.flatMap((assignment) =>
      assignment.assignmentType === 'MEMBER' && assignment.workspaceMemberId
        ? [assignment.workspaceMemberId]
        : [],
    ),
    teamIds: assignments.flatMap((assignment) =>
      assignment.assignmentType === 'TEAM' && assignment.teamId
        ? [assignment.teamId]
        : [],
    ),
  }
  return (
    <ServiceFormDialog
      title="Edit Future Schedule"
      timezone={timezone}
      customers={customers}
      members={members}
      teams={teams}
      initialForm={form}
      scheduleOnly
      onClose={onClose}
      onSubmit={async ({ scheduleInput }) => onSubmit(scheduleInput)}
    />
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-app-primary border-app border-b pb-2 text-sm font-semibold uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  )
}
function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="form-label">
        {label}
        {required ? ' *' : ''}
      </span>
      <div className="mt-1 [&>*]:w-full">{children}</div>
    </label>
  )
}
function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="border-app bg-app-surface-muted flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-app bg-app-surface-muted rounded-xl border p-3">
      <p className="text-app-muted text-xs uppercase tracking-wide">{label}</p>
      <p className="text-app-primary mt-1 text-sm">{value}</p>
    </div>
  )
}
function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-app bg-app-surface-muted rounded-xl border p-4">
      <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
      <p className="text-app-secondary mt-2 whitespace-pre-wrap text-sm leading-6">
        {text}
      </p>
    </section>
  )
}
function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
