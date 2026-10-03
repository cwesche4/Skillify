'use client'

import Link from 'next/link'
import React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Copy,
  FilePlus2,
  Mail,
  Plus,
  RefreshCw,
  ShieldOff,
  Trash2,
} from 'lucide-react'

import { EstimateOperationalizationModal } from '@/components/dashboard/estimates/EstimateOperationalizationModal'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { listCustomers } from '@/lib/customers/client'
import type { CustomerClientRecord } from '@/lib/customers/clientTypes'
import {
  archiveEstimate,
  createEstimateShare,
  createEstimate,
  estimateAction,
  EstimatesApiError,
  getEstimate,
  listEstimates,
  revokeEstimateShare,
  rotateEstimateShare,
  sendEstimateEmail,
  updateEstimate,
} from '@/lib/estimates/client'
import type {
  EstimateClientListRecord,
  EstimateClientCustomerExperience,
  EstimateClientOperationalCustomer,
  EstimateClientOperationalization,
  EstimateClientRecord,
  EstimateClientRevision,
} from '@/lib/estimates/clientTypes'
import type { EstimateListView } from '@/lib/estimates/types'
import { listLeads } from '@/lib/leads/client'
import type { LeadClientRecord } from '@/lib/leads/clientTypes'
import { EstimateStatus } from '@/lib/prisma/enums'

type Props = {
  workspaceId: string
  workspaceSlug: string
  initialEstimateId?: string
  initialLeadId?: string
  initialCustomerId?: string
  initialCreate?: boolean
  timezone?: string
  members?: Array<{ id: string; name: string }>
  teams?: Array<{ id: string; name: string }>
}

type DraftLine = {
  key: string
  title: string
  description: string
  billingBasis: 'ONE_TIME' | 'PER_VISIT'
  amount: string
}

type DraftState = {
  leadId: string
  customerId: string
  title: string
  scopeDescription: string
  currency: string
  expiresOn: string
  contactNameSnapshot: string
  contactEmailSnapshot: string
  contactPhoneSnapshot: string
  serviceAddressLine1Snapshot: string
  serviceAddressLine2Snapshot: string
  serviceAddressCitySnapshot: string
  serviceAddressRegionSnapshot: string
  serviceAddressPostalCodeSnapshot: string
  serviceAddressCountrySnapshot: string
  lines: DraftLine[]
}

const views: Array<{ key: EstimateListView; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PRESENTED', label: 'Presented' },
  { key: 'PAST_EXPIRY', label: 'Past expiry' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'VOIDED', label: 'Voided' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  title: '',
  description: '',
  billingBasis: 'ONE_TIME',
  amount: '',
})

const emptyDraft = (leadId = '', customerId = ''): DraftState => ({
  leadId,
  customerId,
  title: '',
  scopeDescription: '',
  currency: 'USD',
  expiresOn: '',
  contactNameSnapshot: '',
  contactEmailSnapshot: '',
  contactPhoneSnapshot: '',
  serviceAddressLine1Snapshot: '',
  serviceAddressLine2Snapshot: '',
  serviceAddressCitySnapshot: '',
  serviceAddressRegionSnapshot: '',
  serviceAddressPostalCodeSnapshot: '',
  serviceAddressCountrySnapshot: '',
  lines: [emptyLine()],
})

function draftFromEstimate(estimate: EstimateClientRecord): DraftState {
  return {
    leadId: estimate.leadId ?? '',
    customerId: estimate.customerId ?? '',
    title: estimate.title,
    scopeDescription: estimate.scopeDescription ?? '',
    currency: estimate.currency,
    expiresOn: estimate.expiresOn ?? '',
    contactNameSnapshot: estimate.contactNameSnapshot ?? '',
    contactEmailSnapshot: estimate.contactEmailSnapshot ?? '',
    contactPhoneSnapshot: estimate.contactPhoneSnapshot ?? '',
    serviceAddressLine1Snapshot: estimate.serviceAddressLine1Snapshot ?? '',
    serviceAddressLine2Snapshot: estimate.serviceAddressLine2Snapshot ?? '',
    serviceAddressCitySnapshot: estimate.serviceAddressCitySnapshot ?? '',
    serviceAddressRegionSnapshot: estimate.serviceAddressRegionSnapshot ?? '',
    serviceAddressPostalCodeSnapshot:
      estimate.serviceAddressPostalCodeSnapshot ?? '',
    serviceAddressCountrySnapshot: estimate.serviceAddressCountrySnapshot ?? '',
    lines: estimate.lineItems.map((line) => ({
      key: line.id,
      title: line.title,
      description: line.description ?? '',
      billingBasis: line.billingBasis,
      amount: (line.amountCents / 100).toFixed(2),
    })),
  }
}

function money(cents: number, currency: string) {
  const displayCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: displayCurrency,
  }).format(cents / 100)
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}

function actorName(
  actor: { fullName: string | null; email: string | null } | null,
) {
  return actor?.fullName || actor?.email || 'Not recorded'
}

function statusLabel(
  estimate: EstimateClientListRecord,
  workspaceDateKey: string,
) {
  if (
    estimate.status === EstimateStatus.PRESENTED &&
    estimate.expiresOn &&
    estimate.expiresOn < workspaceDateKey
  ) {
    return 'Expired'
  }
  return estimate.status.charAt(0) + estimate.status.slice(1).toLowerCase()
}

function statusVariant(status: string) {
  if (status === 'Accepted') return 'green' as const
  if (status === 'Declined' || status === 'Voided' || status === 'Expired') {
    return 'red' as const
  }
  if (status === 'Presented') return 'blue' as const
  return 'gray' as const
}

function toMutation(draft: DraftState) {
  return {
    title: draft.title,
    scopeDescription: draft.scopeDescription || null,
    currency: draft.currency,
    expiresOn: draft.expiresOn || null,
    contactNameSnapshot: draft.contactNameSnapshot || null,
    contactEmailSnapshot: draft.contactEmailSnapshot || null,
    contactPhoneSnapshot: draft.contactPhoneSnapshot || null,
    serviceAddressLine1Snapshot: draft.serviceAddressLine1Snapshot || null,
    serviceAddressLine2Snapshot: draft.serviceAddressLine2Snapshot || null,
    serviceAddressCitySnapshot: draft.serviceAddressCitySnapshot || null,
    serviceAddressRegionSnapshot: draft.serviceAddressRegionSnapshot || null,
    serviceAddressPostalCodeSnapshot:
      draft.serviceAddressPostalCodeSnapshot || null,
    serviceAddressCountrySnapshot: draft.serviceAddressCountrySnapshot || null,
    lineItems: draft.lines.map((line) => ({
      title: line.title,
      description: line.description || null,
      billingBasis: line.billingBasis,
      amountCents: Math.round(Number(line.amount) * 100),
    })),
  }
}

export function EstimatesClient({
  workspaceId,
  workspaceSlug,
  initialEstimateId,
  initialLeadId,
  initialCustomerId,
  initialCreate,
  timezone = 'UTC',
  members = [],
  teams = [],
}: Props) {
  const [view, setView] = useState<EstimateListView>('ALL')
  const [estimates, setEstimates] = useState<EstimateClientListRecord[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [workspaceDateKey, setWorkspaceDateKey] = useState('')
  const [selected, setSelected] = useState<EstimateClientRecord | null>(null)
  const [revisions, setRevisions] = useState<EstimateClientRevision[]>([])
  const [revisionHistoryTruncated, setRevisionHistoryTruncated] =
    useState(false)
  const [operationalization, setOperationalization] =
    useState<EstimateClientOperationalization | null>(null)
  const [operationalCustomer, setOperationalCustomer] =
    useState<EstimateClientOperationalCustomer | null>(null)
  const [customerExperience, setCustomerExperience] =
    useState<EstimateClientCustomerExperience | null>(null)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendIdempotencyKey, setSendIdempotencyKey] = useState('')
  const [leads, setLeads] = useState<LeadClientRecord[]>([])
  const [customers, setCustomers] = useState<CustomerClientRecord[]>([])
  const [draft, setDraft] = useState<DraftState>(() =>
    emptyDraft(initialLeadId, initialCustomerId),
  )
  const [editorOpen, setEditorOpen] = useState(Boolean(initialCreate))
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<
    'present' | 'accept' | 'decline' | 'void' | 'archive' | null
  >(null)

  const loadList = useCallback(
    async (next = false) => {
      setLoading(true)
      setError(null)
      try {
        const result = await listEstimates(workspaceId, {
          view,
          cursor: next ? (nextCursor ?? undefined) : undefined,
          pageSize: 20,
        })
        setEstimates((current) =>
          next ? [...current, ...result.estimates] : result.estimates,
        )
        setNextCursor(result.nextCursor)
        setWorkspaceDateKey(result.workspaceDateKey)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Estimates could not be loaded.',
        )
      } finally {
        setLoading(false)
      }
    },
    [nextCursor, view, workspaceId],
  )

  const openEstimate = useCallback(
    async (estimateId: string) => {
      setError(null)
      try {
        const result = await getEstimate(workspaceId, estimateId)
        setSelected(result.estimate)
        setRevisions(result.revisions)
        setRevisionHistoryTruncated(result.revisionHistoryTruncated)
        setOperationalization(result.operationalization)
        setOperationalCustomer(result.operationalCustomer)
        setCustomerExperience(result.customerExperience)
        setWorkspaceDateKey(result.workspaceDateKey)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Estimate details could not be loaded.',
        )
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    void loadList()
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void Promise.all([listLeads(workspaceId), listCustomers(workspaceId)])
      .then(([nextLeads, nextCustomers]) => {
        setLeads(nextLeads)
        setCustomers(nextCustomers)
      })
      .catch(() => undefined)
  }, [workspaceId])

  useEffect(() => {
    if (initialEstimateId) void openEstimate(initialEstimateId)
  }, [initialEstimateId, openEstimate])

  const subtotals = useMemo(
    () =>
      draft.lines.reduce(
        (totals, line) => {
          const cents = Number.isFinite(Number(line.amount))
            ? Math.max(0, Math.round(Number(line.amount) * 100))
            : 0
          if (line.billingBasis === 'ONE_TIME') totals.oneTime += cents
          else totals.perVisit += cents
          return totals
        },
        { oneTime: 0, perVisit: 0 },
      ),
    [draft.lines],
  )

  function startCreate() {
    setSelected(null)
    setEditing(false)
    setDraft(emptyDraft(initialLeadId, initialCustomerId))
    setEditorOpen(true)
  }

  function startEdit() {
    if (!selected) return
    setDraft(draftFromEstimate(selected))
    setEditing(true)
    setEditorOpen(true)
  }

  async function saveDraft() {
    setSaving(true)
    setError(null)
    try {
      const invalidAmount = draft.lines.some(
        (line) =>
          !/^\d+(\.\d{1,2})?$/.test(line.amount) ||
          Number(line.amount) > 1_000_000,
      )
      if (invalidAmount)
        throw new Error(
          'Enter line-item amounts from $0.00 to $1,000,000.00 using no more than two decimal places.',
        )
      const mutation = toMutation(draft)
      const estimate =
        editing && selected
          ? await updateEstimate(
              workspaceId,
              selected.id,
              selected.version,
              mutation,
            )
          : await createEstimate(workspaceId, {
              leadId: draft.leadId || null,
              customerId: draft.customerId || null,
              title: mutation.title,
              scopeDescription: mutation.scopeDescription,
              currency: mutation.currency,
              expiresOn: mutation.expiresOn,
              lineItems: mutation.lineItems,
            })
      setEditorOpen(false)
      setSelected(estimate)
      await Promise.all([openEstimate(estimate.id), loadList()])
    } catch (saveError) {
      setError(
        saveError instanceof EstimatesApiError || saveError instanceof Error
          ? saveError.message
          : 'The Estimate could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function runAction() {
    if (!selected || !confirmAction) return
    setSaving(true)
    setError(null)
    try {
      const estimate =
        confirmAction === 'archive'
          ? await archiveEstimate(workspaceId, selected.id, selected.version)
          : await estimateAction(
              workspaceId,
              selected.id,
              confirmAction,
              selected.version,
            )
      setConfirmAction(null)
      setSelected(confirmAction === 'archive' ? null : estimate)
      await loadList()
      if (confirmAction !== 'archive') await openEstimate(estimate.id)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'The Estimate action could not be completed.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function revise() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const revision = await estimateAction(
        workspaceId,
        selected.id,
        'revise',
        selected.version,
      )
      setSelected(revision)
      setDraft(draftFromEstimate(revision))
      setEditing(true)
      setEditorOpen(true)
      await loadList()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'A revision could not be created.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function copySecureLink() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const result = await createEstimateShare(
        workspaceId,
        selected.id,
        selected.version,
      )
      await navigator.clipboard.writeText(result.share.url)
      await openEstimate(selected.id)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'The secure link could not be copied.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function rotateSecureLink() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const result = await rotateEstimateShare(
        workspaceId,
        selected.id,
        selected.version,
      )
      await navigator.clipboard.writeText(result.share.url)
      await openEstimate(selected.id)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'The secure link could not be rotated.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function revokeSecureLink() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await revokeEstimateShare(workspaceId, selected.id, selected.version)
      await openEstimate(selected.id)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'The secure link could not be revoked.',
      )
    } finally {
      setSaving(false)
    }
  }

  function openSendEmail() {
    if (!selected) return
    setSendEmail(
      customerExperience?.deliveries[0]?.recipientEmail ||
        selected.contactEmailSnapshot ||
        '',
    )
    setSendIdempotencyKey(crypto.randomUUID())
    setSendOpen(true)
  }

  async function queueEmail() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await sendEstimateEmail(workspaceId, selected.id, {
        expectedVersion: selected.version,
        recipientEmail: sendEmail,
        idempotencyKey: sendIdempotencyKey || crypto.randomUUID(),
      })
      setSendOpen(false)
      setSendIdempotencyKey('')
      await openEstimate(selected.id)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'The Estimate email could not be queued.',
      )
    } finally {
      setSaving(false)
    }
  }

  const effectiveStatus = selected
    ? statusLabel(selected, workspaceDateKey)
    : null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">
            Commercial scope
          </p>
          <h1 className="text-app-primary mt-1 text-2xl font-semibold">
            Estimates
          </h1>
          <p className="text-app-muted mt-2 max-w-2xl text-sm">
            Record priced work, present exact revisions, securely share them,
            and track customer decisions separately from operational work.
          </p>
        </div>
        <Button
          onClick={startCreate}
          leftIcon={<FilePlus2 className="h-4 w-4" />}
        >
          Create Estimate
        </Button>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2" aria-label="Estimate saved views">
        {views.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={view === item.key ? 'primary' : 'outline'}
            onClick={() => setView(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <section className="border-app overflow-hidden rounded-2xl border">
        {loading && !estimates.length ? (
          <p className="text-app-muted p-8 text-center text-sm">
            Loading Estimates…
          </p>
        ) : estimates.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-app-primary font-medium">
              No Estimates in this view
            </p>
            <p className="text-app-muted mt-1 text-sm">
              Create a Draft from a Lead, an existing Customer, or here.
            </p>
          </div>
        ) : (
          <div className="divide-app divide-y">
            {estimates.map((estimate) => {
              const label = statusLabel(estimate, workspaceDateKey)
              return (
                <button
                  key={estimate.id}
                  type="button"
                  onClick={() => void openEstimate(estimate.id)}
                  className="hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 flex w-full flex-col gap-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="text-app-primary block text-sm font-medium">
                      {estimate.title}
                    </span>
                    <span className="text-app-muted mt-1 block text-xs">
                      {estimate.referenceNumber} · Rev {estimate.revisionNumber}{' '}
                      ·{' '}
                      {estimate.customer?.displayName ||
                        estimate.lead?.displayName ||
                        'Commercial context'}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-app-muted text-xs">
                      {money(estimate.oneTimeSubtotalCents, estimate.currency)}{' '}
                      one-time
                    </span>
                    <span className="text-app-muted text-xs">
                      {money(
                        estimate.recurringPerVisitSubtotalCents,
                        estimate.currency,
                      )}{' '}
                      / visit
                    </span>
                    <Badge variant={statusVariant(label)}>
                      {estimate.archivedAt ? `Archived · ${label}` : label}
                    </Badge>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            loading={loading}
            onClick={() => void loadList(true)}
          >
            Load more
          </Button>
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(selected) && !editorOpen}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selected.referenceNumber} · Revision ${selected.revisionNumber}`
            : undefined
        }
        description={selected?.title}
        size="lg"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(effectiveStatus ?? '')}>
                {selected.archivedAt
                  ? `Archived · ${effectiveStatus}`
                  : effectiveStatus}
              </Badge>
              {selected.lead ? (
                <Link
                  className="text-xs text-brand-primary hover:underline"
                  href={`/dashboard/${encodeURIComponent(workspaceSlug)}/leads?leadId=${encodeURIComponent(selected.lead.id)}`}
                >
                  Lead: {selected.lead.displayName}
                </Link>
              ) : null}
              {selected.customer ? (
                <Link
                  className="text-xs text-brand-primary hover:underline"
                  href={`/dashboard/${encodeURIComponent(workspaceSlug)}/clients?customerId=${encodeURIComponent(selected.customer.id)}`}
                >
                  Customer: {selected.customer.displayName}
                </Link>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Contact">
                {selected.contactNameSnapshot || 'Not provided'}
                <br />
                {selected.contactEmailSnapshot || 'No email'}
                <br />
                {selected.contactPhoneSnapshot || 'No phone'}
              </Detail>
              <Detail label="Service location">
                {[
                  selected.serviceAddressLine1Snapshot,
                  selected.serviceAddressLine2Snapshot,
                  [
                    selected.serviceAddressCitySnapshot,
                    selected.serviceAddressRegionSnapshot,
                    selected.serviceAddressPostalCodeSnapshot,
                  ]
                    .filter(Boolean)
                    .join(', '),
                  selected.serviceAddressCountrySnapshot,
                ]
                  .filter(Boolean)
                  .join('\n') || 'Not provided'}
              </Detail>
            </div>
            <Detail label="Scope">
              <span className="whitespace-pre-wrap">
                {selected.scopeDescription || 'No scope notes.'}
              </span>
            </Detail>
            <section aria-labelledby="estimate-lines-heading">
              <h3
                id="estimate-lines-heading"
                className="text-app-primary text-sm font-medium"
              >
                Priced scope
              </h3>
              <div className="mt-2 space-y-2">
                {selected.lineItems.map((line) => (
                  <div
                    key={line.id}
                    className="border-app rounded-xl border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-app-primary font-medium">
                        {line.title}
                      </span>
                      <span className="text-app-primary">
                        {money(line.amountCents, selected.currency)}
                      </span>
                    </div>
                    <p className="text-app-muted mt-1 text-xs">
                      {line.billingBasis === 'ONE_TIME'
                        ? 'One-time'
                        : 'Per visit'}
                      {line.description ? ` · ${line.description}` : ''}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-app mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-app-muted">One-time subtotal</span>
                  <strong className="text-app-primary ml-2">
                    {money(selected.oneTimeSubtotalCents, selected.currency)}
                  </strong>
                </p>
                <p>
                  <span className="text-app-muted">Per-visit subtotal</span>
                  <strong className="text-app-primary ml-2">
                    {money(
                      selected.recurringPerVisitSubtotalCents,
                      selected.currency,
                    )}
                  </strong>
                </p>
              </div>
            </section>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <Detail label="Expiry">
                {selected.expiresOn || 'No expiry'}
              </Detail>
              <Detail label="Created">
                {dateTime(selected.createdAt)} · {actorName(selected.createdBy)}
              </Detail>
              <Detail label="Presented">
                {dateTime(selected.presentedAt)} ·{' '}
                {actorName(selected.presentedBy)}
              </Detail>
              <Detail label="Accepted">
                {dateTime(selected.acceptedAt)} ·{' '}
                {actorName(selected.acceptedBy)}
              </Detail>
              <Detail label="Declined">
                {dateTime(selected.declinedAt)} ·{' '}
                {actorName(selected.declinedBy)}
              </Detail>
              <Detail label="Voided">
                {dateTime(selected.voidedAt)} · {actorName(selected.voidedBy)}
              </Detail>
            </div>
            <section aria-labelledby="estimate-customer-experience-heading">
              <h3
                id="estimate-customer-experience-heading"
                className="text-app-primary text-sm font-medium"
              >
                Customer experience
              </h3>
              <div className="mt-2 grid gap-3 text-xs sm:grid-cols-3">
                <Detail label="Commercial">
                  {effectiveStatus || 'Not recorded'}
                </Detail>
                <Detail label="Customer access">
                  {customerExperience?.share?.state
                    ? customerExperience.share.state.charAt(0) +
                      customerExperience.share.state.slice(1).toLowerCase()
                    : 'Not shared'}
                </Detail>
                <Detail label="Decision">
                  {customerExperience?.decision
                    ? `${customerExperience.decision.decision === 'ACCEPTED' ? 'Accepted' : 'Declined'} · ${customerExperience.decision.source === 'CUSTOMER_LINK' ? 'Customer link' : 'Recorded by management'}`
                    : 'Awaiting decision'}
                </Detail>
              </div>
              {customerExperience?.decision ? (
                <p className="text-app-muted mt-2 text-xs">
                  Recorded {dateTime(customerExperience.decision.occurredAt)}
                  {customerExperience.decision.acknowledgmentNameSnapshot
                    ? ` · Acknowledged by ${customerExperience.decision.acknowledgmentNameSnapshot}`
                    : customerExperience.decision.managementActor
                      ? ` · ${actorName(customerExperience.decision.managementActor)}`
                      : ''}
                </p>
              ) : null}
            </section>
            {customerExperience?.deliveries.length ? (
              <section aria-labelledby="estimate-delivery-history-heading">
                <h3
                  id="estimate-delivery-history-heading"
                  className="text-app-primary text-sm font-medium"
                >
                  Email delivery history
                </h3>
                <div className="border-app mt-2 divide-y overflow-hidden rounded-xl border">
                  {customerExperience.deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex flex-col gap-1 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        <span className="text-app-primary block font-medium">
                          {delivery.recipientEmail}
                        </span>
                        <span className="text-app-muted">
                          Requested {dateTime(delivery.requestedAt)}
                        </span>
                      </span>
                      <span className="text-app-muted">
                        {delivery.status
                          .split('_')
                          .map(
                            (word) =>
                              word.charAt(0) + word.slice(1).toLowerCase(),
                          )
                          .join(' ')}
                        {delivery.attempts
                          ? ` · ${delivery.attempts} attempt${delivery.attempts === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {customerExperience.deliveryHistoryTruncated ? (
                  <p className="text-app-muted mt-2 text-xs">
                    Showing the 20 most recent deliveries.
                  </p>
                ) : null}
              </section>
            ) : null}
            {revisions.length > 1 ? (
              <section aria-labelledby="estimate-revisions-heading">
                <h3
                  id="estimate-revisions-heading"
                  className="text-app-primary text-sm font-medium"
                >
                  Revision history
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {revisions.map((revision) => (
                    <Button
                      key={revision.id}
                      size="xs"
                      variant={
                        revision.id === selected.id ? 'primary' : 'outline'
                      }
                      onClick={() => void openEstimate(revision.id)}
                    >
                      Rev {revision.revisionNumber} ·{' '}
                      {revision.status.toLowerCase()}
                    </Button>
                  ))}
                </div>
                {revisionHistoryTruncated ? (
                  <p className="text-app-muted mt-2 text-xs">
                    Showing the first 100 revisions. Additional revision history
                    is not shown in this view.
                  </p>
                ) : null}
              </section>
            ) : null}
            {selected.status === EstimateStatus.ACCEPTED &&
            operationalization ? (
              <Alert variant="success">
                <strong>Work Created</strong>
                <span className="mt-1 block text-xs">
                  Operational work was created on{' '}
                  {dateTime(operationalization.operationalizedAt)}.
                </span>
                <span className="mt-2 flex flex-wrap gap-3">
                  {operationalization.jobId ? (
                    <Link
                      className="text-xs font-medium underline"
                      href={`/dashboard/${encodeURIComponent(workspaceSlug)}/service-requests?jobId=${encodeURIComponent(operationalization.jobId)}`}
                    >
                      Open Job
                    </Link>
                  ) : null}
                  {operationalization.recurringServiceIds.map(
                    (serviceId, index) => (
                      <Link
                        key={serviceId}
                        className="text-xs font-medium underline"
                        href={`/dashboard/${encodeURIComponent(workspaceSlug)}/scheduling/recurring-services?recurringServiceId=${encodeURIComponent(serviceId)}`}
                      >
                        Open Recurring Service {index + 1}
                      </Link>
                    ),
                  )}
                </span>
              </Alert>
            ) : null}
            {selected.status === EstimateStatus.ACCEPTED &&
            !operationalization &&
            !selected.archivedAt ? (
              operationalCustomer ? (
                <Alert variant="info">
                  <strong>Ready to create work</strong>
                  <span className="mt-1 block text-xs">
                    Acceptance is recorded. Management must review and confirm
                    the operational setup before work is created.
                  </span>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => setHandoffOpen(true)}
                  >
                    Create Work
                  </Button>
                </Alert>
              ) : (
                <Alert variant="warning">
                  <strong>Convert Lead to Customer first</strong>
                  <span className="mt-1 block text-xs">
                    Operational work requires an active Customer. No Customer
                    will be created automatically.
                  </span>
                  {selected.leadId ? (
                    <Link
                      className="mt-2 inline-block text-xs font-medium underline"
                      href={`/dashboard/${encodeURIComponent(workspaceSlug)}/leads?leadId=${encodeURIComponent(selected.leadId)}`}
                    >
                      Open Lead
                    </Link>
                  ) : null}
                </Alert>
              )
            ) : null}
            {selected.archivedAt ? (
              <Alert variant="info">
                This Estimate is archived and remains available as read-only
                commercial history.
              </Alert>
            ) : (
              <div className="border-app flex flex-wrap gap-2 border-t pt-4">
                {selected.status === EstimateStatus.DRAFT ? (
                  <Button onClick={startEdit}>Edit Draft</Button>
                ) : null}
                {selected.status === EstimateStatus.DRAFT ? (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('present')}
                  >
                    Mark Presented
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED &&
                effectiveStatus !== 'Expired' ? (
                  <Button
                    variant="outline"
                    leftIcon={<Copy className="h-4 w-4" />}
                    loading={saving}
                    onClick={() => void copySecureLink()}
                  >
                    Copy Secure Link
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED &&
                effectiveStatus !== 'Expired' ? (
                  <Button
                    variant="outline"
                    leftIcon={<Mail className="h-4 w-4" />}
                    onClick={openSendEmail}
                  >
                    {customerExperience?.deliveries.length
                      ? 'Resend Email'
                      : 'Send Email'}
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED &&
                effectiveStatus !== 'Expired' &&
                customerExperience?.share?.state === 'ACTIVE' ? (
                  <Button
                    variant="ghost"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    loading={saving}
                    onClick={() => void rotateSecureLink()}
                  >
                    Rotate Link
                  </Button>
                ) : null}
                {customerExperience?.share?.state === 'ACTIVE' ? (
                  <Button
                    variant="ghost"
                    leftIcon={<ShieldOff className="h-4 w-4" />}
                    loading={saving}
                    onClick={() => void revokeSecureLink()}
                  >
                    Revoke Link
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED &&
                effectiveStatus !== 'Expired' ? (
                  <Button onClick={() => setConfirmAction('accept')}>
                    Record Accepted
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED ? (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('decline')}
                  >
                    Record Declined
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.PRESENTED ||
                selected.status === EstimateStatus.VOIDED ? (
                  <Button
                    variant="outline"
                    loading={saving}
                    onClick={() => void revise()}
                  >
                    Create Revision
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.DECLINED ? (
                  <Button variant="outline" onClick={startCreate}>
                    Create New Estimate
                  </Button>
                ) : null}
                {selected.status === EstimateStatus.DRAFT ||
                selected.status === EstimateStatus.PRESENTED ? (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmAction('void')}
                  >
                    Void
                  </Button>
                ) : null}
                {selected.status !== EstimateStatus.PRESENTED &&
                !(
                  (selected.status === EstimateStatus.DRAFT ||
                    selected.status === EstimateStatus.VOIDED) &&
                  selected.previousRevisionId
                ) ? (
                  <Button
                    variant="ghost"
                    leftIcon={<Archive className="h-4 w-4" />}
                    onClick={() => setConfirmAction('archive')}
                  >
                    Archive
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {selected && operationalCustomer ? (
        <EstimateOperationalizationModal
          key={`${selected.id}:${selected.version}`}
          isOpen={handoffOpen}
          estimate={selected}
          customer={operationalCustomer}
          workspaceId={workspaceId}
          timezone={timezone}
          members={members}
          teams={teams}
          onClose={() => setHandoffOpen(false)}
          onCreated={async () => {
            setHandoffOpen(false)
            await Promise.all([openEstimate(selected.id), loadList()])
          }}
        />
      ) : null}

      <Modal
        isOpen={sendOpen}
        onClose={() => !saving && setSendOpen(false)}
        title={
          customerExperience?.deliveries.length
            ? 'Resend Estimate Email'
            : 'Send Estimate Email'
        }
        description="This queues an email from your verified workspace Resend sender. Presented remains the commercial state until the customer responds."
        size="sm"
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field label="Customer email" htmlFor="estimate-send-email">
            <Input
              id="estimate-send-email"
              type="email"
              className="min-h-11"
              value={sendEmail}
              maxLength={320}
              required
              onChange={(event) => setSendEmail(event.target.value)}
            />
          </Field>
          <Alert variant="info">
            The secure link is bound to this exact revision. Sending does not
            mean the message was delivered or opened.
          </Alert>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              className="min-h-11"
              variant="ghost"
              disabled={saving}
              onClick={() => setSendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11"
              loading={saving}
              disabled={!sendEmail.trim()}
              onClick={() => void queueEmail()}
            >
              Queue Email
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={editing ? 'Edit Draft Estimate' : 'Create Estimate'}
        description="Drafts stay editable until you record that they were presented."
        size="lg"
      >
        <div className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {!editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lead" htmlFor="estimate-lead">
                <Select
                  id="estimate-lead"
                  value={draft.leadId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      leadId: event.target.value,
                    }))
                  }
                >
                  <option value="">No Lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Customer" htmlFor="estimate-customer">
                <Select
                  id="estimate-customer"
                  value={draft.customerId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      customerId: event.target.value,
                    }))
                  }
                >
                  <option value="">No Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
          <Field label="Estimate title" htmlFor="estimate-title">
            <Input
              id="estimate-title"
              value={draft.title}
              maxLength={300}
              required
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Scope" htmlFor="estimate-scope">
            <Textarea
              id="estimate-scope"
              value={draft.scopeDescription}
              maxLength={10000}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  scopeDescription: event.target.value,
                }))
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="estimate-currency">
              <Input
                id="estimate-currency"
                value={draft.currency}
                maxLength={3}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
            <Field label="Expires on (optional)" htmlFor="estimate-expiry">
              <Input
                id="estimate-expiry"
                type="date"
                value={draft.expiresOn}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    expiresOn: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          {editing ? (
            <SnapshotFields draft={draft} setDraft={setDraft} />
          ) : null}
          <section aria-labelledby="draft-lines-heading">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="draft-lines-heading"
                className="text-app-primary text-sm font-medium"
              >
                Line items
              </h3>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    lines: [...current.lines, emptyLine()],
                  }))
                }
              >
                Add item
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {draft.lines.map((line, index) => (
                <div
                  key={line.key}
                  className="border-app space-y-3 rounded-xl border p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px_130px_auto]">
                    <Field
                      label={`Item ${index + 1}`}
                      htmlFor={`estimate-line-${line.key}`}
                    >
                      <Input
                        id={`estimate-line-${line.key}`}
                        value={line.title}
                        maxLength={300}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            lines: current.lines.map((item) =>
                              item.key === line.key
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Basis" htmlFor={`estimate-basis-${line.key}`}>
                      <Select
                        id={`estimate-basis-${line.key}`}
                        value={line.billingBasis}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            lines: current.lines.map((item) =>
                              item.key === line.key
                                ? {
                                    ...item,
                                    billingBasis: event.target
                                      .value as DraftLine['billingBasis'],
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="ONE_TIME">One-time</option>
                        <option value="PER_VISIT">Per visit</option>
                      </Select>
                    </Field>
                    <Field
                      label="Amount"
                      htmlFor={`estimate-amount-${line.key}`}
                    >
                      <Input
                        id={`estimate-amount-${line.key}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            lines: current.lines.map((item) =>
                              item.key === line.key
                                ? { ...item, amount: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Button
                      aria-label={`Remove item ${index + 1}`}
                      title="Remove item"
                      size="icon"
                      variant="ghost"
                      disabled={draft.lines.length === 1}
                      className="self-end"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.filter(
                            (item) => item.key !== line.key,
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Field
                    label="Description (optional)"
                    htmlFor={`estimate-description-${line.key}`}
                  >
                    <Input
                      id={`estimate-description-${line.key}`}
                      value={line.description}
                      maxLength={5000}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.map((item) =>
                            item.key === line.key
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </section>
          <div
            className="bg-app-surface-muted grid gap-3 rounded-xl p-4 sm:grid-cols-2"
            aria-live="polite"
          >
            <Detail label="One-time subtotal">
              {money(subtotals.oneTime, draft.currency || 'USD')}
            </Detail>
            <Detail label="Per-visit subtotal">
              {money(subtotals.perVisit, draft.currency || 'USD')}
            </Detail>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveDraft()}>
              {editing ? 'Save Draft' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => !saving && setConfirmAction(null)}
        title={confirmAction ? actionTitle(confirmAction) : undefined}
        description={
          confirmAction ? actionDescription(confirmAction) : undefined
        }
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </Button>
          <Button
            variant={
              confirmAction === 'void' || confirmAction === 'archive'
                ? 'danger'
                : 'primary'
            }
            loading={saving}
            onClick={() => void runAction()}
          >
            Confirm
          </Button>
        </div>
      </Modal>
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
      className="text-app-muted block text-xs font-medium"
    >
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-app-muted text-xs">{label}</div>
      <div className="text-app-primary mt-1 whitespace-pre-line text-sm">
        {children}
      </div>
    </div>
  )
}

function SnapshotFields({
  draft,
  setDraft,
}: {
  draft: DraftState
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>
}) {
  const fields: Array<{ key: keyof DraftState; label: string; type?: string }> =
    [
      { key: 'contactNameSnapshot', label: 'Contact name' },
      { key: 'contactEmailSnapshot', label: 'Contact email', type: 'email' },
      { key: 'contactPhoneSnapshot', label: 'Contact phone' },
      { key: 'serviceAddressLine1Snapshot', label: 'Address line 1' },
      { key: 'serviceAddressLine2Snapshot', label: 'Address line 2' },
      { key: 'serviceAddressCitySnapshot', label: 'City' },
      { key: 'serviceAddressRegionSnapshot', label: 'State / region' },
      { key: 'serviceAddressPostalCodeSnapshot', label: 'Postal code' },
      { key: 'serviceAddressCountrySnapshot', label: 'Country' },
    ]
  return (
    <section aria-labelledby="commercial-snapshot-heading">
      <h3
        id="commercial-snapshot-heading"
        className="text-app-primary text-sm font-medium"
      >
        Commercial snapshot
      </h3>
      <p className="text-app-muted mt-1 text-xs">
        These details are frozen when this revision is presented.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={`estimate-${field.key}`}
          >
            <Input
              id={`estimate-${field.key}`}
              type={field.type}
              value={String(draft[field.key])}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </Field>
        ))}
      </div>
    </section>
  )
}

type ConfirmAction = 'present' | 'accept' | 'decline' | 'void' | 'archive'

function actionTitle(action: ConfirmAction) {
  return {
    present: 'Mark this Estimate Presented?',
    accept: 'Record customer acceptance?',
    decline: 'Record customer decline?',
    void: 'Void this Estimate?',
    archive: 'Archive this Estimate?',
  }[action]
}

function actionDescription(action: ConfirmAction) {
  return {
    present:
      'This records that management presented the revision outside Skillify. It does not send or deliver anything, and the revision becomes immutable.',
    accept:
      'This records management’s knowledge that the customer accepted. It is not an electronic signature or payment authorization.',
    decline:
      'This records management’s knowledge that the customer declined this presented revision.',
    void: 'Voiding preserves history but marks this revision intentionally invalid.',
    archive:
      'Archiving removes this Estimate from active views while preserving its history.',
  }[action]
}
