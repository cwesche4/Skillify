'use client'

import React, {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  EXPANDED_WORKSPACE_KNOWLEDGE_CATEGORIES,
  GOVERNED_KNOWLEDGE_SOURCE_LABELS,
  buildGovernedLearningRecommendations,
  buildWorkspaceKnowledgeQuality,
  detectWorkspaceKnowledgeConflicts,
  getStructuredProposal,
  getWorkspaceKnowledgeDependencies,
  getRuntimeUsageForKnowledge,
} from '@/lib/intelligence/workspaceKnowledgeGovernance'

type KnowledgeStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'SUPERSEDED'
type KnowledgeTab =
  | 'overview'
  | 'library'
  | 'queue'
  | 'gaps'
  | 'recommendations'
  | 'audit'
type UserRole = 'owner' | 'admin' | 'manager' | 'member'

type ScopeOption = {
  type: string
  label: string
  targetType?: 'team' | 'location' | 'serviceType' | 'customerSegment'
}

type SourceOption = {
  type: string
  label: string
}

type TargetOption = {
  id: string
  label: string
  type: 'team' | 'location' | 'serviceType' | 'customerSegment'
}

export type WorkspaceKnowledgeManagerItem = {
  id: string
  category: string
  title: string
  description: string | null
  structuredValue: unknown
  sourceSummary: string | null
  confidence: string | null
  approvalStatus: KnowledgeStatus
  createdById: string
  approvedById: string | null
  approvedAt: string | null
  reason: string | null
  tags: string[]
  version: number
  isArchived: boolean
  supersededById: string | null
  createdAt: string
  updatedAt: string
  source: {
    id: string
    type: string
    label: string
    domain: string
    recordType: string | null
    recordId: string | null
    referenceId: string | null
  } | null
  revisions: Array<{
    id: string
    version: number
    revisionType: string
    title: string
    changeSummary: string | null
    createdAt: string
  }>
  approvals: Array<{
    id: string
    action: string
    actorRole: string
    reason: string | null
    createdAt: string
  }>
  corrections: Array<{
    id: string
    correctionText: string
    status: string
    createdAt: string
  }>
}

export type WorkspaceKnowledgeManagerProps = {
  workspaceId: string
  workspaceSlug: string
  userRole: UserRole
  initialItems: WorkspaceKnowledgeManagerItem[]
  auditEvents: Array<{
    id: string
    eventType: string
    summary: string
    createdAt: string
  }>
  knowledgeGaps: Array<{
    id: string
    title: string
    description: string
    severity: string
    frequency: number
  }>
  recommendationHistory: Array<{
    id: string
    recommendationId: string
    recommendationTitle: string
    status: string
    occurredAt: string
  }>
  confidence: {
    level: string
    score: number
    known: string[]
    unknown: string[]
    missingData: string[]
    recommendedNextIntegrations: string[]
  }
  selectorTargets: {
    teams: TargetOption[]
    locations: TargetOption[]
    serviceTypes: TargetOption[]
    customerSegments: TargetOption[]
  }
}

const CATEGORY_OPTIONS = EXPANDED_WORKSPACE_KNOWLEDGE_CATEGORIES

const SCOPE_OPTIONS: ScopeOption[] = [
  { type: 'entireWorkspace', label: 'Entire Workspace' },
  { type: 'scheduling', label: 'Scheduling' },
  { type: 'crm', label: 'CRM' },
  { type: 'leads', label: 'Leads' },
  { type: 'opportunities', label: 'Opportunities' },
  { type: 'salesPipeline', label: 'Sales Pipeline' },
  { type: 'clients', label: 'Clients' },
  { type: 'tasks', label: 'Tasks' },
  { type: 'serviceRequests', label: 'Service Requests' },
  { type: 'automations', label: 'Automations' },
  { type: 'reportsAnalytics', label: 'Reports and Analytics' },
  { type: 'teamOperations', label: 'Team Operations' },
  { type: 'specificTeam', label: 'Specific Team', targetType: 'team' },
  {
    type: 'specificBusinessLocation',
    label: 'Specific Business Location',
    targetType: 'location',
  },
  {
    type: 'specificServiceType',
    label: 'Specific Service Type',
    targetType: 'serviceType',
  },
  {
    type: 'specificCustomerSegment',
    label: 'Specific Customer Segment',
    targetType: 'customerSegment',
  },
]

const SOURCE_OPTIONS: SourceOption[] = uniqueSources([
  { type: 'Owner instruction', label: 'Owner instruction' },
  { type: 'Admin instruction', label: 'Admin instruction' },
  { type: 'Manager suggestion', label: 'Manager suggestion' },
  { type: 'Member suggestion', label: 'Member suggestion' },
  ...GOVERNED_KNOWLEDGE_SOURCE_LABELS.map((label) => ({
    type: label,
    label,
  })),
  { type: 'AI Proposal', label: 'AI Proposal' },
  { type: 'Customer policy document', label: 'Customer policy document' },
  { type: 'Operating procedure', label: 'Operating procedure' },
  { type: 'Integration data', label: 'Integration data' },
  { type: 'Correction', label: 'Correction' },
  { type: 'Other', label: 'Other' },
])

const REJECTION_REASONS = [
  'Incorrect',
  'Insufficient evidence',
  'Outdated',
  'Duplicate',
  'Too broad',
  'Needs owner clarification',
  'Not appropriate for AI use',
  'Other',
]

const EMPTY_FORM = {
  statement: '',
  summary: '',
  reasoning: '',
  evidence: '',
  confidence: 'medium',
  dependencies: '',
  category: '',
  scopeType: '',
  targetId: '',
  explanation: '',
  sourceType: '',
  sourceOtherLabel: '',
  effectiveDate: '',
  reviewNotes: '',
  relatedModule: '',
  tags: '',
}

export function WorkspaceKnowledgeManager({
  workspaceId,
  workspaceSlug,
  userRole,
  initialItems,
  auditEvents,
  knowledgeGaps,
  recommendationHistory,
  confidence,
  selectorTargets,
}: WorkspaceKnowledgeManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('overview')
  const [items, setItems] = useState(initialItems)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] =
    useState<WorkspaceKnowledgeManagerItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | KnowledgeStatus>(
    'all',
  )
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [archiveFilter, setArchiveFilter] = useState<
    'active' | 'archived' | 'all'
  >('active')
  const [search, setSearch] = useState('')
  const [detailReason, setDetailReason] = useState('')
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0])
  const [correctionText, setCorrectionText] = useState('')

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('knowledgeTab')
    const status = params.get('knowledgeStatus')
    const archive = params.get('knowledgeArchive')
    if (isKnowledgeTab(tab)) setActiveTab(tab)
    if (isKnowledgeStatus(status)) setStatusFilter(status)
    if (isKnowledgeArchiveFilter(archive)) setArchiveFilter(archive)

    const proposalStatement = params.get('knowledgeStatement')?.trim()
    if (!proposalStatement) return

    setEditingItem(null)
    setForm({
      ...EMPTY_FORM,
      statement: proposalStatement,
      summary:
        params.get('knowledgeSummary') ??
        params.get('knowledgeExplanation') ??
        '',
      reasoning: params.get('knowledgeReasoning') ?? '',
      evidence:
        params.get('knowledgeEvidence') ?? 'Derived from AI investigation',
      confidence: params.get('knowledgeConfidence') ?? 'medium',
      dependencies: params.get('knowledgeDependencies') ?? '',
      category: params.get('knowledgeCategory') ?? 'AI Response Preference',
      scopeType: params.get('knowledgeScope') ?? 'entireWorkspace',
      explanation: params.get('knowledgeExplanation') ?? '',
      sourceType: params.get('knowledgeSource') ?? 'AI Proposal',
      reviewNotes: 'Proposed from Internal AI Playground response.',
      tags: 'ai-proposed',
    })
    setSubmitted(false)
    setFormError(null)
    setFormOpen(true)
    params.delete('knowledgeStatement')
    params.delete('knowledgeCategory')
    params.delete('knowledgeScope')
    params.delete('knowledgeExplanation')
    params.delete('knowledgeSummary')
    params.delete('knowledgeReasoning')
    params.delete('knowledgeEvidence')
    params.delete('knowledgeConfidence')
    params.delete('knowledgeDependencies')
    params.delete('knowledgeSource')
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', nextUrl)
  }, [])

  const canApprove = userRole === 'owner' || userRole === 'admin'
  const canManage = canApprove || userRole === 'manager'
  const selectedItem = selectedItemId
    ? (items.find((item) => item.id === selectedItemId) ?? null)
    : null

  const itemStats = useMemo(() => {
    const activeItems = items.filter((item) => !item.isArchived)
    return {
      approved: activeItems.filter((item) => item.approvalStatus === 'APPROVED')
        .length,
      pending: activeItems.filter(
        (item) =>
          item.approvalStatus === 'PENDING_REVIEW' ||
          item.approvalStatus === 'DRAFT',
      ).length,
      rejected: items.filter((item) => item.approvalStatus === 'REJECTED')
        .length,
      archived: items.filter(
        (item) =>
          item.isArchived ||
          item.approvalStatus === 'ARCHIVED' ||
          item.approvalStatus === 'SUPERSEDED',
      ).length,
    }
  }, [items])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.approvalStatus !== statusFilter)
        return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter)
        return false
      if (scopeFilter !== 'all' && getScope(item).type !== scopeFilter)
        return false
      if (
        sourceFilter !== 'all' &&
        (item.source?.type ?? item.source?.label ?? '') !== sourceFilter
      )
        return false
      if (
        archiveFilter === 'active' &&
        (item.isArchived ||
          item.approvalStatus === 'ARCHIVED' ||
          item.approvalStatus === 'SUPERSEDED')
      )
        return false
      if (
        archiveFilter === 'archived' &&
        !item.isArchived &&
        item.approvalStatus !== 'ARCHIVED' &&
        item.approvalStatus !== 'SUPERSEDED'
      )
        return false
      if (!query) return true
      return [
        item.title,
        item.description ?? '',
        item.category,
        getScopeLabel(item),
        item.source?.label ?? '',
        ...item.tags,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    archiveFilter,
    categoryFilter,
    items,
    scopeFilter,
    search,
    sourceFilter,
    statusFilter,
  ])

  const pendingItems = items.filter(
    (item) =>
      !item.isArchived &&
      (item.approvalStatus === 'PENDING_REVIEW' ||
        item.approvalStatus === 'DRAFT'),
  )
  const categories = Array.from(
    new Set(items.map((item) => item.category)),
  ).sort()
  const sources = Array.from(
    new Set(
      items
        .map((item) => item.source?.type ?? item.source?.label)
        .filter(Boolean) as string[],
    ),
  ).sort()
  const approvedItems = items.filter(
    (item) => item.approvalStatus === 'APPROVED' && !item.isArchived,
  )
  const selectedConflicts = selectedItem
    ? detectWorkspaceKnowledgeConflicts({
        proposed: selectedItem,
        approved: approvedItems,
      })
    : []
  const selectedQuality = selectedItem
    ? buildWorkspaceKnowledgeQuality({ item: selectedItem, approvedItems })
    : null
  const formConflicts =
    form.statement.trim() && form.category
      ? detectWorkspaceKnowledgeConflicts({
          proposed: {
            id: editingItem?.id ?? 'new-proposal',
            title: form.statement,
            category: form.category,
            structuredValue: {
              proposal: {
                title: form.statement,
                summary: form.summary || form.explanation || form.statement,
                reasoning: parseLines(form.reasoning),
              },
            },
          },
          approved: approvedItems.filter((item) => item.id !== editingItem?.id),
        })
      : []
  const learningRecommendations = buildGovernedLearningRecommendations(items)

  function openAddKnowledge(prefill?: Partial<typeof EMPTY_FORM>) {
    setEditingItem(null)
    setForm({
      ...EMPTY_FORM,
      sourceType: sourceTypeForRole(userRole),
      ...prefill,
    })
    setSubmitted(false)
    setFormError(null)
    setFormOpen(true)
  }

  function openEditKnowledge(item: WorkspaceKnowledgeManagerItem) {
    const scope = getScope(item)
    setEditingItem(item)
    setForm({
      statement: item.title,
      summary: getStructuredProposal(item.structuredValue)?.summary ?? '',
      reasoning: (
        getStructuredProposal(item.structuredValue)?.reasoning ?? []
      ).join('\n'),
      evidence: (
        getStructuredProposal(item.structuredValue)?.evidence ?? []
      ).join('\n'),
      confidence:
        getStructuredProposal(item.structuredValue)?.confidence ?? 'medium',
      dependencies: getWorkspaceKnowledgeDependencies(item).join(', '),
      category: item.category,
      scopeType: scope.type,
      targetId: scope.targetId ?? '',
      explanation: item.description ?? '',
      sourceType: item.source?.type ?? 'Admin instruction',
      sourceOtherLabel: '',
      effectiveDate:
        getMetadataString(item.structuredValue, 'effectiveDate') ?? '',
      reviewNotes: item.reason ?? '',
      relatedModule:
        getMetadataString(item.structuredValue, 'relatedModule') ?? '',
      tags: item.tags.join(', '),
    })
    setSubmitted(false)
    setFormError(null)
    setFormOpen(true)
  }

  async function submitKnowledge(saveAndApprove: boolean) {
    setSubmitted(true)
    setFormError(null)
    const errors = getFormErrors(form)
    if (Object.keys(errors).length) {
      setFormError(
        'Complete the highlighted fields before submitting workspace knowledge.',
      )
      return
    }

    const scope = buildScope(form, selectorTargets)
    const selectedSource = SOURCE_OPTIONS.find(
      (source) => source.type === form.sourceType,
    )
    const payload = {
      category: form.category,
      title: form.statement,
      description: form.summary || form.explanation || undefined,
      value: {
        proposal: {
          title: form.statement,
          summary: form.summary || form.explanation || form.statement,
          reasoning: parseLines(form.reasoning),
          evidence: parseLines(form.evidence),
          confidence: form.confidence,
          sourceLabel: form.sourceType || 'Manual Entry',
        },
        dependencies: parseTags(form.dependencies),
        runtimeUsage: runtimeUsageFromCategory(form.category),
      },
      scope,
      source: {
        type: form.sourceType,
        label:
          form.sourceType === 'Other'
            ? form.sourceOtherLabel
            : (selectedSource?.label ?? form.sourceType),
        customLabel: form.sourceOtherLabel || undefined,
        recordType: editingItem ? 'workspaceKnowledgeItem' : undefined,
        recordId: editingItem?.id,
      },
      effectiveDate: form.effectiveDate || undefined,
      reviewNotes: form.reviewNotes || undefined,
      relatedModule: form.relatedModule || undefined,
      tags: parseTags(form.tags),
      reason: form.reviewNotes || undefined,
    }

    try {
      const url = editingItem
        ? `/api/workspaces/${workspaceId}/knowledge/${editingItem.id}`
        : `/api/workspaces/${workspaceId}/knowledge`
      const response = await fetch(url, {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? 'Workspace knowledge could not be saved.')
      const createdOrUpdated = data.item as WorkspaceKnowledgeManagerItem

      if (saveAndApprove && canApprove) {
        const approveResponse = await fetch(
          `/api/workspaces/${workspaceId}/knowledge/${createdOrUpdated.id}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason:
                form.reviewNotes ||
                'Created and approved from Workspace Knowledge.',
            }),
          },
        )
        const approveData = await approveResponse.json()
        if (!approveResponse.ok)
          throw new Error(
            approveData.error ??
              'Workspace knowledge was saved but could not be approved.',
          )
      }

      setFormOpen(false)
      setEditingItem(null)
      refreshFromServer()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Workspace knowledge could not be saved.',
      )
    }
  }

  async function mutateItem(
    action: 'approve' | 'reject' | 'archive' | 'restore',
  ) {
    if (!selectedItem) return
    const reason =
      action === 'reject'
        ? `${rejectionReason}${detailReason ? `: ${detailReason}` : ''}`
        : detailReason
    if (action === 'reject' && !reason.trim()) {
      setDetailReason('Select or enter a rejection reason.')
      return
    }

    const endpoint =
      action === 'archive'
        ? `/api/workspaces/${workspaceId}/knowledge/${selectedItem.id}`
        : `/api/workspaces/${workspaceId}/knowledge/${selectedItem.id}/${action}`
    const response = await fetch(endpoint, {
      method: action === 'archive' ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await response.json()
    if (!response.ok) {
      setDetailReason(data.error ?? 'Knowledge action failed.')
      return
    }
    setDetailReason('')
    setSelectedItemId(null)
    refreshFromServer()
  }

  async function submitCorrection() {
    if (!selectedItem || !correctionText.trim()) return
    const response = await fetch(
      `/api/workspaces/${workspaceId}/knowledge/corrections`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeItemId: selectedItem.id,
          correctionText,
          correctedValue: { statement: correctionText },
          targetCategory: selectedItem.category,
          sourceDomain: selectedItem.source?.domain,
        }),
      },
    )
    if (response.ok) {
      setCorrectionText('')
      refreshFromServer()
    }
  }

  async function reviewCorrection(
    correctionId: string,
    action: 'accept' | 'reject',
  ) {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/knowledge/corrections/${correctionId}/${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason:
            detailReason ||
            `${action === 'accept' ? 'Accepted' : 'Rejected'} from Workspace Knowledge.`,
        }),
      },
    )
    if (response.ok) refreshFromServer()
  }

  function refreshFromServer() {
    startTransition(() => {
      router.refresh()
    })
  }

  function openKnowledgeFilteredView({
    tab,
    status = 'all',
    archive = 'active',
  }: {
    tab: KnowledgeTab
    status?: KnowledgeStatus | 'all'
    archive?: typeof archiveFilter
  }) {
    setActiveTab(tab)
    setStatusFilter(status)
    setArchiveFilter(archive)
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.set('knowledgeTab', tab)
    params.set('knowledgeStatus', status)
    params.set('knowledgeArchive', archive)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params.toString()}`,
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ['overview', 'Overview'],
            ['library', 'Knowledge Library'],
            ['queue', 'Review Queue'],
            ['gaps', 'Gaps and Corrections'],
            ['recommendations', 'Recommendation History'],
            ['audit', 'Audit'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeTab === key
                  ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200'
                  : 'text-neutral-text-secondary hover:text-neutral-text-primary border-white/10 bg-slate-950/40 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => openAddKnowledge()}>
          + Add Knowledge
        </Button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
          <OverviewCard
            title="Approved"
            count={itemStats.approved}
            variant="green"
            description="Available to Workspace AI."
            onClick={() =>
              openKnowledgeFilteredView({
                tab: 'library',
                status: 'APPROVED',
                archive: 'active',
              })
            }
          />
          <OverviewCard
            title="Pending Review"
            count={itemStats.pending}
            variant="yellow"
            description="Waiting for governed review."
            onClick={() =>
              openKnowledgeFilteredView({
                tab: 'queue',
                status: 'PENDING_REVIEW',
                archive: 'active',
              })
            }
          />
          <OverviewCard
            title="Rejected"
            count={itemStats.rejected}
            variant="red"
            description="Retained for audit only."
            onClick={() =>
              openKnowledgeFilteredView({
                tab: 'library',
                status: 'REJECTED',
                archive: 'all',
              })
            }
          />
          <OverviewCard
            title="Archived"
            count={itemStats.archived}
            variant="slate"
            description="Excluded from AI runtime."
            onClick={() =>
              openKnowledgeFilteredView({
                tab: 'library',
                status: 'all',
                archive: 'archived',
              })
            }
          />

          <Card className="space-y-4 p-5 xl:col-span-2">
            <h2 className="text-sm font-semibold">Recent knowledge activity</h2>
            <KnowledgeList
              items={items.slice(0, 6)}
              emptyTitle="No governed knowledge yet"
              emptyDescription="Add a business fact, policy, preference, or operating guideline to start building approved Workspace AI context."
              onSelect={setSelectedItemId}
            />
          </Card>

          <Card className="space-y-4 p-5 xl:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Confidence</h2>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Grounded in approved knowledge, deterministic references,
                  unresolved gaps, and missing data.
                </p>
              </div>
              <Badge
                variant={
                  confidence.level === 'high'
                    ? 'green'
                    : confidence.level === 'medium'
                      ? 'yellow'
                      : 'red'
                }
              >
                {confidence.level} · {confidence.score}%
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SignalList title="Known" items={confidence.known} />
              <SignalList title="Unknown" items={confidence.unknown} />
              <SignalList title="Missing data" items={confidence.missingData} />
              <SignalList
                title="Recommended next integrations"
                items={confidence.recommendedNextIntegrations}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'library' || activeTab === 'queue' ? (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Search" className="min-w-[220px] flex-1">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workspace knowledge..."
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={activeTab === 'queue' ? 'PENDING_REVIEW' : statusFilter}
                disabled={activeTab === 'queue'}
                onChange={(event) =>
                  setStatusFilter(event.target.value as KnowledgeStatus | 'all')
                }
                className={inputClass}
              >
                <option value="all">All statuses</option>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
                <option value="SUPERSEDED">Superseded</option>
              </select>
            </Field>
            <Field label="Category">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scope">
              <select
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">All scopes</option>
                {SCOPE_OPTIONS.map((scope) => (
                  <option key={scope.type} value={scope.type}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Archived">
              <select
                value={archiveFilter}
                onChange={(event) =>
                  setArchiveFilter(event.target.value as typeof archiveFilter)
                }
                className={inputClass}
              >
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
                <option value="all">All records</option>
              </select>
            </Field>
          </div>
          {statusFilter === 'SUPERSEDED' || archiveFilter === 'archived' ? (
            <p className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-xs leading-5">
              Superseded knowledge is retained for history and audit. It is
              excluded from Workspace AI runtime once a replacement is approved.
            </p>
          ) : null}
          <KnowledgeList
            items={activeTab === 'queue' ? pendingItems : visibleItems}
            emptyTitle={
              activeTab === 'queue'
                ? 'No knowledge waiting for review'
                : 'No knowledge matches these filters'
            }
            emptyDescription={
              activeTab === 'queue'
                ? 'New suggestions and AI proposals will appear here before they can affect Workspace AI.'
                : 'Clear or adjust filters to find another governed knowledge record.'
            }
            onSelect={setSelectedItemId}
          />
        </Card>
      ) : null}

      {activeTab === 'gaps' ? (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Gaps and Corrections</h2>
          <p className="text-neutral-text-secondary text-xs">
            Corrections let team members propose changes to approved knowledge
            without changing AI runtime truth until review is complete.
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <h3 className="text-neutral-text-secondary mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Knowledge gaps
              </h3>
              <div className="space-y-2">
                {knowledgeGaps.length ? (
                  knowledgeGaps.map((gap) => (
                    <div
                      key={gap.id}
                      className="rounded-md border border-white/10 p-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-neutral-text-primary font-medium">
                          {gap.title}
                        </p>
                        <Badge
                          variant={
                            gap.severity === 'high'
                              ? 'red'
                              : gap.severity === 'medium'
                                ? 'yellow'
                                : 'blue'
                          }
                        >
                          {gap.severity}
                        </Badge>
                      </div>
                      <p className="text-neutral-text-secondary mt-1 leading-5">
                        {gap.description}
                      </p>
                      <p className="text-neutral-text-secondary mt-2 text-[11px]">
                        Seen {gap.frequency} time
                        {gap.frequency === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-text-secondary rounded-md border border-dashed border-white/10 px-3 py-4 text-xs">
                    No knowledge gaps detected yet.
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-neutral-text-secondary mb-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Corrections
              </h3>
              <KnowledgeList
                items={items.filter((item) => item.corrections.length > 0)}
                emptyTitle="No corrections submitted"
                emptyDescription="Corrections suggested from approved knowledge records will appear here for owner or admin review."
                onSelect={setSelectedItemId}
              />
            </div>
          </div>
        </Card>
      ) : null}

      {activeTab === 'recommendations' ? (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Recommendation History</h2>
          <p className="text-neutral-text-secondary text-xs">
            Outcomes from prior recommendations are retained as governed
            feedback metadata.
          </p>
          {learningRecommendations.length ? (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
              <h3 className="text-xs font-semibold text-cyan-100">
                Recommended knowledge improvements
              </h3>
              <div className="mt-2 space-y-2">
                {learningRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="text-xs">
                    <p className="text-neutral-text-primary font-medium">
                      {recommendation.title}
                    </p>
                    <p className="text-neutral-text-secondary mt-1">
                      {recommendation.description}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-neutral-text-secondary mt-3 text-[11px]">
                These are suggestions only. Skillify never modifies workspace
                knowledge automatically.
              </p>
            </div>
          ) : null}
          <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {recommendationHistory.length ? (
              recommendationHistory.map((outcome) => (
                <div
                  key={outcome.id}
                  className="grid gap-2 px-4 py-3 text-xs md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="text-neutral-text-primary font-medium">
                      {outcome.recommendationTitle}
                    </p>
                    <p className="text-neutral-text-secondary mt-1">
                      {outcome.recommendationId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <Badge>{outcome.status}</Badge>
                    <span className="text-neutral-text-secondary">
                      {formatDate(outcome.occurredAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-neutral-text-secondary px-4 py-5 text-xs">
                Recommendation outcomes will appear here as users accept,
                reject, dismiss, or defer Workspace AI recommendations.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'audit' ? (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Audit</h2>
          <div className="divide-y divide-white/10 overflow-hidden rounded-md border border-white/10">
            {auditEvents.length ? (
              auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 px-3 py-2 text-xs md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium">{event.summary}</p>
                    <p className="text-neutral-text-secondary">
                      {event.eventType}
                    </p>
                  </div>
                  <p className="text-neutral-text-secondary">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-neutral-text-secondary px-3 py-4 text-xs">
                No workspace knowledge audit events yet.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Knowledge Add Knowledge"
        >
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-cyan-300">
                  Workspace Knowledge
                </p>
                <h2 className="text-lg font-semibold">
                  {editingItem ? 'Edit Knowledge' : 'Add Knowledge'}
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Suggestions require governed review before they can affect
                  Workspace AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-neutral-text-secondary rounded-md px-2 py-1 text-sm hover:bg-white/10 hover:text-white"
                aria-label="Close Add Knowledge"
              >
                X
              </button>
            </div>

            <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto px-5 py-4">
              {formError ? (
                <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {formError}
                </p>
              ) : null}
              <Field
                label="Knowledge statement"
                required
                error={submitted ? getFormErrors(form).statement : undefined}
              >
                <textarea
                  value={form.statement}
                  onChange={(event) =>
                    setFormValue('statement', event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                  aria-invalid={
                    submitted && Boolean(getFormErrors(form).statement)
                  }
                />
              </Field>
              <Field label="Summary">
                <textarea
                  value={form.summary}
                  onChange={(event) =>
                    setFormValue('summary', event.target.value)
                  }
                  rows={2}
                  className={inputClass}
                  placeholder="Briefly explain how this describes the way the business operates."
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Category"
                  required
                  error={submitted ? getFormErrors(form).category : undefined}
                >
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setFormValue('category', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select category</option>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Scope"
                  required
                  error={submitted ? getFormErrors(form).scopeType : undefined}
                >
                  <select
                    value={form.scopeType}
                    onChange={(event) => {
                      setFormValue('scopeType', event.target.value)
                      setFormValue('targetId', '')
                    }}
                    className={inputClass}
                  >
                    <option value="">Select scope</option>
                    {SCOPE_OPTIONS.map((scope) => (
                      <option key={scope.type} value={scope.type}>
                        {scope.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {selectedScopeRequiresTarget(form.scopeType) ? (
                <Field
                  label="Target record"
                  required
                  error={submitted ? getFormErrors(form).targetId : undefined}
                >
                  <select
                    value={form.targetId}
                    onChange={(event) =>
                      setFormValue('targetId', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Select{' '}
                      {SCOPE_OPTIONS.find(
                        (scope) => scope.type === form.scopeType,
                      )?.label.toLowerCase()}
                    </option>
                    {getTargetsForScope(form.scopeType, selectorTargets).map(
                      (target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ),
                    )}
                  </select>
                  {!getTargetsForScope(form.scopeType, selectorTargets)
                    .length ? (
                    <p className="mt-1 text-[11px] text-amber-200">
                      No workspace records are available for this scope yet.
                    </p>
                  ) : null}
                </Field>
              ) : null}
              <Field label="Explanation">
                <textarea
                  value={form.explanation}
                  onChange={(event) =>
                    setFormValue('explanation', event.target.value)
                  }
                  rows={3}
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Reasoning">
                  <textarea
                    value={form.reasoning}
                    onChange={(event) =>
                      setFormValue('reasoning', event.target.value)
                    }
                    rows={4}
                    className={inputClass}
                    placeholder="One reason per line"
                  />
                </Field>
                <Field label="Evidence">
                  <textarea
                    value={form.evidence}
                    onChange={(event) =>
                      setFormValue('evidence', event.target.value)
                    }
                    rows={4}
                    className={inputClass}
                    placeholder="One evidence point per line"
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Confidence">
                  <select
                    value={form.confidence}
                    onChange={(event) =>
                      setFormValue('confidence', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <Field label="Dependencies">
                  <input
                    value={form.dependencies}
                    onChange={(event) =>
                      setFormValue('dependencies', event.target.value)
                    }
                    placeholder="Business Locations, Dispatch rules..."
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Source">
                  <select
                    value={form.sourceType}
                    onChange={(event) =>
                      setFormValue('sourceType', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select source</option>
                    {SOURCE_OPTIONS.map((source) => (
                      <option key={source.type} value={source.type}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.sourceType === 'Other' ? (
                  <Field label="Other source label">
                    <input
                      value={form.sourceOtherLabel}
                      onChange={(event) =>
                        setFormValue('sourceOtherLabel', event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                ) : (
                  <Field label="Effective date">
                    <input
                      type="date"
                      value={form.effectiveDate}
                      onChange={(event) =>
                        setFormValue('effectiveDate', event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Related module">
                  <input
                    value={form.relatedModule}
                    onChange={(event) =>
                      setFormValue('relatedModule', event.target.value)
                    }
                    placeholder="Scheduling, CRM, Automations..."
                    className={inputClass}
                  />
                </Field>
                <Field label="Tags">
                  <input
                    value={form.tags}
                    onChange={(event) =>
                      setFormValue('tags', event.target.value)
                    }
                    placeholder="Comma-separated tags"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Review notes">
                <textarea
                  value={form.reviewNotes}
                  onChange={(event) =>
                    setFormValue('reviewNotes', event.target.value)
                  }
                  rows={3}
                  className={inputClass}
                />
              </Field>
              {formConflicts.length ? (
                <ConflictPanel conflicts={formConflicts} />
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950 px-5 py-4">
              <p className="text-neutral-text-secondary text-xs">
                Approved knowledge becomes eligible for Workspace AI. Pending
                knowledge never changes runtime truth.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isPending}
                  onClick={() => void submitKnowledge(false)}
                >
                  Submit for Review
                </Button>
                {canApprove ? (
                  <Button
                    type="button"
                    size="sm"
                    loading={isPending}
                    onClick={() => void submitKnowledge(true)}
                  >
                    Save and Approve
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Knowledge Details"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedItemId(null)
          }}
        >
          <aside className="flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-slate-950 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-cyan-300">
                    Workspace Knowledge
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {selectedItem.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(selectedItem.approvalStatus)}>
                      {formatStatus(selectedItem.approvalStatus)}
                    </Badge>
                    <Badge>{selectedItem.category}</Badge>
                    <Badge>{getScopeLabel(selectedItem)}</Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="text-neutral-text-secondary rounded-md px-2 py-1 text-sm hover:bg-white/10 hover:text-white"
                  aria-label="Close knowledge details"
                >
                  X
                </button>
              </div>
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedItem.approvalStatus === 'PENDING_REVIEW' ||
                  selectedItem.approvalStatus === 'DRAFT' ? (
                    <>
                      {canApprove ? (
                        <Button
                          size="xs"
                          onClick={() => void mutateItem('approve')}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canApprove ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void mutateItem('reject')}
                        >
                          Reject
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => openEditKnowledge(selectedItem)}
                      >
                        Edit before approval
                      </Button>
                    </>
                  ) : null}
                  {selectedItem.approvalStatus === 'APPROVED' &&
                  !selectedItem.isArchived ? (
                    <>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => openEditKnowledge(selectedItem)}
                      >
                        Edit replacement
                      </Button>
                      {canApprove ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void mutateItem('archive')}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {(selectedItem.isArchived ||
                    selectedItem.approvalStatus === 'ARCHIVED') &&
                  canApprove ? (
                    <Button
                      size="xs"
                      onClick={() => void mutateItem('restore')}
                    >
                      Restore
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {canApprove &&
              (selectedItem.approvalStatus === 'PENDING_REVIEW' ||
                selectedItem.approvalStatus === 'DRAFT') ? (
                <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
                  <select
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className={inputClass}
                  >
                    {REJECTION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <input
                    value={detailReason}
                    onChange={(event) => setDetailReason(event.target.value)}
                    placeholder="Review note or rejection detail"
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <DetailSection title="Customer-facing statement">
                <p className="text-neutral-text-primary text-sm">
                  {selectedItem.title}
                </p>
                {selectedItem.description ? (
                  <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
                    {selectedItem.description}
                  </p>
                ) : null}
              </DetailSection>
              {getStructuredProposal(selectedItem.structuredValue) ? (
                <DetailSection title="Summary">
                  <p className="text-neutral-text-primary text-sm leading-6">
                    {
                      getStructuredProposal(selectedItem.structuredValue)
                        ?.summary
                    }
                  </p>
                </DetailSection>
              ) : null}
              {getStructuredProposal(selectedItem.structuredValue)?.reasoning
                .length ? (
                <DetailSection title="Reasoning">
                  <BulletList
                    items={
                      getStructuredProposal(selectedItem.structuredValue)
                        ?.reasoning ?? []
                    }
                  />
                </DetailSection>
              ) : null}
              {getStructuredProposal(selectedItem.structuredValue)?.evidence
                .length ? (
                <DetailSection title="Evidence">
                  <BulletList
                    items={
                      getStructuredProposal(selectedItem.structuredValue)
                        ?.evidence ?? []
                    }
                  />
                </DetailSection>
              ) : null}
              {selectedQuality ? (
                <DetailSection title="Knowledge quality">
                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <DetailRow
                      label="Confidence"
                      value={selectedQuality.confidence}
                    />
                    <DetailRow
                      label="Evidence count"
                      value={String(selectedQuality.evidenceCount)}
                    />
                    <DetailRow
                      label="Conflicts"
                      value={String(selectedQuality.conflictCount)}
                    />
                    <DetailRow
                      label="Dependencies"
                      value={
                        selectedQuality.dependencies.length
                          ? selectedQuality.dependencies.join(', ')
                          : 'None identified'
                      }
                    />
                  </div>
                </DetailSection>
              ) : null}
              <DetailSection title="Runtime usage">
                <div className="flex flex-wrap gap-2">
                  {getRuntimeUsageForKnowledge(selectedItem).map((usage) => (
                    <Badge key={usage}>{usage}</Badge>
                  ))}
                </div>
              </DetailSection>
              <DetailSection title="Dependencies">
                <BulletList
                  items={getWorkspaceKnowledgeDependencies(selectedItem)}
                  empty="No dependencies identified."
                />
              </DetailSection>
              {selectedConflicts.length ? (
                <DetailSection title="Conflicts">
                  <ConflictPanel conflicts={selectedConflicts} />
                  <p className="text-neutral-text-secondary mt-2 text-[11px]">
                    Owners and admins may still approve after reviewing the
                    possible impact.
                  </p>
                </DetailSection>
              ) : null}
              <DetailSection title="Governance">
                <div className="grid gap-3 text-xs md:grid-cols-2">
                  <DetailRow
                    label="Runtime eligibility"
                    value={
                      selectedItem.approvalStatus === 'APPROVED' &&
                      !selectedItem.isArchived
                        ? 'Eligible for Workspace AI'
                        : 'Not used by Workspace AI'
                    }
                  />
                  <DetailRow
                    label="Source"
                    value={
                      selectedItem.source?.label ??
                      selectedItem.sourceSummary ??
                      'Workspace knowledge'
                    }
                  />
                  <DetailRow
                    label="Version"
                    value={`v${selectedItem.version}`}
                  />
                  <DetailRow
                    label="Updated"
                    value={formatDate(selectedItem.updatedAt)}
                  />
                  <DetailRow
                    label="Effective date"
                    value={
                      getMetadataString(
                        selectedItem.structuredValue,
                        'effectiveDate',
                      ) ?? 'Not set'
                    }
                  />
                  <DetailRow
                    label="Related module"
                    value={
                      getMetadataString(
                        selectedItem.structuredValue,
                        'relatedModule',
                      ) ?? 'Not set'
                    }
                  />
                </div>
              </DetailSection>
              <DetailSection title="Suggest a correction">
                <textarea
                  value={correctionText}
                  onChange={(event) => setCorrectionText(event.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Describe what should change..."
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => void submitCorrection()}
                  >
                    Submit Correction
                  </Button>
                </div>
              </DetailSection>
              <DetailSection title="Corrections">
                {selectedItem.corrections.length ? (
                  selectedItem.corrections.map((correction) => (
                    <div
                      key={correction.id}
                      className="rounded-md border border-white/10 p-3"
                    >
                      <p className="text-xs font-medium">
                        {correction.correctionText}
                      </p>
                      <p className="text-neutral-text-secondary mt-1 text-[11px]">
                        {correction.status} · {formatDate(correction.createdAt)}
                      </p>
                      {canApprove &&
                      correction.status === 'QUEUED_FOR_REVIEW' ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="xs"
                            onClick={() =>
                              void reviewCorrection(correction.id, 'accept')
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              void reviewCorrection(correction.id, 'reject')
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-text-secondary text-xs">
                    No corrections submitted for this knowledge yet.
                  </p>
                )}
              </DetailSection>
              <DetailSection title="Approval chain">
                {selectedItem.approvals.length ? (
                  <div className="space-y-2">
                    {selectedItem.approvals.map((approval) => (
                      <div
                        key={approval.id}
                        className="rounded-md border border-white/10 p-3 text-xs"
                      >
                        <p className="font-medium">
                          {approval.action} · {approval.actorRole}
                        </p>
                        {approval.reason ? (
                          <p className="text-neutral-text-secondary mt-1">
                            {approval.reason}
                          </p>
                        ) : null}
                        <p className="text-neutral-text-secondary mt-1 text-[11px]">
                          {formatDate(approval.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-text-secondary text-xs">
                    No approval actions recorded yet.
                  </p>
                )}
              </DetailSection>
              <DetailSection title="Recommendations using this knowledge">
                <BulletList
                  items={recommendationHistory
                    .filter(
                      (outcome) =>
                        outcome.recommendationTitle.includes(
                          selectedItem.title,
                        ) || outcome.recommendationId.includes(selectedItem.id),
                    )
                    .map(
                      (outcome) =>
                        `${outcome.recommendationTitle} · ${outcome.status}`,
                    )}
                  empty="No recommendation outcomes reference this knowledge yet."
                />
              </DetailSection>
              <DetailSection title="History">
                <div className="space-y-2">
                  {selectedItem.revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="rounded-md border border-white/10 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">
                          v{revision.version} · {revision.revisionType}
                        </p>
                        <p className="text-neutral-text-secondary">
                          {formatDate(revision.createdAt)}
                        </p>
                      </div>
                      {revision.changeSummary ? (
                        <p className="text-neutral-text-secondary mt-1">
                          {revision.changeSummary}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </DetailSection>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )

  function setFormValue(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }
}

function OverviewCard({
  title,
  count,
  description,
  variant,
  onClick,
}: {
  title: string
  count: number
  description: string
  variant: BadgeVariant
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      <Card className="space-y-3 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge variant={variant}>{count}</Badge>
        </div>
        <p className="text-neutral-text-secondary text-xs">{description}</p>
      </Card>
    </button>
  )
}

function KnowledgeList({
  items,
  emptyTitle,
  emptyDescription,
  onSelect,
}: {
  items: WorkspaceKnowledgeManagerItem[]
  emptyTitle: string
  emptyDescription: string
  onSelect: (id: string) => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 p-6">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }
  return (
    <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="grid w-full gap-2 px-4 py-3 text-left text-xs transition hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.05] md:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="text-neutral-text-primary font-medium">
              {item.title}
            </p>
            <p className="text-neutral-text-secondary mt-1">
              {item.category} · {getScopeLabel(item)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Badge variant={statusVariant(item.approvalStatus)}>
              {formatStatus(item.approvalStatus)}
            </Badge>
            {item.isArchived ? <Badge variant="slate">Archived</Badge> : null}
          </div>
        </button>
      ))}
    </div>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <details className="group rounded-lg border border-white/10 p-4" open>
      <summary className="text-neutral-text-secondary flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
        <span>{title}</span>
        <span className="text-neutral-text-secondary transition group-open:rotate-90">
          &gt;
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) {
    return (
      <p className="text-neutral-text-secondary text-xs">
        {empty ?? 'No details recorded.'}
      </p>
    )
  }
  return (
    <ul className="text-neutral-text-secondary space-y-2 text-xs leading-5">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ConflictPanel({
  conflicts,
}: {
  conflicts: Array<{
    existingPolicy: string
    proposedPolicy: string
    potentialImpact: string
  }>
}) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
      <p className="text-xs font-semibold text-amber-100">
        Possible conflict detected
      </p>
      {conflicts.map((conflict) => (
        <div
          key={`${conflict.existingPolicy}:${conflict.proposedPolicy}`}
          className="grid gap-2 text-xs md:grid-cols-3"
        >
          <DetailRow label="Existing policy" value={conflict.existingPolicy} />
          <DetailRow label="Proposed policy" value={conflict.proposedPolicy} />
          <DetailRow
            label="Potential impact"
            value={conflict.potentialImpact}
          />
        </div>
      ))}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-neutral-text-secondary">{label}</p>
      <p className="text-neutral-text-primary mt-1 font-medium">{value}</p>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`block text-xs ${className ?? ''}`}>
      <span className="text-neutral-text-secondary mb-1.5 block font-medium">
        {label}
        {required ? <span className="text-rose-300"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-rose-300">{error}</span>
      ) : null}
    </label>
  )
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-white/10 p-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <ul className="text-neutral-text-secondary mt-2 space-y-1 text-xs">
        {items.length ? (
          items.slice(0, 5).map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>No grounded signals yet.</li>
        )}
      </ul>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-neutral-text-primary outline-none transition placeholder:text-neutral-text-secondary focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-60'

function getFormErrors(form: typeof EMPTY_FORM) {
  const errors: Record<string, string> = {}
  if (!form.statement.trim())
    errors.statement = 'Knowledge statement is required.'
  if (
    form.statement.trim() &&
    form.statement.trim().replace(/\s+/g, ' ').length < 12
  )
    errors.statement = 'Use a more specific statement.'
  if (!form.category) errors.category = 'Category is required.'
  if (!form.scopeType) errors.scopeType = 'Scope is required.'
  if (selectedScopeRequiresTarget(form.scopeType) && !form.targetId)
    errors.targetId = 'Select a workspace record for this scope.'
  if (form.sourceType === 'Other' && !form.sourceOtherLabel.trim())
    errors.sourceOtherLabel = 'Source label is required.'
  return errors
}

function buildScope(
  form: typeof EMPTY_FORM,
  targets: WorkspaceKnowledgeManagerProps['selectorTargets'],
) {
  const scope = SCOPE_OPTIONS.find((option) => option.type === form.scopeType)
  const target = getTargetsForScope(form.scopeType, targets).find(
    (option) => option.id === form.targetId,
  )
  return {
    type: scope?.type ?? 'entireWorkspace',
    label: scope?.label ?? 'Entire Workspace',
    targetType: scope?.targetType,
    targetId: target?.id,
    targetLabel: target?.label,
  }
}

function getTargetsForScope(
  scopeType: string,
  targets: WorkspaceKnowledgeManagerProps['selectorTargets'],
) {
  if (scopeType === 'specificTeam') return targets.teams
  if (scopeType === 'specificBusinessLocation') return targets.locations
  if (scopeType === 'specificServiceType') return targets.serviceTypes
  if (scopeType === 'specificCustomerSegment') return targets.customerSegments
  return []
}

function selectedScopeRequiresTarget(scopeType: string) {
  return Boolean(
    SCOPE_OPTIONS.find((option) => option.type === scopeType)?.targetType,
  )
}

function getScope(item: WorkspaceKnowledgeManagerItem) {
  if (isRecord(item.structuredValue) && isRecord(item.structuredValue.scope)) {
    const scope = item.structuredValue.scope
    return {
      type: typeof scope.type === 'string' ? scope.type : 'entireWorkspace',
      label: typeof scope.label === 'string' ? scope.label : 'Entire Workspace',
      targetId: typeof scope.targetId === 'string' ? scope.targetId : undefined,
      targetLabel:
        typeof scope.targetLabel === 'string' ? scope.targetLabel : undefined,
    }
  }
  return { type: 'entireWorkspace', label: 'Entire Workspace' }
}

function getScopeLabel(item: WorkspaceKnowledgeManagerItem) {
  const scope = getScope(item)
  return scope.targetLabel
    ? `${scope.label} · ${scope.targetLabel}`
    : scope.label
}

function getMetadataString(value: unknown, key: string) {
  if (!isRecord(value) || !isRecord(value.metadata)) return undefined
  const candidate = value.metadata[key]
  return typeof candidate === 'string' ? candidate : undefined
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function parseLines(value: string) {
  return value
    .split(/\n|•|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function runtimeUsageFromCategory(category: string) {
  if (
    category === 'Scheduling Preference' ||
    category === 'Dispatch Rule' ||
    category === 'Assignment Rule'
  ) {
    return ['Scheduling', 'Assignments', 'AI Coach']
  }
  if (category === 'Automation Guideline')
    return ['Automations', 'Workflow Builder', 'AI Coach']
  if (category === 'Customer Policy' || category === 'Communication Guideline')
    return ['CRM', 'Clients', 'AI Coach']
  if (category === 'Sales Guideline' || category === 'CRM Guideline')
    return ['CRM', 'Sales Pipeline', 'Opportunities']
  return ['Workspace AI']
}

function uniqueSources(sources: SourceOption[]) {
  const seen = new Set<string>()
  return sources.filter((source) => {
    const key = source.type.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function statusVariant(status: KnowledgeStatus): BadgeVariant {
  if (status === 'APPROVED') return 'green'
  if (status === 'PENDING_REVIEW' || status === 'DRAFT') return 'yellow'
  if (status === 'REJECTED') return 'red'
  if (status === 'ARCHIVED' || status === 'SUPERSEDED') return 'slate'
  return 'default'
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function sourceTypeForRole(role: UserRole) {
  if (role === 'owner') return 'Owner instruction'
  if (role === 'admin') return 'Admin instruction'
  if (role === 'manager') return 'Manager suggestion'
  return 'Member suggestion'
}

function isKnowledgeTab(value: string | null): value is KnowledgeTab {
  return (
    value === 'overview' ||
    value === 'library' ||
    value === 'queue' ||
    value === 'gaps' ||
    value === 'recommendations' ||
    value === 'audit'
  )
}

function isKnowledgeStatus(
  value: string | null,
): value is KnowledgeStatus | 'all' {
  return (
    value === 'all' ||
    value === 'DRAFT' ||
    value === 'PENDING_REVIEW' ||
    value === 'APPROVED' ||
    value === 'REJECTED' ||
    value === 'ARCHIVED' ||
    value === 'SUPERSEDED'
  )
}

function isKnowledgeArchiveFilter(
  value: string | null,
): value is 'active' | 'archived' | 'all' {
  return value === 'active' || value === 'archived' || value === 'all'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
