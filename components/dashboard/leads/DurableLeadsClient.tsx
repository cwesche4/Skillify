'use client'

import React, {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, Pencil, Plus, X } from 'lucide-react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  archiveLead,
  convertLeadToCustomer,
  createLead,
  LeadsApiError,
  listLeads,
  updateLead,
} from '@/lib/leads/client'
import type {
  LeadClientRecord,
  LeadConvertedCustomer,
  LeadMemberOption,
  LeadMutationInput,
} from '@/lib/leads/clientTypes'
import { leadSources } from '@/lib/leads/validation'
import {
  durableLeadSavedViews,
  filterDurableLeads,
  leadStageLabels,
  matchesDurableLeadSavedView,
  normalizeDurableLeadSavedView,
  type DurableLeadSavedView,
} from '@/lib/leads/presentation'
import { LeadStage, type LeadStage as LeadStageValue } from '@/lib/prisma/enums'

const stageVariants: Record<LeadStageValue, BadgeVariant> = {
  NEW: 'blue',
  CONTACTED: 'purple',
  ESTIMATE_VISIT: 'orange',
  FOLLOW_UP: 'yellow',
  WON: 'green',
  LOST: 'red',
}

const highValueCents = 350_000

function apiMessage(error: unknown) {
  return error instanceof LeadsApiError
    ? error.message
    : 'The Lead request could not be completed.'
}

function money(cents: number | null, currency = 'USD') {
  if (cents === null) return 'Not provided'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function dateTime(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function memberName(members: LeadMemberOption[], id: string | null) {
  if (!id) return 'Unassigned'
  return members.find((member) => member.id === id)?.name ?? 'Team member'
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
}) {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 pt-12 sm:pt-20">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="border-app bg-app-surface-raised w-full max-w-2xl rounded-2xl border shadow-2xl"
      >
        <div className="border-app flex items-start justify-between gap-4 border-b p-5">
          <div>
            <h2 id={titleId} className="text-app-primary text-lg font-semibold">
              {title}
            </h2>
            <p id={descriptionId} className="text-app-muted mt-1 text-sm">
              {description}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-app-secondary block text-xs font-medium"
    >
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function LeadForm({
  lead,
  members,
  onClose,
  onSave,
}: {
  lead?: LeadClientRecord
  members: LeadMemberOption[]
  onClose: () => void
  onSave: (input: LeadMutationInput & { displayName: string }) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(lead?.displayName ?? '')
  const [companyName, setCompanyName] = useState(lead?.companyName ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [stage, setStage] = useState<LeadStageValue>(
    lead?.stage ?? LeadStage.NEW,
  )
  const [source, setSource] = useState(lead?.source ?? 'Manual Entry')
  const [estimatedValue, setEstimatedValue] = useState(
    lead?.estimatedValueCents === null ||
      lead?.estimatedValueCents === undefined
      ? ''
      : String(lead.estimatedValueCents / 100),
  )
  const [nextStep, setNextStep] = useState(lead?.nextStep ?? '')
  const [followUpAt, setFollowUpAt] = useState(
    toDateTimeInput(lead?.followUpAt ?? null),
  )
  const [assignedMemberId, setAssignedMemberId] = useState(
    lead?.assignedMemberId ?? '',
  )
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!displayName.trim()) {
      setError('Enter a Lead name.')
      return
    }
    const parsedValue = estimatedValue.trim() ? Number(estimatedValue) : null
    if (
      parsedValue !== null &&
      (!Number.isFinite(parsedValue) || parsedValue < 0)
    ) {
      setError('Enter a valid estimated value.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        displayName: displayName.trim(),
        companyName: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        stage,
        source: source || null,
        estimatedValueCents:
          parsedValue === null ? null : Math.round(parsedValue * 100),
        currency: 'USD',
        nextStep: nextStep.trim() || null,
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        assignedMemberId: assignedMemberId || null,
        notes: notes.trim() || null,
      })
    } catch (saveError) {
      setError(apiMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={lead ? 'Edit Lead' : 'Add Lead'}
      description="Keep the prospect details your team needs to follow up."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? (
          <Alert variant="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead name *" htmlFor="lead-name">
            <Input
              id="lead-name"
              autoFocus
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field label="Company" htmlFor="lead-company">
            <Input
              id="lead-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="lead-email">
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="lead-phone">
            <Input
              id="lead-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label="Stage" htmlFor="lead-stage">
            <Select
              id="lead-stage"
              value={stage}
              disabled={Boolean(lead?.convertedCustomerId)}
              onChange={(event) =>
                setStage(event.target.value as LeadStageValue)
              }
            >
              {Object.values(LeadStage).map((value) => (
                <option key={value} value={value}>
                  {leadStageLabels[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source" htmlFor="lead-source">
            <Select
              id="lead-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Not provided</option>
              {leadSources.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated value" htmlFor="lead-value">
            <Input
              id="lead-value"
              type="number"
              min="0"
              step="0.01"
              value={estimatedValue}
              onChange={(event) => setEstimatedValue(event.target.value)}
            />
          </Field>
          <Field label="Owner" htmlFor="lead-owner">
            <Select
              id="lead-owner"
              value={assignedMemberId}
              onChange={(event) => setAssignedMemberId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Follow-up" htmlFor="lead-follow-up">
            <Input
              id="lead-follow-up"
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
            />
          </Field>
          <Field label="Next step" htmlFor="lead-next-step">
            <Input
              id="lead-next-step"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="lead-notes">
          <Textarea
            id="lead-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {lead ? 'Save Lead' : 'Add Lead'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function DurableLeadsClient({
  workspaceId,
  workspaceSlug,
  workspaceTimezone = 'UTC',
  members,
}: {
  workspaceId: string
  workspaceSlug: string
  workspaceTimezone?: string
  members: LeadMemberOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view')
  const [leads, setLeads] = useState<LeadClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<DurableLeadSavedView>(() =>
    normalizeDurableLeadSavedView(requestedView),
  )
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<LeadClientRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [conversionStep, setConversionStep] = useState<
    'CONFIRM' | 'DUPLICATE' | null
  >(null)
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    LeadConvertedCustomer[]
  >([])
  const [converting, setConverting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLeads(await listLeads(workspaceId))
    } catch (loadError) {
      setError(apiMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setView(normalizeDurableLeadSavedView(requestedView))
  }, [requestedView])

  useEffect(() => {
    if (loading) return
    const leadId = searchParams.get('leadId')
    if (!leadId) return
    const lead = leads.find((candidate) => candidate.id === leadId)
    if (lead) {
      setSelected(lead)
      return
    }
    setNotice('That Lead is no longer available in this workspace.')
  }, [leads, loading, searchParams])

  const filtered = useMemo(() => {
    return filterDurableLeads(leads, view, search, {
      timezone: workspaceTimezone,
      highValueCents,
    })
  }, [leads, search, view, workspaceTimezone])

  const counts = useMemo(
    () =>
      new Map(
        durableLeadSavedViews.map((item) => [
          item.id,
          leads.filter((lead) =>
            matchesDurableLeadSavedView(lead, item.id, {
              timezone: workspaceTimezone,
              highValueCents,
            }),
          ).length,
        ]),
      ),
    [leads, workspaceTimezone],
  )

  const selectView = (next: DurableLeadSavedView) => {
    setView(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const openLead = (lead: LeadClientRecord) => {
    setSelected(lead)
    setActionError(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('leadId', lead.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const closeLead = () => {
    setSelected(null)
    setConversionStep(null)
    setDuplicateCandidates([])
    const params = new URLSearchParams(searchParams.toString())
    params.delete('leadId')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const replace = (lead: LeadClientRecord) => {
    setLeads((current) =>
      current.map((item) => (item.id === lead.id ? lead : item)),
    )
    setSelected(lead)
  }

  const changeStage = async (stage: LeadStageValue) => {
    if (!selected || stage === selected.stage) return
    setActionError(null)
    try {
      replace(await updateLead(workspaceId, selected.id, { stage }))
      setNotice(`${selected.displayName} moved to ${leadStageLabels[stage]}.`)
    } catch (stageError) {
      setActionError(apiMessage(stageError))
    }
  }

  const archiveSelected = async () => {
    if (!selected || !window.confirm(`Archive ${selected.displayName}?`)) return
    setActionError(null)
    try {
      await archiveLead(workspaceId, selected.id)
      setLeads((current) => current.filter((lead) => lead.id !== selected.id))
      setSelected(null)
      setNotice(`${selected.displayName} was archived.`)
    } catch (archiveError) {
      setActionError(apiMessage(archiveError))
    }
  }

  const convertSelected = async (confirmDuplicate: boolean) => {
    if (!selected) return
    setConverting(true)
    setActionError(null)
    try {
      const result = await convertLeadToCustomer(
        workspaceId,
        selected.id,
        confirmDuplicate,
      )
      if (result.status === 'DUPLICATE_WARNING') {
        replace(result.lead)
        setDuplicateCandidates(result.candidates)
        setConversionStep('DUPLICATE')
        return
      }
      replace(result.lead)
      setConversionStep(null)
      setDuplicateCandidates([])
      setNotice(
        result.status === 'ALREADY_CONVERTED'
          ? `${result.lead.displayName} was already converted to ${result.customer.displayName}.`
          : `${result.lead.displayName} was converted to ${result.customer.displayName}.`,
      )
    } catch (conversionError) {
      setConversionStep(null)
      setActionError(apiMessage(conversionError))
    } finally {
      setConverting(false)
    }
  }

  return (
    <DashboardShell className="max-w-7xl">
      <div id="leads-workspace" className="scroll-mt-28" />
      <PageHeader
        title="Leads"
        description="Track new prospects and the next step needed to win their work."
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
          >
            Add Lead
          </Button>
        }
      />
      {notice ? (
        <Alert variant="success" className="mb-4" role="status">
          {notice}
        </Alert>
      ) : null}
      <div className="mb-4 flex flex-col gap-3">
        <Input
          aria-label="Search Leads"
          placeholder="Search leads..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Lead saved views"
        >
          {durableLeadSavedViews.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={view === item.id ? 'primary' : 'outline'}
              onClick={() => selectView(item.id)}
            >
              {item.label} ({counts.get(item.id) ?? 0})
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="text-app-muted p-8 text-center">
            Loading durable Leads…
          </CardContent>
        </Card>
      ) : error ? (
        <Alert
          variant="error"
          role="alert"
          className="flex items-center justify-between gap-3"
        >
          {error}
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={leads.length ? 'No Leads match this view' : 'No Leads yet'}
          description={
            leads.length
              ? 'Try another saved view or search.'
              : 'Add your first prospect when you are ready to follow up.'
          }
          actionLabel={leads.length ? undefined : 'Add Lead'}
          onAction={leads.length ? undefined : () => setCreating(true)}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => openLead(lead)}
              className="border-app bg-app-surface-raised hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-app-primary truncate font-medium">
                    {lead.displayName}
                  </div>
                  <div className="text-app-muted mt-1 truncate text-xs">
                    {lead.companyName ||
                      lead.email ||
                      lead.phone ||
                      'No contact details'}
                  </div>
                </div>
                <Badge variant={stageVariants[lead.stage]}>
                  {leadStageLabels[lead.stage]}
                </Badge>
              </div>
              <div className="text-neutral-text-secondary mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <span>{money(lead.estimatedValueCents, lead.currency)}</span>
                <span className="sm:text-right">
                  {memberName(members, lead.assignedMemberId)}
                </span>
                <span className="sm:col-span-2">
                  Next: {lead.nextStep || 'Not set'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating ? (
        <LeadForm
          members={members}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const lead = await createLead(workspaceId, input)
            setLeads((current) => [lead, ...current])
            setCreating(false)
            setSelected(lead)
            setNotice(`${lead.displayName} was added.`)
          }}
        />
      ) : null}
      {selected && editing ? (
        <LeadForm
          lead={selected}
          members={members}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            const lead = await updateLead(workspaceId, selected.id, input)
            replace(lead)
            setEditing(false)
            setNotice(`${lead.displayName} was updated.`)
          }}
        />
      ) : null}
      {selected && !editing ? (
        <Modal
          title={selected.displayName}
          description={selected.companyName || 'Lead details'}
          onClose={closeLead}
        >
          <div className="space-y-5">
            {actionError ? (
              <Alert variant="error" role="alert">
                {actionError}
              </Alert>
            ) : null}
            {selected.convertedCustomer ? (
              <Alert variant="info">
                Converted to Customer{' '}
                <strong>{selected.convertedCustomer.displayName}</strong>
                {selected.convertedCustomer.archivedAt
                  ? ' (archived)'
                  : ''} on {dateTime(selected.convertedAt)}.
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stage" htmlFor="lead-detail-stage">
                <Select
                  id="lead-detail-stage"
                  value={selected.stage}
                  disabled={Boolean(selected.convertedCustomerId)}
                  onChange={(event) =>
                    void changeStage(event.target.value as LeadStageValue)
                  }
                >
                  {Object.values(LeadStage).map((value) => (
                    <option key={value} value={value}>
                      {leadStageLabels[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <div className="text-app-muted text-xs">Owner</div>
                <div className="text-app-primary mt-1 text-sm">
                  {memberName(members, selected.assignedMemberId)}
                </div>
              </div>
              <div>
                <div className="text-app-muted text-xs">Contact</div>
                <div className="text-app-primary mt-1 text-sm">
                  {selected.email || 'No email'}
                  <br />
                  {selected.phone || 'No phone'}
                </div>
              </div>
              <div>
                <div className="text-app-muted text-xs">Estimated value</div>
                <div className="text-app-primary mt-1 text-sm">
                  {money(selected.estimatedValueCents, selected.currency)}
                </div>
              </div>
              <div>
                <div className="text-app-muted text-xs">Follow-up</div>
                <div className="text-app-primary mt-1 text-sm">
                  {dateTime(selected.followUpAt)}
                </div>
              </div>
              <div>
                <div className="text-app-muted text-xs">Source</div>
                <div className="text-app-primary mt-1 text-sm">
                  {selected.source || 'Not provided'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-app-muted text-xs">Next step</div>
              <div className="text-app-primary mt-1 text-sm">
                {selected.nextStep || 'Not set'}
              </div>
            </div>
            <div>
              <div className="text-app-muted text-xs">Notes</div>
              <p className="text-app-primary mt-1 whitespace-pre-wrap text-sm">
                {selected.notes || 'No notes added.'}
              </p>
            </div>
            {selected.convertedCustomer ? (
              selected.convertedCustomer.archivedAt ? (
                <div className="border-app text-app-muted rounded-xl border px-3.5 py-2 text-center text-sm">
                  Converted Customer is archived
                </div>
              ) : (
                <Link
                  href={`/dashboard/${encodeURIComponent(workspaceSlug)}/clients?customerId=${encodeURIComponent(selected.convertedCustomer.id)}`}
                  className="border-app text-app-primary hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 flex h-9 w-full items-center justify-center rounded-xl border px-3.5 text-sm font-medium focus:outline-none focus-visible:ring-2"
                >
                  Open Customer
                </Link>
              )
            ) : (
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => setConversionStep('CONFIRM')}
              >
                Convert to Customer
              </Button>
            )}
            <div className="border-app flex flex-wrap justify-between gap-2 border-t pt-4">
              <Button
                type="button"
                variant="danger"
                leftIcon={<Archive className="h-4 w-4" />}
                onClick={() => void archiveSelected()}
              >
                Archive
              </Button>
              <Button
                type="button"
                leftIcon={<Pencil className="h-4 w-4" />}
                onClick={() => setEditing(true)}
              >
                Edit Lead
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {selected && conversionStep ? (
        <Modal
          title={
            conversionStep === 'CONFIRM'
              ? 'Convert to Customer?'
              : 'Potential duplicate Customers'
          }
          description={
            conversionStep === 'CONFIRM'
              ? 'Review what this durable conversion will do.'
              : 'Matching contact information already exists in this workspace.'
          }
          onClose={() => {
            if (converting) return
            setConversionStep(null)
            setDuplicateCandidates([])
          }}
        >
          <div className="space-y-5">
            {conversionStep === 'CONFIRM' ? (
              <Alert variant="info">
                A new Customer will be created from this Lead. The Lead will be
                marked Won if necessary, and its history will remain preserved.
                No Job will be created.
              </Alert>
            ) : (
              <>
                <Alert variant="warning">
                  Duplicate contact information is allowed. Review these
                  Customers before choosing Convert Anyway.
                </Alert>
                <div className="space-y-2">
                  {duplicateCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="border-app rounded-xl border p-3 text-sm"
                    >
                      <div className="text-app-primary font-medium">
                        {candidate.displayName}
                        {candidate.archivedAt ? ' (archived)' : ''}
                      </div>
                      <div className="text-app-muted mt-1">
                        {candidate.companyName || 'No company'} ·{' '}
                        {candidate.email || 'No email'} ·{' '}
                        {candidate.phone || 'No phone'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={converting}
                onClick={() => {
                  setConversionStep(null)
                  setDuplicateCandidates([])
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={converting}
                onClick={() =>
                  void convertSelected(conversionStep === 'DUPLICATE')
                }
              >
                {conversionStep === 'DUPLICATE'
                  ? 'Convert Anyway'
                  : 'Convert to Customer'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </DashboardShell>
  )
}
