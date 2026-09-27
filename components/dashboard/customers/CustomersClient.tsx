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
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Archive,
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
import { Alert } from '@/components/ui/Alert'
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
  archiveCustomer,
  createCustomer,
  CustomersApiError,
  listCustomers,
  updateCustomer,
} from '@/lib/customers/client'
import type {
  CustomerClientRecord,
  CustomerMemberOption,
  CustomerMutationInput,
} from '@/lib/customers/clientTypes'
import { listJobs } from '@/lib/jobs/client'
import type { JobClientRecord } from '@/lib/jobs/clientTypes'
import { jobStatusLabels, priorityLabels } from '@/lib/jobs/presentation'
import { formatRevenueCurrency } from '@/lib/revenue/money'
import { listRecurringServices } from '@/lib/recurring-services/client'
import type { RecurringServiceClientRecord } from '@/lib/recurring-services/clientTypes'
import {
  boundedUpcomingJobs,
  formatRecurringServiceCadence,
  recurringServiceAssignmentLabel,
  recurringServiceStatusLabels,
} from '@/lib/recurring-services/presentation'
import { cn } from '@/lib/utils'

type CustomerFormState = {
  displayName: string
  companyName: string
  contactName: string
  email: string
  phone: string
  serviceAddressLine1: string
  serviceAddressLine2: string
  serviceAddressCity: string
  serviceAddressRegion: string
  serviceAddressPostalCode: string
  serviceAddressCountry: string
  notes: string
  assignedMemberId: string
}

const emptyForm: CustomerFormState = {
  displayName: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  serviceAddressLine1: '',
  serviceAddressLine2: '',
  serviceAddressCity: '',
  serviceAddressRegion: '',
  serviceAddressPostalCode: '',
  serviceAddressCountry: '',
  notes: '',
  assignedMemberId: '',
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function apiErrorMessage(error: unknown) {
  return error instanceof CustomersApiError
    ? error.message
    : 'Something went wrong. Please try again.'
}

function formFromCustomer(customer: CustomerClientRecord): CustomerFormState {
  return {
    displayName: customer.displayName,
    companyName: customer.companyName ?? '',
    contactName: customer.contactName ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    serviceAddressLine1: customer.serviceAddressLine1 ?? '',
    serviceAddressLine2: customer.serviceAddressLine2 ?? '',
    serviceAddressCity: customer.serviceAddressCity ?? '',
    serviceAddressRegion: customer.serviceAddressRegion ?? '',
    serviceAddressPostalCode: customer.serviceAddressPostalCode ?? '',
    serviceAddressCountry: customer.serviceAddressCountry ?? '',
    notes: customer.notes ?? '',
    assignedMemberId: customer.assignedMemberId ?? '',
  }
}

function mutationFromForm(form: CustomerFormState): CustomerMutationInput & {
  displayName: string
} {
  const optional = (value: string) => value.trim() || null
  return {
    displayName: form.displayName.trim(),
    companyName: optional(form.companyName),
    contactName: optional(form.contactName),
    email: optional(form.email),
    phone: optional(form.phone),
    serviceAddressLine1: optional(form.serviceAddressLine1),
    serviceAddressLine2: optional(form.serviceAddressLine2),
    serviceAddressCity: optional(form.serviceAddressCity),
    serviceAddressRegion: optional(form.serviceAddressRegion),
    serviceAddressPostalCode: optional(form.serviceAddressPostalCode),
    serviceAddressCountry: optional(form.serviceAddressCountry),
    notes: optional(form.notes),
    assignedMemberId: optional(form.assignedMemberId),
  }
}

function formatAddress(customer: CustomerClientRecord) {
  const locality = [
    customer.serviceAddressCity,
    customer.serviceAddressRegion,
    customer.serviceAddressPostalCode,
  ]
    .filter(Boolean)
    .join(', ')
  return [
    customer.serviceAddressLine1,
    customer.serviceAddressLine2,
    locality,
    customer.serviceAddressCountry,
  ].filter(Boolean)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function memberName(members: CustomerMemberOption[], memberId: string | null) {
  if (!memberId) return 'Unassigned'
  return members.find((member) => member.id === memberId)?.name ?? 'Team member'
}

function CustomerDialog({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) {
  const [ready, setReady] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!open) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const frame = window.requestAnimationFrame(() => {
      // Do not steal focus if an auto-focused form field or the user already
      // moved focus while the panel was opening.
      if (document.activeElement === document.body) closeRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
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

  if (!ready || !open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-dialog-title"
        aria-describedby={
          description ? 'customer-dialog-description' : undefined
        }
        className="border-app bg-app-surface-raised flex h-full w-full max-w-2xl flex-col border-l shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="border-app flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="customer-dialog-title"
              className="text-app-primary text-lg font-semibold"
            >
              {title}
            </h2>
            {description ? (
              <p
                id="customer-dialog-description"
                className="text-neutral-text-secondary mt-1 text-sm"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary hover:bg-app-surface-hover hover:text-app-primary rounded-xl p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            aria-label="Close Customer panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function CustomerForm({
  mode,
  customer,
  members,
  onCancel,
  onSaved,
  workspaceId,
}: {
  mode: 'create' | 'edit'
  customer?: CustomerClientRecord
  members: CustomerMemberOption[]
  onCancel: () => void
  onSaved: (customer: CustomerClientRecord) => void
  workspaceId: string
}) {
  const [form, setForm] = useState<CustomerFormState>(() =>
    customer ? formFromCustomer(customer) : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({})

  const setField = (field: keyof CustomerFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.displayName.trim()) {
      setFieldErrors({ displayName: ['Enter a display name.'] })
      return
    }
    setSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      const input = mutationFromForm(form)
      const saved =
        mode === 'create'
          ? await createCustomer(workspaceId, input)
          : await updateCustomer(workspaceId, customer!.id, input)
      onSaved(saved)
    } catch (saveError) {
      setError(apiErrorMessage(saveError))
      if (saveError instanceof CustomersApiError) {
        setFieldErrors(saveError.fieldErrors ?? {})
      }
    } finally {
      setSaving(false)
    }
  }

  const inputProps = (field: keyof CustomerFormState) => ({
    value: form[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setField(field, event.target.value),
    error: fieldErrors[field]?.[0],
  })

  return (
    <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <section className="space-y-4" aria-labelledby="customer-basics-heading">
        <h3
          id="customer-basics-heading"
          className="text-app-primary font-medium"
        >
          Customer details
        </h3>
        <Field label="Display name *" htmlFor="customer-display-name">
          <Input
            id="customer-display-name"
            autoFocus
            maxLength={300}
            {...inputProps('displayName')}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor="customer-company-name">
            <Input
              id="customer-company-name"
              maxLength={300}
              {...inputProps('companyName')}
            />
          </Field>
          <Field label="Contact name" htmlFor="customer-contact-name">
            <Input
              id="customer-contact-name"
              maxLength={300}
              {...inputProps('contactName')}
            />
          </Field>
          <Field label="Email" htmlFor="customer-email">
            <Input
              id="customer-email"
              type="email"
              maxLength={320}
              {...inputProps('email')}
            />
          </Field>
          <Field label="Phone" htmlFor="customer-phone">
            <Input
              id="customer-phone"
              type="tel"
              maxLength={50}
              {...inputProps('phone')}
            />
          </Field>
        </div>
        <Field label="Account manager" htmlFor="customer-account-manager">
          <Select
            id="customer-account-manager"
            value={form.assignedMemberId}
            onValueChange={(value) => setField('assignedMemberId', value)}
            error={fieldErrors.assignedMemberId?.[0]}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-4" aria-labelledby="service-address-heading">
        <h3
          id="service-address-heading"
          className="text-app-primary font-medium"
        >
          Service address
        </h3>
        <Field label="Address line 1" htmlFor="customer-address-1">
          <Input
            id="customer-address-1"
            maxLength={300}
            {...inputProps('serviceAddressLine1')}
          />
        </Field>
        <Field label="Address line 2" htmlFor="customer-address-2">
          <Input
            id="customer-address-2"
            maxLength={300}
            {...inputProps('serviceAddressLine2')}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="customer-city">
            <Input
              id="customer-city"
              maxLength={120}
              {...inputProps('serviceAddressCity')}
            />
          </Field>
          <Field label="State / region" htmlFor="customer-region">
            <Input
              id="customer-region"
              maxLength={120}
              {...inputProps('serviceAddressRegion')}
            />
          </Field>
          <Field label="Postal code" htmlFor="customer-postal-code">
            <Input
              id="customer-postal-code"
              maxLength={32}
              {...inputProps('serviceAddressPostalCode')}
            />
          </Field>
          <Field label="Country" htmlFor="customer-country">
            <Input
              id="customer-country"
              maxLength={120}
              {...inputProps('serviceAddressCountry')}
            />
          </Field>
        </div>
      </section>

      <Field label="Notes" htmlFor="customer-notes">
        <Textarea
          id="customer-notes"
          value={form.notes}
          maxLength={10_000}
          onChange={(event) => setField('notes', event.target.value)}
          error={fieldErrors.notes?.[0]}
          placeholder="Service preferences, access details, or other useful notes"
        />
      </Field>

      <div className="border-app sticky bottom-0 -mx-5 flex justify-end gap-2 border-t bg-[var(--app-surface-raised)] px-5 py-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {mode === 'create' ? 'Add Customer' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 py-3">
      <span className="text-app-muted mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-app-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </div>
        <div className="text-app-primary mt-1 break-words text-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

export function CustomersClient({
  workspaceId,
  workspaceSlug,
  initialCustomerId,
  members,
}: {
  workspaceId: string
  workspaceSlug: string
  initialCustomerId?: string
  members: CustomerMemberOption[]
}) {
  const [customers, setCustomers] = useState<CustomerClientRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<CustomerClientRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [customerJobs, setCustomerJobs] = useState<JobClientRecord[]>([])
  const [customerJobsLoading, setCustomerJobsLoading] = useState(false)
  const [customerJobsError, setCustomerJobsError] = useState<string | null>(
    null,
  )
  const [customerServices, setCustomerServices] = useState<
    RecurringServiceClientRecord[]
  >([])
  const [customerServicesLoading, setCustomerServicesLoading] = useState(false)
  const [customerServicesError, setCustomerServicesError] = useState<
    string | null
  >(null)
  const requestSequence = useRef(0)
  const customerJobsRequestSequence = useRef(0)
  const customerServicesRequestSequence = useRef(0)
  const initialSelectionApplied = useRef(false)

  const load = useCallback(
    async (query: string) => {
      const sequence = ++requestSequence.current
      setLoading(true)
      setError(null)
      try {
        const records = await listCustomers(workspaceId, query)
        if (sequence === requestSequence.current) setCustomers(records)
      } catch (loadError) {
        if (sequence === requestSequence.current)
          setError(apiErrorMessage(loadError))
      } finally {
        if (sequence === requestSequence.current) setLoading(false)
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(search), search ? 250 : 0)
    return () => window.clearTimeout(timeout)
  }, [load, search])

  useEffect(() => {
    if (loading || initialSelectionApplied.current || !initialCustomerId) return
    initialSelectionApplied.current = true
    const customer = customers.find((item) => item.id === initialCustomerId)
    if (customer) setSelected(customer)
  }, [customers, initialCustomerId, loading])

  const loadCustomerJobs = useCallback(
    async (customerId: string) => {
      const sequence = ++customerJobsRequestSequence.current
      setCustomerJobsLoading(true)
      setCustomerJobsError(null)
      try {
        const jobs = await listJobs(workspaceId, { customerId })
        if (sequence === customerJobsRequestSequence.current) {
          setCustomerJobs(jobs)
        }
      } catch (loadError) {
        if (sequence === customerJobsRequestSequence.current) {
          setCustomerJobsError(apiErrorMessage(loadError))
        }
      } finally {
        if (sequence === customerJobsRequestSequence.current) {
          setCustomerJobsLoading(false)
        }
      }
    },
    [workspaceId],
  )

  const loadCustomerServices = useCallback(
    async (customerId: string) => {
      const sequence = ++customerServicesRequestSequence.current
      setCustomerServicesLoading(true)
      setCustomerServicesError(null)
      try {
        const services = await listRecurringServices(workspaceId)
        if (sequence === customerServicesRequestSequence.current) {
          setCustomerServices(
            services.filter((service) => service.customerId === customerId),
          )
        }
      } catch (loadError) {
        if (sequence === customerServicesRequestSequence.current) {
          setCustomerServicesError(apiErrorMessage(loadError))
        }
      } finally {
        if (sequence === customerServicesRequestSequence.current) {
          setCustomerServicesLoading(false)
        }
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    if (!selected) {
      customerJobsRequestSequence.current += 1
      setCustomerJobs([])
      setCustomerJobsError(null)
      setCustomerJobsLoading(false)
      customerServicesRequestSequence.current += 1
      setCustomerServices([])
      setCustomerServicesError(null)
      setCustomerServicesLoading(false)
      return
    }
    void loadCustomerJobs(selected.id)
    void loadCustomerServices(selected.id)
  }, [loadCustomerJobs, loadCustomerServices, selected])

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members],
  )

  const saveCreated = (customer: CustomerClientRecord) => {
    setSearch('')
    setCustomers((current) =>
      [customer, ...current.filter((item) => item.id !== customer.id)].sort(
        (a, b) => a.displayName.localeCompare(b.displayName),
      ),
    )
    setCreateOpen(false)
    setSelected(customer)
    setNotice(`${customer.displayName} was added.`)
  }

  const saveUpdated = (customer: CustomerClientRecord) => {
    setCustomers((current) =>
      current.map((item) => (item.id === customer.id ? customer : item)),
    )
    setSelected(customer)
    setEditing(false)
    setNotice(`${customer.displayName} was updated.`)
  }

  const confirmArchive = async () => {
    if (!selected) return
    setArchiveError(null)
    try {
      await archiveCustomer(workspaceId, selected.id)
      setCustomers((current) =>
        current.filter((item) => item.id !== selected.id),
      )
      setArchiveOpen(false)
      setSelected(null)
      setEditing(false)
      setNotice(`${selected.displayName} was archived.`)
    } catch (archiveFailure) {
      setArchiveError(apiErrorMessage(archiveFailure))
      setArchiveOpen(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Keep customer contact details, service locations, and account ownership in one place."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Customer
          </Button>
        }
      />

      {notice ? (
        <Alert variant="success" className="mb-4" role="status">
          {notice}
        </Alert>
      ) : null}
      {archiveError ? (
        <Alert variant="error" className="mb-4" role="alert">
          {archiveError}
        </Alert>
      ) : null}

      <div className="mb-5 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="text-app-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label="Search Customers"
            placeholder="Search by name, email, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void load(search)}
          aria-label="Refresh Customers"
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Alert variant="error" role="alert">
              {error}
            </Alert>
            <Button variant="outline" onClick={() => void load(search)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card aria-label="Loading Customers">
          <CardContent className="space-y-3 pt-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : customers.length === 0 ? (
        search ? (
          <EmptyState
            title="No Customers found"
            description={`No active Customers match “${search}”. Try another name, email, or phone.`}
          />
        ) : (
          <EmptyState
            title="No Customers yet"
            description="Add your first Customer to keep their contact and service details organized."
            actionLabel="Add Customer"
            onAction={() => setCreateOpen(true)}
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-app-surface-muted text-app-muted border-app border-b text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Service location</th>
                  <th className="px-5 py-3 font-medium">Account manager</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {customers.map((customer) => {
                  const address = formatAddress(customer)
                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-app-surface-hover/60"
                    >
                      <td className="px-5 py-4">
                        <div className="text-app-primary font-medium">
                          {customer.displayName}
                        </div>
                        {customer.companyName &&
                        customer.companyName !== customer.displayName ? (
                          <div className="text-app-muted mt-1 text-xs">
                            {customer.companyName}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-neutral-text-secondary px-5 py-4">
                        <div>{customer.contactName || 'No contact name'}</div>
                        <div className="text-app-muted mt-1 text-xs">
                          {customer.email ||
                            customer.phone ||
                            'No contact details'}
                        </div>
                      </td>
                      <td className="text-neutral-text-secondary max-w-xs px-5 py-4">
                        {address[0] || 'No service address'}
                      </td>
                      <td className="text-neutral-text-secondary px-5 py-4">
                        {memberById.get(customer.assignedMemberId ?? '') ||
                          'Unassigned'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelected(customer)}
                          aria-label={`Open Customer ${customer.displayName}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[color:var(--border)] md:hidden">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelected(customer)}
                className="hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 w-full px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                aria-label={`Open Customer ${customer.displayName}`}
              >
                <div className="text-app-primary font-medium">
                  {customer.displayName}
                </div>
                <div className="text-neutral-text-secondary mt-1 text-sm">
                  {customer.email || customer.phone || 'No contact details'}
                </div>
                <div className="text-app-muted mt-2 text-xs">
                  Account manager:{' '}
                  {memberName(members, customer.assignedMemberId)}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <CustomerDialog
        open={createOpen}
        title="Add Customer"
        description="Create a durable Customer record for this workspace."
        onClose={() => setCreateOpen(false)}
      >
        <CustomerForm
          mode="create"
          workspaceId={workspaceId}
          members={members}
          onCancel={() => setCreateOpen(false)}
          onSaved={saveCreated}
        />
      </CustomerDialog>

      <CustomerDialog
        open={Boolean(selected)}
        title={
          editing
            ? `Edit ${selected?.displayName ?? 'Customer'}`
            : (selected?.displayName ?? 'Customer')
        }
        description={
          editing ? 'Update the durable Customer record.' : 'Customer details'
        }
        onClose={() => {
          setSelected(null)
          setEditing(false)
          setArchiveError(null)
        }}
      >
        {selected && editing ? (
          <CustomerForm
            key={selected.id}
            mode="edit"
            customer={selected}
            workspaceId={workspaceId}
            members={members}
            onCancel={() => setEditing(false)}
            onSaved={saveUpdated}
          />
        ) : selected ? (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                leftIcon={<Pencil className="h-4 w-4" />}
              >
                Edit Customer
              </Button>
              <Button
                variant="ghost"
                onClick={() => setArchiveOpen(true)}
                leftIcon={<Archive className="h-4 w-4" />}
              >
                Archive Customer
              </Button>
            </div>

            <section
              className="divide-y divide-[color:var(--border)]"
              aria-label="Customer contact details"
            >
              <DetailRow
                icon={<Building2 className="h-4 w-4" />}
                label="Company"
              >
                {selected.companyName || 'Not provided'}
              </DetailRow>
              <DetailRow
                icon={<UserRound className="h-4 w-4" />}
                label="Contact"
              >
                {selected.contactName || 'Not provided'}
              </DetailRow>
              <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
                {selected.email ? (
                  <a
                    className="text-brand-primary hover:underline"
                    href={`mailto:${selected.email}`}
                  >
                    {selected.email}
                  </a>
                ) : (
                  'Not provided'
                )}
              </DetailRow>
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
                {selected.phone ? (
                  <a
                    className="text-brand-primary hover:underline"
                    href={`tel:${selected.phone}`}
                  >
                    {selected.phone}
                  </a>
                ) : (
                  'Not provided'
                )}
              </DetailRow>
              <DetailRow
                icon={<MapPin className="h-4 w-4" />}
                label="Service address"
              >
                {formatAddress(selected).length
                  ? formatAddress(selected).map((line) => (
                      <div key={line}>{line}</div>
                    ))
                  : 'Not provided'}
              </DetailRow>
              <DetailRow
                icon={<UserRound className="h-4 w-4" />}
                label="Account manager"
              >
                {memberName(members, selected.assignedMemberId)}
              </DetailRow>
            </section>

            <section>
              <h3 className="text-app-primary text-sm font-medium">Notes</h3>
              <p className="text-neutral-text-secondary mt-2 whitespace-pre-wrap text-sm leading-6">
                {selected.notes || 'No notes added.'}
              </p>
            </section>

            <section
              className="border-app border-t pt-5"
              aria-labelledby="customer-services-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3
                    id="customer-services-heading"
                    className="text-app-primary text-sm font-medium"
                  >
                    Recurring Services
                  </h3>
                  <p className="text-app-muted mt-1 text-xs">
                    Repeat service agreements are separate from their individual
                    Jobs.
                  </p>
                </div>
                {customerServicesError ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadCustomerServices(selected.id)}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
              {customerServicesLoading ? (
                <div
                  className="mt-4 space-y-2"
                  aria-label="Loading Recurring Services"
                >
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : customerServicesError ? (
                <Alert variant="error" className="mt-4">
                  {customerServicesError}
                </Alert>
              ) : customerServices.length === 0 ? (
                <div className="border-app bg-app-surface-muted text-neutral-text-secondary mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                  No Recurring Services are linked to this Customer.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {customerServices.map((service) => (
                    <Link
                      key={service.id}
                      href={`/dashboard/${workspaceSlug}/scheduling/recurring-services`}
                      className="border-app bg-app-surface-muted hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 block rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-app-primary text-sm font-medium">
                            {service.name}
                          </p>
                          <p className="text-app-muted mt-1 text-xs">
                            {recurringServiceStatusLabels[service.status]} ·{' '}
                            {formatRecurringServiceCadence(
                              service.recurrenceSeries?.normalizedRule,
                            )}
                          </p>
                          <p className="text-app-muted mt-1 text-xs">
                            {recurringServiceAssignmentLabel(
                              service,
                              memberById,
                              new Map(),
                            )}
                            {' · Next visit: '}
                            {boundedUpcomingJobs(service.jobs ?? [], 1)[0]
                              ?.scheduledStartAt
                              ? formatDate(
                                  boundedUpcomingJobs(service.jobs ?? [], 1)[0]
                                    .scheduledStartAt as string,
                                )
                              : 'Not scheduled'}
                          </p>
                        </div>
                        <span className="text-neutral-text-secondary text-xs">
                          {formatRevenueCurrency(
                            service.pricePerVisitCents,
                            service.currency,
                          )}{' '}
                          per visit
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section
              className="border-app border-t pt-5"
              aria-labelledby="customer-jobs-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3
                    id="customer-jobs-heading"
                    className="text-app-primary text-sm font-medium"
                  >
                    Jobs
                  </h3>
                  <p className="text-app-muted mt-1 text-xs">
                    Durable Jobs currently associated with this Customer.
                  </p>
                </div>
                {customerJobsError ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadCustomerJobs(selected.id)}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>

              {customerJobsLoading ? (
                <div
                  className="mt-4 space-y-2"
                  aria-label="Loading Customer Jobs"
                >
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : customerJobsError ? (
                <Alert variant="error" className="mt-4" role="alert">
                  {customerJobsError}
                </Alert>
              ) : customerJobs.length === 0 ? (
                <div className="border-app bg-app-surface-muted text-neutral-text-secondary mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                  No Jobs are linked to this Customer yet.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {customerJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/dashboard/${workspaceSlug}/service-requests?jobId=${encodeURIComponent(job.id)}`}
                      className="border-app bg-app-surface-muted hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 block rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-app-primary text-sm font-medium">
                            {job.title}
                          </div>
                          <div className="text-app-muted mt-1 text-xs">
                            {jobStatusLabels[job.status]} ·{' '}
                            {priorityLabels[job.priority]}
                          </div>
                        </div>
                        {job.valueCents !== null ? (
                          <span className="text-neutral-text-secondary text-xs">
                            {formatRevenueCurrency(
                              job.valueCents,
                              job.currency,
                            )}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-neutral-text-secondary mt-2 text-xs">
                        {job.completedAt
                          ? `Completed ${formatDate(job.completedAt)}`
                          : job.scheduledStartAt
                            ? `Scheduled ${formatDate(job.scheduledStartAt)}`
                            : 'Not scheduled'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="border-app text-app-muted grid gap-2 border-t pt-4 text-xs sm:grid-cols-2">
              <div>Created {formatDate(selected.createdAt)}</div>
              <div>Updated {formatDate(selected.updatedAt)}</div>
            </section>
          </div>
        ) : null}
      </CustomerDialog>

      <ConfirmDialog
        open={archiveOpen}
        title="Archive Customer"
        description="Archiving removes this Customer from active Customers without destroying the record."
        confirmLabel="Archive Customer"
        destructive
        onOpenChange={setArchiveOpen}
        onConfirm={confirmArchive}
      />
    </div>
  )
}
