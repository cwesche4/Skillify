'use client'

import React, {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronRight, Pencil, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  CompactActivityTimeline,
  NotesCard,
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
  LinkedRecordsCard,
  ProgressMetricCard,
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
  formatWorkspaceDateTime,
  getLocalTimestamp,
} from '@/lib/formatting/dates'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  demoOpportunities,
  type OpportunityRecord,
  type OpportunityStage,
  type OpportunityStatus,
} from '@/lib/sales/demoSalesRecords'
import {
  getPreviewOpportunityStorageKey,
  getMergedWorkspaceOpportunities,
  upsertPreviewOpportunity,
} from '@/lib/sales/previewOpportunityStorage'
import {
  normalizeSaleRecord,
  upsertPreviewSale,
} from '@/lib/sales/previewSaleStorage'
import {
  normalizeOpportunityStage,
  opportunityStageOptions,
} from '@/lib/crm/pipelineStageRegistry'
import {
  getOpportunityDashboardMetrics,
  getOpportunityExpectedRevenue,
  getOpportunityStatusForChartLabel,
  isOpportunityStage,
  opportunityFollowUpCutoff,
  sortOpportunitiesForDashboard,
  type OpportunityDashboardSort,
} from '@/lib/sales/opportunityDashboard'
import {
  applyIdentityToOpportunity,
  applyIdentityToSale,
  ensureContactIdentity,
  resolveContactIdentity,
  upsertContactIdentity,
} from '@/lib/crm/contactIdentity'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
  getRelatedActivityRecords,
  getWorkspaceActivityCategory,
  readPreviewActivity,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { updateRevenueRecordWithRules } from '@/lib/workspace-records/crmMutations'
import {
  markOpportunityLost,
  markOpportunityWon,
  reopenOpportunity,
} from '@/lib/workspace-records/salesFlow'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'
import { useClearFilters } from '@/hooks/useClearFilters'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'
import {
  selectOpenOpportunities,
  selectWonOpportunities,
} from '@/lib/workspace-records/relationships'
import { buildRelatedRecordHref } from '@/lib/workspace-records/relatedRecordLinks'

type OpportunityMetric =
  | 'openDeals'
  | 'pipelineValue'
  | 'expectedRevenue'
  | 'averageDealSize'
type DealSizeBucket = 'under-5k' | '5k-10k' | '10k-20k' | '20k-plus'
type OpportunityDrilldown =
  | { type: 'status'; label: string; status: OpportunityStatus }
  | { type: 'needsFollowUp'; label: string }
  | { type: 'activeValue'; label: string }
  | { type: 'closedWon'; label: string }
  | { type: 'forecast'; label: string }
  | { type: 'averageProbability'; label: string }
  | { type: 'deal'; label: string; dealId: string }
  | { type: 'stage'; label: string; stage: OpportunityStage }
  | { type: 'bucket'; label: string; bucket: DealSizeBucket }
  | { type: 'activeDeals'; label: string }

const opportunitiesTableColumns: TableColumnConfig[] = [
  { id: 'opportunity', label: 'Opportunity', required: true },
  { id: 'status', label: 'Status' },
  { id: 'stage', label: 'Stage' },
  { id: 'value', label: 'Value' },
  { id: 'probability', label: 'Probability' },
  { id: 'expectedRevenue', label: 'Expected Revenue' },
  { id: 'nextStep', label: 'Next Step' },
  { id: 'lastActivity', label: 'Last Activity' },
  { id: 'owner', label: ownershipLabels.opportunities.table },
]

const opportunities = demoOpportunities

function normalizeOpportunityRecord(
  opportunity: OpportunityRecord,
): OpportunityRecord {
  return {
    ...opportunity,
    stage: normalizeOpportunityStage(opportunity.stage),
  }
}

const statusOptions: Array<'All' | OpportunityStatus> = [
  'All',
  'Active',
  'At Risk',
  'Closed-Won',
  'Closed-Lost',
]
const stageOptions: Array<'All' | OpportunityStage> = [
  'All',
  ...opportunityStageOptions,
]
const nextStepOptions = [
  'Book discovery call',
  'Send discovery recap',
  'Prepare proposal draft',
  'Send proposal',
  'Review proposal feedback',
  'Resolve scope questions',
  'Finalize implementation scope',
  'Schedule follow-up',
  'Archive and revisit next quarter',
]

const statusVariant: Record<OpportunityStatus, BadgeVariant> = {
  Active: 'blue',
  'At Risk': 'orange',
  'Closed-Won': 'green',
  'Closed-Lost': 'red',
}

const metricTone: Record<OpportunityMetric, string> = {
  openDeals: 'border-cyan-300/50 bg-cyan-300/[0.065] shadow-cyan-400/[0.08]',
  pipelineValue:
    'border-violet-300/50 bg-violet-400/[0.065] shadow-violet-400/[0.08]',
  expectedRevenue:
    'border-emerald-300/50 bg-emerald-400/[0.065] shadow-emerald-400/[0.08]',
  averageDealSize: 'border-sky-300/50 bg-sky-400/[0.065] shadow-sky-400/[0.08]',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function expectedRevenue(opportunity: OpportunityRecord) {
  return getOpportunityExpectedRevenue(opportunity)
}

function isOpenDeal(opportunity: OpportunityRecord) {
  return selectOpenOpportunities([opportunity]).length === 1
}

function getDealBucket(opportunity: OpportunityRecord): DealSizeBucket {
  if (opportunity.value < 5000) return 'under-5k'
  if (opportunity.value < 10000) return '5k-10k'
  if (opportunity.value < 20000) return '10k-20k'
  return '20k-plus'
}

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(target.closest('button,a,input,select,textarea'))
    : false
}

export function OpportunitiesClient({
  workspaceId,
  workspaceOwners,
  canEditOwners = false,
}: {
  workspaceId: string
  workspaceOwners: WorkspaceOwner[]
  canEditOwners?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [opportunityRecords, setOpportunityRecords] = useState(opportunities)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | OpportunityStatus>(
    'All',
  )
  const [stageFilter, setStageFilter] = useState<'All' | OpportunityStage>(
    'All',
  )
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [selectedMetric, setSelectedMetric] =
    useState<OpportunityMetric | null>(null)
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<OpportunityDrilldown | null>(null)
  const [dashboardSort, setDashboardSort] =
    useState<OpportunityDashboardSort>('salesPriority')
  const [workspaceHighlighted, setWorkspaceHighlighted] = useState(false)
  const [highlightedOpportunityId, setHighlightedOpportunityId] = useState<
    string | null
  >(null)
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<OpportunityRecord | null>(null)
  const [opportunitiesHydrated, setOpportunitiesHydrated] = useState(false)
  const [missingOpportunityId, setMissingOpportunityId] = useState<
    string | null
  >(null)
  const [activityRecords, setActivityRecords] = useState<
    WorkspaceActivityRecord[]
  >([])
  const [message, setMessage] = useState<string | null>(null)
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('opportunities', opportunitiesTableColumns)

  const navigateToWorkspace = useCallback(() => {
    window.setTimeout(() => {
      document
        .getElementById('opportunities-workspace')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      setWorkspaceHighlighted(true)
      window.setTimeout(() => setWorkspaceHighlighted(false), 1200)
    }, 0)
  }, [])

  useEffect(() => {
    const merged = getMergedWorkspaceOpportunities(workspaceId).map(
      normalizeOpportunityRecord,
    )
    setOpportunityRecords(merged)
    setActivityRecords(readPreviewActivity(workspaceId))
    setOpportunitiesHydrated(true)
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Skillify][opportunities] Opportunities page loaded', {
        workspaceSlug: workspaceId,
        storageKey: getPreviewOpportunityStorageKey(workspaceId),
        loadedCount: merged.length,
        ids: merged.map((opportunity) => opportunity.id),
      })
    }
  }, [workspaceId])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (event.detail.workspaceId !== workspaceId) return
      if (event.detail.scope === 'opportunities') {
        const merged = getMergedWorkspaceOpportunities(workspaceId).map(
          normalizeOpportunityRecord,
        )
        setOpportunityRecords(merged)
        setOpportunitiesHydrated(true)
        if (process.env.NODE_ENV !== 'production') {
          console.info(
            '[Skillify][opportunities] Opportunities page reloaded',
            {
              workspaceSlug: workspaceId,
              storageKey: getPreviewOpportunityStorageKey(workspaceId),
              loadedCount: merged.length,
              ids: merged.map((opportunity) => opportunity.id),
            },
          )
        }
      }
      if (event.detail.scope === 'activity') {
        setActivityRecords(readPreviewActivity(workspaceId))
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
  }, [workspaceId])

  const metrics = useMemo(() => {
    const dashboardMetrics = getOpportunityDashboardMetrics(opportunityRecords)

    return [
      {
        id: 'openDeals' as const,
        label: 'Open Deals',
        value: dashboardMetrics.openDeals.length.toString(),
        helper: 'Qualified opportunities',
        tooltip: 'Qualified opportunities still being worked.',
      },
      {
        id: 'pipelineValue' as const,
        label: 'Pipeline Value',
        value: formatCurrency(dashboardMetrics.pipelineValue),
        helper: 'Active opportunity value',
        tooltip:
          'Total value of active opportunities excluding closed-lost deals.',
      },
      {
        id: 'expectedRevenue' as const,
        label: 'Expected Revenue',
        value: formatCurrency(dashboardMetrics.expectedRevenue),
        helper: 'Weighted by probability',
        tooltip: 'Weighted forecast based on deal value and probability.',
      },
      {
        id: 'averageDealSize' as const,
        label: 'Average Deal Size',
        value: formatCurrency(dashboardMetrics.averageDealSize),
        helper: 'Current opportunity records',
        tooltip: 'Average value across current opportunity records.',
      },
    ]
  }, [opportunityRecords])

  const opportunityVisuals = useMemo(() => {
    const dashboardMetrics = getOpportunityDashboardMetrics(opportunityRecords)
    const openDeals = dashboardMetrics.openDeals
    const forecastable = dashboardMetrics.forecastable
    const pipelineValue = dashboardMetrics.pipelineValue
    const expected = dashboardMetrics.expectedRevenue
    const averageProbability = dashboardMetrics.averageProbability
    const valueOverTime: InsightSeriesPoint[] = [
      { label: 'Jun 1', value: Math.round(pipelineValue * 0.46) },
      { label: 'Jun 8', value: Math.round(pipelineValue * 0.58) },
      { label: 'Jun 15', value: Math.round(pipelineValue * 0.73) },
      { label: 'Jun 22', value: Math.round(pipelineValue * 0.86) },
      { label: 'Today', value: pipelineValue, secondary: expected },
    ]
    const byStage: InsightBreakdownPoint[] = stageOptions
      .filter((stage): stage is OpportunityStage => stage !== 'All')
      .map((stage, index) => ({
        label: stage,
        value: openDeals
          .filter((opportunity) => opportunity.stage === stage)
          .reduce((sum, opportunity) => sum + opportunity.value, 0),
        helper: `${openDeals.filter((opportunity) => opportunity.stage === stage).length} opportunities`,
        color: [
          '#22d3ee',
          '#8b5cf6',
          '#60a5fa',
          '#34d399',
          '#f59e0b',
          '#fb7185',
        ][index % 6],
      }))
      .filter((stage) => stage.value > 0)
    const byStatus: InsightBreakdownPoint[] = statusOptions
      .filter((status): status is OpportunityStatus => status !== 'All')
      .map((status, index) => ({
        label: status,
        value: opportunityRecords.filter(
          (opportunity) => opportunity.status === status,
        ).length,
        color:
          status === 'Closed-Won'
            ? '#34d399'
            : status === 'Closed-Lost'
              ? '#fb7185'
              : index % 2 === 0
                ? '#22d3ee'
                : '#8b5cf6',
      }))
    const highestForecast = [...forecastable].sort(
      (a, b) => expectedRevenue(b) - expectedRevenue(a),
    )[0]

    return {
      averageProbability,
      byStage,
      byStatus,
      expected,
      highestForecast,
      highRisk: dashboardMetrics.highRisk,
      needsFollowUp: dashboardMetrics.needsFollowUp,
      oldestActiveOpportunity: dashboardMetrics.oldestActiveOpportunity,
      pipelineValue,
      stageRail: opportunityStageOptions.map((stage) => {
        const stageRecords = opportunityRecords.filter(
          (opportunity) => opportunity.stage === stage,
        )
        const stageValue = stageRecords.reduce(
          (sum, opportunity) => sum + opportunity.value,
          0,
        )
        return {
          label: stage,
          value: formatCurrency(stageValue),
          helper: `${stageRecords.length} ${
            stageRecords.length === 1 ? 'opportunity' : 'opportunities'
          }`,
          description:
            stage === 'Scoping'
              ? 'Define the exact work, requirements, materials, labor, and solution before preparing the proposal.'
              : undefined,
          active: stageFilter === stage,
          tone:
            stage === 'Won'
              ? ('green' as const)
              : stage === 'Lost'
                ? ('rose' as const)
                : stage === 'Negotiation'
                  ? ('purple' as const)
                  : ('cyan' as const),
        }
      }),
      valueOverTime,
    }
  }, [opportunityRecords, stageFilter])

  const filteredOpportunities = useMemo(() => {
    const query = search.trim().toLowerCase()
    const next = opportunityRecords.filter((opportunity) => {
      const matchesSearch = query
        ? [
            opportunity.name,
            opportunity.client,
            opportunity.nextStep,
            getOwnerName(workspaceOwners, opportunity.ownerId),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true
      const matchesStatus =
        statusFilter === 'All' || opportunity.status === statusFilter
      const matchesStage =
        stageFilter === 'All' || opportunity.stage === stageFilter
      const matchesMetric =
        selectedMetric === 'openDeals' || selectedMetric === 'pipelineValue'
          ? isOpenDeal(opportunity)
          : selectedMetric === 'expectedRevenue'
            ? opportunity.probability > 0 && isOpenDeal(opportunity)
            : true
      const matchesDrilldown = selectedDrilldown
        ? selectedDrilldown.type === 'status'
          ? opportunity.status === selectedDrilldown.status
          : selectedDrilldown.type === 'needsFollowUp'
            ? isOpenDeal(opportunity) &&
              opportunity.lastActivityAt <= opportunityFollowUpCutoff
            : selectedDrilldown.type === 'activeValue' ||
                selectedDrilldown.type === 'activeDeals'
              ? isOpenDeal(opportunity)
              : selectedDrilldown.type === 'closedWon'
                ? opportunity.status === 'Closed-Won'
                : selectedDrilldown.type === 'forecast' ||
                    selectedDrilldown.type === 'averageProbability'
                  ? opportunity.probability > 0 && isOpenDeal(opportunity)
                  : selectedDrilldown.type === 'deal'
                    ? opportunity.id === selectedDrilldown.dealId
                    : selectedDrilldown.type === 'stage'
                      ? opportunity.stage === selectedDrilldown.stage
                      : getDealBucket(opportunity) === selectedDrilldown.bucket
        : true

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStage &&
        matchesMetric &&
        matchesDrilldown
      )
    })

    if (selectedDrilldown?.type === 'averageProbability') {
      return [...next].sort((a, b) => b.probability - a.probability)
    }

    return sortOpportunitiesForDashboard(next, dashboardSort)
  }, [
    dashboardSort,
    opportunityRecords,
    search,
    selectedDrilldown,
    selectedMetric,
    stageFilter,
    statusFilter,
    workspaceOwners,
  ])

  const scrollTarget =
    searchParams.get('view') ||
    searchParams.get('opportunityId') ||
    searchParams.get('stage') ||
    searchParams.get('status')
      ? 'opportunities-workspace'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredOpportunities.length}:${selectedOpportunity?.id ?? ''}`,
  )

  const activeMetric = metrics.find((metric) => metric.id === selectedMetric)
  const activeDashboardFilterLabel =
    activeMetric ||
    selectedDrilldown ||
    statusFilter !== 'All' ||
    stageFilter !== 'All'
      ? `Active filter: ${
          activeMetric?.label ??
          selectedDrilldown?.label ??
          (stageFilter !== 'All' ? stageFilter : statusFilter)
        }${
          activeMetric && selectedDrilldown
            ? ` / ${selectedDrilldown.label}`
            : ''
        }`
      : null

  const resetDashboardRefinements = useCallback(() => {
    setSearch('')
    setStatusFilter('All')
    setStageFilter('All')
    setSelectedMetric(null)
    setSelectedDrilldown(null)
    setHighlightedOpportunityId(null)
  }, [])

  const selectMetric = (metric: OpportunityMetric) => {
    resetDashboardRefinements()
    setSelectedMetric(metric)
    setDashboardSort(
      metric === 'expectedRevenue'
        ? 'expectedRevenue'
        : metric === 'averageDealSize'
          ? 'value'
          : 'salesPriority',
    )
    navigateToWorkspace()
  }

  const selectDrilldown = (selection: OpportunityDrilldown) => {
    setSelectedDrilldown(selection)
    if (selection.type === 'status') setStatusFilter(selection.status)
    if (selection.type === 'stage') setStageFilter(selection.stage)
    setHighlightedOpportunityId(
      selection.type === 'deal' ? selection.dealId : null,
    )
    navigateToWorkspace()
  }

  const clearFilter = useCallback(() => {
    setSelectedMetric(null)
    setSelectedDrilldown(null)
    setHighlightedOpportunityId(null)
    setDashboardSort('salesPriority')
    setStatusFilter('All')
    setStageFilter('All')
  }, [])

  const selectStageFromDashboard = useCallback(
    (stage: OpportunityStage) => {
      resetDashboardRefinements()
      setStageFilter(stage)
      setSelectedDrilldown({
        type: 'stage',
        label: stage,
        stage,
      })
      setDashboardSort('salesPriority')
      navigateToWorkspace()
    },
    [navigateToWorkspace, resetDashboardRefinements],
  )

  const selectStatusFromDashboard = useCallback(
    (status: OpportunityStatus) => {
      resetDashboardRefinements()
      setStatusFilter(status)
      setSelectedDrilldown({
        type: 'status',
        label: status,
        status,
      })
      setDashboardSort('salesPriority')
      navigateToWorkspace()
    },
    [navigateToWorkspace, resetDashboardRefinements],
  )

  const selectFollowUpNeeds = useCallback(() => {
    resetDashboardRefinements()
    setSelectedDrilldown({ type: 'needsFollowUp', label: 'Needs Follow-Up' })
    setDashboardSort('salesPriority')
    navigateToWorkspace()
  }, [navigateToWorkspace, resetDashboardRefinements])

  const selectDealFromDashboard = useCallback(
    (opportunity: OpportunityRecord | null | undefined) => {
      if (!opportunity) return
      resetDashboardRefinements()
      setSelectedDrilldown({
        type: 'deal',
        label: opportunity.name,
        dealId: opportunity.id,
      })
      setHighlightedOpportunityId(opportunity.id)
      setSelectedOpportunity(opportunity)
      navigateToWorkspace()
    },
    [navigateToWorkspace, resetDashboardRefinements],
  )

  const openOpportunity = (opportunity: OpportunityRecord) => {
    setSelectedOpportunity(opportunity)
  }

  const closeOpportunityDrawer = () => {
    setSelectedOpportunity(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('opportunityId')
    const query = params.toString()
    const hash = window.location.hash
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const updateOpportunityOwner = (opportunityId: string, ownerId: string) => {
    updateOpportunityRecord(opportunityId, { ownerId })
  }

  const updateOpportunityRecord = (
    opportunityId: string,
    updates: Partial<OpportunityRecord>,
  ) => {
    if (updates.stage === 'Won') {
      markOpportunityClosedWon(opportunityId)
      return
    }
    if (updates.stage === 'Lost') {
      markOpportunityClosedLost(opportunityId)
      return
    }
    const sourceOpportunity =
      selectedOpportunity?.id === opportunityId
        ? selectedOpportunity
        : opportunityRecords.find(
            (opportunity) => opportunity.id === opportunityId,
          )
    if (!sourceOpportunity) return

    const { record: nextOpportunity, events } = updateRevenueRecordWithRules(
      workspaceId,
      'opportunity',
      sourceOpportunity,
      updates,
    )
    setOpportunityRecords((current) =>
      current.map((opportunity) =>
        opportunity.id === opportunityId ? nextOpportunity : opportunity,
      ),
    )
    setSelectedOpportunity((current) =>
      current?.id === opportunityId ? nextOpportunity : current,
    )
    upsertPreviewOpportunity(workspaceId, nextOpportunity)
    events.forEach((event) => appendPreviewActivity(event.workspaceId, event))
    setMessage('Opportunity changes saved locally for this workspace preview.')
  }

  const markOpportunityClosedWon = (opportunityId: string) => {
    const opportunity =
      selectedOpportunity?.id === opportunityId
        ? selectedOpportunity
        : opportunityRecords.find((record) => record.id === opportunityId)
    if (!opportunity) return

    const identity = ensureContactIdentity(workspaceId, opportunity)
    const result = markOpportunityWon(workspaceId, opportunity)
    const nextOpportunity = applyIdentityToOpportunity(
      result.opportunity,
      identity,
    )
    const nextSale = applyIdentityToSale(
      normalizeSaleRecord(result.sale),
      identity,
    )
    setOpportunityRecords((current) =>
      current.map((record) =>
        record.id === opportunityId ? nextOpportunity : record,
      ),
    )
    setSelectedOpportunity((current) =>
      current?.id === opportunityId ? nextOpportunity : current,
    )
    upsertPreviewOpportunity(workspaceId, nextOpportunity)
    upsertPreviewSale(workspaceId, nextSale)
    result.events.forEach((event) => appendPreviewActivity(workspaceId, event))
    setMessage('Opportunity marked won and sale created locally.')
  }

  const markOpportunityClosedLost = (opportunityId: string) => {
    const opportunity =
      selectedOpportunity?.id === opportunityId
        ? selectedOpportunity
        : opportunityRecords.find((record) => record.id === opportunityId)
    if (!opportunity) return

    const result = markOpportunityLost(workspaceId, opportunity)
    setOpportunityRecords((current) =>
      current.map((record) =>
        record.id === opportunityId ? result.opportunity : record,
      ),
    )
    setSelectedOpportunity((current) =>
      current?.id === opportunityId ? result.opportunity : current,
    )
    upsertPreviewOpportunity(workspaceId, result.opportunity)
    result.events.forEach((event) => appendPreviewActivity(workspaceId, event))
    setMessage('Opportunity marked lost locally for this workspace preview.')
  }

  const reopenClosedOpportunity = (opportunityId: string) => {
    const opportunity =
      selectedOpportunity?.id === opportunityId
        ? selectedOpportunity
        : opportunityRecords.find((record) => record.id === opportunityId)
    if (!opportunity) return

    const result = reopenOpportunity(workspaceId, opportunity)
    setOpportunityRecords((current) =>
      current.map((record) =>
        record.id === opportunityId ? result.opportunity : record,
      ),
    )
    setSelectedOpportunity((current) =>
      current?.id === opportunityId ? result.opportunity : current,
    )
    upsertPreviewOpportunity(workspaceId, result.opportunity)
    result.events.forEach((event) => appendPreviewActivity(workspaceId, event))
    setMessage('Opportunity reopened locally for this workspace preview.')
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    opportunity: OpportunityRecord,
  ) => {
    if (isRowActionTarget(event.target)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openOpportunity(opportunity)
    }
  }

  const applySavedView = useCallback(
    (viewId: string) => {
      setActiveSavedViewId(viewId)
      setSearch('')
      clearFilter()
      setStatusFilter('All')
      setStageFilter('All')
      setDashboardSort('salesPriority')

      if (viewId === 'open') setSelectedMetric('openDeals')
      if (viewId === 'active') setStatusFilter('Active')
      if (viewId === 'at-risk') setStatusFilter('At Risk')
      if (viewId === 'proposal') setStageFilter('Proposal Sent')
      if (viewId === 'negotiation') setStageFilter('Negotiation')
      if (viewId === 'closed-won') setStatusFilter('Closed-Won')
    },
    [clearFilter],
  )

  useEffect(() => {
    const viewParam = searchParams.get('view')
    const stageParam = searchParams.get('stage')
    const statusParam = searchParams.get('status')
    const opportunityId = searchParams.get('opportunityId')

    if (viewParam) applySavedView(viewParam)
    if (stageParam) {
      const normalized = stageOptions.find(
        (option) => option.toLowerCase() === stageParam.toLowerCase(),
      )
      if (normalized) setStageFilter(normalized)
    }
    if (statusParam) {
      const normalized = statusOptions.find(
        (option) => option.toLowerCase() === statusParam.toLowerCase(),
      )
      if (normalized) setStatusFilter(normalized)
    }
    if (opportunityId) {
      const opportunity = opportunityRecords.find(
        (record) => record.id === opportunityId,
      )
      if (opportunity) {
        setMissingOpportunityId(null)
        setSelectedOpportunity(opportunity)
      }
    }
  }, [applySavedView, opportunityRecords, searchParams])

  useEffect(() => {
    const opportunityId = searchParams.get('opportunityId')
    if (!opportunityId || !opportunitiesHydrated) return
    const opportunity = opportunityRecords.find(
      (record) => record.id === opportunityId,
    )
    setMissingOpportunityId(opportunity ? null : opportunityId)
    if (!opportunity && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Skillify] Opportunity ${opportunityId} was not found in merged workspace opportunities.`,
        {
          workspaceSlug: workspaceId,
          storageKey: getPreviewOpportunityStorageKey(workspaceId),
          loadedCount: opportunityRecords.length,
          ids: opportunityRecords.map((record) => record.id),
        },
      )
    }
  }, [opportunitiesHydrated, opportunityRecords, searchParams, workspaceId])

  const expectedStatusForView =
    activeSavedViewId === 'active'
      ? 'Active'
      : activeSavedViewId === 'at-risk'
        ? 'At Risk'
        : activeSavedViewId === 'closed-won'
          ? 'Closed-Won'
          : 'All'
  const expectedStageForView =
    activeSavedViewId === 'proposal'
      ? 'Proposal Sent'
      : activeSavedViewId === 'negotiation'
        ? 'Negotiation'
        : 'All'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === expectedStatusForView ? '' : statusFilter,
      stageFilter: stageFilter === expectedStageForView ? '' : stageFilter,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter(expectedStatusForView as 'All' | OpportunityStatus)
      setStageFilter(expectedStageForView as 'All' | OpportunityStage)
    },
  })

  return (
    <DashboardShell className="max-w-7xl">
      <div className="space-y-5">
        <PageHeader
          title="Opportunities"
          description="Manage qualified sales opportunities, deal value, expected revenue, and next steps."
        />

        {process.env.NODE_ENV !== 'production' && missingOpportunityId ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
            Dev warning: opportunity{' '}
            <span className="font-semibold">{missingOpportunityId}</span> was
            not found in merged preview opportunities for this workspace.
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ChartCard
            title="Opportunity stage rail"
            description="Open opportunity value grouped by the stage where work is currently happening."
          >
            <StageRail
              data={opportunityVisuals.stageRail}
              selectedLabel={stageFilter === 'All' ? null : stageFilter}
              onSelect={(item) => {
                if (isOpportunityStage(item.label)) {
                  selectStageFromDashboard(item.label)
                }
              }}
            />
          </ChartCard>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SignalMatrix
              columns={2}
              data={[
                {
                  label: 'Awaiting Follow-Up',
                  value: opportunityVisuals.needsFollowUp.length.toString(),
                  helper: 'Open deals with stale activity',
                  tone: 'amber',
                  active: selectedDrilldown?.type === 'needsFollowUp',
                  onClick: selectFollowUpNeeds,
                },
                {
                  label: 'High Risk',
                  value: opportunityVisuals.highRisk.length.toString(),
                  helper: 'At-risk opportunities',
                  tone: 'rose',
                  active:
                    selectedDrilldown?.type === 'status' &&
                    selectedDrilldown.status === 'At Risk',
                  onClick: () => selectStatusFromDashboard('At Risk'),
                },
              ]}
            />
            <ProgressMetricCard
              label="Close Probability"
              value={`${opportunityVisuals.averageProbability}%`}
              helper="Average across forecastable open opportunities"
              progress={opportunityVisuals.averageProbability}
              tone="green"
            />
            <Card className="p-4">
              <p className="text-neutral-text-secondary text-xs font-medium">
                Highest Forecast Deal
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-100">
                {opportunityVisuals.highestForecast?.name ?? 'No deal yet'}
              </p>
              <p className="text-neutral-text-secondary mt-1 text-xs">
                {opportunityVisuals.highestForecast
                  ? `${opportunityVisuals.highestForecast.client} · ${formatCurrency(
                      expectedRevenue(opportunityVisuals.highestForecast),
                    )} expected`
                  : 'Forecast details appear when opportunities are active.'}
              </p>
              {opportunityVisuals.highestForecast ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="mt-3"
                  onClick={() =>
                    selectDealFromDashboard(opportunityVisuals.highestForecast)
                  }
                >
                  Highlight Deal
                </Button>
              ) : null}
            </Card>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Opportunities by stage"
            description="Open value grouped by current selling stage."
          >
            <HorizontalBarList
              data={opportunityVisuals.byStage}
              valuePrefix="$"
            />
          </ChartCard>
          <ChartCard
            title="Won, lost, and open mix"
            description="Current opportunity status distribution."
          >
            <DonutBreakdown
              data={opportunityVisuals.byStatus}
              centerValue={opportunityRecords.length.toString()}
              centerLabel="Total"
              activeLabel={
                selectedDrilldown?.type === 'status'
                  ? selectedDrilldown.status
                  : null
              }
              onSelect={(item) => {
                const status = getOpportunityStatusForChartLabel(item.label)
                if (status) selectStatusFromDashboard(status)
              }}
            />
          </ChartCard>
        </section>

        <RecommendedActionsCard
          description="Focus the opportunity queue on closing movement and risk reduction."
          actions={[
            {
              title: 'Follow up on at-risk opportunities',
              detail:
                'At-risk deals should get a clear owner response before they stall.',
              tone: 'amber',
              cta: 'Show at risk',
              onClick: () => selectStatusFromDashboard('At Risk'),
            },
            {
              title: 'Review highest forecast deal',
              detail:
                'Use the forecast leader to anchor expected revenue this week.',
              tone: 'green',
              cta: 'Highlight deal',
              onClick: () =>
                selectDealFromDashboard(opportunityVisuals.highestForecast),
            },
            {
              title: 'Clear stale next steps',
              detail:
                'Older activity dates are the best signal for deals that need attention.',
              tone: 'purple',
              cta: 'Show follow-up needs',
              onClick: selectFollowUpNeeds,
            },
          ]}
        />

        <SavedViewTabs
          activeViewId={activeSavedViewId}
          onSelect={applySavedView}
          views={[
            { id: 'all', label: 'All', count: opportunityRecords.length },
            {
              id: 'open',
              label: 'Open',
              count: selectOpenOpportunities(opportunityRecords).length,
              tone: 'cyan',
            },
            {
              id: 'active',
              label: 'Active',
              count: opportunityRecords.filter(
                (item) => item.status === 'Active',
              ).length,
              tone: 'cyan',
            },
            {
              id: 'at-risk',
              label: 'At Risk',
              count: opportunityRecords.filter(
                (item) => item.status === 'At Risk',
              ).length,
              tone: 'amber',
            },
            {
              id: 'proposal',
              label: 'Proposal Sent',
              count: opportunityRecords.filter(
                (item) => item.stage === 'Proposal Sent',
              ).length,
              tone: 'purple',
            },
            {
              id: 'negotiation',
              label: 'Negotiation',
              count: opportunityRecords.filter(
                (item) => item.stage === 'Negotiation',
              ).length,
              tone: 'purple',
            },
            {
              id: 'closed-won',
              label: 'Closed Won',
              count: selectWonOpportunities(opportunityRecords).length,
              tone: 'green',
            },
          ]}
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search opportunities..."
              />
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as 'All' | OpportunityStatus,
                  )
                }
                aria-label="Status filter"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(event.target.value as 'All' | OpportunityStage)
                }
                aria-label="Stage filter"
              >
                {stageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card
          id="opportunities-workspace"
          className={cn(
            'scroll-mt-28 transition-shadow duration-300',
            workspaceHighlighted &&
              'shadow-[0_0_0_2px_rgba(103,232,249,0.35),0_0_34px_rgba(34,211,238,0.12)]',
          )}
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Opportunities Workspace</CardTitle>
                <CardDescription>
                  Click an opportunity to review forecast, stage, risk, and next
                  steps.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TableColumnsButton
                  columns={opportunitiesTableColumns}
                  visibleColumns={visibleColumns}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
                <Badge variant="slate">Demo data</Badge>
              </div>
            </div>
            {activeDashboardFilterLabel ? (
              <ActiveFilter
                label={activeDashboardFilterLabel}
                onClear={clearFilter}
              />
            ) : null}
          </CardHeader>

          {selectedMetric ? (
            <OpportunityDrilldownPanel
              metric={selectedMetric}
              selectedDrilldown={selectedDrilldown}
              onSelect={selectDrilldown}
            />
          ) : null}

          {filteredOpportunities.length > 0 ? (
            <Table
              className="min-w-[1180px]"
              containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
            >
              <THead>
                <TR>
                  <TH>Opportunity</TH>
                  {isColumnVisible('status') ? <TH>Status</TH> : null}
                  {isColumnVisible('stage') ? <TH>Stage</TH> : null}
                  {isColumnVisible('value') ? <TH>Value</TH> : null}
                  {isColumnVisible('probability') ? <TH>Probability</TH> : null}
                  {isColumnVisible('expectedRevenue') ? (
                    <TH>Expected Revenue</TH>
                  ) : null}
                  {isColumnVisible('nextStep') ? <TH>Next Step</TH> : null}
                  {isColumnVisible('lastActivity') ? (
                    <TH>Last Activity</TH>
                  ) : null}
                  {isColumnVisible('owner') ? (
                    <TH>{ownershipLabels.opportunities.table}</TH>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {filteredOpportunities.map((opportunity) => (
                  <TR
                    key={opportunity.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${opportunity.name}`}
                    className={cn(
                      'group cursor-pointer transition duration-150 hover:-translate-y-px hover:border-slate-700/80 hover:bg-cyan-300/[0.07] hover:shadow-[0_8px_24px_rgba(8,145,178,0.08)] focus-visible:bg-cyan-300/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50',
                      selectedOpportunity?.id === opportunity.id &&
                        'bg-cyan-300/[0.08]',
                      highlightedOpportunityId === opportunity.id &&
                        'border-cyan-300/40 bg-cyan-300/[0.06] shadow-[0_0_0_1px_rgba(103,232,249,0.14)]',
                    )}
                    onClick={(event) => {
                      if (isRowActionTarget(event.target)) return
                      openOpportunity(opportunity)
                    }}
                    onKeyDown={(event) => handleRowKeyDown(event, opportunity)}
                  >
                    <TD>
                      <div className="flex min-w-60 items-center gap-2">
                        <div>
                          <p className="font-medium text-neutral-100">
                            {opportunity.name}
                          </p>
                          <p className="text-neutral-text-secondary mt-0.5 text-xs">
                            {opportunity.contactName ?? opportunity.client} ·{' '}
                            {opportunity.company ?? opportunity.client}
                          </p>
                          <p className="text-neutral-text-secondary mt-0.5 text-xs">
                            Created{' '}
                            {formatWorkspaceCompactDate(
                              opportunity.convertedAt ??
                                opportunity.createdAt ??
                                opportunity.lastActivityAt,
                            )}
                          </p>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-500 transition group-hover:text-cyan-200" />
                      </div>
                    </TD>
                    {isColumnVisible('status') ? (
                      <TD>
                        <Badge variant={statusVariant[opportunity.status]}>
                          {opportunity.status}
                        </Badge>
                      </TD>
                    ) : null}
                    {isColumnVisible('stage') ? (
                      <TD className="text-neutral-text-secondary">
                        {opportunity.stage}
                      </TD>
                    ) : null}
                    {isColumnVisible('value') ? (
                      <TD>{formatCurrency(opportunity.value)}</TD>
                    ) : null}
                    {isColumnVisible('probability') ? (
                      <TD className="text-neutral-text-secondary">
                        {opportunity.probability}%
                      </TD>
                    ) : null}
                    {isColumnVisible('expectedRevenue') ? (
                      <TD>{formatCurrency(expectedRevenue(opportunity))}</TD>
                    ) : null}
                    {isColumnVisible('nextStep') ? (
                      <TD className="text-neutral-text-secondary">
                        <div className="min-w-56">{opportunity.nextStep}</div>
                      </TD>
                    ) : null}
                    {isColumnVisible('lastActivity') ? (
                      <TD className="text-neutral-text-secondary">
                        {formatWorkspaceCompactDate(opportunity.lastActivityAt)}
                      </TD>
                    ) : null}
                    {isColumnVisible('owner') ? (
                      <TD className="text-neutral-text-secondary">
                        {getOwnerName(workspaceOwners, opportunity.ownerId)}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No opportunities found"
                description="Try clearing the active filter or changing your search filters."
                actionLabel="Clear filter"
                onAction={clearFilter}
              />
            </div>
          )}
        </Card>

        {message ? (
          <div
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-sm text-cyan-100"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}

        {selectedOpportunity ? (
          <OpportunityDrawer
            opportunity={selectedOpportunity}
            onClose={closeOpportunityDrawer}
            onPlaceholder={setMessage}
            workspaceOwners={workspaceOwners}
            canEditOwners={canEditOwners}
            onOwnerChange={updateOpportunityOwner}
            onUpdateOpportunity={updateOpportunityRecord}
            onMarkWon={markOpportunityClosedWon}
            onMarkLost={markOpportunityClosedLost}
            onReopen={reopenClosedOpportunity}
            activityRecords={activityRecords}
            workspaceId={workspaceId}
          />
        ) : null}
      </div>
    </DashboardShell>
  )
}

function OpportunityDrilldownPanel({
  metric,
  selectedDrilldown,
  onSelect,
}: {
  metric: OpportunityMetric
  selectedDrilldown: OpportunityDrilldown | null
  onSelect: (selection: OpportunityDrilldown) => void
}) {
  const openDeals = opportunities.filter(isOpenDeal)
  const atRiskDeals = opportunities.filter(
    (opportunity) => opportunity.status === 'At Risk',
  )
  const activeValue = openDeals.reduce(
    (sum, opportunity) => sum + opportunity.value,
    0,
  )
  const atRiskValue = atRiskDeals.reduce(
    (sum, opportunity) => sum + opportunity.value,
    0,
  )
  const closedWonValue = opportunities
    .filter((opportunity) => opportunity.status === 'Closed-Won')
    .reduce((sum, opportunity) => sum + opportunity.value, 0)
  const forecastDeals = openDeals.filter(
    (opportunity) => opportunity.probability > 0,
  )
  const weightedForecast = forecastDeals.reduce(
    (sum, opportunity) => sum + expectedRevenue(opportunity),
    0,
  )
  const averageProbability = Math.round(
    forecastDeals.reduce(
      (sum, opportunity) => sum + opportunity.probability,
      0,
    ) / Math.max(forecastDeals.length, 1),
  )
  const highestForecastDeal = [...forecastDeals].sort(
    (a, b) => expectedRevenue(b) - expectedRevenue(a),
  )[0]
  const largestDeal = [...opportunities].sort((a, b) => b.value - a.value)[0]
  const smallestDeal = [...opportunities].sort((a, b) => a.value - b.value)[0]
  const averageActiveDeal = Math.round(
    activeValue / Math.max(openDeals.length, 1),
  )

  const tiles =
    metric === 'openDeals'
      ? [
          {
            label: 'Active Deals',
            value: openDeals.filter((deal) => deal.status === 'Active').length,
            selection: {
              type: 'status',
              label: 'Active Deals',
              status: 'Active',
            } as OpportunityDrilldown,
          },
          {
            label: 'Needs Follow-Up',
            value: openDeals.filter(
              (deal) => deal.lastActivityAt <= '2026-06-20',
            ).length,
            selection: {
              type: 'needsFollowUp',
              label: 'Needs Follow-Up',
            } as OpportunityDrilldown,
          },
          {
            label: 'At Risk',
            value: atRiskDeals.length,
            selection: {
              type: 'status',
              label: 'At Risk',
              status: 'At Risk',
            } as OpportunityDrilldown,
          },
        ]
      : metric === 'pipelineValue'
        ? [
            {
              label: 'Active Value',
              value: formatCurrency(activeValue),
              selection: {
                type: 'activeValue',
                label: 'Active Value',
              } as OpportunityDrilldown,
            },
            {
              label: 'At-Risk Value',
              value: formatCurrency(atRiskValue),
              selection: {
                type: 'status',
                label: 'At-Risk Value',
                status: 'At Risk',
              } as OpportunityDrilldown,
            },
            {
              label: 'Closed-Won Value',
              value: formatCurrency(closedWonValue),
              selection: {
                type: 'closedWon',
                label: 'Closed-Won Value',
              } as OpportunityDrilldown,
            },
          ]
        : metric === 'expectedRevenue'
          ? [
              {
                label: 'Weighted Forecast',
                value: formatCurrency(weightedForecast),
                selection: {
                  type: 'forecast',
                  label: 'Weighted Forecast',
                } as OpportunityDrilldown,
              },
              {
                label: 'Average Probability',
                value: `${averageProbability}%`,
                selection: {
                  type: 'averageProbability',
                  label: 'Average Probability',
                } as OpportunityDrilldown,
              },
              {
                label: 'Highest Forecast Deal',
                value: highestForecastDeal?.name ?? 'None',
                selection: {
                  type: 'deal',
                  label: 'Highest Forecast Deal',
                  dealId: highestForecastDeal?.id ?? '',
                } as OpportunityDrilldown,
              },
            ]
          : [
              {
                label: 'Average Active Deal',
                value: formatCurrency(averageActiveDeal),
                selection: {
                  type: 'activeDeals',
                  label: 'Average Active Deal',
                } as OpportunityDrilldown,
              },
              {
                label: 'Largest Deal',
                value: formatCurrency(largestDeal.value),
                selection: {
                  type: 'deal',
                  label: 'Largest Deal',
                  dealId: largestDeal.id,
                } as OpportunityDrilldown,
              },
              {
                label: 'Smallest Deal',
                value: formatCurrency(smallestDeal.value),
                selection: {
                  type: 'deal',
                  label: 'Smallest Deal',
                  dealId: smallestDeal.id,
                } as OpportunityDrilldown,
              },
            ]

  return (
    <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-2 sm:grid-cols-3">
          {tiles.map((tile) => (
            <DrilldownTile
              key={tile.label}
              label={tile.label}
              value={tile.value.toString()}
              active={sameDrilldown(tile.selection, selectedDrilldown)}
              onClick={() => onSelect(tile.selection)}
            />
          ))}
        </div>
        <OpportunityVisual
          metric={metric}
          selectedDrilldown={selectedDrilldown}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

function OpportunityVisual({
  metric,
  selectedDrilldown,
  onSelect,
}: {
  metric: OpportunityMetric
  selectedDrilldown: OpportunityDrilldown | null
  onSelect: (selection: OpportunityDrilldown) => void
}) {
  if (metric === 'expectedRevenue') {
    const forecastDeals = opportunities
      .filter(isOpenDeal)
      .sort((a, b) => expectedRevenue(b) - expectedRevenue(a))

    return (
      <VisualShell title="Forecast by Deal">
        {forecastDeals.map((opportunity) => {
          const selection: OpportunityDrilldown = {
            type: 'deal',
            label: opportunity.name,
            dealId: opportunity.id,
          }
          return (
            <ProgressButton
              key={opportunity.id}
              label={opportunity.name}
              value={`${opportunity.probability}%`}
              width={opportunity.probability}
              active={sameDrilldown(selection, selectedDrilldown)}
              onClick={() => onSelect(selection)}
            />
          )
        })}
      </VisualShell>
    )
  }

  if (metric === 'averageDealSize') {
    const buckets: Array<{
      label: string
      bucket: DealSizeBucket
      deals: OpportunityRecord[]
    }> = [
      {
        label: 'Under $5k',
        bucket: 'under-5k',
        deals: opportunities.filter(
          (deal) => getDealBucket(deal) === 'under-5k',
        ),
      },
      {
        label: '$5k-$10k',
        bucket: '5k-10k',
        deals: opportunities.filter((deal) => getDealBucket(deal) === '5k-10k'),
      },
      {
        label: '$10k-$20k',
        bucket: '10k-20k',
        deals: opportunities.filter(
          (deal) => getDealBucket(deal) === '10k-20k',
        ),
      },
      {
        label: '$20k+',
        bucket: '20k-plus',
        deals: opportunities.filter(
          (deal) => getDealBucket(deal) === '20k-plus',
        ),
      },
    ]
    const max = Math.max(...buckets.map((bucket) => bucket.deals.length), 1)

    return (
      <VisualShell title="Deal Size Distribution">
        {buckets.map((bucket) => {
          const total = bucket.deals.reduce((sum, deal) => sum + deal.value, 0)
          const selection: OpportunityDrilldown = {
            type: 'bucket',
            label: bucket.label,
            bucket: bucket.bucket,
          }
          return (
            <ProgressButton
              key={bucket.label}
              label={bucket.label}
              value={`${bucket.deals.length} deals - ${formatCurrency(total)}`}
              width={(bucket.deals.length / max) * 100}
              active={sameDrilldown(selection, selectedDrilldown)}
              onClick={() => onSelect(selection)}
            />
          )
        })}
      </VisualShell>
    )
  }

  const chartDeals = opportunities.filter(isOpenDeal)
  const stageTotals = stageOptions
    .filter((stage): stage is OpportunityStage => stage !== 'All')
    .map((stage) => ({
      stage,
      value: chartDeals
        .filter((opportunity) => opportunity.stage === stage)
        .reduce((sum, opportunity) => sum + opportunity.value, 0),
    }))
    .filter((item) => item.value > 0)
  const max = Math.max(...stageTotals.map((item) => item.value), 1)

  return (
    <VisualShell
      title={
        metric === 'openDeals'
          ? 'Open Pipeline by Stage'
          : 'Pipeline Value by Stage'
      }
    >
      {stageTotals.map((item) => {
        const selection: OpportunityDrilldown = {
          type: 'stage',
          label: item.stage,
          stage: item.stage,
        }
        return (
          <ProgressButton
            key={item.stage}
            label={item.stage}
            value={formatCurrency(item.value)}
            width={(item.value / max) * 100}
            active={sameDrilldown(selection, selectedDrilldown)}
            onClick={() => onSelect(selection)}
          />
        )
      })}
    </VisualShell>
  )
}

function sameDrilldown(
  a: OpportunityDrilldown,
  b: OpportunityDrilldown | null,
) {
  return JSON.stringify(a) === JSON.stringify(b)
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
        'rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
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

function VisualShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-xs font-medium text-neutral-100">{title}</p>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  )
}

function ProgressButton({
  label,
  value,
  width,
  active,
  onClick,
}: {
  label: string
  value: string
  width: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-cyan-300/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
        active && 'bg-cyan-300/[0.08]',
      )}
    >
      <div className="text-neutral-text-secondary flex justify-between gap-3 text-[11px]">
        <span className="truncate">{label}</span>
        <span className="shrink-0">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-300/70"
          style={{ width: `${Math.max(Math.min(width, 100), 4)}%` }}
        />
      </div>
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

function OpportunityDrawer({
  opportunity,
  onClose,
  onPlaceholder,
  workspaceOwners,
  canEditOwners,
  onOwnerChange,
  onUpdateOpportunity,
  onMarkWon,
  onMarkLost,
  onReopen,
  activityRecords,
  workspaceId,
}: {
  opportunity: OpportunityRecord
  onClose: () => void
  onPlaceholder: (message: string) => void
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  onOwnerChange: (opportunityId: string, ownerId: string) => void
  onUpdateOpportunity: (
    opportunityId: string,
    updates: Partial<OpportunityRecord>,
  ) => void
  onMarkWon: (opportunityId: string) => void
  onMarkLost: (opportunityId: string) => void
  onReopen: (opportunityId: string) => void
  activityRecords: WorkspaceActivityRecord[]
  workspaceId: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(opportunity.name)
  const [draftStatus, setDraftStatus] = useState<OpportunityStatus>(
    opportunity.status,
  )
  const [draftStage, setDraftStage] = useState<OpportunityStage>(
    opportunity.stage,
  )
  const [draftValue, setDraftValue] = useState(String(opportunity.value))
  const [draftProbability, setDraftProbability] = useState(
    String(opportunity.probability),
  )
  const [draftOwnerId, setDraftOwnerId] = useState(opportunity.ownerId)
  const [draftNextStep, setDraftNextStep] = useState(opportunity.nextStep)
  const [stageFocusRequested, setStageFocusRequested] = useState(false)
  const [stageDirty, setStageDirty] = useState(false)
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null)
  const [identityVersion, setIdentityVersion] = useState(0)
  const [hasDirtyInlineNotes, setHasDirtyInlineNotes] = useState(false)
  const stageFieldRef = useRef<HTMLLabelElement | null>(null)
  const stageSelectRef = useRef<HTMLSelectElement | null>(null)

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
    setIsEditing(false)
    setDraftName(opportunity.name)
    setDraftStatus(opportunity.status)
    setDraftStage(opportunity.stage)
    setDraftValue(String(opportunity.value))
    setDraftProbability(String(opportunity.probability))
    setDraftOwnerId(opportunity.ownerId)
    setDraftNextStep(opportunity.nextStep)
    setStageFocusRequested(false)
    setStageDirty(false)
  }, [opportunity])

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

  const cancelEditing = () => {
    setIsEditing(false)
    setDraftName(opportunity.name)
    setDraftStatus(opportunity.status)
    setDraftStage(opportunity.stage)
    setDraftValue(String(opportunity.value))
    setDraftProbability(String(opportunity.probability))
    setDraftOwnerId(opportunity.ownerId)
    setDraftNextStep(opportunity.nextStep)
    setStageFocusRequested(false)
    setStageDirty(false)
  }

  const saveEditing = () => {
    const value = Number(draftValue)
    const probability = Number(draftProbability)
    onUpdateOpportunity(opportunity.id, {
      name: draftName.trim() || opportunity.name,
      status: draftStatus,
      stage: draftStage,
      value: Number.isFinite(value) ? value : opportunity.value,
      probability: Number.isFinite(probability)
        ? Math.min(100, Math.max(0, probability))
        : opportunity.probability,
      ownerId: draftOwnerId,
      nextStep: draftNextStep.trim() || opportunity.nextStep,
      lastActivityAt: getLocalTimestamp(),
    })
    setStageFocusRequested(false)
    setStageDirty(false)
    setIsEditing(false)
  }
  const requestStageMove = () => {
    setIsEditing(true)
    setStageFocusRequested(true)
    setDrawerMessage('Select a new stage, then save your changes.')
  }
  const draftValueNumber = Number(draftValue)
  const draftProbabilityNumber = Number(draftProbability)
  const displayedExpectedRevenue = isEditing
    ? Math.round(
        (Number.isFinite(draftValueNumber)
          ? draftValueNumber
          : opportunity.value) *
          ((Number.isFinite(draftProbabilityNumber)
            ? Math.min(100, Math.max(0, draftProbabilityNumber))
            : opportunity.probability) /
            100),
      )
    : expectedRevenue(opportunity)
  const relatedActivity = useMemo(
    () =>
      getRelatedActivityRecords(activityRecords, {
        leadId: opportunity.leadId,
        sourceLeadId: opportunity.sourceLeadId,
        opportunityId: opportunity.id,
        clientId: opportunity.clientId,
        companyName: opportunity.company,
        clientName: opportunity.client,
      }),
    [activityRecords, opportunity],
  )
  const contactIdentity = resolveContactIdentity(workspaceId, opportunity)
  void identityVersion

  const saveClientNotes = (nextNotes: string) => {
    upsertContactIdentity(workspaceId, {
      ...contactIdentity,
      sharedNotes: nextNotes || undefined,
    })
    setIdentityVersion((current) => current + 1)
    appendPreviewActivity(
      workspaceId,
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: opportunity.id,
        recordType: 'note',
        action: 'noteAdded',
        title: 'Client Notes updated',
        description: `${contactIdentity.contactName} shared client notes were updated.`,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          companyName: opportunity.company ?? opportunity.client,
          clientName: opportunity.client,
          sharedContactId: contactIdentity.id,
        },
      }),
    )
  }

  const saveOpportunityNotes = (nextNotes: string) => {
    onUpdateOpportunity(opportunity.id, {
      opportunityNotes: nextNotes,
      notes: nextNotes,
    })
  }

  const showPlaceholder = (action: string) => {
    onPlaceholder(
      `${action} will connect when opportunity workflows are enabled.`,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close opportunity details"
        className="hidden flex-1 cursor-default sm:block"
        onClick={requestClose}
      />
      <aside
        role="dialog"
        aria-label="Opportunity details"
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50"
      >
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                {isEditing ? 'Editing opportunity' : opportunity.name}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {opportunity.contactName ?? opportunity.client}
              </p>
              <p className="text-neutral-text-secondary text-xs">
                {opportunity.company ?? opportunity.client}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={
                    statusVariant[isEditing ? draftStatus : opportunity.status]
                  }
                >
                  {isEditing ? draftStatus : opportunity.status}
                </Badge>
                <Badge variant="purple">
                  {isEditing ? draftStage : opportunity.stage}
                </Badge>
                <Badge variant="green">
                  {formatCurrency(displayedExpectedRevenue)} forecast
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
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          {drawerMessage ? (
            <div
              className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-100"
              role="status"
              aria-live="polite"
            >
              {drawerMessage}
            </div>
          ) : null}
        </div>
        {isEditing ? (
          <div className="border-b border-slate-800 bg-slate-950/95 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-cyan-100">
                {stageDirty
                  ? 'Unsaved changes — Save changes to apply the new stage and update the pipeline.'
                  : stageFocusRequested
                    ? 'Select a new stage, then save your changes.'
                    : 'Editing opportunity. Changes are saved locally for this workspace preview.'}
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
          </div>
        ) : null}
        <div className="space-y-4 p-5">
          <DrawerSection title="Opportunity Details">
            <InfoGrid>
              {isEditing ? (
                <>
                  <EditableField label="Opportunity Title">
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label="Status">
                    <Select
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatus(event.target.value as OpportunityStatus)
                      }
                    >
                      {statusOptions
                        .filter(
                          (option): option is OpportunityStatus =>
                            option !== 'All',
                        )
                        .map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </Select>
                  </EditableField>
                  <EditableField
                    label="Stage"
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
                        const nextStage = event.target.value as OpportunityStage
                        setDraftStage(nextStage)
                        setStageDirty(nextStage !== opportunity.stage)
                        setStageFocusRequested(false)
                      }}
                    >
                      {stageOptions
                        .filter(
                          (option): option is OpportunityStage =>
                            option !== 'All',
                        )
                        .map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Value">
                    <Input
                      type="number"
                      min="0"
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label="Probability">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={draftProbability}
                      onChange={(event) =>
                        setDraftProbability(event.target.value)
                      }
                    />
                  </EditableField>
                  <EditableField label={ownershipLabels.opportunities.drawer}>
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
                  <EditableField label="Next Step">
                    <Input
                      value={draftNextStep}
                      onChange={(event) => setDraftNextStep(event.target.value)}
                    />
                  </EditableField>
                </>
              ) : (
                <>
                  <InfoItem label="Status" value={opportunity.status} />
                  <InfoItem label="Stage" value={opportunity.stage} />
                  <InfoItem
                    label="Value"
                    value={formatCurrency(opportunity.value)}
                  />
                  <InfoItem
                    label="Probability"
                    value={`${opportunity.probability}%`}
                  />
                </>
              )}
              <InfoItem
                label="Expected Revenue"
                value={formatCurrency(displayedExpectedRevenue)}
              />
              <InfoItem
                label="Contact"
                value={opportunity.contactName ?? opportunity.client}
              />
              <InfoItem
                label="Company"
                value={opportunity.company ?? opportunity.client}
              />
              {!isEditing && canEditOwners ? (
                <EditableOwnerItem
                  label={ownershipLabels.opportunities.drawer}
                  value={opportunity.ownerId}
                  owners={workspaceOwners}
                  onChange={(ownerId) => onOwnerChange(opportunity.id, ownerId)}
                />
              ) : !isEditing ? (
                <InfoItem
                  label={ownershipLabels.opportunities.drawer}
                  value={getOwnerName(workspaceOwners, opportunity.ownerId)}
                />
              ) : null}
              <InfoItem
                label="Last Activity"
                value={formatWorkspaceDateTime(opportunity.lastActivityAt)}
              />
              {opportunity.riskReason ? (
                <InfoItem label="Risk Reason" value={opportunity.riskReason} />
              ) : null}
              {!isEditing ? (
                <InfoItem label="Next Step" value={opportunity.nextStep} />
              ) : null}
            </InfoGrid>
          </DrawerSection>

          {!isEditing ? (
            <DrawerSection title="Quick Updates">
              <div className="grid gap-3 sm:grid-cols-2">
                <EditableField label="Stage">
                  <Select
                    value={opportunity.stage}
                    onChange={(event) =>
                      onUpdateOpportunity(opportunity.id, {
                        stage: event.target.value as OpportunityStage,
                        lastActivityAt: getLocalTimestamp(),
                      })
                    }
                    aria-label="Update opportunity stage"
                  >
                    {opportunityStageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </EditableField>
                <EditableField label="Probability">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={opportunity.probability}
                    onChange={(event) =>
                      onUpdateOpportunity(opportunity.id, {
                        probability: Math.min(
                          100,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                        lastActivityAt: getLocalTimestamp(),
                      })
                    }
                    aria-label="Update close probability"
                  />
                </EditableField>
                <EditableField label="Follow-Up">
                  <Input
                    type="date"
                    value={opportunity.expectedCloseDate ?? ''}
                    onChange={(event) =>
                      onUpdateOpportunity(opportunity.id, {
                        expectedCloseDate: event.target.value || undefined,
                        lastActivityAt: getLocalTimestamp(),
                      })
                    }
                    aria-label="Update follow-up date"
                  />
                </EditableField>
                <EditableField label="Next Step">
                  <Select
                    value={
                      nextStepOptions.includes(opportunity.nextStep)
                        ? opportunity.nextStep
                        : 'custom'
                    }
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === 'custom') return
                      onUpdateOpportunity(opportunity.id, {
                        nextStep: value,
                        lastActivityAt: getLocalTimestamp(),
                      })
                    }}
                    aria-label="Update next step"
                  >
                    {!nextStepOptions.includes(opportunity.nextStep) ? (
                      <option value="custom">{opportunity.nextStep}</option>
                    ) : null}
                    {nextStepOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </EditableField>
                {canEditOwners ? (
                  <EditableField label={ownershipLabels.opportunities.drawer}>
                    <Select
                      value={opportunity.ownerId}
                      onChange={(event) =>
                        onOwnerChange(opportunity.id, event.target.value)
                      }
                      aria-label="Update opportunity owner"
                    >
                      {getActiveOwners(workspaceOwners).map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                ) : null}
                <InfoItem
                  label="Expected Revenue"
                  value={formatCurrency(expectedRevenue(opportunity))}
                />
              </div>
            </DrawerSection>
          ) : null}
          <NotesCard
            title="Client Notes"
            description="Shared throughout the customer relationship."
            value={contactIdentity.sharedNotes}
            onSave={saveClientNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <NotesCard
            title="Opportunity Notes"
            description="Only for this Opportunity."
            value={opportunity.opportunityNotes ?? opportunity.notes}
            onSave={saveOpportunityNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <CompactActivityTimeline
            events={
              relatedActivity.length > 0
                ? relatedActivity.map((event) => ({
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    timestamp: formatWorkspaceDateTime(event.timestamp),
                    category: getWorkspaceActivityCategory(event),
                  }))
                : [
                    {
                      id: `${opportunity.id}-last-sales-touch`,
                      title: 'Last sales touch',
                      description: opportunity.nextStep,
                      timestamp: formatWorkspaceDateTime(
                        opportunity.lastActivityAt,
                      ),
                      category: 'Opportunity Pipeline',
                    },
                  ]
            }
          />
          <LinkedRecordsCard
            title="Related Records"
            records={[
              ...((opportunity.sourceLeadId ?? opportunity.leadId)
                ? [
                    {
                      label: 'Source Lead',
                      value: opportunity.contactName ?? opportunity.client,
                      helper: 'Open the Lead that created this Opportunity.',
                      href: buildRelatedRecordHref({
                        workspaceSlug: workspaceId,
                        type: 'lead',
                        id:
                          opportunity.sourceLeadId ?? opportunity.leadId ?? '',
                      }),
                    },
                  ]
                : []),
              ...(opportunity.saleId
                ? [
                    {
                      label: 'Sale',
                      value: `${opportunity.company ?? opportunity.client} Sale`,
                      helper:
                        'Open the Sale created from this won Opportunity.',
                      href: buildRelatedRecordHref({
                        workspaceSlug: workspaceId,
                        type: 'sale',
                        id: opportunity.saleId,
                      }),
                    },
                  ]
                : []),
              ...(opportunity.clientId
                ? [
                    {
                      label: 'Client',
                      value: opportunity.company ?? opportunity.client,
                      helper: 'Open the Client connected to this Opportunity.',
                      href: buildRelatedRecordHref({
                        workspaceSlug: workspaceId,
                        type: 'client',
                        id: opportunity.clientId,
                      }),
                    },
                  ]
                : []),
            ]}
          />
          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <DrawerActionGroup label="Primary">
                {[
                  opportunity.status === 'Closed-Won' ||
                  opportunity.status === 'Closed-Lost'
                    ? 'Reopen Opportunity'
                    : 'Mark Opportunity Won',
                  opportunity.status === 'Closed-Won' ||
                  opportunity.status === 'Closed-Lost'
                    ? 'View Related Sale'
                    : 'Mark Opportunity Lost',
                  'Create Task',
                ].map((action, index) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={
                      index === 0
                        ? 'primary'
                        : index === 1
                          ? 'outline'
                          : 'ghost'
                    }
                    className={cn(
                      index === 0
                        ? ''
                        : 'border-slate-700/80 bg-slate-950/45 text-neutral-100 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-100',
                    )}
                    onClick={() => {
                      if (action === 'Mark Opportunity Won') {
                        onMarkWon(opportunity.id)
                        return
                      }
                      if (action === 'Mark Opportunity Lost') {
                        onMarkLost(opportunity.id)
                        return
                      }
                      if (action === 'Reopen Opportunity') {
                        onReopen(opportunity.id)
                        return
                      }
                      if (action === 'View Related Sale') {
                        showPlaceholder(
                          'Open the related Sale from Sales Pipeline.',
                        )
                        return
                      }
                      showPlaceholder(action)
                    }}
                    disabled={
                      (action === 'Mark Opportunity Won' &&
                        opportunity.status === 'Closed-Won') ||
                      (action === 'Mark Opportunity Lost' &&
                        opportunity.status === 'Closed-Lost')
                    }
                  >
                    {action}
                  </Button>
                ))}
              </DrawerActionGroup>
              <DrawerActionGroup label="Manage">
                {[
                  'Message Client',
                  'Schedule Follow-Up',
                  'Generate Proposal',
                  'Update Stage',
                ].map((action) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-700/80 bg-slate-950/45 text-neutral-100 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                    onClick={() =>
                      action === 'Update Stage'
                        ? requestStageMove()
                        : showPlaceholder(action)
                    }
                  >
                    {action}
                  </Button>
                ))}
              </DrawerActionGroup>
              {isEditing ? (
                <div className="flex flex-wrap justify-end gap-2">
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
              ) : null}
              <DrawerActionGroup label="Automation">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="border-slate-700/80 bg-slate-950/45 text-neutral-100 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                  onClick={() => showPlaceholder('Trigger Workflow')}
                >
                  Trigger Workflow
                </Button>
              </DrawerActionGroup>
            </div>
          </DrawerSection>
        </div>
      </aside>
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function DrawerActionGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
      <p className="text-neutral-text-secondary mb-2 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
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
        'rounded-xl border border-slate-800 bg-slate-950/45 p-3 transition',
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-sm text-neutral-100">{value}</p>
    </div>
  )
}

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
