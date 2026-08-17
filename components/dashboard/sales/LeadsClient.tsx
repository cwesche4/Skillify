'use client'

import React from 'react'
import {
  forwardRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  CompactActivityTimeline,
  NotesCard,
  type CrmTimelineEvent,
} from '@/components/crm/CrmDrawerCards'
import { SalesKpiCard } from '@/components/dashboard/sales/SalesKpiCard'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { ClearFiltersButton } from '@/components/ui/ClearFiltersButton'
import {
  TableColumnsButton,
  type TableColumnConfig,
  useTableColumnVisibility,
} from '@/components/ui/TableColumnVisibility'
import {
  ChartCard,
  DonutBreakdown,
  HorizontalBarList,
  InsightAreaChart,
  LinkedRecordsCard,
  RecommendedActionsCard,
  SavedViewTabs,
  SignalMatrix,
  StageRail,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { cn } from '@/lib/utils'
import {
  formatWorkspaceCompactDate,
  formatWorkspaceDate,
  formatWorkspaceDateTime,
} from '@/lib/formatting/dates'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  demoLeadStaleActivityCutoff,
  demoLeads,
  demoSalesToday,
  type LeadRecord,
  type LeadSource,
  type LeadStage,
  type LeadStatus,
} from '@/lib/sales/demoSalesRecords'
import {
  mergeLeadRecords,
  readPreviewLeads,
  upsertPreviewLead,
} from '@/lib/sales/previewLeadStorage'
import {
  convertLeadForWorkspacePreview,
  getMergedWorkspaceOpportunities,
} from '@/lib/sales/previewOpportunityStorage'
import {
  getLeadConversionActions,
  type LeadConversionAction,
} from '@/lib/crm/getLeadConversionActions'
import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  type LeadConversionDestination as LeadConversionDestinationValue,
  type QualifiedLeadBehavior as QualifiedLeadBehaviorValue,
} from '@/lib/prisma/enums'
import {
  applyIdentityToLead,
  resolveContactIdentity,
  upsertContactIdentity,
} from '@/lib/crm/contactIdentity'
import {
  createPreviewLeadRecord,
  getLeadDuplicateWarning,
  validateCreateLeadInput,
  type CreateLeadField,
  type CreateLeadInput,
} from '@/lib/crm/createLead'
import {
  getQualifiedLeadPromptCopy,
  resolveLeadStageConversionAction,
} from '@/lib/crm/leadLifecycle'
import {
  getLeadMetrics,
  getLeadSavedViewCounts,
  getLeadStage,
  getLeadStageCount,
  getNormalizedLeads,
  getLeadLifecycleLabel,
  getLeadDateKey,
  normalizeLeadSort,
  filterLeads,
  hasStaleLeadActivity,
  isActiveLead,
  isConvertedLead,
  isLeadDueToday,
  isLeadOverdue,
  sortLeads,
  type LeadSortOption,
} from '@/lib/crm/leadSelectors'
import { getLeadStageOptionsForBusinessModel } from '@/lib/crm/pipelineStageRegistry'
import { demoTaskToday, type TaskRecord } from '@/lib/tasks/demoTasks'
import { appendPreviewTask } from '@/lib/tasks/previewTaskStorage'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspacePresentationProfile } from '@/lib/workspaces/workspacePresentation'
import type { OpportunityRecord } from '@/lib/sales/demoSalesRecords'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import { useClearFilters } from '@/hooks/useClearFilters'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
  getRelatedActivityRecords,
  getWorkspaceActivityCategory,
  readPreviewActivity,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { updateLeadRecordWithRules } from '@/lib/workspace-records/crmMutations'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'
import { selectLeadsNeedingFollowUp } from '@/lib/workspace-records/relationships'
import { getWorkspaceNow } from '@/lib/scheduling/schedulingDateTime'
import { buildRelatedRecordHref } from '@/lib/workspace-records/relatedRecordLinks'

type LeadMetric =
  | 'totalLeads'
  | 'newThisMonth'
  | 'needsFollowUp'
  | 'conversionRate'
type LeadDrilldown =
  | { type: 'status'; label: string; status: LeadStatus }
  | { type: 'stage'; label: string; stage: LeadStage }
  | { type: 'source'; label: string; source: LeadSource }
  | { type: 'followUp'; label: string; mode: 'overdue' | 'today' | 'inactive' }
  | { type: 'conversion'; label: string; mode: 'converted' | 'open' | 'lost' }
  | { type: 'age'; label: string; mode: 'average' }
  | { type: 'value'; label: string; mode: 'high' }

type FollowUpChannel = 'Call' | 'Email' | 'SMS' | 'Meeting' | 'Other'
type FollowUpOutcome =
  | 'Reached'
  | 'No answer'
  | 'Left voicemail'
  | 'Replied'
  | 'Meeting booked'
  | 'Not interested'
  | 'Other'
type FollowUpNextAction =
  | 'Schedule another follow-up'
  | 'Book meeting'
  | 'Send proposal'
  | 'Qualify lead'
  | 'Convert to Opportunity'
  | 'Close follow-ups'
  | 'Nothing else'

const followUpChannels: FollowUpChannel[] = [
  'Call',
  'Email',
  'SMS',
  'Meeting',
  'Other',
]

const followUpOutcomes: FollowUpOutcome[] = [
  'Reached',
  'No answer',
  'Left voicemail',
  'Replied',
  'Meeting booked',
  'Not interested',
  'Other',
]

const followUpNextActions: FollowUpNextAction[] = [
  'Schedule another follow-up',
  'Book meeting',
  'Send proposal',
  'Qualify lead',
  'Convert to Opportunity',
  'Close follow-ups',
  'Nothing else',
]

const today = demoSalesToday

const leadsTableColumns: TableColumnConfig[] = [
  { id: 'lead', label: 'Lead', required: true },
  { id: 'status', label: 'Status' },
  { id: 'source', label: 'Source' },
  { id: 'value', label: 'Value' },
  { id: 'nextStep', label: 'Next Step' },
  { id: 'followUp', label: 'Follow-Up' },
  { id: 'dateAdded', label: 'Date Added' },
  { id: 'owner', label: ownershipLabels.leads.table },
]

const leads = demoLeads

const statusVariant: Record<LeadStatus, BadgeVariant> = {
  New: 'blue',
  Contacted: 'purple',
  Qualified: 'green',
  Nurture: 'orange',
  Disqualified: 'red',
  Converted: 'green',
}

const metricTone: Record<LeadMetric, string> = {
  totalLeads: 'border-cyan-300/50 bg-cyan-300/[0.065] shadow-cyan-400/[0.08]',
  newThisMonth:
    'border-violet-300/50 bg-violet-400/[0.065] shadow-violet-400/[0.08]',
  needsFollowUp:
    'border-amber-300/50 bg-amber-400/[0.065] shadow-amber-400/[0.08]',
  conversionRate:
    'border-emerald-300/50 bg-emerald-400/[0.065] shadow-emerald-400/[0.08]',
}

const statusOptions: Array<'All' | LeadStatus> = [
  'All',
  'New',
  'Contacted',
  'Qualified',
  'Nurture',
  'Disqualified',
]

function normalizeLeadForWorkspaceModel(
  lead: LeadRecord,
  capabilities: WorkspaceCapabilities,
): LeadRecord {
  const presentation = getWorkspacePresentationProfile(capabilities)
  const normalized = getNormalizedLeads([lead])[0] ?? lead
  if (presentation.pipelineMode !== 'leadToCustomer') return normalized

  if (isConvertedLead(normalized)) {
    return {
      ...normalized,
      status: 'Converted',
      stage: normalized.stage === 'Lost' ? 'Lost' : 'Won',
    }
  }
  if (normalized.stage === 'Lost' || normalized.status === 'Disqualified') {
    return { ...normalized, status: 'Disqualified', stage: 'Lost' }
  }
  if (normalized.stage === 'Qualified' || normalized.status === 'Qualified') {
    return { ...normalized, status: 'Contacted', stage: 'Estimate / Visit' }
  }
  if (normalized.stage === 'Nurture' || normalized.status === 'Nurture') {
    return { ...normalized, status: 'Contacted', stage: 'Follow-Up' }
  }
  if (normalized.stage === 'New Lead') {
    return { ...normalized, status: 'New', stage: 'New' }
  }
  if (
    normalized.stage === 'Estimate / Visit' ||
    normalized.stage === 'Follow-Up'
  ) {
    return { ...normalized, status: 'Contacted' }
  }
  return normalized
}

function normalizeLeadsForWorkspaceModel(
  records: LeadRecord[],
  capabilities: WorkspaceCapabilities,
) {
  return records.map((lead) =>
    normalizeLeadForWorkspaceModel(lead, capabilities),
  )
}

function countLeadsByPipelineStage(records: LeadRecord[], stage: LeadStage) {
  return records.filter(
    (lead) => isActiveLead(lead) && getLeadStage(lead) === stage,
  ).length
}

function getLeadSavedViewCountForStage(
  records: LeadRecord[],
  stage: LeadStage,
) {
  return countLeadsByPipelineStage(records, stage)
}

function getLeadStatusOptionsForWorkspace(
  capabilities: WorkspaceCapabilities,
): Array<'All' | LeadStatus> {
  const presentation = getWorkspacePresentationProfile(capabilities)
  if (presentation.pipelineMode !== 'leadToCustomer') return statusOptions
  return ['All', 'New', 'Contacted', 'Converted', 'Disqualified']
}

function getStatusForLeadStage(stage: LeadStage): LeadStatus {
  if (stage === 'Converted') return 'Converted'
  if (stage === 'Disqualified' || stage === 'Lost') return 'Disqualified'
  if (stage === 'Won') return 'Qualified'
  if (stage === 'Estimate / Visit' || stage === 'Follow-Up') return 'Contacted'
  if (stage === 'Qualified') return 'Qualified'
  if (stage === 'Nurture') return 'Nurture'
  if (stage === 'Contacted') return 'Contacted'
  return 'New'
}

const sourceOptions: LeadSource[] = [
  'Website Form',
  'Referral',
  'Google Search',
  'Facebook/Instagram',
  'Manual Entry',
]

const leadSortOptions: Array<{ value: LeadSortOption; label: string }> = [
  { value: 'followUpPriority', label: 'Follow-up priority' },
  { value: 'newestAdded', label: 'Newest added' },
  { value: 'oldestAdded', label: 'Oldest added' },
  { value: 'followUpSoonest', label: 'Follow-up: soonest' },
  { value: 'followUpLatest', label: 'Follow-up: latest' },
  { value: 'highestValue', label: 'Highest value' },
  { value: 'lowestValue', label: 'Lowest value' },
  { value: 'status', label: 'Status' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatLeadFollowUpLabel(
  lead: LeadRecord,
  todayKey: string,
  timezone: string,
) {
  if (isConvertedLead(lead)) return 'Not scheduled'
  const followUpKey = getLeadDateKey(lead.followUpDue, timezone)
  if (!followUpKey) return 'Not scheduled'
  const dayDelta = getDateKeyDayDelta(todayKey, followUpKey)

  if (dayDelta < 0) {
    const days = Math.abs(dayDelta)
    return `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (dayDelta === 0) return 'Due today'
  if (dayDelta === 1) return 'Tomorrow'
  return formatWorkspaceDate(followUpKey)
}

function formatLeadDateAdded(
  value: string,
  timezone: string,
  mode: 'compact' | 'full',
) {
  const dateKey = getLeadDateKey(value, timezone) ?? value
  return mode === 'compact'
    ? formatWorkspaceCompactDate(dateKey)
    : formatWorkspaceDate(dateKey)
}

function getDateKeyDayDelta(fromDateKey: string, toDateKey: string) {
  const from = dateKeyToUtcNoon(fromDateKey)
  const to = dateKeyToUtcNoon(toDateKey)
  if (!from || !to) return 0
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function dateKeyToUtcNoon(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function isCurrentMonth(date: string, todayKey: string, timezone: string) {
  return (
    getLeadDateKey(date, timezone)?.startsWith(todayKey.slice(0, 7)) ?? false
  )
}

function isActiveLeadWork(lead: LeadRecord) {
  return isActiveLead(lead)
}

function isOverdue(lead: LeadRecord) {
  return isLeadOverdue(lead, today)
}

function isDueToday(lead: LeadRecord) {
  return isLeadDueToday(lead, today)
}

function hasNoRecentActivity(lead: LeadRecord) {
  return hasStaleLeadActivity(lead, demoLeadStaleActivityCutoff)
}

function isNeedingFollowUp(lead: LeadRecord) {
  return selectLeadsNeedingFollowUp([lead]).length === 1
}

function hasActiveLeadFollowUp(lead: LeadRecord) {
  return isActiveLead(lead) && Boolean(lead.followUpDue)
}

function hasFutureLeadFollowUp(
  lead: LeadRecord,
  todayKey: string,
  timezone: string,
) {
  const followUpKey = getLeadDateKey(lead.followUpDue, timezone)
  return Boolean(followUpKey && followUpKey > todayKey)
}

function getStageFollowUpGuidance({
  lead,
  nextLead,
  todayKey,
  timezone,
}: {
  lead: LeadRecord
  nextLead: LeadRecord
  todayKey: string
  timezone: string
}) {
  const nextStage = getLeadStage(nextLead)
  const hasFollowUp = hasActiveLeadFollowUp(nextLead)
  const hasFutureFollowUp = hasFutureLeadFollowUp(nextLead, todayKey, timezone)
  const hadFollowUp = hasActiveLeadFollowUp(lead)

  if (nextStage === 'New') {
    return 'Lead changes saved locally for this workspace preview.'
  }
  if (nextStage === 'Contacted' && !hasFutureFollowUp) {
    return 'Lead saved. Contacted leads work best with a scheduled next follow-up.'
  }
  if (nextStage === 'Qualified' && !hasFollowUp) {
    return 'Lead saved. Add a next action when qualification needs a planned follow-up.'
  }
  if (nextStage === 'Nurture' && !hasFutureFollowUp) {
    return 'Lead saved. Nurture leads should have a future follow-up scheduled.'
  }
  if (
    (nextStage === 'Converted' || nextStage === 'Disqualified') &&
    hadFollowUp
  ) {
    return 'Lead saved. Close remaining follow-ups when this lifecycle change is final.'
  }
  return 'Lead changes saved locally for this workspace preview.'
}

function buildFollowUpNextStep({
  action,
  channel,
  date,
  time,
}: {
  action: FollowUpNextAction
  channel: FollowUpChannel
  date?: string
  time?: string
}) {
  if (action === 'Nothing else') return 'No next action'
  if (action === 'Close follow-ups') return 'Follow-ups closed'
  if (action === 'Book meeting') return 'Book meeting'
  if (action === 'Send proposal') return 'Send proposal'
  if (action === 'Qualify lead') return 'Qualify lead'
  if (action === 'Convert to Opportunity') return 'Convert to Opportunity'
  const timing = [date, time].filter(Boolean).join(' ')
  return timing ? `${channel} follow-up on ${timing}` : `${channel} follow-up`
}

function formatFollowUpActivityDescription({
  channel,
  outcome,
  notes,
  ownerName,
}: {
  channel: FollowUpChannel
  outcome: FollowUpOutcome
  notes?: string
  ownerName: string
}) {
  return [
    `${channel} follow-up completed by ${ownerName}.`,
    `Outcome: ${outcome}.`,
    notes?.trim() ? `Notes: ${notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

function getLeadAgeDays(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const current = new Date(`${today}T12:00:00`).getTime()
  return Math.max(Math.round((current - created) / 86_400_000), 0)
}

function getAverageLeadAgeDays() {
  const totalAge = leads.reduce(
    (sum, lead) => sum + getLeadAgeDays(lead.createdAt),
    0,
  )
  return Math.round(totalAge / Math.max(leads.length, 1))
}

function getLeadTimeline(lead: LeadRecord) {
  return [
    {
      title: 'Lead created',
      detail: `Added from ${lead.source}`,
      date: lead.createdAt,
      tone: 'cyan',
    },
    {
      title: lead.lastActivityAt
        ? 'First contact / follow-up sent'
        : 'First contact pending',
      detail: lead.lastActivityAt
        ? lead.nextStep
        : 'No outreach activity has been recorded yet.',
      date: lead.lastActivityAt ?? 'Not started',
      tone: lead.lastActivityAt ? 'purple' : 'slate',
    },
    {
      title: 'Last activity',
      detail: lead.lastActivityAt
        ? lead.notes
        : 'This lead is waiting for its first activity.',
      date: lead.lastActivityAt ?? 'No activity yet',
      tone: lead.lastActivityAt ? 'green' : 'slate',
    },
    {
      title: 'Next follow-up due',
      detail: lead.nextStep,
      date: lead.followUpDue ?? 'Not scheduled',
      tone: lead.followUpDue ? (isOverdue(lead) ? 'amber' : 'cyan') : 'slate',
    },
  ]
}

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(target.closest('button,a,input,select,textarea'))
    : false
}

export function LeadsClient({
  workspaceId,
  workspaceSlug,
  workspaceTimezone = 'America/New_York',
  workspaceOwners,
  capabilities,
  canEditOwners = false,
}: {
  workspaceId: string
  workspaceSlug: string
  workspaceTimezone?: string
  workspaceOwners: WorkspaceOwner[]
  capabilities: WorkspaceCapabilities
  canEditOwners?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const presentation = useMemo(
    () => getWorkspacePresentationProfile(capabilities),
    [capabilities],
  )
  const [leadRecords, setLeadRecords] = useState(() =>
    normalizeLeadsForWorkspaceModel(leads, capabilities),
  )
  const [previewOpportunities, setPreviewOpportunities] = useState<
    OpportunityRecord[]
  >([])
  const [activityRecords, setActivityRecords] = useState<
    WorkspaceActivityRecord[]
  >([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All')
  const [stageFilter, setStageFilter] = useState<'All' | LeadStage>('All')
  const [leadSort, setLeadSort] = useState<LeadSortOption>('followUpPriority')
  const [selectedMetric, setSelectedMetric] = useState<LeadMetric | null>(null)
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<LeadDrilldown | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null)
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [leadCreatedMessage, setLeadCreatedMessage] = useState<string | null>(
    null,
  )
  const [recentCreatedLeadId, setRecentCreatedLeadId] = useState<string | null>(
    null,
  )
  const [isWorkspaceHighlighted, setIsWorkspaceHighlighted] = useState(false)
  const [qualifiedLeadBehaviorOverride, setQualifiedLeadBehaviorOverride] =
    useState<QualifiedLeadBehaviorValue | null>(null)
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('leads', leadsTableColumns)
  const workspaceToday = useMemo(
    () => getWorkspaceNow({ timezone: workspaceTimezone }).dateKey,
    [workspaceTimezone],
  )
  const selectableLeadStages = useMemo(
    () => getLeadStageOptionsForBusinessModel(capabilities.businessModel),
    [capabilities.businessModel],
  )
  const availableStatusOptions = useMemo(
    () => getLeadStatusOptionsForWorkspace(capabilities),
    [capabilities],
  )
  const effectiveCapabilities = useMemo<WorkspaceCapabilities>(
    () =>
      qualifiedLeadBehaviorOverride
        ? {
            ...capabilities,
            conversion: {
              ...capabilities.conversion,
              qualifiedLeadBehavior: qualifiedLeadBehaviorOverride,
            },
          }
        : capabilities,
    [capabilities, qualifiedLeadBehaviorOverride],
  )

  useEffect(() => {
    setLeadRecords(
      normalizeLeadsForWorkspaceModel(
        mergeLeadRecords(leads, readPreviewLeads(workspaceSlug)),
        effectiveCapabilities,
      ),
    )
    setPreviewOpportunities(
      getMergedWorkspaceOpportunities(workspaceSlug, {
        repairConvertedLeads: effectiveCapabilities.modules.opportunities,
      }),
    )
    setActivityRecords(readPreviewActivity(workspaceSlug))
  }, [
    effectiveCapabilities,
    effectiveCapabilities.modules.opportunities,
    workspaceSlug,
  ])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (event.detail.workspaceId !== workspaceSlug) return
      if (event.detail.scope === 'activity') {
        setActivityRecords(readPreviewActivity(workspaceSlug))
      }
      if (event.detail.scope === 'leads') {
        setLeadRecords(
          normalizeLeadsForWorkspaceModel(
            mergeLeadRecords(leads, readPreviewLeads(workspaceSlug)),
            effectiveCapabilities,
          ),
        )
      }
      if (event.detail.scope === 'opportunities') {
        setPreviewOpportunities(
          getMergedWorkspaceOpportunities(workspaceSlug, {
            repairConvertedLeads: effectiveCapabilities.modules.opportunities,
          }),
        )
      }
    }

    window.addEventListener(
      workspaceCrmRecordsChangedEvent,
      handleCrmRecordsChanged,
    )
    return () =>
      window.removeEventListener(
        workspaceCrmRecordsChangedEvent,
        handleCrmRecordsChanged,
      )
  }, [
    effectiveCapabilities,
    effectiveCapabilities.modules.opportunities,
    workspaceSlug,
  ])

  useEffect(() => {
    if (!effectiveCapabilities.modules.opportunities) return
    const existingOpportunities = getMergedWorkspaceOpportunities(workspaceSlug)
    let createdOpportunity = false

    leadRecords.forEach((lead) => {
      if (!lead.converted) return
      const existing = existingOpportunities.find(
        (opportunity) =>
          (opportunity.sourceLeadId ?? opportunity.leadId) === lead.id,
      )
      if (existing) return

      const conversion = convertLeadForWorkspacePreview(
        workspaceSlug,
        lead.id,
        {
          workspace: {
            opportunitiesEnabled: true,
            commerceEnabled: false,
            defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
            allowDirectLeadToSale: true,
          },
        },
      )
      createdOpportunity = Boolean(conversion.record) || createdOpportunity
    })

    if (createdOpportunity) {
      setPreviewOpportunities(getMergedWorkspaceOpportunities(workspaceSlug))
      setLeadRecords(
        normalizeLeadsForWorkspaceModel(
          mergeLeadRecords(leads, readPreviewLeads(workspaceSlug)),
          effectiveCapabilities,
        ),
      )
    }
  }, [
    effectiveCapabilities,
    effectiveCapabilities.modules.opportunities,
    leadRecords,
    workspaceSlug,
  ])

  const metrics = useMemo(() => {
    const leadMetrics = getLeadMetrics(
      leadRecords,
      workspaceToday,
      demoLeadStaleActivityCutoff,
      workspaceTimezone,
    )
    return [
      {
        id: 'totalLeads' as const,
        label: 'Total Leads',
        value: leadMetrics.totalLeads.toString(),
        helper: 'Across all active sources',
        tooltip:
          'All leads currently tracked across connected sources and manual entries.',
      },
      {
        id: 'newThisMonth' as const,
        label: 'New This Month',
        value: leadMetrics.newThisMonth.toString(),
        helper: 'Recently captured prospects',
        tooltip: 'Leads created during the current month.',
      },
      {
        id: 'needsFollowUp' as const,
        label: 'Needs Follow-Up',
        value: leadMetrics.needsFollowUp.toString(),
        helper: 'Overdue or pending outreach',
        tooltip:
          'Leads that require outreach, are overdue, or have no recent activity.',
      },
      {
        id: 'conversionRate' as const,
        label: 'Conversion Rate',
        value: `${leadMetrics.conversionRate}%`,
        helper: 'Lead converted',
        tooltip:
          'Percentage of leads converted into their configured next lifecycle record.',
      },
    ]
  }, [leadRecords, workspaceTimezone, workspaceToday])

  const leadVisuals = useMemo(() => {
    const normalizedLeads = getNormalizedLeads(leadRecords)
    const leadMetrics = getLeadMetrics(
      normalizedLeads,
      workspaceToday,
      demoLeadStaleActivityCutoff,
      workspaceTimezone,
    )
    const leadsOverTime: InsightSeriesPoint[] = [
      { label: 'May 20', value: 1 },
      { label: 'May 27', value: 2 },
      {
        label: 'Jun 3',
        value: leadRecords.filter((lead) => lead.createdAt <= '2026-06-03')
          .length,
      },
      {
        label: 'Jun 10',
        value: leadRecords.filter((lead) => lead.createdAt <= '2026-06-10')
          .length,
      },
      {
        label: 'Jun 17',
        value: leadRecords.filter((lead) => lead.createdAt <= '2026-06-17')
          .length,
      },
      { label: 'Today', value: leadRecords.length },
    ]
    const statusBreakdown: InsightBreakdownPoint[] = availableStatusOptions
      .filter((status): status is LeadStatus => status !== 'All')
      .map((status, index) => ({
        label: status,
        value: getLeadStageCount(normalizedLeads, status),
        color:
          status === 'Qualified'
            ? '#34d399'
            : status === 'Disqualified'
              ? '#fb7185'
              : index % 2 === 0
                ? '#22d3ee'
                : '#8b5cf6',
      }))
    const sourceBreakdown: InsightBreakdownPoint[] = Array.from(
      new Set(leadRecords.map((lead) => lead.source)),
    ).map((source, index) => ({
      label: source,
      value: leadRecords.filter((lead) => lead.source === source).length,
      color: ['#22d3ee', '#8b5cf6', '#60a5fa', '#34d399', '#f59e0b'][index % 5],
    }))
    const followUpNeeded = leadMetrics.needsFollowUp

    return {
      conversionRate: leadMetrics.conversionRate,
      followUpNeeded,
      leadsOverTime,
      lifecycleRail:
        presentation.pipelineMode === 'leadToCustomer'
          ? [
              {
                label: 'Captured',
                value: leadRecords.length.toString(),
                helper: 'Total leads',
                active: true,
                tone: 'cyan' as const,
              },
              {
                label: 'Contacted',
                value: countLeadsByPipelineStage(
                  normalizedLeads,
                  'Contacted',
                ).toString(),
                helper: 'Outreach started',
                active: true,
                tone: 'purple' as const,
              },
              {
                label: 'Estimate / Visit',
                value: countLeadsByPipelineStage(
                  normalizedLeads,
                  'Estimate / Visit',
                ).toString(),
                helper: 'Service fit being reviewed',
                active: true,
                tone: 'green' as const,
              },
              {
                label: 'Needs Follow-Up',
                value: followUpNeeded.toString(),
                helper: 'Overdue or pending',
                active: followUpNeeded > 0,
                tone: 'amber' as const,
              },
            ]
          : [
              {
                label: 'Captured',
                value: leadRecords.length.toString(),
                helper: 'Total leads',
                active: true,
                tone: 'cyan' as const,
              },
              {
                label: 'Contacted',
                value: getLeadStageCount(
                  normalizedLeads,
                  'Contacted',
                ).toString(),
                helper: 'Outreach started',
                active: true,
                tone: 'purple' as const,
              },
              {
                label: 'Qualified',
                value: getLeadStageCount(
                  normalizedLeads,
                  'Qualified',
                ).toString(),
                helper: 'Ready for opportunity',
                active: true,
                tone: 'green' as const,
              },
              {
                label: 'Needs Follow-Up',
                value: followUpNeeded.toString(),
                helper: 'Overdue or pending',
                active: followUpNeeded > 0,
                tone: 'amber' as const,
              },
            ],
      sourceBreakdown,
      statusBreakdown,
    }
  }, [
    availableStatusOptions,
    leadRecords,
    presentation.pipelineMode,
    workspaceTimezone,
    workspaceToday,
  ])

  const filteredLeads = useMemo(() => {
    return sortLeads(
      filterLeads(leadRecords, {
        search,
        statusFilter,
        stageFilter,
        metric: selectedMetric,
        drilldown: selectedDrilldown,
        today: workspaceToday,
        staleActivityCutoff: demoLeadStaleActivityCutoff,
        timezone: workspaceTimezone,
        ownerName: (lead) => getOwnerName(workspaceOwners, lead.ownerId),
      }),
      workspaceToday,
      demoLeadStaleActivityCutoff,
      leadSort,
      workspaceTimezone,
    )
  }, [
    leadRecords,
    leadSort,
    search,
    selectedDrilldown,
    selectedMetric,
    stageFilter,
    statusFilter,
    workspaceTimezone,
    workspaceToday,
    workspaceOwners,
  ])

  const savedViewCounts = useMemo(
    () => getLeadSavedViewCounts(leadRecords),
    [leadRecords],
  )
  const savedViews = useMemo(() => {
    const baseViews = [
      { id: 'all', label: 'All Leads', count: savedViewCounts.all },
      {
        id: 'needs-follow-up',
        label: 'Needs Follow-Up',
        count: savedViewCounts.needsFollowUp,
        tone: 'amber' as const,
      },
      {
        id: 'new',
        label: 'New',
        count: savedViewCounts.new,
        tone: 'cyan' as const,
      },
      {
        id: 'contacted',
        label: 'Contacted',
        count: savedViewCounts.contacted,
        tone: 'purple' as const,
      },
    ]

    if (presentation.pipelineMode === 'leadToCustomer') {
      return [
        ...baseViews,
        {
          id: 'estimate-visit',
          label: 'Estimate / Visit',
          count: getLeadSavedViewCountForStage(leadRecords, 'Estimate / Visit'),
          tone: 'green' as const,
        },
        {
          id: 'follow-up',
          label: 'Follow-Up',
          count: getLeadSavedViewCountForStage(leadRecords, 'Follow-Up'),
          tone: 'amber' as const,
        },
        {
          id: 'converted',
          label: 'Converted',
          count: savedViewCounts.converted,
          tone: 'green' as const,
        },
        {
          id: 'high-value',
          label: 'High Value',
          count: savedViewCounts.highValue,
          tone: 'purple' as const,
        },
      ]
    }

    return [
      ...baseViews,
      {
        id: 'qualified',
        label: 'Qualified',
        count: savedViewCounts.qualified,
        tone: 'green' as const,
      },
      {
        id: 'converted',
        label: 'Converted',
        count: savedViewCounts.converted,
        tone: 'green' as const,
      },
      {
        id: 'high-value',
        label: 'High Value',
        count: savedViewCounts.highValue,
        tone: 'purple' as const,
      },
    ]
  }, [leadRecords, presentation.pipelineMode, savedViewCounts])
  const leadPageDescription =
    presentation.pipelineMode === 'leadToCustomer'
      ? `Track new prospects, follow-up activity, and early customer interest before they become ${capabilities.terminology.customerPlural.toLowerCase()}.`
      : presentation.pipelineMode === 'leadToSaleToClient'
        ? `Track new prospects, follow-up activity, and early sales interest before they move into ${capabilities.terminology.salesLabel.toLowerCase()}.`
        : 'Track new prospects, follow-up activity, and early sales interest before they become opportunities.'
  const leadLifecycleDescription =
    presentation.pipelineMode === 'leadToCustomer'
      ? 'From captured lead to estimate, follow-up, and customer conversion.'
      : 'From captured lead to qualification and follow-up pressure.'
  const signalConversionHelper =
    presentation.pipelineMode === 'leadToCustomer'
      ? `Lead to ${capabilities.terminology.customerSingular.toLowerCase()}`
      : presentation.pipelineMode === 'leadToSaleToClient'
        ? `Lead to ${capabilities.terminology.salesLabel.toLowerCase()}`
        : 'Lead to opportunity'
  const recommendedLeadActions = useMemo(() => {
    const actions: Array<{
      title: string
      detail: string
      tone: 'amber' | 'green' | 'cyan' | 'purple' | 'rose'
      cta: string
      onClick: () => void
    }> = [
      {
        title: 'Contact overdue leads',
        detail: 'Prioritize leads with due or stale follow-up activity.',
        tone: 'amber' as const,
        cta: 'Show follow-ups',
        onClick: () => {
          setSelectedMetric('needsFollowUp')
          setSelectedDrilldown({
            type: 'followUp',
            label: 'Overdue',
            mode: 'overdue',
          })
        },
      },
    ]

    if (presentation.pipelineMode === 'leadToCustomer') {
      actions.push({
        title: 'Follow up on estimates',
        detail:
          'Review leads in Estimate / Visit or Follow-Up before converting agreed work into Customers.',
        tone: 'green',
        cta: 'Show estimates',
        onClick: () => {
          setSelectedMetric('totalLeads')
          setSelectedDrilldown({
            type: 'stage',
            label: 'Estimate / Visit',
            stage: 'Estimate / Visit',
          })
        },
      })
    } else if (effectiveCapabilities.modules.opportunities) {
      actions.push({
        title: 'Qualify converted-fit leads',
        detail:
          'Qualified leads should become opportunities before momentum cools.',
        tone: 'green',
        cta: 'Show qualified',
        onClick: () => {
          setSelectedMetric('totalLeads')
          setSelectedDrilldown({
            type: 'status',
            label: 'Qualified',
            status: 'Qualified',
          })
        },
      })
    } else if (effectiveCapabilities.modules.sales) {
      actions.push({
        title: `Move ready leads into ${effectiveCapabilities.terminology.salesLabel}`,
        detail: `Review qualified leads before moving them into ${effectiveCapabilities.terminology.salesLabel.toLowerCase()}.`,
        tone: 'green',
        cta: 'Show qualified',
        onClick: () => {
          setSelectedMetric('totalLeads')
          setSelectedDrilldown({
            type: 'status',
            label: 'Qualified',
            status: 'Qualified',
          })
        },
      })
    }

    actions.push({
      title: 'Review lead sources',
      detail: 'Use source performance to decide where to improve intake next.',
      tone: 'cyan',
      cta: 'Review sources',
      onClick: () => setSelectedMetric('totalLeads'),
    })

    return actions
  }, [
    effectiveCapabilities.modules.opportunities,
    effectiveCapabilities.modules.sales,
    effectiveCapabilities.terminology.salesLabel,
    presentation.pipelineMode,
  ])

  const activeMetric = metrics.find((metric) => metric.id === selectedMetric)

  const scrollTarget =
    searchParams.get('view') ||
    searchParams.get('leadId') ||
    searchParams.get('source') ||
    searchParams.get('status')
      ? 'leads-workspace'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredLeads.length}:${selectedLead?.id ?? ''}`,
  )

  const focusLeadsWorkspace = useCallback(() => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById('leads-workspace')
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      target?.focus({ preventScroll: true })
      setIsWorkspaceHighlighted(true)
      window.setTimeout(() => setIsWorkspaceHighlighted(false), 1800)
    })
  }, [])

  const selectMetric = (metric: LeadMetric) => {
    setSearch('')
    setStatusFilter('All')
    setStageFilter('All')
    setSelectedMetric(metric)
    setSelectedDrilldown(null)
    if (metric === 'newThisMonth') {
      setLeadSort('newestAdded')
    }
    if (metric === 'needsFollowUp') {
      setLeadSort('followUpPriority')
    }
    if (metric === 'conversionRate') {
      setSelectedDrilldown({
        type: 'conversion',
        label: 'Converted',
        mode: 'converted',
      })
    }
    focusLeadsWorkspace()
  }

  const clearFilter = useCallback(() => {
    setSelectedMetric(null)
    setSelectedDrilldown(null)
  }, [])

  const applySavedView = useCallback(
    (viewId: string) => {
      setSearch('')
      setStatusFilter('All')
      setStageFilter('All')

      if (viewId === 'needs-follow-up') {
        setSelectedMetric('needsFollowUp')
        setSelectedDrilldown(null)
        return
      }
      if (viewId === 'qualified') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown(
          presentation.pipelineMode === 'leadToCustomer'
            ? {
                type: 'stage',
                label: 'Estimate / Visit',
                stage: 'Estimate / Visit',
              }
            : {
                type: 'status',
                label: 'Qualified',
                status: 'Qualified',
              },
        )
        return
      }
      if (viewId === 'new') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({ type: 'status', label: 'New', status: 'New' })
        return
      }
      if (viewId === 'contacted') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'status',
          label: 'Contacted',
          status: 'Contacted',
        })
        return
      }
      if (viewId === 'nurture') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown(
          presentation.pipelineMode === 'leadToCustomer'
            ? {
                type: 'stage',
                label: 'Follow-Up',
                stage: 'Follow-Up',
              }
            : {
                type: 'status',
                label: 'Nurture',
                status: 'Nurture',
              },
        )
        return
      }
      if (viewId === 'estimate-visit') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'stage',
          label: 'Estimate / Visit',
          stage: 'Estimate / Visit',
        })
        return
      }
      if (viewId === 'follow-up') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'stage',
          label: 'Follow-Up',
          stage: 'Follow-Up',
        })
        return
      }
      if (viewId === 'converted') {
        setSelectedMetric('conversionRate')
        setSelectedDrilldown({
          type: 'conversion',
          label: 'Converted',
          mode: 'converted',
        })
        return
      }
      if (viewId === 'disqualified') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'status',
          label: 'Disqualified',
          status: 'Disqualified',
        })
        return
      }
      if (viewId === 'high-value') {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'value',
          label: 'High Value',
          mode: 'high',
        })
        return
      }
      clearFilter()
    },
    [clearFilter, presentation.pipelineMode],
  )

  useEffect(() => {
    const view = searchParams.get('view')
    const source = searchParams.get('source')
    const leadId = searchParams.get('leadId')

    if (view) applySavedView(view)
    if (source) {
      const normalized = Array.from(
        new Set(leadRecords.map((lead) => lead.source)),
      ).find((item) => item.toLowerCase() === source.toLowerCase())
      if (normalized) {
        setSelectedMetric('totalLeads')
        setSelectedDrilldown({
          type: 'source',
          label: normalized,
          source: normalized,
        })
      }
    }
    if (leadId) {
      const lead = leadRecords.find((record) => record.id === leadId)
      if (lead) setSelectedLead(lead)
    }
  }, [applySavedView, leadRecords, searchParams])

  const activeSavedViewId =
    selectedDrilldown?.type === 'status' && selectedDrilldown.status === 'New'
      ? 'new'
      : selectedDrilldown?.type === 'status' &&
          selectedDrilldown.status === 'Contacted'
        ? 'contacted'
        : selectedDrilldown?.type === 'status' &&
            selectedDrilldown.status === 'Qualified'
          ? 'qualified'
          : selectedDrilldown?.type === 'status' &&
              selectedDrilldown.status === 'Nurture'
            ? 'nurture'
            : selectedDrilldown?.type === 'stage' &&
                selectedDrilldown.stage === 'Estimate / Visit'
              ? 'estimate-visit'
              : selectedDrilldown?.type === 'stage' &&
                  selectedDrilldown.stage === 'Follow-Up'
                ? 'follow-up'
                : selectedDrilldown?.type === 'status' &&
                    selectedDrilldown.status === 'Disqualified'
                  ? 'disqualified'
                  : selectedDrilldown?.type === 'conversion' &&
                      selectedDrilldown.mode === 'converted'
                    ? 'converted'
                    : selectedDrilldown?.type === 'value'
                      ? 'high-value'
                      : selectedMetric === 'needsFollowUp'
                        ? 'needs-follow-up'
                        : 'all'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === 'All' ? '' : statusFilter,
      stageFilter: stageFilter === 'All' ? '' : stageFilter,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter('All')
      setStageFilter('All')
    },
  })

  const openLead = (lead: LeadRecord) => setSelectedLead(lead)

  const closeAddLeadDialog = () => {
    setIsAddLeadOpen(false)
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('[data-add-lead-trigger="true"]')
        ?.focus()
    })
  }

  const createLead = (input: CreateLeadInput) => {
    const validation = validateCreateLeadInput(input)
    if (!validation.valid) {
      return validation
    }

    const draftLead = createPreviewLeadRecord({
      input,
      existingLeads: leadRecords,
    })
    const identity = upsertContactIdentity(workspaceSlug, {
      id: draftLead.sharedContactId ?? `contact-${draftLead.id}`,
      workspaceId: workspaceSlug,
      contactName: draftLead.name,
      companyName: draftLead.company,
      email: draftLead.contactEmail,
      phone: draftLead.contactPhone,
      sharedNotes: input.sharedNotes?.trim() || undefined,
      updatedAt: draftLead.lastActivityAt ?? draftLead.createdAt,
    })
    const nextLead = applyIdentityToLead(draftLead, identity)

    upsertPreviewLead(workspaceSlug, nextLead)
    appendPreviewActivity(
      workspaceSlug,
      createWorkspaceActivityRecord({
        workspaceId: workspaceSlug,
        recordId: nextLead.id,
        recordType: 'lead',
        action: 'created',
        title: 'Lead created',
        description: `${nextLead.name} was added as a lead.`,
        timestamp: nextLead.lastActivityAt,
        metadata: {
          leadId: nextLead.id,
          companyName: nextLead.company,
          sharedContactId: identity.id,
        },
      }),
    )
    const nextLeadRecords = normalizeLeadsForWorkspaceModel(
      mergeLeadRecords(leads, readPreviewLeads(workspaceSlug)),
      effectiveCapabilities,
    )
    setLeadRecords(nextLeadRecords)
    setActivityRecords(readPreviewActivity(workspaceSlug))
    const isVisibleAfterCreate = filterLeads(nextLeadRecords, {
      search,
      statusFilter,
      stageFilter,
      metric: selectedMetric,
      drilldown: selectedDrilldown,
      today: workspaceToday,
      staleActivityCutoff: demoLeadStaleActivityCutoff,
      timezone: workspaceTimezone,
      ownerName: (lead) => getOwnerName(workspaceOwners, lead.ownerId),
    }).some((lead) => lead.id === nextLead.id)
    setRecentCreatedLeadId(nextLead.id)
    setLeadCreatedMessage(
      isVisibleAfterCreate
        ? `${nextLead.name} was added to Leads.`
        : `${nextLead.name} was added to Leads. It is not visible under the current filter.`,
    )
    window.setTimeout(() => setRecentCreatedLeadId(null), 3500)
    window.setTimeout(() => setLeadCreatedMessage(null), 4500)

    return {
      valid: true,
      errors: {},
    }
  }

  const closeLeadDrawer = () => {
    setSelectedLead(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('leadId')
    const query = params.toString()
    const hash = window.location.hash
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const updateLeadRecord = useCallback(
    (leadId: string, updates: Partial<LeadRecord>) => {
      const sourceLead =
        selectedLead?.id === leadId
          ? selectedLead
          : leadRecords.find((lead) => lead.id === leadId)
      if (!sourceLead) return

      const { record: nextLead, events } = updateLeadRecordWithRules(
        sourceLead,
        updates,
      )
      setLeadRecords((current) =>
        current.map((lead) => (lead.id === leadId ? nextLead : lead)),
      )
      setSelectedLead((current) =>
        current?.id === leadId ? nextLead : current,
      )
      upsertPreviewLead(workspaceSlug, nextLead)
      events.forEach((event) => {
        appendPreviewActivity(workspaceSlug, {
          ...event,
          workspaceId: workspaceSlug,
        })
      })
    },
    [leadRecords, selectedLead, workspaceSlug],
  )

  const updateLeadOwner = (leadId: string, ownerId: string) => {
    updateLeadRecord(leadId, { ownerId })
  }

  const createLeadTask = useCallback(
    (lead: LeadRecord) => {
      const ownerName = getOwnerName(workspaceOwners, lead.ownerId)
      const dueDate = lead.followUpDue ?? workspaceToday
      const task: TaskRecord = {
        id: `task-lead-${lead.id}-${Date.now()}`,
        workspaceId,
        title: `Follow up with ${lead.name}`,
        status: 'Open',
        priority: isLeadOverdue(lead, workspaceToday, workspaceTimezone)
          ? 'High'
          : 'Medium',
        relatedRecord: lead.company,
        relatedType: 'Lead',
        relatedRecordType: 'lead',
        relatedRecordId: lead.id,
        relatedRecordLabel: lead.company,
        parentType: 'lead',
        parentId: lead.id,
        parentLabel: lead.company,
        dueDate,
        ownerId: lead.ownerId,
        assignedOwner: ownerName,
        source: 'Lead Follow-Up',
        createdAt: demoTaskToday,
        estimatedTime: '30 min',
        description: `Follow up with ${lead.name} from ${lead.company}.`,
        notes:
          lead.nextStep ||
          'Created from the lead drawer and linked to the source lead.',
        timeline: [
          {
            title: 'Task created',
            detail: `Created from lead ${lead.name}.`,
            timestamp: `${demoTaskToday} 9:00 AM`,
            tone: 'cyan',
          },
          {
            title: `Assigned to ${ownerName}`,
            detail: 'Owner inherited from the lead.',
            timestamp: `${demoTaskToday} 9:01 AM`,
            tone: 'purple',
          },
        ],
      }

      appendPreviewTask(workspaceId, task)
      appendPreviewTask(workspaceSlug, task)
      appendPreviewActivity(
        workspaceSlug,
        createWorkspaceActivityRecord({
          workspaceId,
          recordId: task.id,
          recordType: 'task',
          action: 'created',
          title: 'Task created',
          description: `${task.title} was created from ${lead.company}.`,
          metadata: {
            leadId: lead.id,
            taskId: task.id,
            companyName: lead.company,
          },
        }),
      )
      setActivityRecords(readPreviewActivity(workspaceSlug))
    },
    [
      workspaceId,
      workspaceSlug,
      workspaceToday,
      workspaceTimezone,
      workspaceOwners,
    ],
  )

  const saveLeadEdits = (leadId: string, updates: Partial<LeadRecord>) => {
    updateLeadRecord(leadId, updates)
  }

  const appendLeadActivity = useCallback(
    (event: WorkspaceActivityRecord) => {
      appendPreviewActivity(workspaceSlug, {
        ...event,
        workspaceId: workspaceSlug,
      })
      setActivityRecords(readPreviewActivity(workspaceSlug))
    },
    [workspaceSlug],
  )

  const scheduleLeadFollowUp = useCallback(
    (
      leadId: string,
      input: {
        date: string
        time?: string
        channel: FollowUpChannel
        notes?: string
        ownerId: string
      },
    ) => {
      const sourceLead =
        selectedLead?.id === leadId
          ? selectedLead
          : leadRecords.find((lead) => lead.id === leadId)
      if (!sourceLead) return
      const ownerName = getOwnerName(workspaceOwners, input.ownerId)
      updateLeadRecord(leadId, {
        followUpDue: input.date,
        nextStep: buildFollowUpNextStep({
          action: 'Schedule another follow-up',
          channel: input.channel,
          date: input.date,
          time: input.time,
        }),
        ownerId: input.ownerId,
      })
      appendLeadActivity(
        createWorkspaceActivityRecord({
          workspaceId: workspaceSlug,
          recordId: leadId,
          recordType: 'lead',
          action: 'updated',
          title: 'Follow-up scheduled',
          description: [
            `${input.channel} follow-up scheduled for ${input.date}${input.time ? ` at ${input.time}` : ''}.`,
            `Owner: ${ownerName}.`,
            input.notes?.trim() ? `Notes: ${input.notes.trim()}` : null,
          ]
            .filter(Boolean)
            .join(' '),
          metadata: {
            leadId,
            channel: input.channel,
            followUpDue: input.date,
            followUpTime: input.time || null,
            ownerId: input.ownerId,
            ownerName,
          },
        }),
      )
    },
    [
      appendLeadActivity,
      leadRecords,
      selectedLead,
      updateLeadRecord,
      workspaceOwners,
      workspaceSlug,
    ],
  )

  const completeLeadFollowUp = useCallback(
    (
      leadId: string,
      input: {
        channel: FollowUpChannel
        outcome: FollowUpOutcome
        notes?: string
        nextAction: FollowUpNextAction
        nextFollowUpDate?: string
        nextFollowUpTime?: string
        ownerId: string
      },
    ) => {
      const sourceLead =
        selectedLead?.id === leadId
          ? selectedLead
          : leadRecords.find((lead) => lead.id === leadId)
      if (!sourceLead) return
      const ownerName = getOwnerName(workspaceOwners, input.ownerId)
      const shouldScheduleNext =
        input.nextAction === 'Schedule another follow-up'
      const shouldCloseFollowUps =
        input.nextAction === 'Close follow-ups' ||
        input.nextAction === 'Nothing else'
      const nextFollowUpDue = shouldScheduleNext
        ? input.nextFollowUpDate || undefined
        : shouldCloseFollowUps
          ? undefined
          : sourceLead.followUpDue
      const nextStep = buildFollowUpNextStep({
        action: input.nextAction,
        channel: input.channel,
        date: input.nextFollowUpDate,
        time: input.nextFollowUpTime,
      })

      updateLeadRecord(leadId, {
        lastActivityAt: getWorkspaceNow({
          timezone: workspaceTimezone,
        }).instant.toISOString(),
        followUpDue: nextFollowUpDue,
        nextStep,
        ownerId: input.ownerId,
      })
      appendLeadActivity(
        createWorkspaceActivityRecord({
          workspaceId: workspaceSlug,
          recordId: leadId,
          recordType: 'lead',
          action: 'completed',
          title: 'Follow-up completed',
          description: formatFollowUpActivityDescription({
            channel: input.channel,
            outcome: input.outcome,
            notes: input.notes,
            ownerName,
          }),
          metadata: {
            leadId,
            channel: input.channel,
            outcome: input.outcome,
            nextAction: input.nextAction,
            nextFollowUpDue: nextFollowUpDue ?? null,
            nextFollowUpTime: input.nextFollowUpTime || null,
            ownerId: input.ownerId,
            ownerName,
          },
        }),
      )
    },
    [
      appendLeadActivity,
      leadRecords,
      selectedLead,
      updateLeadRecord,
      workspaceOwners,
      workspaceSlug,
      workspaceTimezone,
    ],
  )

  const convertLead = (
    leadId: string,
    requestedDestination?: LeadConversionDestinationValue,
  ) => {
    const conversion = convertLeadForWorkspacePreview(workspaceSlug, leadId, {
      workspace: {
        businessModel: effectiveCapabilities.businessModel,
        opportunitiesEnabled: effectiveCapabilities.modules.opportunities,
        commerceEnabled: effectiveCapabilities.modules.customers,
        defaultLeadDestination:
          effectiveCapabilities.conversion.defaultLeadDestination,
        allowDirectLeadToSale:
          effectiveCapabilities.conversion.allowDirectLeadToSale,
        customerSingularLabel:
          effectiveCapabilities.terminology.customerSingular,
        customerPluralLabel: effectiveCapabilities.terminology.customerPlural,
        salesLabel: effectiveCapabilities.terminology.salesLabel,
      },
      request: requestedDestination ? { requestedDestination } : undefined,
    })
    if (!conversion.record) return conversion.message

    const nextLead = normalizeLeadsForWorkspaceModel(
      mergeLeadRecords(leads, readPreviewLeads(workspaceSlug)),
      effectiveCapabilities,
    ).find((lead) => lead.id === leadId)
    if (!nextLead) return conversion.message

    setLeadRecords((current) =>
      current.map((lead) => (lead.id === leadId ? nextLead : lead)),
    )
    setSelectedLead((current) => (current?.id === leadId ? nextLead : current))
    setPreviewOpportunities(
      getMergedWorkspaceOpportunities(workspaceSlug, {
        repairConvertedLeads: effectiveCapabilities.modules.opportunities,
      }),
    )
    return conversion.message
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    lead: LeadRecord,
  ) => {
    if (isRowActionTarget(event.target)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openLead(lead)
    }
  }

  return (
    <DashboardShell className="max-w-7xl">
      <div className="space-y-5">
        <PageHeader
          title="Leads"
          description={leadPageDescription}
          actions={
            <Button
              type="button"
              data-add-lead-trigger="true"
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setIsAddLeadOpen(true)}
            >
              Add Lead
            </Button>
          }
        />

        {leadCreatedMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3 text-sm text-emerald-100"
          >
            {leadCreatedMessage}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <SalesKpiCard
              key={metric.id}
              {...metric}
              isActive={selectedMetric === metric.id}
              toneClass={metricTone[metric.id]}
              onClick={() => selectMetric(metric.id)}
            />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <ChartCard
            title="Lead lifecycle rail"
            description={leadLifecycleDescription}
          >
            <StageRail data={leadVisuals.lifecycleRail} />
          </ChartCard>
          <ChartCard
            title="Lead status breakdown"
            description={`${leadVisuals.followUpNeeded} leads need follow-up · ${leadVisuals.conversionRate}% converted`}
          >
            <DonutBreakdown
              data={leadVisuals.statusBreakdown}
              centerValue={`${leadVisuals.conversionRate}%`}
              centerLabel="Converted"
            />
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ChartCard
            title="Leads by source"
            description="See where new prospects are entering the workspace."
          >
            <HorizontalBarList data={leadVisuals.sourceBreakdown} />
          </ChartCard>
          <ChartCard
            title="Lead signals"
            description="Compact health readout for intake and conversion."
          >
            <SignalMatrix
              columns={2}
              data={[
                {
                  label: 'Conversion',
                  value: `${leadVisuals.conversionRate}%`,
                  helper: signalConversionHelper,
                  tone: 'green',
                },
                {
                  label: 'Follow-Up',
                  value: leadVisuals.followUpNeeded.toString(),
                  helper: 'Needs action',
                  tone: leadVisuals.followUpNeeded > 0 ? 'amber' : 'cyan',
                },
              ]}
            />
          </ChartCard>
        </section>

        <RecommendedActionsCard
          description="Move captured leads through the valid workspace pipeline with the highest-impact follow-ups first."
          actions={recommendedLeadActions}
        />

        <SavedViewTabs
          activeViewId={activeSavedViewId}
          onSelect={applySavedView}
          views={savedViews}
          trailingAction={
            <ClearFiltersButton
              count={activeFilterCount}
              onClear={clearFilters}
            />
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads..."
                aria-label="Search leads"
              />
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'All' | LeadStatus)
                }
                aria-label="Status filter"
              >
                {availableStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(event.target.value as 'All' | LeadStage)
                }
                aria-label="Stage filter"
              >
                {(
                  ['All', ...selectableLeadStages] as Array<'All' | LeadStage>
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select
                value={leadSort}
                onChange={(event) =>
                  setLeadSort(normalizeLeadSort(event.target.value))
                }
                aria-label="Sort leads by"
              >
                {leadSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card
          id="leads-workspace"
          tabIndex={-1}
          className={cn(
            'scroll-mt-28 outline-none transition-shadow duration-300',
            isWorkspaceHighlighted &&
              'border-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.22),0_18px_45px_rgba(8,145,178,0.14)]',
          )}
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Leads Workspace</CardTitle>
                <CardDescription>
                  Click a lead to review source, follow-up timing, and sales
                  readiness.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TableColumnsButton
                  columns={leadsTableColumns}
                  visibleColumns={visibleColumns}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
                <Badge variant="slate">Demo data</Badge>
              </div>
            </div>
            {activeMetric ? (
              <ActiveFilter
                label={`Active filter: ${activeMetric.label}${
                  selectedDrilldown ? ` / ${selectedDrilldown.label}` : ''
                }`}
                onClear={clearFilter}
              />
            ) : null}
          </CardHeader>

          {selectedMetric ? (
            <LeadsDrilldown
              metric={selectedMetric}
              selectedDrilldown={selectedDrilldown}
              onSelect={setSelectedDrilldown}
              leads={leadRecords}
              todayKey={workspaceToday}
              timezone={workspaceTimezone}
              stageOptions={selectableLeadStages}
              pipelineMode={presentation.pipelineMode}
            />
          ) : null}

          {filteredLeads.length > 0 ? (
            <Table
              className="min-w-[1180px]"
              containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
            >
              <THead>
                <TR>
                  <TH>Lead</TH>
                  {isColumnVisible('status') ? <TH>Status</TH> : null}
                  {isColumnVisible('source') ? <TH>Source</TH> : null}
                  {isColumnVisible('value') ? <TH>Value</TH> : null}
                  {isColumnVisible('nextStep') ? <TH>Next Step</TH> : null}
                  {isColumnVisible('followUp') ? <TH>Follow-Up</TH> : null}
                  {isColumnVisible('dateAdded') ? <TH>Date Added</TH> : null}
                  {isColumnVisible('owner') ? (
                    <TH>{ownershipLabels.leads.table}</TH>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {filteredLeads.map((lead) => (
                  <TR
                    key={lead.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${lead.name}`}
                    className={cn(
                      'group cursor-pointer transition duration-150 hover:-translate-y-px hover:border-slate-700/80 hover:bg-cyan-300/[0.07] hover:shadow-[0_8px_24px_rgba(8,145,178,0.08)] focus-visible:bg-cyan-300/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50',
                      selectedLead?.id === lead.id && 'bg-cyan-300/[0.08]',
                      recentCreatedLeadId === lead.id &&
                        'border-cyan-300/45 bg-cyan-300/[0.09] shadow-[0_0_0_1px_rgba(103,232,249,0.18)]',
                    )}
                    onClick={(event) => {
                      if (isRowActionTarget(event.target)) return
                      openLead(lead)
                    }}
                    onKeyDown={(event) => handleRowKeyDown(event, lead)}
                  >
                    <TD>
                      <div className="flex min-w-56 items-center gap-2">
                        <div>
                          <p className="text-app-primary font-medium">
                            {lead.name}
                          </p>
                          <p className="text-neutral-text-secondary mt-0.5 text-xs">
                            {lead.company}
                          </p>
                        </div>
                        <ChevronRight className="text-app-muted ml-auto h-4 w-4 transition group-hover:text-cyan-700 dark:group-hover:text-cyan-200" />
                      </div>
                    </TD>
                    {isColumnVisible('status') ? (
                      <TD>
                        <Badge
                          variant={statusVariant[getLeadLifecycleLabel(lead)]}
                        >
                          {getLeadLifecycleLabel(lead)}
                        </Badge>
                      </TD>
                    ) : null}
                    {isColumnVisible('source') ? (
                      <TD className="text-neutral-text-secondary">
                        {lead.source}
                      </TD>
                    ) : null}
                    {isColumnVisible('value') ? (
                      <TD>{formatCurrency(lead.value)}</TD>
                    ) : null}
                    {isColumnVisible('nextStep') ? (
                      <TD className="text-neutral-text-secondary">
                        <div className="min-w-52">{lead.nextStep}</div>
                      </TD>
                    ) : null}
                    {isColumnVisible('followUp') ? (
                      <TD className="text-neutral-text-secondary">
                        {formatLeadFollowUpLabel(
                          lead,
                          workspaceToday,
                          workspaceTimezone,
                        )}
                      </TD>
                    ) : null}
                    {isColumnVisible('dateAdded') ? (
                      <TD className="text-neutral-text-secondary">
                        <span
                          title={formatLeadDateAdded(
                            lead.createdAt,
                            workspaceTimezone,
                            'full',
                          )}
                        >
                          {formatLeadDateAdded(
                            lead.createdAt,
                            workspaceTimezone,
                            'compact',
                          )}
                        </span>
                      </TD>
                    ) : null}
                    {isColumnVisible('owner') ? (
                      <TD className="text-neutral-text-secondary">
                        {getOwnerName(workspaceOwners, lead.ownerId)}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No leads found"
                description="Try clearing the active filter or changing your search filters."
                actionLabel={
                  selectedMetric || activeFilterCount > 0
                    ? 'Clear filter'
                    : 'Add Lead'
                }
                onAction={
                  selectedMetric || activeFilterCount > 0
                    ? clearFilter
                    : () => setIsAddLeadOpen(true)
                }
              />
              {selectedMetric || activeFilterCount > 0 ? (
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    data-add-lead-trigger="true"
                    leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => setIsAddLeadOpen(true)}
                  >
                    Add Lead
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        {isAddLeadOpen ? (
          <AddLeadDialog
            leads={leadRecords}
            workspaceOwners={workspaceOwners}
            stageOptions={selectableLeadStages}
            onClose={closeAddLeadDialog}
            onCreate={createLead}
          />
        ) : null}

        {selectedLead ? (
          <LeadDrawer
            lead={selectedLead}
            onClose={closeLeadDrawer}
            workspaceOwners={workspaceOwners}
            canEditOwners={canEditOwners}
            onOwnerChange={updateLeadOwner}
            onUpdateLead={saveLeadEdits}
            onScheduleFollowUp={scheduleLeadFollowUp}
            onCompleteFollowUp={completeLeadFollowUp}
            onCreateTask={createLeadTask}
            onConvertLead={convertLead}
            opportunities={previewOpportunities}
            activityRecords={activityRecords}
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            workspaceTimezone={workspaceTimezone}
            capabilities={effectiveCapabilities}
            stageOptions={selectableLeadStages}
            onQualifiedLeadBehaviorChange={setQualifiedLeadBehaviorOverride}
          />
        ) : null}
      </div>
    </DashboardShell>
  )
}

function AddLeadDialog({
  leads,
  workspaceOwners,
  stageOptions,
  onClose,
  onCreate,
}: {
  leads: LeadRecord[]
  workspaceOwners: WorkspaceOwner[]
  stageOptions: readonly LeadStage[]
  onClose: () => void
  onCreate: (input: CreateLeadInput) => {
    valid: boolean
    errors: Partial<Record<CreateLeadField, string>>
  }
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const ownerOptions = activeOwners.length > 0 ? activeOwners : workspaceOwners
  const defaultOwnerId = ownerOptions[0]?.id ?? ''
  const [draft, setDraft] = useState<CreateLeadInput>({
    name: '',
    company: '',
    contactEmail: '',
    contactPhone: '',
    source: 'Manual Entry',
    stage: 'New',
    value: '',
    ownerId: defaultOwnerId,
    followUpDue: '',
    nextStep: '',
    notes: '',
    sharedNotes: '',
  })
  const [errors, setErrors] = useState<
    Partial<Record<CreateLeadField, string>>
  >({})
  const [validationTriggered, setValidationTriggered] = useState(false)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const fieldRefs = useRef<
    Partial<
      Record<CreateLeadField, HTMLInputElement | HTMLSelectElement | null>
    >
  >({})

  const duplicateWarning = useMemo(
    () => getLeadDuplicateWarning(draft, leads),
    [draft, leads],
  )

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const updateDraft = <TKey extends keyof CreateLeadInput>(
    key: TKey,
    value: CreateLeadInput[TKey],
  ) => {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (validationTriggered && isCreateLeadField(key)) {
        setErrors(validateCreateLeadInput(next).errors)
      }
      return next
    })
  }

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = onCreate(draft)
    setErrors(result.errors)
    if (!result.valid) {
      setValidationTriggered(true)
      const firstError = Object.keys(result.errors)[0] as
        | CreateLeadField
        | undefined
      if (firstError) {
        fieldRefs.current[firstError]?.focus()
      }
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 px-4 py-8 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        aria-describedby="add-lead-description"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-black/50"
        onSubmit={submitLead}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="add-lead-title" className="text-lg font-semibold">
              Add Lead
            </h2>
            <p
              id="add-lead-description"
              className="text-neutral-text-secondary mt-1 text-sm leading-6"
            >
              Capture a new prospect and keep it in this workspace&apos;s lead
              pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close Add Lead</span>
          </button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-5 py-5">
          {Object.keys(errors).length > 0 ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-sm text-rose-100"
            >
              Complete the highlighted fields before adding this lead.
            </div>
          ) : null}

          {duplicateWarning ? (
            <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-sm text-amber-100">
              {duplicateWarning}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <LeadFormField label="Lead name" htmlFor="add-lead-name" required>
              <Input
                id="add-lead-name"
                ref={(node) => {
                  nameRef.current = node
                  fieldRefs.current.name = node
                }}
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
                error={errors.name}
                aria-invalid={Boolean(errors.name)}
                placeholder="Corbin Wesche"
              />
            </LeadFormField>
            <LeadFormField label="Company" htmlFor="add-lead-company">
              <Input
                id="add-lead-company"
                value={draft.company}
                onChange={(event) => updateDraft('company', event.target.value)}
                placeholder="NorthStar Electric"
              />
            </LeadFormField>
            <LeadFormField label="Email" htmlFor="add-lead-email">
              <Input
                id="add-lead-email"
                ref={(node) => {
                  fieldRefs.current.contactEmail = node
                }}
                type="email"
                value={draft.contactEmail}
                onChange={(event) =>
                  updateDraft('contactEmail', event.target.value)
                }
                error={errors.contactEmail}
                aria-invalid={Boolean(errors.contactEmail)}
                placeholder="corbin@example.com"
              />
            </LeadFormField>
            <LeadFormField label="Phone" htmlFor="add-lead-phone">
              <Input
                id="add-lead-phone"
                value={draft.contactPhone}
                onChange={(event) =>
                  updateDraft('contactPhone', event.target.value)
                }
                placeholder="+1 555 0100"
              />
            </LeadFormField>
            <LeadFormField label="Source" htmlFor="add-lead-source" required>
              <Select
                id="add-lead-source"
                ref={(node) => {
                  fieldRefs.current.source = node
                }}
                value={draft.source}
                onChange={(event) =>
                  updateDraft('source', event.target.value as LeadSource)
                }
                error={errors.source}
                aria-invalid={Boolean(errors.source)}
              >
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </LeadFormField>
            <LeadFormField label="Stage" htmlFor="add-lead-stage" required>
              <Select
                id="add-lead-stage"
                ref={(node) => {
                  fieldRefs.current.stage = node
                }}
                value={draft.stage}
                onChange={(event) =>
                  updateDraft('stage', event.target.value as LeadStage)
                }
                error={errors.stage}
                aria-invalid={Boolean(errors.stage)}
              >
                {stageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </LeadFormField>
            <LeadFormField label="Estimated value" htmlFor="add-lead-value">
              <Input
                id="add-lead-value"
                ref={(node) => {
                  fieldRefs.current.value = node
                }}
                type="number"
                min="0"
                inputMode="decimal"
                value={draft.value}
                onChange={(event) => updateDraft('value', event.target.value)}
                error={errors.value}
                aria-invalid={Boolean(errors.value)}
                placeholder="2500"
              />
            </LeadFormField>
            <LeadFormField
              label={ownershipLabels.leads.drawer}
              htmlFor="add-lead-owner"
              required
            >
              <Select
                id="add-lead-owner"
                ref={(node) => {
                  fieldRefs.current.ownerId = node
                }}
                value={draft.ownerId}
                onChange={(event) => updateDraft('ownerId', event.target.value)}
                error={errors.ownerId}
                aria-invalid={Boolean(errors.ownerId)}
              >
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </LeadFormField>
            <LeadFormField label="Follow-up due" htmlFor="add-lead-follow-up">
              <Input
                id="add-lead-follow-up"
                ref={(node) => {
                  fieldRefs.current.followUpDue = node
                }}
                type="date"
                value={draft.followUpDue}
                onChange={(event) =>
                  updateDraft('followUpDue', event.target.value)
                }
                error={errors.followUpDue}
                aria-invalid={Boolean(errors.followUpDue)}
              />
            </LeadFormField>
            <LeadFormField label="Next step" htmlFor="add-lead-next-step">
              <Input
                id="add-lead-next-step"
                value={draft.nextStep}
                onChange={(event) =>
                  updateDraft('nextStep', event.target.value)
                }
                placeholder="Schedule intro call"
              />
            </LeadFormField>
            <LeadFormField
              label="Lead notes"
              htmlFor="add-lead-notes"
              className="sm:col-span-2"
            >
              <textarea
                id="add-lead-notes"
                rows={3}
                value={draft.notes}
                onChange={(event) => updateDraft('notes', event.target.value)}
                placeholder="What should the team know before follow-up?"
                className="text-neutral-text-primary placeholder:text-neutral-text-secondary/70 focus:border-brand-primary/70 focus:ring-brand-primary/60 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm leading-6 shadow-sm outline-none transition-colors focus:ring-1"
              />
            </LeadFormField>
            <LeadFormField
              label="Shared client notes"
              htmlFor="add-lead-shared-notes"
              className="sm:col-span-2"
            >
              <textarea
                id="add-lead-shared-notes"
                rows={3}
                value={draft.sharedNotes}
                onChange={(event) =>
                  updateDraft('sharedNotes', event.target.value)
                }
                placeholder="Preferences that should follow this contact into future records."
                className="text-neutral-text-primary placeholder:text-neutral-text-secondary/70 focus:border-brand-primary/70 focus:ring-brand-primary/60 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm leading-6 shadow-sm outline-none transition-colors focus:ring-1"
              />
            </LeadFormField>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Lead</Button>
        </div>
      </form>
    </div>
  )
}

function LeadFormField({
  label,
  htmlFor,
  required = false,
  className,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block space-y-1.5', className)} htmlFor={htmlFor}>
      <span className="text-neutral-text-secondary text-xs font-medium uppercase tracking-[0.14em]">
        {label}
        {required ? <span className="text-cyan-200"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function isCreateLeadField(key: keyof CreateLeadInput): key is CreateLeadField {
  return [
    'name',
    'contactEmail',
    'source',
    'stage',
    'value',
    'ownerId',
    'followUpDue',
  ].includes(key)
}

function LeadsDrilldown({
  metric,
  selectedDrilldown,
  onSelect,
  leads,
  todayKey,
  timezone,
  stageOptions,
  pipelineMode,
}: {
  metric: LeadMetric
  selectedDrilldown: LeadDrilldown | null
  onSelect: (selection: LeadDrilldown) => void
  leads: LeadRecord[]
  todayKey: string
  timezone: string
  stageOptions: readonly LeadStage[]
  pipelineMode: ReturnType<
    typeof getWorkspacePresentationProfile
  >['pipelineMode']
}) {
  const normalizedLeads = getNormalizedLeads(leads)
  const totalLeadTiles =
    pipelineMode === 'leadToCustomer'
      ? [
          ...stageOptions.map((stage) => ({
            label: stage === 'New' ? 'New Leads' : stage,
            value: countLeadsByPipelineStage(normalizedLeads, stage),
            selection: {
              type: 'stage',
              label: stage === 'New' ? 'New Leads' : stage,
              stage,
            } as LeadDrilldown,
          })),
          {
            label: 'Avg Lead Age',
            value: `${getAverageLeadAgeDays()} days`,
            selection: {
              type: 'age',
              label: 'Avg Lead Age',
              mode: 'average',
            } as LeadDrilldown,
          },
        ]
      : ([
          {
            label: 'New Leads',
            value: getLeadStageCount(normalizedLeads, 'New'),
            selection: { type: 'status', label: 'New Leads', status: 'New' },
          },
          {
            label: 'Contacted',
            value: getLeadStageCount(normalizedLeads, 'Contacted'),
            selection: {
              type: 'status',
              label: 'Contacted',
              status: 'Contacted',
            },
          },
          {
            label: 'Qualified',
            value: getLeadStageCount(normalizedLeads, 'Qualified'),
            selection: {
              type: 'status',
              label: 'Qualified',
              status: 'Qualified',
            },
          },
          {
            label: 'Nurture',
            value: getLeadStageCount(normalizedLeads, 'Nurture'),
            selection: {
              type: 'status',
              label: 'Nurture',
              status: 'Nurture',
            },
          },
          {
            label: 'Disqualified',
            value: getLeadStageCount(normalizedLeads, 'Disqualified'),
            selection: {
              type: 'status',
              label: 'Disqualified',
              status: 'Disqualified',
            },
          },
          {
            label: 'Avg Lead Age',
            value: `${getAverageLeadAgeDays()} days`,
            selection: {
              type: 'age',
              label: 'Avg Lead Age',
              mode: 'average',
            },
          },
        ] satisfies Array<{
          label: string
          value: number | string
          selection: LeadDrilldown
        }>)
  const tiles =
    metric === 'totalLeads'
      ? totalLeadTiles
      : metric === 'newThisMonth'
        ? (
            [
              'Website Form',
              'Referral',
              'Google Search',
              'Facebook/Instagram',
              'Manual Entry',
            ] as LeadSource[]
          ).map((source) => ({
            label: source,
            value: normalizedLeads.filter(
              (lead) =>
                isCurrentMonth(lead.createdAt, todayKey, timezone) &&
                lead.source === source,
            ).length,
            selection: {
              type: 'source',
              label: source,
              source,
            } as LeadDrilldown,
          }))
        : metric === 'needsFollowUp'
          ? [
              {
                label: 'Overdue Follow-Ups',
                value: normalizedLeads.filter((lead) =>
                  isLeadOverdue(lead, todayKey, timezone),
                ).length,
                selection: {
                  type: 'followUp',
                  label: 'Overdue Follow-Ups',
                  mode: 'overdue',
                } as LeadDrilldown,
              },
              {
                label: 'Due Today',
                value: normalizedLeads.filter((lead) =>
                  isLeadDueToday(lead, todayKey, timezone),
                ).length,
                selection: {
                  type: 'followUp',
                  label: 'Due Today',
                  mode: 'today',
                } as LeadDrilldown,
              },
              {
                label: 'No Activity 7+ Days',
                value: normalizedLeads.filter(hasNoRecentActivity).length,
                selection: {
                  type: 'followUp',
                  label: 'No Activity 7+ Days',
                  mode: 'inactive',
                } as LeadDrilldown,
              },
            ]
          : [
              {
                label: 'Converted',
                value: normalizedLeads.filter(isConvertedLead).length,
                selection: {
                  type: 'conversion',
                  label: 'Converted',
                  mode: 'converted',
                } as LeadDrilldown,
              },
              {
                label: 'Still Open',
                value: normalizedLeads.filter(isActiveLead).length,
                selection: {
                  type: 'conversion',
                  label: 'Still Open',
                  mode: 'open',
                } as LeadDrilldown,
              },
              {
                label: 'Disqualified/Lost',
                value: getLeadStageCount(normalizedLeads, 'Disqualified'),
                selection: {
                  type: 'conversion',
                  label: 'Disqualified/Lost',
                  mode: 'lost',
                } as LeadDrilldown,
              },
              {
                label: 'Avg Qualification Time',
                value: '4 days',
                selection: {
                  type: 'conversion',
                  label: 'Converted',
                  mode: 'converted',
                } as LeadDrilldown,
              },
            ]

  if (metric === 'totalLeads') {
    return (
      <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <DrilldownTile
              key={tile.label}
              label={tile.label}
              value={tile.value.toString()}
              active={sameLeadDrilldown(tile.selection, selectedDrilldown)}
              onClick={() => onSelect(tile.selection)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <DrilldownTile
            key={tile.label}
            label={tile.label}
            value={tile.value.toString()}
            active={sameLeadDrilldown(tile.selection, selectedDrilldown)}
            onClick={() => onSelect(tile.selection)}
          />
        ))}
      </div>
      {metric === 'conversionRate' ? (
        <ConversionBars leads={normalizedLeads} />
      ) : null}
    </div>
  )
}

function sameLeadDrilldown(a: LeadDrilldown, b: LeadDrilldown | null) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function ConversionBars({ leads }: { leads: LeadRecord[] }) {
  const rows = [
    {
      label: 'Converted',
      value: leads.filter(isConvertedLead).length,
    },
    {
      label: 'Still Open',
      value: leads.filter(isActiveLead).length,
    },
    {
      label: 'Disqualified/Lost',
      value: getLeadStageCount(leads, 'Disqualified'),
    },
  ]
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-xs font-medium text-neutral-100">
        Lead Conversion Breakdown
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="text-neutral-text-secondary flex justify-between text-[11px]">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-300/70"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DrilldownTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-[76px] flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
        active && 'border-cyan-300/45 bg-cyan-300/[0.08]',
      )}
    >
      <p className="text-neutral-text-secondary text-[11px] uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-neutral-100">
        {value}
      </p>
    </button>
  )
}

function ActiveFilter({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-xs text-cyan-100">
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-neutral-text-secondary inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-950/35 px-3 py-1 text-xs font-medium transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear filter
      </button>
    </div>
  )
}

function LeadDrawer({
  lead,
  onClose,
  workspaceOwners,
  canEditOwners,
  onOwnerChange,
  onUpdateLead,
  onScheduleFollowUp,
  onCompleteFollowUp,
  onCreateTask,
  onConvertLead,
  opportunities,
  activityRecords,
  workspaceSlug,
  workspaceId,
  workspaceTimezone,
  capabilities,
  stageOptions,
  onQualifiedLeadBehaviorChange,
}: {
  lead: LeadRecord
  onClose: () => void
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  onOwnerChange: (leadId: string, ownerId: string) => void
  onUpdateLead: (leadId: string, updates: Partial<LeadRecord>) => void
  onScheduleFollowUp: (
    leadId: string,
    input: {
      date: string
      time?: string
      channel: FollowUpChannel
      notes?: string
      ownerId: string
    },
  ) => void
  onCompleteFollowUp: (
    leadId: string,
    input: {
      channel: FollowUpChannel
      outcome: FollowUpOutcome
      notes?: string
      nextAction: FollowUpNextAction
      nextFollowUpDate?: string
      nextFollowUpTime?: string
      ownerId: string
    },
  ) => void
  onCreateTask: (lead: LeadRecord) => void
  onConvertLead: (
    leadId: string,
    requestedDestination?: LeadConversionDestinationValue,
  ) => string | null | void
  opportunities: OpportunityRecord[]
  activityRecords: WorkspaceActivityRecord[]
  workspaceSlug: string
  workspaceId: string
  workspaceTimezone: string
  capabilities: WorkspaceCapabilities
  stageOptions: readonly LeadStage[]
  onQualifiedLeadBehaviorChange: (behavior: QualifiedLeadBehaviorValue) => void
}) {
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(lead.name)
  const [draftCompany, setDraftCompany] = useState(lead.company)
  const [draftStatus, setDraftStatus] = useState<LeadStatus>(lead.status)
  const [draftStage, setDraftStage] = useState<LeadStage>(getLeadStage(lead))
  const [draftSource, setDraftSource] = useState<LeadSource>(lead.source)
  const [draftValue, setDraftValue] = useState(String(lead.value))
  const [draftOwnerId, setDraftOwnerId] = useState(lead.ownerId)
  const [draftFollowUpDue, setDraftFollowUpDue] = useState(
    lead.followUpDue ?? '',
  )
  const [draftNextStep, setDraftNextStep] = useState(lead.nextStep)
  const [draftNotes, setDraftNotes] = useState(lead.notes)
  const [identity, setIdentity] = useState(() =>
    resolveContactIdentity(workspaceSlug, lead),
  )
  const [draftContactName, setDraftContactName] = useState(identity.contactName)
  const [draftCompanyName, setDraftCompanyName] = useState(
    identity.companyName ?? lead.company,
  )
  const [draftContactEmail, setDraftContactEmail] = useState(
    identity.email ?? '',
  )
  const [draftContactPhone, setDraftContactPhone] = useState(
    identity.phone ?? '',
  )
  const [draftSharedNotes, setDraftSharedNotes] = useState(
    identity.sharedNotes ?? '',
  )
  const [stageFocusRequested, setStageFocusRequested] = useState(false)
  const [stageDirty, setStageDirty] = useState(false)
  const [qualifiedPrompt, setQualifiedPrompt] = useState<{
    lead: LeadRecord
    destination: LeadConversionDestinationValue
  } | null>(null)
  const [rememberQualifiedChoice, setRememberQualifiedChoice] = useState(false)
  const [hasDirtyInlineNotes, setHasDirtyInlineNotes] = useState(false)
  const [conversionMenuOpen, setConversionMenuOpen] = useState(false)
  const [followUpDialog, setFollowUpDialog] = useState<
    'schedule' | 'complete' | null
  >(null)
  const conversionMenuRef = useRef<HTMLDivElement | null>(null)
  const stageFieldRef = useRef<HTMLLabelElement | null>(null)
  const stageSelectRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    if (isEditing) return
    setDraftName(lead.name)
    setDraftCompany(lead.company)
    setDraftStatus(lead.status)
    setDraftStage(getLeadStage(lead))
    setDraftSource(lead.source)
    setDraftValue(String(lead.value))
    setDraftOwnerId(lead.ownerId)
    setDraftFollowUpDue(lead.followUpDue ?? '')
    setDraftNextStep(lead.nextStep)
    setDraftNotes(lead.notes)
    const nextIdentity = resolveContactIdentity(workspaceSlug, lead)
    setIdentity(nextIdentity)
    setDraftContactName(nextIdentity.contactName)
    setDraftCompanyName(nextIdentity.companyName ?? lead.company)
    setDraftContactEmail(nextIdentity.email ?? '')
    setDraftContactPhone(nextIdentity.phone ?? '')
    setDraftSharedNotes(nextIdentity.sharedNotes ?? '')
    setStageDirty(false)
    setStageFocusRequested(false)
  }, [isEditing, lead, workspaceSlug])

  useEffect(() => {
    if (!isEditing || !stageFocusRequested) return
    window.setTimeout(() => {
      stageFieldRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
      stageSelectRef.current?.focus()
    }, 0)
  }, [isEditing, stageFocusRequested])

  const requestClose = useCallback(() => {
    if (
      hasDirtyInlineNotes &&
      !window.confirm('Discard unsaved note changes?')
    ) {
      return
    }
    onClose()
  }, [hasDirtyInlineNotes, onClose])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestClose])

  useEffect(() => {
    if (!conversionMenuOpen) return
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (
        conversionMenuRef.current &&
        !conversionMenuRef.current.contains(event.target as Node)
      ) {
        setConversionMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [conversionMenuOpen])

  const showPlaceholder = (action: string) => {
    setDrawerMessage(`${action} will connect when lead workflows are enabled.`)
  }

  const saveClientNotes = (nextNotes: string) => {
    const nextIdentity = upsertContactIdentity(workspaceSlug, {
      ...identity,
      sharedNotes: nextNotes || undefined,
    })
    setIdentity(nextIdentity)
    appendPreviewActivity(
      workspaceSlug,
      createWorkspaceActivityRecord({
        workspaceId: workspaceSlug,
        recordId: lead.id,
        recordType: 'note',
        action: 'noteAdded',
        title: 'Client Notes updated',
        description: `${nextIdentity.contactName} shared client notes were updated.`,
        metadata: {
          leadId: lead.id,
          sourceLeadId: lead.id,
          companyName: lead.company,
          clientName: lead.name,
          sharedContactId: nextIdentity.id,
        },
      }),
    )
  }

  const saveLeadNotes = (nextNotes: string) => {
    onUpdateLead(lead.id, {
      leadNotes: nextNotes,
      notes: nextNotes,
    })
  }

  const linkedOpportunity = opportunities.find(
    (opportunity) =>
      (opportunity.sourceLeadId ?? opportunity.leadId) === lead.id,
  )
  const conversionActions = useMemo(
    () => getLeadConversionActions(capabilities, { converted: lead.converted }),
    [capabilities, lead.converted],
  )
  const primaryConversionAction = conversionActions[0]
  const secondaryConversionActions = conversionActions.slice(1)
  const connectedRecordLabel = linkedOpportunity
    ? 'Opportunity'
    : lead.converted &&
        lead.convertedDestination === LeadConversionDestination.SALE
      ? 'Sale'
      : capabilities.terminology.customerSingular
  const connectedRecordHref = linkedOpportunity
    ? `/dashboard/${workspaceSlug}/opportunities?opportunityId=${linkedOpportunity.id}#opportunities-workspace`
    : lead.converted &&
        connectedRecordLabel === 'Sale' &&
        capabilities.modules.sales
      ? `/dashboard/${workspaceSlug}/sales-pipeline`
      : lead.converted &&
          (lead.convertedDestination === LeadConversionDestination.CUSTOMER ||
            lead.connectedRecordType === 'Customer' ||
            lead.connectedRecordType === 'Client') &&
          lead.connectedRecordId
        ? buildRelatedRecordHref({
            workspaceSlug,
            type: 'client',
            id: lead.connectedRecordId,
          })
        : undefined
  const relatedActivity = useMemo(
    () =>
      getRelatedActivityRecords(activityRecords, {
        leadId: lead.id,
        sourceLeadId: lead.id,
        opportunityId: linkedOpportunity?.id,
        clientId: linkedOpportunity?.clientId,
        companyName: lead.company,
        clientName: linkedOpportunity?.client,
      }),
    [activityRecords, lead.company, lead.id, linkedOpportunity],
  )

  const convertLead = (action: LeadConversionAction) => {
    if (lead.converted) {
      setDrawerMessage('This lead has already been converted.')
      return
    }
    setConversionMenuOpen(false)
    const message = onConvertLead(lead.id, action.destination)
    setDrawerMessage(
      message ??
        (action.destination === LeadConversionDestination.OPPORTUNITY
          ? 'Lead converted and opportunity created locally.'
          : action.destination === LeadConversionDestination.CUSTOMER
            ? `Lead converted to ${capabilities.terminology.customerSingular} locally.`
            : 'Lead converted directly to Sale locally.'),
    )
  }

  const handleConversionMenuKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setConversionMenuOpen(false)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(
      conversionMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    )
    if (!items.length) return
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    )
    const nextIndex =
      event.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  const cancelEditing = () => {
    setDraftName(lead.name)
    setDraftCompany(lead.company)
    setDraftStatus(lead.status)
    setDraftStage(getLeadStage(lead))
    setDraftSource(lead.source)
    setDraftValue(String(lead.value))
    setDraftOwnerId(lead.ownerId)
    setDraftFollowUpDue(lead.followUpDue ?? '')
    setDraftNextStep(lead.nextStep)
    setDraftNotes(lead.notes)
    setDraftContactName(identity.contactName)
    setDraftCompanyName(identity.companyName ?? lead.company)
    setDraftContactEmail(identity.email ?? '')
    setDraftContactPhone(identity.phone ?? '')
    setDraftSharedNotes(identity.sharedNotes ?? '')
    setStageDirty(false)
    setStageFocusRequested(false)
    setIsEditing(false)
  }

  const saveEditing = () => {
    const nextValue = Number(draftValue)
    const nextStage = getLeadStage({ ...lead, stage: draftStage })
    const nextIdentity = upsertContactIdentity(workspaceSlug, {
      ...identity,
      contactName: draftContactName.trim() || draftName.trim() || lead.name,
      companyName:
        draftCompanyName.trim() || draftCompany.trim() || lead.company,
      email: draftContactEmail.trim() || undefined,
      phone: draftContactPhone.trim() || undefined,
      sharedNotes: draftSharedNotes.trim() || undefined,
    })
    setIdentity(nextIdentity)
    const nextLeadDraft: LeadRecord = applyIdentityToLead(
      {
        ...lead,
        name: draftName.trim() || lead.name,
        company: draftCompany.trim() || lead.company,
        status: getStatusForLeadStage(nextStage),
        stage: nextStage,
        source: draftSource,
        value: Number.isFinite(nextValue) ? nextValue : lead.value,
        ownerId: draftOwnerId,
        followUpDue:
          nextStage === 'Converted' || nextStage === 'Disqualified'
            ? undefined
            : draftFollowUpDue || undefined,
        nextStep:
          nextStage === 'Converted' || nextStage === 'Disqualified'
            ? 'Follow-ups closed'
            : draftNextStep.trim() || lead.nextStep,
        notes: draftNotes.trim(),
      },
      nextIdentity,
    )
    onUpdateLead(lead.id, {
      name: nextLeadDraft.name,
      company: nextLeadDraft.company,
      status: nextLeadDraft.status,
      stage: nextLeadDraft.stage,
      source: nextLeadDraft.source,
      value: nextLeadDraft.value,
      ownerId: nextLeadDraft.ownerId,
      followUpDue: nextLeadDraft.followUpDue,
      nextStep: nextLeadDraft.nextStep,
      notes: nextLeadDraft.notes,
    })
    setStageDirty(false)
    setStageFocusRequested(false)
    const qualifiedAction = resolveLeadStageConversionAction({
      before: lead,
      after: nextLeadDraft,
      capabilities,
    })
    if (qualifiedAction.type === 'PROMPT') {
      setQualifiedPrompt({
        lead: nextLeadDraft,
        destination: qualifiedAction.destination,
      })
      setDrawerMessage('Lead changes saved. Choose whether to move it forward.')
    } else if (qualifiedAction.type === 'AUTO_CONVERT') {
      const message = onConvertLead(lead.id, qualifiedAction.destination)
      setDrawerMessage(
        message ??
          (nextLeadDraft.stage === 'Won'
            ? `${capabilities.terminology.customerSingular} created from won lead.`
            : 'Qualified lead converted locally.'),
      )
    } else {
      setDrawerMessage(
        getStageFollowUpGuidance({
          lead,
          nextLead: nextLeadDraft,
          todayKey: getWorkspaceNow({ timezone: workspaceTimezone }).dateKey,
          timezone: workspaceTimezone,
        }),
      )
    }
    setIsEditing(false)
  }

  const persistQualifiedBehavior = async (
    qualifiedLeadBehavior: QualifiedLeadBehaviorValue,
  ) => {
    await fetch(`/api/workspaces/${workspaceId}/sales-process`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessModel: capabilities.businessModel,
        opportunitiesEnabled: capabilities.modules.opportunities,
        commerceEnabled:
          capabilities.modules.orders && capabilities.modules.fulfillment,
        defaultLeadDestination: capabilities.conversion.defaultLeadDestination,
        allowDirectLeadToSale: capabilities.conversion.allowDirectLeadToSale,
        qualifiedLeadBehavior,
      }),
    }).catch(() => null)
  }

  const completeQualifiedPrompt = async (mode: 'convert' | 'keep') => {
    if (!qualifiedPrompt) return
    if (rememberQualifiedChoice) {
      const nextBehavior =
        mode === 'convert'
          ? QualifiedLeadBehavior.AUTO_CONVERT
          : QualifiedLeadBehavior.KEEP_QUALIFIED
      await persistQualifiedBehavior(nextBehavior)
      onQualifiedLeadBehaviorChange(nextBehavior)
    }
    if (mode === 'convert') {
      const message = onConvertLead(
        qualifiedPrompt.lead.id,
        qualifiedPrompt.destination,
      )
      setDrawerMessage(message ?? 'Qualified lead converted locally.')
    } else {
      setDrawerMessage('Lead kept as a Qualified Lead.')
    }
    setQualifiedPrompt(null)
    setRememberQualifiedChoice(false)
  }

  const requestStageUpdate = () => {
    setIsEditing(true)
    setStageFocusRequested(true)
    setDrawerMessage('Select a new stage, then save your changes.')
  }

  const leadNeedsFollowUp = hasActiveLeadFollowUp(lead)
  const activeFollowUpOwners = getActiveOwners(workspaceOwners)
  const ownerOptions =
    activeFollowUpOwners.length > 0 ? activeFollowUpOwners : workspaceOwners
  const followUpOwnerId = lead.ownerId || ownerOptions[0]?.id || ''
  const leadLifecycleLabel = getLeadLifecycleLabel(lead)
  const leadStageLabel = getLeadStage(lead)
  const showLifecycleStatus =
    isConvertedLead(lead) ||
    leadLifecycleLabel === 'Disqualified' ||
    leadLifecycleLabel !== leadStageLabel

  const scheduleFollowUp = (input: {
    date: string
    time?: string
    channel: FollowUpChannel
    notes?: string
    ownerId: string
  }) => {
    onScheduleFollowUp(lead.id, input)
    setFollowUpDialog(null)
    setDrawerMessage('Follow-up scheduled.')
  }

  const completeFollowUp = (input: {
    channel: FollowUpChannel
    outcome: FollowUpOutcome
    notes?: string
    nextAction: FollowUpNextAction
    nextFollowUpDate?: string
    nextFollowUpTime?: string
    ownerId: string
  }) => {
    onCompleteFollowUp(lead.id, input)
    setFollowUpDialog(null)
    setDrawerMessage(
      input.nextAction === 'Schedule another follow-up'
        ? 'Follow-up completed and the next follow-up was scheduled.'
        : 'Follow-up completed.',
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70">
      <button
        type="button"
        aria-label="Close lead details"
        className="hidden flex-1 cursor-default sm:block"
        onClick={requestClose}
      />
      <aside className="drawer-surface flex h-full w-full max-w-xl flex-col overflow-y-auto border-l shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="drawer-header-surface sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-app-primary text-lg font-semibold">
                {isEditing ? 'Editing lead' : lead.name}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {isEditing ? draftCompany : lead.company}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={statusVariant[isEditing ? draftStatus : lead.status]}
                >
                  {isEditing ? draftStatus : getLeadLifecycleLabel(lead)}
                </Badge>
                <Badge variant="purple">
                  {isEditing ? draftSource : lead.source}
                </Badge>
                {isEditing ? <Badge variant="brand">Editing</Badge> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  className="px-3.5"
                  leftIcon={
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              ) : null}
              <button
                type="button"
                onClick={requestClose}
                className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary rounded-lg border p-2 transition"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          {drawerMessage ? (
            <div
              className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/[0.06] dark:text-cyan-100"
              role="status"
              aria-live="polite"
            >
              {drawerMessage}
            </div>
          ) : null}
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 dark:border-cyan-300/20 dark:bg-cyan-300/[0.06]">
              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-100">
                {stageDirty
                  ? 'Unsaved changes — Save changes to apply the new stage and update the pipeline.'
                  : stageFocusRequested
                    ? 'Select a new stage, then save your changes.'
                    : 'Editing lead. Changes are saved locally for this workspace preview.'}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
                <Button type="button" size="xs" onClick={saveEditing}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-4 p-5">
          <DrawerSection title="Lead Details">
            <InfoGrid>
              {isEditing ? (
                <>
                  <EditableField label="Lead Name">
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label="Company">
                    <Input
                      value={draftCompany}
                      onChange={(event) => setDraftCompany(event.target.value)}
                    />
                  </EditableField>
                  <EditableField
                    label="Lead Stage"
                    ref={stageFieldRef}
                    highlighted={stageFocusRequested}
                    helper={
                      stageFocusRequested
                        ? 'Select a new stage, then save your changes.'
                        : undefined
                    }
                  >
                    <Select
                      ref={stageSelectRef}
                      value={draftStage}
                      onChange={(event) => {
                        const nextStage = event.target.value as LeadStage
                        setDraftStage(nextStage)
                        setDraftStatus(getStatusForLeadStage(nextStage))
                        setStageDirty(nextStage !== getLeadStage(lead))
                        setStageFocusRequested(false)
                      }}
                    >
                      {stageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Source">
                    <Select
                      value={draftSource}
                      onChange={(event) =>
                        setDraftSource(event.target.value as LeadSource)
                      }
                    >
                      {sourceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Value">
                    <Input
                      type="number"
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label={ownershipLabels.leads.drawer}>
                    <Select
                      value={draftOwnerId}
                      onChange={(event) => setDraftOwnerId(event.target.value)}
                    >
                      {getActiveOwners(workspaceOwners).map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                </>
              ) : (
                <>
                  {showLifecycleStatus ? (
                    <InfoItem label="Status" value={leadLifecycleLabel} />
                  ) : null}
                  <InfoItem label="Stage" value={leadStageLabel} />
                  {isConvertedLead(lead) && lead.status !== 'Converted' ? (
                    <InfoItem label="Previous stage" value={lead.status} />
                  ) : null}
                  <InfoItem label="Source" value={lead.source} />
                  <InfoItem label="Value" value={formatCurrency(lead.value)} />
                  {canEditOwners ? (
                    <EditableOwnerItem
                      label={ownershipLabels.leads.drawer}
                      value={lead.ownerId}
                      owners={workspaceOwners}
                      onChange={(ownerId) => onOwnerChange(lead.id, ownerId)}
                    />
                  ) : (
                    <InfoItem
                      label={ownershipLabels.leads.drawer}
                      value={getOwnerName(workspaceOwners, lead.ownerId)}
                    />
                  )}
                </>
              )}
              <InfoItem
                label="Created"
                value={formatWorkspaceDateTime(lead.createdAt)}
              />
              <InfoItem
                label="Lead Age"
                value={`${getLeadAgeDays(lead.createdAt)} days`}
              />
            </InfoGrid>
          </DrawerSection>
          <DrawerSection title="Contact Identity">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableField label="Contact Name">
                    <Input
                      value={draftContactName}
                      onChange={(event) =>
                        setDraftContactName(event.target.value)
                      }
                    />
                  </EditableField>
                  <EditableField label="Company">
                    <Input
                      value={draftCompanyName}
                      onChange={(event) =>
                        setDraftCompanyName(event.target.value)
                      }
                    />
                  </EditableField>
                  <EditableField label="Email">
                    <Input
                      type="email"
                      value={draftContactEmail}
                      onChange={(event) =>
                        setDraftContactEmail(event.target.value)
                      }
                    />
                  </EditableField>
                  <EditableField label="Phone">
                    <Input
                      value={draftContactPhone}
                      onChange={(event) =>
                        setDraftContactPhone(event.target.value)
                      }
                    />
                  </EditableField>
                </div>
              </div>
            ) : (
              <InfoGrid>
                <InfoItem label="Contact" value={identity.contactName} />
                <InfoItem
                  label="Company"
                  value={identity.companyName ?? lead.company}
                />
                <InfoItem label="Email" value={identity.email ?? 'Not added'} />
                <InfoItem label="Phone" value={identity.phone ?? 'Not added'} />
              </InfoGrid>
            )}
          </DrawerSection>
          <DrawerSection title="Follow-Up">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableField label="Follow-Up Due">
                    <Input
                      type="date"
                      value={draftFollowUpDue}
                      onChange={(event) =>
                        setDraftFollowUpDue(event.target.value)
                      }
                    />
                  </EditableField>
                  <EditableField label="Next Step">
                    <Input
                      value={draftNextStep}
                      onChange={(event) => setDraftNextStep(event.target.value)}
                    />
                  </EditableField>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoGrid>
                  <InfoItem
                    label="Next Step"
                    value={
                      isConvertedLead(lead) ? 'None - converted' : lead.nextStep
                    }
                  />
                  <InfoItem
                    label="Follow-Up Due"
                    value={formatLeadFollowUpLabel(
                      lead,
                      getWorkspaceNow({ timezone: workspaceTimezone }).dateKey,
                      workspaceTimezone,
                    )}
                  />
                </InfoGrid>
                {!isConvertedLead(lead) ? (
                  <div className="flex flex-wrap gap-2">
                    {leadNeedsFollowUp ? (
                      <Button
                        type="button"
                        size="sm"
                        leftIcon={
                          <CheckCircle2
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        }
                        onClick={() => setFollowUpDialog('complete')}
                      >
                        Mark Followed Up
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        leftIcon={
                          <CalendarPlus
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        }
                        onClick={() => setFollowUpDialog('schedule')}
                      >
                        Schedule Follow-Up
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </DrawerSection>
          <NotesCard
            title="Client Notes"
            description="Shared throughout the customer relationship."
            value={identity.sharedNotes}
            onSave={saveClientNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <NotesCard
            title="Lead Notes"
            description="Only for qualifying and following up with this Lead."
            value={lead.leadNotes ?? lead.notes}
            onSave={saveLeadNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <CompactActivityTimeline
            events={buildLeadActivityEvents(lead, relatedActivity)}
          />
          <LinkedRecordsCard
            title="Connected Records"
            records={[
              linkedOpportunity
                ? {
                    label: 'Opportunity',
                    value: linkedOpportunity.name,
                    helper: 'Open the opportunity created from this lead.',
                    href: connectedRecordHref,
                  }
                : lead.converted
                  ? {
                      label: connectedRecordLabel,
                      value:
                        connectedRecordLabel === 'Sale'
                          ? `${lead.company} Sale`
                          : lead.company,
                      helper: `This lead is connected to a ${connectedRecordLabel}.`,
                      href: connectedRecordHref,
                    }
                  : capabilities.modules.opportunities
                    ? {
                        label: 'Potential Opportunity',
                        value: 'Not created yet',
                        helper: 'Convert when qualification is complete.',
                      }
                    : {
                        label: connectedRecordLabel,
                        value: 'Not created yet',
                        helper:
                          primaryConversionAction?.helper ??
                          'Convert when qualification is complete.',
                      },
            ]}
          />
          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <DrawerActionGroup label="Primary">
                <button
                  type="button"
                  onClick={() => {
                    onCreateTask(lead)
                    setDrawerMessage(
                      `Task created and linked to ${lead.name}. Open it from the Tasks workspace.`,
                    )
                  }}
                  className="rounded-lg border border-cyan-300/35 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Create Task
                </button>
                {!isConvertedLead(lead) ? (
                  <button
                    type="button"
                    onClick={requestStageUpdate}
                    className="text-neutral-text-secondary rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-1.5 text-xs font-medium transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    Update Stage
                  </button>
                ) : null}
                {primaryConversionAction ? (
                  secondaryConversionActions.length > 0 ? (
                    <div
                      ref={conversionMenuRef}
                      className="relative inline-flex"
                      onKeyDown={handleConversionMenuKeyDown}
                    >
                      <button
                        type="button"
                        onClick={() => convertLead(primaryConversionAction)}
                        aria-label={`${primaryConversionAction.label}. Default conversion path.`}
                        className="text-neutral-text-secondary rounded-l-lg border border-slate-700/80 bg-slate-950/45 px-3 py-1.5 text-xs font-medium transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      >
                        {primaryConversionAction.label}
                        {primaryConversionAction.isDefault ? (
                          <span className="sr-only"> Default</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label="Choose lead conversion destination"
                        aria-haspopup="menu"
                        aria-expanded={conversionMenuOpen}
                        onClick={() => setConversionMenuOpen((open) => !open)}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setConversionMenuOpen(true)
                            window.setTimeout(() => {
                              conversionMenuRef.current
                                ?.querySelector<HTMLButtonElement>(
                                  '[role="menuitem"]',
                                )
                                ?.focus()
                            }, 0)
                          }
                        }}
                        className="text-neutral-text-secondary -ml-px rounded-r-lg border border-slate-700/80 bg-slate-950/45 px-2 py-1.5 transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      >
                        <ChevronDown
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </button>
                      {conversionMenuOpen ? (
                        <div
                          role="menu"
                          aria-label="Lead conversion destinations"
                          className="absolute left-0 top-full z-20 mt-2 min-w-56 rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-black/40"
                        >
                          {secondaryConversionActions.map((action) => (
                            <button
                              key={action.destination}
                              type="button"
                              role="menuitem"
                              onClick={() => convertLead(action)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs text-neutral-200 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100 focus:bg-cyan-300/[0.08] focus:outline-none"
                            >
                              <span className="block font-medium">
                                {action.label}
                              </span>
                              <span className="text-neutral-text-secondary mt-0.5 block">
                                {action.helper}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => convertLead(primaryConversionAction)}
                      aria-label={`${primaryConversionAction.label}. Default conversion path.`}
                      className="text-neutral-text-secondary rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-1.5 text-xs font-medium transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    >
                      {primaryConversionAction.label}
                    </button>
                  )
                ) : lead.converted ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-100"
                  >
                    Converted to {connectedRecordLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => showPlaceholder('Message Lead')}
                  className="text-neutral-text-secondary rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-1.5 text-xs font-medium transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Message Lead
                </button>
              </DrawerActionGroup>
              <DrawerActionGroup label="Danger">
                <button
                  type="button"
                  onClick={() => showPlaceholder('Archive Lead')}
                  className="rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
                >
                  Archive Lead
                </button>
              </DrawerActionGroup>
            </div>
          </DrawerSection>
        </div>
      </aside>
      {followUpDialog === 'schedule' ? (
        <ScheduleFollowUpDialog
          lead={lead}
          ownerId={followUpOwnerId}
          workspaceOwners={workspaceOwners}
          onClose={() => setFollowUpDialog(null)}
          onSubmit={scheduleFollowUp}
        />
      ) : null}
      {followUpDialog === 'complete' ? (
        <CompleteFollowUpDialog
          lead={lead}
          ownerId={followUpOwnerId}
          workspaceOwners={workspaceOwners}
          onClose={() => setFollowUpDialog(null)}
          onSubmit={completeFollowUp}
        />
      ) : null}
      {qualifiedPrompt ? (
        <QualifiedLeadHandoffDialog
          lead={qualifiedPrompt.lead}
          destination={qualifiedPrompt.destination}
          remember={rememberQualifiedChoice}
          onRememberChange={setRememberQualifiedChoice}
          onConvert={() => void completeQualifiedPrompt('convert')}
          onKeep={() => void completeQualifiedPrompt('keep')}
          onClose={() => {
            setQualifiedPrompt(null)
            setRememberQualifiedChoice(false)
          }}
        />
      ) : null}
    </div>
  )
}

function buildLeadActivityEvents(
  lead: LeadRecord,
  activityRecords: WorkspaceActivityRecord[],
): CrmTimelineEvent[] {
  const sharedEvents = activityRecords.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    timestamp: formatWorkspaceDateTime(event.timestamp),
    category: getWorkspaceActivityCategory(event),
  }))
  const staticEvents = getLeadTimeline(lead).map((item) => ({
    id: item.title,
    title: item.title,
    description: item.detail,
    timestamp: formatWorkspaceDateTime(item.date),
    category: 'Lead Pipeline',
  }))
  const seen = new Set<string>()

  return [...sharedEvents, ...staticEvents].filter((event) => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}

function ScheduleFollowUpDialog({
  lead,
  ownerId,
  workspaceOwners,
  onClose,
  onSubmit,
}: {
  lead: LeadRecord
  ownerId: string
  workspaceOwners: WorkspaceOwner[]
  onClose: () => void
  onSubmit: (input: {
    date: string
    time?: string
    channel: FollowUpChannel
    notes?: string
    ownerId: string
  }) => void
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const ownerOptions = activeOwners.length > 0 ? activeOwners : workspaceOwners
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [channel, setChannel] = useState<FollowUpChannel>('Call')
  const [notes, setNotes] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState(ownerId)
  const [error, setError] = useState<string | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!date) {
      setError('Choose a follow-up date.')
      dateRef.current?.focus()
      return
    }
    onSubmit({
      date,
      time: time || undefined,
      channel,
      notes,
      ownerId: selectedOwnerId,
    })
  }

  return (
    <FollowUpDialogShell
      title="Schedule Follow-Up"
      description={`Plan the next outreach for ${lead.name}.`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Schedule Follow-Up"
    >
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-xs text-rose-100"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <LeadFormField label="Date" htmlFor="schedule-follow-up-date" required>
          <Input
            id="schedule-follow-up-date"
            ref={dateRef}
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              if (event.target.value) setError(null)
            }}
            error={error ?? undefined}
            aria-invalid={Boolean(error)}
          />
        </LeadFormField>
        <LeadFormField label="Time" htmlFor="schedule-follow-up-time">
          <Input
            id="schedule-follow-up-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </LeadFormField>
        <LeadFormField label="Channel" htmlFor="schedule-follow-up-channel">
          <Select
            id="schedule-follow-up-channel"
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as FollowUpChannel)
            }
          >
            {followUpChannels.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </LeadFormField>
        <LeadFormField
          label={ownershipLabels.leads.drawer}
          htmlFor="schedule-follow-up-owner"
        >
          <Select
            id="schedule-follow-up-owner"
            value={selectedOwnerId}
            onChange={(event) => setSelectedOwnerId(event.target.value)}
          >
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </LeadFormField>
      </div>
      <LeadFormField
        label="Notes"
        htmlFor="schedule-follow-up-notes"
        className="block"
      >
        <textarea
          id="schedule-follow-up-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="text-neutral-text-primary placeholder:text-neutral-text-secondary/70 focus:border-brand-primary/70 focus:ring-brand-primary/60 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm leading-6 shadow-sm outline-none transition-colors focus:ring-1"
          placeholder="Context for the next follow-up."
        />
      </LeadFormField>
    </FollowUpDialogShell>
  )
}

function CompleteFollowUpDialog({
  lead,
  ownerId,
  workspaceOwners,
  onClose,
  onSubmit,
}: {
  lead: LeadRecord
  ownerId: string
  workspaceOwners: WorkspaceOwner[]
  onClose: () => void
  onSubmit: (input: {
    channel: FollowUpChannel
    outcome: FollowUpOutcome
    notes?: string
    nextAction: FollowUpNextAction
    nextFollowUpDate?: string
    nextFollowUpTime?: string
    ownerId: string
  }) => void
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const ownerOptions = activeOwners.length > 0 ? activeOwners : workspaceOwners
  const [channel, setChannel] = useState<FollowUpChannel>('Call')
  const [outcome, setOutcome] = useState<FollowUpOutcome>('Reached')
  const [notes, setNotes] = useState('')
  const [nextAction, setNextAction] = useState<FollowUpNextAction>(
    'Schedule another follow-up',
  )
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [nextFollowUpTime, setNextFollowUpTime] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState(ownerId)
  const [error, setError] = useState<string | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)

  const requiresDate = nextAction === 'Schedule another follow-up'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (requiresDate && !nextFollowUpDate) {
      setError('Choose the next follow-up date.')
      dateRef.current?.focus()
      return
    }
    onSubmit({
      channel,
      outcome,
      notes,
      nextAction,
      nextFollowUpDate: requiresDate ? nextFollowUpDate : undefined,
      nextFollowUpTime: requiresDate ? nextFollowUpTime : undefined,
      ownerId: selectedOwnerId,
    })
  }

  return (
    <FollowUpDialogShell
      title="Mark Followed Up"
      description={`Record the completed follow-up for ${lead.name}.`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Save Follow-Up"
    >
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-xs text-rose-100"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <LeadFormField
          label="Follow-up channel"
          htmlFor="complete-follow-up-channel"
        >
          <Select
            id="complete-follow-up-channel"
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as FollowUpChannel)
            }
          >
            {followUpChannels.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </LeadFormField>
        <LeadFormField label="Outcome" htmlFor="complete-follow-up-outcome">
          <Select
            id="complete-follow-up-outcome"
            value={outcome}
            onChange={(event) =>
              setOutcome(event.target.value as FollowUpOutcome)
            }
          >
            {followUpOutcomes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </LeadFormField>
        <LeadFormField
          label={ownershipLabels.leads.drawer}
          htmlFor="complete-follow-up-owner"
        >
          <Select
            id="complete-follow-up-owner"
            value={selectedOwnerId}
            onChange={(event) => setSelectedOwnerId(event.target.value)}
          >
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </LeadFormField>
        <LeadFormField
          label="What happens next?"
          htmlFor="complete-follow-up-next-action"
        >
          <Select
            id="complete-follow-up-next-action"
            value={nextAction}
            onChange={(event) => {
              const value = event.target.value as FollowUpNextAction
              setNextAction(value)
              if (value !== 'Schedule another follow-up') setError(null)
            }}
          >
            {followUpNextActions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </LeadFormField>
      </div>
      {requiresDate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <LeadFormField
            label="Next follow-up date"
            htmlFor="complete-follow-up-next-date"
            required
          >
            <Input
              id="complete-follow-up-next-date"
              ref={dateRef}
              type="date"
              value={nextFollowUpDate}
              onChange={(event) => {
                setNextFollowUpDate(event.target.value)
                if (event.target.value) setError(null)
              }}
              error={error ?? undefined}
              aria-invalid={Boolean(error)}
            />
          </LeadFormField>
          <LeadFormField
            label="Next follow-up time"
            htmlFor="complete-follow-up-next-time"
          >
            <Input
              id="complete-follow-up-next-time"
              type="time"
              value={nextFollowUpTime}
              onChange={(event) => setNextFollowUpTime(event.target.value)}
            />
          </LeadFormField>
        </div>
      ) : null}
      <LeadFormField
        label="Notes"
        htmlFor="complete-follow-up-notes"
        className="block"
      >
        <textarea
          id="complete-follow-up-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="text-neutral-text-primary placeholder:text-neutral-text-secondary/70 focus:border-brand-primary/70 focus:ring-brand-primary/60 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm leading-6 shadow-sm outline-none transition-colors focus:ring-1"
          placeholder="Outcome notes for the timeline."
        />
      </LeadFormField>
    </FollowUpDialogShell>
  )
}

function FollowUpDialogShell({
  title,
  description,
  children,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  children: ReactNode
  submitLabel: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-follow-up-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-black/50"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="lead-follow-up-dialog-title"
              className="text-lg font-semibold"
            >
              {title}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close follow-up dialog</span>
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

function QualifiedLeadHandoffDialog({
  lead,
  destination,
  remember,
  onRememberChange,
  onConvert,
  onKeep,
  onClose,
}: {
  lead: LeadRecord
  destination: LeadConversionDestinationValue
  remember: boolean
  onRememberChange: (remember: boolean) => void
  onConvert: () => void
  onKeep: () => void
  onClose: () => void
}) {
  const copy = getQualifiedLeadPromptCopy(lead, destination)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qualified-lead-title"
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="qualified-lead-title" className="text-lg font-semibold">
              {copy.title}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              {copy.description} {copy.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
            Next pipeline
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-100">
            {copy.nextPipeline}
          </p>
          <p className="mt-1 text-xs text-cyan-100">{copy.flow}</p>
          <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
            {copy.supportingText}
          </p>
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-xs text-neutral-200">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => onRememberChange(event.target.checked)}
          />
          <span>
            <span className="block font-medium">
              Remember this choice for this workspace
            </span>
            <span className="text-neutral-text-secondary mt-1 block">
              You can change this later in Settings → Sales Process.
            </span>
          </span>
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onKeep}>
            {copy.secondaryAction}
          </Button>
          <Button type="button" size="sm" onClick={onConvert}>
            {copy.primaryAction}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DrawerSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="drawer-panel-surface rounded-2xl border p-4">
      <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DrawerActionGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <p className="text-neutral-text-secondary mb-2 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <p className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-app-primary mt-1 text-sm">{value}</p>
    </div>
  )
}

const EditableField = forwardRef<
  HTMLLabelElement,
  {
    label: string
    children: ReactNode
    highlighted?: boolean
    helper?: string
  }
>(function EditableField(
  { label, children, highlighted = false, helper },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn(
        'drawer-panel-muted block rounded-xl border p-3 transition',
        highlighted &&
          'border-cyan-300/70 bg-cyan-300/[0.08] shadow-[0_0_0_2px_rgba(103,232,249,0.16)]',
      )}
    >
      <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {helper ? (
        <p className="mt-2 text-[11px] font-medium text-cyan-100">{helper}</p>
      ) : null}
    </label>
  )
})

function EditableOwnerItem({
  label,
  value,
  owners,
  onChange,
}: {
  label: string
  value: string
  owners: WorkspaceOwner[]
  onChange: (ownerId: string) => void
}) {
  return (
    <label className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-8 py-1 text-xs"
      >
        {getActiveOwners(owners).map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Select>
    </label>
  )
}
