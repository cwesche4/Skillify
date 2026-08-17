'use client'

import {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Pencil, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  CompactActivityTimeline,
  NotesCard,
} from '@/components/crm/CrmDrawerCards'
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
  FunnelVisual,
  HorizontalBarList,
  InsightAreaChart,
  LinkedRecordsCard,
  MiniSparkline,
  ProgressMetricCard,
  RecommendedActionsCard,
  SavedViewTabs,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { cn } from '@/lib/utils'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getDemoOwnerIdByName,
  getOwnerName,
} from '@/lib/workspace-ownership'
import {
  formatWorkspaceCompactDate,
  formatWorkspaceDateTime,
  getLocalTimestamp,
} from '@/lib/formatting/dates'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
  getRelatedActivityRecords,
  getWorkspaceActivityCategory,
  readPreviewActivity,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { calculateExpectedRevenue } from '@/lib/workspace-records/businessRules'
import { updateRevenueRecordWithRules } from '@/lib/workspace-records/crmMutations'
import { useClearFilters } from '@/hooks/useClearFilters'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'
import {
  moveSaleStage,
  normalizeSaleRecord,
  readPreviewSales,
  upsertPreviewSale,
  type SaleRecord,
  type SaleStage,
} from '@/lib/sales/previewSaleStorage'
import {
  normalizeSaleStage,
  saleStageOptions,
} from '@/lib/crm/pipelineStageRegistry'
import {
  resolveContactIdentity,
  upsertContactIdentity,
} from '@/lib/crm/contactIdentity'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'

type PipelineStatus = 'Active' | 'At Risk' | 'Closed-Won' | 'Closed-Lost'
type PipelineStage = SaleStage
type MetricFilter =
  | 'openDeals'
  | 'pipelineValue'
  | 'expectedRevenue'
  | 'averageDealSize'
type MetricSummary = {
  id: MetricFilter
  label: string
  value: string
  helper: string
  tooltip: string
}
type DealSizeBucket = 'under-5k' | '5k-10k' | '10k-20k' | '20k-plus'
type DrilldownSelection = {
  type:
    | 'activeDeals'
    | 'atRiskDeals'
    | 'needsAction'
    | 'totalActiveValue'
    | 'atRiskValue'
    | 'closedWonRevenue'
    | 'weightedForecast'
    | 'averageProbability'
    | 'highestForecastDeal'
    | 'averageActiveDeal'
    | 'largestDeal'
    | 'smallestDeal'
    | 'stage'
    | 'deal'
    | 'bucket'
  label: string
  stage?: PipelineStage
  dealId?: string
  bucket?: DealSizeBucket
}
type FilterValue<T extends string> = 'All' | T

type PipelineActivity = {
  id: string
  label: string
  timestamp: string
  detail: string
}

type PipelineDeal = {
  id: string
  name: string
  client: string
  contactEmail?: string
  contactPhone?: string
  sharedContactId?: string
  company?: string
  clientId?: string
  leadId?: string
  sourceLeadId?: string
  sourceOpportunityId?: string
  saleNotes?: string
  notes?: string
  status: PipelineStatus
  riskReason?: string
  stage: PipelineStage
  value: number
  probability: number
  ownerId: string
  nextStep: string
  relatedClient: string
  createdAt: string
  convertedAt?: string
  activity: PipelineActivity[]
}

const salesPipelineTableColumns: TableColumnConfig[] = [
  { id: 'deal', label: 'Deal', required: true },
  { id: 'client', label: 'Client' },
  { id: 'status', label: 'Status' },
  { id: 'stage', label: 'Stage' },
  { id: 'value', label: 'Value' },
  { id: 'probability', label: 'Probability' },
  { id: 'expectedRevenue', label: 'Expected Revenue' },
  { id: 'nextStep', label: 'Next Step' },
  { id: 'owner', label: ownershipLabels.pipeline.table },
]

const statusOptions: Array<FilterValue<PipelineStatus>> = [
  'All',
  'Active',
  'At Risk',
  'Closed-Won',
  'Closed-Lost',
]

const stageOptions: Array<FilterValue<PipelineStage>> = [
  'All',
  ...saleStageOptions,
]

const statusVariant: Record<PipelineStatus, BadgeVariant> = {
  Active: 'blue',
  'At Risk': 'orange',
  'Closed-Won': 'green',
  'Closed-Lost': 'red',
}

const activeMetricToneClass: Record<MetricFilter, string> = {
  openDeals: 'border-cyan-300/50 bg-cyan-300/[0.065] shadow-cyan-400/[0.08]',
  pipelineValue:
    'border-violet-300/50 bg-violet-400/[0.065] shadow-violet-400/[0.08]',
  expectedRevenue:
    'border-emerald-300/50 bg-emerald-400/[0.065] shadow-emerald-400/[0.08]',
  averageDealSize: 'border-sky-300/50 bg-sky-400/[0.065] shadow-sky-400/[0.08]',
}

const deals: PipelineDeal[] = [
  {
    id: 'deal-commonwealth-refresh',
    name: 'Website Refresh',
    client: 'Commonwealth Gas & Well Service',
    status: 'Active',
    stage: 'Proposal Sent',
    value: 6400,
    probability: 70,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Review proposal feedback',
    relatedClient: 'Commonwealth Gas & Well Service',
    createdAt: '2026-06-24T14:00:00.000Z',
    activity: [
      {
        id: 'commonwealth-proposal',
        label: 'Proposal sent',
        timestamp: '2026-06-24T14:00:00-04:00',
        detail: 'Website refresh scope delivered for review.',
      },
      {
        id: 'commonwealth-next',
        label: 'Next step added',
        timestamp: '2026-06-26T10:30:00-04:00',
        detail: 'Follow up on pricing and launch timing.',
      },
    ],
  },
  {
    id: 'deal-johnson-growth',
    name: 'Spring Campaign Automation',
    client: 'Johnson Landscaping',
    status: 'Active',
    stage: 'Discovery Scheduled',
    value: 4800,
    probability: 55,
    ownerId: getDemoOwnerIdByName('Ops Team'),
    nextStep: 'Complete discovery call',
    relatedClient: 'Johnson Landscaping',
    createdAt: '2026-06-23T17:30:00.000Z',
    activity: [
      {
        id: 'johnson-qualified',
        label: 'Qualified',
        timestamp: '2026-06-23T17:30:00-04:00',
        detail: 'Lead moved into discovery for automation package.',
      },
    ],
  },
  {
    id: 'deal-carter-reliability',
    name: 'Automation Reliability Review',
    client: 'Carter Plumbing',
    status: 'At Risk',
    riskReason: 'Internal bottleneck',
    stage: 'Negotiation',
    value: 11200,
    probability: 45,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Resolve scope questions',
    relatedClient: 'Carter Plumbing',
    createdAt: '2026-06-18T11:15:00.000Z',
    activity: [
      {
        id: 'carter-scope',
        label: 'Scope question',
        timestamp: '2026-06-25T09:15:00-04:00',
        detail: 'Client asked for phased implementation options.',
      },
      {
        id: 'carter-stalled',
        label: 'Bottleneck detected',
        timestamp: '2026-06-27T11:45:00-04:00',
        detail: 'Waiting on technical access before finalizing.',
      },
    ],
  },
  {
    id: 'deal-brooks-reviews',
    name: 'Review Growth Campaign',
    client: 'Brooks Cleaning Co.',
    status: 'Closed-Won',
    stage: 'Won',
    value: 3900,
    probability: 100,
    ownerId: getDemoOwnerIdByName('Skillify AI'),
    nextStep: 'Start onboarding workflow',
    relatedClient: 'Brooks Cleaning Co.',
    createdAt: '2026-06-12T09:00:00.000Z',
    activity: [
      {
        id: 'brooks-won',
        label: 'Closed-Won',
        timestamp: '2026-06-28T13:20:00-04:00',
        detail: 'Client approved review automation rollout.',
      },
    ],
  },
  {
    id: 'deal-reed-portal',
    name: 'Client Portal Upgrade',
    client: 'Reed HVAC',
    status: 'Closed-Lost',
    stage: 'Lost',
    value: 2400,
    probability: 0,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Archive and revisit next quarter',
    relatedClient: 'Reed HVAC',
    createdAt: '2026-06-08T15:45:00.000Z',
    activity: [
      {
        id: 'reed-lost',
        label: 'Closed-Lost',
        timestamp: '2026-06-20T15:45:00-04:00',
        detail: 'Client paused portal work until budget opens.',
      },
    ],
  },
]

function mapSaleToPipelineDeal(sale: SaleRecord): PipelineDeal {
  const normalizedSale = normalizeSaleRecord(sale)
  return {
    id: normalizedSale.id,
    name: normalizedSale.name,
    client: normalizedSale.contactName,
    contactEmail: normalizedSale.contactEmail,
    contactPhone: normalizedSale.contactPhone,
    sharedContactId: normalizedSale.sharedContactId,
    company: normalizedSale.company,
    clientId: normalizedSale.clientId,
    leadId: normalizedSale.sourceLeadId,
    sourceLeadId: normalizedSale.sourceLeadId,
    sourceOpportunityId: normalizedSale.sourceOpportunityId,
    saleNotes: normalizedSale.saleNotes,
    notes: normalizedSale.notes,
    status: normalizedSale.status,
    stage: normalizedSale.stage,
    value: normalizedSale.value,
    probability: normalizedSale.probability,
    ownerId: normalizedSale.ownerId,
    nextStep: normalizedSale.nextStep,
    relatedClient: normalizedSale.company,
    createdAt: normalizedSale.createdAt,
    convertedAt: normalizedSale.convertedAt,
    activity: [
      {
        id: `${normalizedSale.id}-activity`,
        label: 'Sale updated',
        timestamp: normalizedSale.lastActivityAt,
        detail: normalizedSale.nextStep,
      },
    ],
  }
}

function normalizePipelineDeal(deal: PipelineDeal): PipelineDeal {
  const stage = normalizeSaleStage(deal.stage, deal.status)
  const status: PipelineStatus =
    stage === 'Closed-Won'
      ? 'Closed-Won'
      : stage === 'Closed-Lost'
        ? 'Closed-Lost'
        : deal.status === 'Closed-Won' || deal.status === 'Closed-Lost'
          ? 'Active'
          : deal.status
  return {
    ...deal,
    stage,
    status,
    probability:
      status === 'Closed-Won'
        ? 100
        : status === 'Closed-Lost'
          ? 0
          : deal.probability,
  }
}

function mergePipelineDeals(
  baseDeals: PipelineDeal[],
  previewSales: SaleRecord[],
) {
  const previewDeals = previewSales.map(mapSaleToPipelineDeal)
  const seen = new Set<string>()
  return [...previewDeals, ...baseDeals.map(normalizePipelineDeal)].filter(
    (deal) => {
      if (seen.has(deal.id)) return false
      seen.add(deal.id)
      return true
    },
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function expectedRevenue(deal: PipelineDeal) {
  return calculateExpectedRevenue(deal.value, deal.probability)
}

function isOpenPipelineDeal(deal: PipelineDeal) {
  return deal.status === 'Active' || deal.status === 'At Risk'
}

function isForecastableDeal(deal: PipelineDeal) {
  return deal.probability > 0 && deal.status !== 'Closed-Lost'
}

function getDealBucket(deal: PipelineDeal): DealSizeBucket {
  if (deal.value < 5000) return 'under-5k'
  if (deal.value < 10000) return '5k-10k'
  if (deal.value < 20000) return '10k-20k'
  return '20k-plus'
}

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(target.closest('button,a,input,select,textarea'))
    : false
}

export function SalesPipelineClient({
  workspaceId,
  workspaceOwners,
  canEditOwners = false,
}: {
  workspaceId: string
  workspaceOwners: WorkspaceOwner[]
  canEditOwners?: boolean
}) {
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const searchParams = useSearchParams()
  const [dealRecords, setDealRecords] = useState(deals)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<PipelineStatus>>('All')
  const [stageFilter, setStageFilter] =
    useState<FilterValue<PipelineStage>>('All')
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [selectedMetricCard, setSelectedMetricCard] =
    useState<MetricFilter | null>(null)
  const [selectedDrilldownFilter, setSelectedDrilldownFilter] =
    useState<DrilldownSelection | null>(null)
  const [selectedDealHighlight, setSelectedDealHighlight] = useState<
    string | null
  >(null)
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null)
  const [activityRecords, setActivityRecords] = useState<
    WorkspaceActivityRecord[]
  >([])
  const [message, setMessage] = useState<string | null>(null)
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('sales-pipeline', salesPipelineTableColumns)

  useEffect(() => {
    const previewSales = readPreviewSales(workspaceId)
    setDealRecords(mergePipelineDeals(deals, previewSales))
    setActivityRecords(readPreviewActivity(workspaceId))
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Skillify][sales] Sales Pipeline loaded', {
        workspaceSlug: workspaceId,
        loadedSaleCount: previewSales.length,
        ids: previewSales.map((sale) => sale.id),
      })
    }
  }, [workspaceId])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (event.detail.workspaceId !== workspaceId) return
      if (event.detail.scope === 'sales') {
        const previewSales = readPreviewSales(workspaceId)
        setDealRecords(mergePipelineDeals(deals, previewSales))
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Skillify][sales] Sales Pipeline reloaded', {
            workspaceSlug: workspaceId,
            loadedSaleCount: previewSales.length,
            ids: previewSales.map((sale) => sale.id),
          })
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
    const openDeals = dealRecords.filter(isOpenPipelineDeal)
    const forecastDeals = dealRecords.filter((deal) => deal.probability > 0)
    const totalPipelineValue = openDeals.reduce(
      (sum, deal) => sum + deal.value,
      0,
    )
    const totalExpectedRevenue = forecastDeals.reduce(
      (sum, deal) => sum + expectedRevenue(deal),
      0,
    )
    const averageDealSize = Math.round(
      dealRecords.reduce((sum, deal) => sum + deal.value, 0) /
        dealRecords.length,
    )

    return [
      {
        id: 'openDeals' as const,
        label: 'Open Deals',
        value: openDeals.length.toString(),
        helper: 'Active and at-risk deals',
        tooltip: 'Deals currently in progress and not yet won or lost.',
      },
      {
        id: 'pipelineValue' as const,
        label: 'Pipeline Value',
        value: formatCurrency(totalPipelineValue),
        helper: 'Active pipeline value',
        tooltip: 'Total potential revenue from active opportunities.',
      },
      {
        id: 'expectedRevenue' as const,
        label: 'Expected Revenue',
        value: formatCurrency(totalExpectedRevenue),
        helper: 'Weighted forecast value',
        tooltip: 'Weighted forecast based on deal value and probability.',
      },
      {
        id: 'averageDealSize' as const,
        label: 'Average Deal Size',
        value: formatCurrency(averageDealSize),
        helper: 'Across demo deals',
        tooltip: 'Average value across the current demo deal set.',
      },
    ]
  }, [dealRecords])

  const forecastVisuals = useMemo(() => {
    const openDeals = dealRecords.filter(isOpenPipelineDeal)
    const forecastableDeals = dealRecords.filter(isForecastableDeal)
    const totalPipeline = openDeals.reduce((sum, deal) => sum + deal.value, 0)
    const weightedForecast = forecastableDeals.reduce(
      (sum, deal) => sum + expectedRevenue(deal),
      0,
    )
    const averageProbability =
      forecastableDeals.length > 0
        ? Math.round(
            forecastableDeals.reduce((sum, deal) => sum + deal.probability, 0) /
              forecastableDeals.length,
          )
        : 0
    const highestForecastDeal = [...forecastableDeals].sort(
      (a, b) => expectedRevenue(b) - expectedRevenue(a),
    )[0]
    const pipelineByStage = stageOptions
      .filter((stage): stage is PipelineStage => stage !== 'All')
      .map((stage, index) => {
        const stageDeals = openDeals.filter((deal) => deal.stage === stage)
        return {
          label: stage,
          value: stageDeals.reduce(
            (sum, deal) => sum + expectedRevenue(deal),
            0,
          ),
          helper: `${stageDeals.length} ${stageDeals.length === 1 ? 'deal' : 'deals'}`,
          color:
            index % 2 === 0
              ? '#22d3ee'
              : index % 3 === 0
                ? '#34d399'
                : '#8b5cf6',
        }
      })
      .filter((stage) => stage.value > 0)

    const forecastTrend: InsightSeriesPoint[] = [
      { label: 'Jun 1', value: Math.round(weightedForecast * 0.58) },
      { label: 'Jun 8', value: Math.round(weightedForecast * 0.68) },
      { label: 'Jun 15', value: Math.round(weightedForecast * 0.76) },
      { label: 'Jun 22', value: Math.round(weightedForecast * 0.91) },
      { label: 'Today', value: weightedForecast, secondary: totalPipeline },
    ]
    const probabilityTrend: InsightSeriesPoint[] = [
      { label: 'Jun 1', value: Math.max(averageProbability - 10, 0) },
      { label: 'Jun 8', value: Math.max(averageProbability - 6, 0) },
      { label: 'Jun 15', value: Math.max(averageProbability - 4, 0) },
      { label: 'Jun 22', value: Math.max(averageProbability - 2, 0) },
      { label: 'Today', value: averageProbability },
    ]
    const forecastByDeal: InsightBreakdownPoint[] = forecastableDeals
      .map((deal) => ({
        label: deal.name,
        value: expectedRevenue(deal),
        helper: `${deal.probability}% probability · ${deal.client}`,
        color: deal.status === 'At Risk' ? '#f59e0b' : '#22d3ee',
      }))
      .sort((a, b) => b.value - a.value)

    return {
      averageProbability,
      forecastByDeal,
      forecastTrend,
      highestForecastDeal,
      pipelineByStage,
      probabilityTrend,
      totalPipeline,
      weightedForecast,
    }
  }, [dealRecords])

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase()

    const matchesMetricFilter = (deal: PipelineDeal) => {
      if (selectedDrilldownFilter?.type === 'closedWonRevenue') return true

      switch (selectedMetricCard) {
        case 'openDeals':
          return isOpenPipelineDeal(deal)
        case 'pipelineValue':
          return isOpenPipelineDeal(deal)
        case 'expectedRevenue':
          return isForecastableDeal(deal)
        case 'averageDealSize':
        default:
          return true
      }
    }

    const matchesDrilldownFilter = (deal: PipelineDeal) => {
      if (!selectedDrilldownFilter) return true

      switch (selectedDrilldownFilter.type) {
        case 'activeDeals':
          return deal.status === 'Active'
        case 'atRiskDeals':
          return deal.status === 'At Risk'
        case 'needsAction':
          return isOpenPipelineDeal(deal) && Boolean(deal.nextStep)
        case 'totalActiveValue':
        case 'averageActiveDeal':
          return isOpenPipelineDeal(deal)
        case 'atRiskValue':
          return deal.status === 'At Risk'
        case 'closedWonRevenue':
          return deal.status === 'Closed-Won'
        case 'weightedForecast':
          return isForecastableDeal(deal)
        case 'averageProbability':
          return isForecastableDeal(deal)
        case 'highestForecastDeal':
        case 'largestDeal':
        case 'smallestDeal':
        case 'deal':
          return selectedDrilldownFilter.dealId
            ? deal.id === selectedDrilldownFilter.dealId
            : true
        case 'stage':
          return selectedDrilldownFilter.stage
            ? deal.stage === selectedDrilldownFilter.stage
            : true
        case 'bucket':
          return selectedDrilldownFilter.bucket
            ? getDealBucket(deal) === selectedDrilldownFilter.bucket
            : true
        default:
          return true
      }
    }

    const nextDeals = dealRecords.filter((deal) => {
      const matchesSearch = query
        ? [
            deal.name,
            deal.client,
            deal.nextStep,
            getOwnerName(workspaceOwners, deal.ownerId),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true
      const matchesStatus =
        statusFilter === 'All' || deal.status === statusFilter
      const matchesStage = stageFilter === 'All' || deal.stage === stageFilter

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStage &&
        matchesMetricFilter(deal) &&
        matchesDrilldownFilter(deal)
      )
    })

    if (
      selectedDrilldownFilter?.type === 'largestDeal' ||
      selectedMetricCard === 'averageDealSize'
    ) {
      return [...nextDeals].sort((a, b) => b.value - a.value)
    }

    if (selectedDrilldownFilter?.type === 'smallestDeal') {
      return [...nextDeals].sort((a, b) => a.value - b.value)
    }

    if (selectedDrilldownFilter?.type === 'averageProbability') {
      return [...nextDeals].sort((a, b) => b.probability - a.probability)
    }

    return nextDeals
  }, [
    search,
    dealRecords,
    selectedDrilldownFilter,
    selectedMetricCard,
    stageFilter,
    statusFilter,
    workspaceOwners,
  ])

  const activeMetric = metrics.find(
    (metric) => metric.id === selectedMetricCard,
  )

  const scrollTarget =
    searchParams.get('view') ||
    searchParams.get('dealId') ||
    searchParams.get('stage') ||
    searchParams.get('status')
      ? 'sales-pipeline-workspace'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredDeals.length}:${selectedDeal?.id ?? ''}`,
  )

  const applyMetricFilter = (metricFilter: MetricFilter) => {
    setSelectedMetricCard(metricFilter)
    setSelectedDrilldownFilter(null)
    setSelectedDealHighlight(null)
    window.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const applyDrilldownFilter = (selection: DrilldownSelection) => {
    setSelectedDrilldownFilter(selection)
    setSelectedDealHighlight(selection.dealId ?? null)
  }

  const clearActiveMetricFilter = useCallback(() => {
    setSelectedMetricCard(null)
    setSelectedDrilldownFilter(null)
    setSelectedDealHighlight(null)
  }, [])

  const showPlaceholder = (text: string) => {
    setMessage(text)
  }

  const openDeal = (deal: PipelineDeal) => {
    setSelectedDeal(deal)
  }

  const updateDealOwner = (dealId: string, ownerId: string) => {
    updateDealRecord(dealId, { ownerId })
  }

  const updateDealRecord = (dealId: string, updates: Partial<PipelineDeal>) => {
    const sourceDeal =
      selectedDeal?.id === dealId
        ? selectedDeal
        : dealRecords.find((deal) => deal.id === dealId)
    if (!sourceDeal) return

    const mergedDeal = { ...sourceDeal, ...updates }
    const requestedStage = updates.stage as SaleStage | undefined
    const saleRecord = {
      id: sourceDeal.id,
      name: sourceDeal.name,
      contactName: sourceDeal.client,
      contactEmail: sourceDeal.contactEmail,
      contactPhone: sourceDeal.contactPhone,
      sharedContactId: sourceDeal.sharedContactId,
      company: sourceDeal.company ?? sourceDeal.relatedClient,
      clientId: sourceDeal.clientId,
      sourceLeadId: sourceDeal.sourceLeadId ?? sourceDeal.leadId,
      sourceOpportunityId: sourceDeal.sourceOpportunityId,
      saleNotes: sourceDeal.saleNotes,
      notes: sourceDeal.notes,
      status: sourceDeal.status,
      stage: normalizeSaleStage(sourceDeal.stage, sourceDeal.status),
      value: sourceDeal.value,
      probability: sourceDeal.probability,
      ownerId: sourceDeal.ownerId,
      nextStep: sourceDeal.nextStep,
      createdAt: sourceDeal.createdAt,
      convertedAt: sourceDeal.convertedAt,
      lastActivityAt: getLocalTimestamp(),
    } as SaleRecord
    const transition = requestedStage
      ? moveSaleStage(workspaceId, saleRecord, requestedStage)
      : null
    const nextSale =
      transition?.sale ??
      ({
        ...saleRecord,
        ...updates,
        stage: normalizeSaleStage(mergedDeal.stage, mergedDeal.status),
        lastActivityAt: getLocalTimestamp(),
      } as SaleRecord)
    const nextDeal = mapSaleToPipelineDeal(nextSale)
    const events =
      transition?.events ??
      updateRevenueRecordWithRules(workspaceId, 'sale', sourceDeal, updates)
        .events
    setDealRecords((current) =>
      current.map((deal) => (deal.id === dealId ? nextDeal : deal)),
    )
    setSelectedDeal((current) => (current?.id === dealId ? nextDeal : current))
    upsertPreviewSale(workspaceId, nextSale)
    events.forEach((event) => appendPreviewActivity(event.workspaceId, event))
    showPlaceholder(
      transition?.client
        ? 'Sale stage saved and Client connected locally.'
        : 'Deal changes saved locally for this workspace preview.',
    )
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    deal: PipelineDeal,
  ) => {
    if (isRowActionTarget(event.target)) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDeal(deal)
    }
  }

  const applySavedView = useCallback(
    (viewId: string) => {
      setActiveSavedViewId(viewId)
      setSearch('')
      clearActiveMetricFilter()
      setStatusFilter('All')
      setStageFilter('All')

      if (viewId === 'active') setStatusFilter('Active')
      if (viewId === 'at-risk') setStatusFilter('At Risk')
      if (viewId === 'quote') setStageFilter('Quote Sent')
      if (viewId === 'negotiation') setStageFilter('Negotiation')
      if (viewId === 'closed-won') setStageFilter('Closed-Won')
      if (viewId === 'closed-lost') setStageFilter('Closed-Lost')
    },
    [clearActiveMetricFilter],
  )

  useEffect(() => {
    const viewParam = searchParams.get('view')
    const statusParam = searchParams.get('status')
    const stageParam = searchParams.get('stage')
    const dealId = searchParams.get('dealId')

    if (viewParam) applySavedView(viewParam)
    if (statusParam) {
      const normalized = statusOptions.find(
        (option) => option.toLowerCase() === statusParam.toLowerCase(),
      )
      if (normalized) setStatusFilter(normalized)
    }
    if (stageParam) {
      const normalized = stageOptions.find(
        (option) => option.toLowerCase() === stageParam.toLowerCase(),
      )
      if (normalized) setStageFilter(normalized)
    }
    if (dealId) {
      const deal = dealRecords.find((record) => record.id === dealId)
      if (deal) setSelectedDeal(deal)
    }
  }, [applySavedView, dealRecords, searchParams])

  const expectedStatusForView =
    activeSavedViewId === 'active'
      ? 'Active'
      : activeSavedViewId === 'at-risk'
        ? 'At Risk'
        : 'All'
  const expectedStageForView =
    activeSavedViewId === 'quote'
      ? 'Quote Sent'
      : activeSavedViewId === 'negotiation'
        ? 'Negotiation'
        : activeSavedViewId === 'closed-won'
          ? 'Closed-Won'
          : activeSavedViewId === 'closed-lost'
            ? 'Closed-Lost'
            : 'All'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === expectedStatusForView ? '' : statusFilter,
      stageFilter: stageFilter === expectedStageForView ? '' : stageFilter,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter(expectedStatusForView as 'All' | PipelineStatus)
      setStageFilter(expectedStageForView as 'All' | PipelineStage)
    },
  })

  return (
    <DashboardShell className="max-w-7xl">
      <div className="space-y-5">
        <PageHeader
          title="Sales Pipeline"
          description="Review sales movement from new lead through qualification, proposals, negotiation, and close."
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const isActive = selectedMetricCard === metric.id

            return (
              <MetricCard
                key={metric.id}
                metric={metric}
                isActive={isActive}
                onClick={() => applyMetricFilter(metric.id)}
              />
            )
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <ChartCard
            title="Pipeline forecast by stage"
            description="Weighted revenue is compared against total active pipeline so forecast health is easier to scan."
          >
            <FunnelVisual
              data={forecastVisuals.pipelineByStage}
              valuePrefix="$"
            />
          </ChartCard>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ProgressMetricCard
              label="Average Probability"
              value={`${forecastVisuals.averageProbability}%`}
              helper="Confidence across forecastable deals"
              progress={forecastVisuals.averageProbability}
              tone="purple"
            />
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-neutral-text-secondary text-xs font-medium">
                    Highest Forecast Deal
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-100">
                    {forecastVisuals.highestForecastDeal?.name ?? 'No deal yet'}
                  </p>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    {forecastVisuals.highestForecastDeal
                      ? `${forecastVisuals.highestForecastDeal.client} · ${formatCurrency(
                          expectedRevenue(forecastVisuals.highestForecastDeal),
                        )} weighted`
                      : 'Forecast details appear when deals are active.'}
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                  {forecastVisuals.highestForecastDeal?.probability ?? 0}%
                </span>
              </div>
              <MiniSparkline data={forecastVisuals.probabilityTrend} />
            </Card>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Expected revenue by deal"
            description="Forecasted revenue by deal, weighted by close probability."
          >
            <HorizontalBarList
              data={forecastVisuals.forecastByDeal}
              valuePrefix="$"
            />
          </ChartCard>
          <ChartCard
            title="Weighted revenue vs total pipeline"
            description="Stage-level view of active forecast value."
          >
            <HorizontalBarList
              data={forecastVisuals.pipelineByStage}
              valuePrefix="$"
            />
          </ChartCard>
        </section>

        <RecommendedActionsCard
          description="Prioritize the sales moves most likely to improve forecast confidence."
          actions={[
            {
              title: 'Resolve at-risk scope questions',
              detail:
                'Carter Plumbing is the largest open risk in the current pipeline.',
              tone: 'amber',
              cta: 'Review deal',
              onClick: () =>
                openDeal(
                  dealRecords.find((deal) => deal.status === 'At Risk') ??
                    dealRecords[0],
                ),
            },
            {
              title: 'Advance quote follow-up',
              detail:
                'Quote-stage sales are closest to revenue and need clear next steps.',
              tone: 'cyan',
              cta: 'Filter quote stage',
              onClick: () => setStageFilter('Quote Sent'),
            },
            {
              title: 'Ask AI Coach for close plan',
              detail: 'Generate a focused plan for the highest forecast deal.',
              tone: 'purple',
              cta: 'Coming soon',
              onClick: () =>
                showPlaceholder(
                  'AI close-plan recommendations will connect when sales coaching is enabled.',
                ),
            },
          ]}
        />

        <SavedViewTabs
          activeViewId={activeSavedViewId}
          onSelect={applySavedView}
          views={[
            { id: 'all', label: 'All', count: dealRecords.length },
            {
              id: 'active',
              label: 'Active Deals',
              count: dealRecords.filter((deal) => deal.status === 'Active')
                .length,
              tone: 'cyan',
            },
            {
              id: 'at-risk',
              label: 'At Risk',
              count: dealRecords.filter((deal) => deal.status === 'At Risk')
                .length,
              tone: 'amber',
            },
            {
              id: 'quote',
              label: 'Quote Sent',
              count: dealRecords.filter((deal) => deal.stage === 'Quote Sent')
                .length,
              tone: 'purple',
            },
            {
              id: 'negotiation',
              label: 'Negotiation',
              count: dealRecords.filter((deal) => deal.stage === 'Negotiation')
                .length,
              tone: 'purple',
            },
            {
              id: 'closed-won',
              label: 'Closed-Won',
              count: dealRecords.filter((deal) => deal.stage === 'Closed-Won')
                .length,
              tone: 'green',
            },
            {
              id: 'closed-lost',
              label: 'Closed-Lost',
              count: dealRecords.filter((deal) => deal.stage === 'Closed-Lost')
                .length,
              tone: 'rose',
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
                placeholder="Search sales pipeline..."
              />
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as FilterValue<PipelineStatus>,
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
                  setStageFilter(
                    event.target.value as FilterValue<PipelineStage>,
                  )
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

        <div
          id="sales-pipeline-workspace"
          ref={workspaceRef}
          className="scroll-mt-28"
        >
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Sales Pipeline Workspace</CardTitle>
                  <CardDescription>
                    Click a deal to review forecast details, next steps, and
                    recent activity.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <TableColumnsButton
                    columns={salesPipelineTableColumns}
                    visibleColumns={visibleColumns}
                    onToggle={toggleColumn}
                    onReset={resetColumns}
                  />
                  <Badge variant="slate">Demo data</Badge>
                </div>
              </div>
              {activeMetric ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-xs text-cyan-100">
                    Active filter: {activeMetric.label}
                    {selectedDrilldownFilter
                      ? ` / ${selectedDrilldownFilter.label}`
                      : ''}
                  </span>
                  <button
                    type="button"
                    onClick={clearActiveMetricFilter}
                    className="text-neutral-text-secondary inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-950/35 px-3 py-1 text-xs font-medium transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear filter
                  </button>
                </div>
              ) : null}
            </CardHeader>

            {selectedMetricCard ? (
              <MetricDrilldown
                metricFilter={selectedMetricCard}
                deals={dealRecords}
                selectedDrilldownFilter={selectedDrilldownFilter}
                onSelectDrilldown={applyDrilldownFilter}
              />
            ) : null}

            {filteredDeals.length > 0 ? (
              <Table
                className="min-w-[1180px]"
                containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
              >
                <THead>
                  <TR>
                    <TH>Deal</TH>
                    {isColumnVisible('client') ? <TH>Client</TH> : null}
                    {isColumnVisible('status') ? <TH>Status</TH> : null}
                    {isColumnVisible('stage') ? <TH>Stage</TH> : null}
                    {isColumnVisible('value') ? <TH>Value</TH> : null}
                    {isColumnVisible('probability') ? (
                      <TH>Probability</TH>
                    ) : null}
                    {isColumnVisible('expectedRevenue') ? (
                      <TH>Expected Revenue</TH>
                    ) : null}
                    {isColumnVisible('nextStep') ? <TH>Next Step</TH> : null}
                    {isColumnVisible('owner') ? (
                      <TH>{ownershipLabels.pipeline.table}</TH>
                    ) : null}
                  </TR>
                </THead>
                <TBody>
                  {filteredDeals.map((deal) => {
                    const isSelected = selectedDeal?.id === deal.id
                    const isHighlighted = selectedDealHighlight === deal.id

                    return (
                      <TR
                        key={deal.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${deal.name}`}
                        className={cn(
                          'group cursor-pointer transition duration-150 hover:-translate-y-px hover:border-slate-700/80 hover:bg-cyan-300/[0.07] hover:shadow-[0_8px_24px_rgba(8,145,178,0.08)] focus-visible:bg-cyan-300/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50',
                          isSelected &&
                            'bg-cyan-300/[0.08] hover:bg-cyan-300/[0.12]',
                          isHighlighted &&
                            'border-cyan-300/40 bg-cyan-300/[0.06] shadow-[0_0_0_1px_rgba(103,232,249,0.14)]',
                        )}
                        onClick={(event) => {
                          if (isRowActionTarget(event.target)) return
                          openDeal(deal)
                        }}
                        onKeyDown={(event) => handleRowKeyDown(event, deal)}
                      >
                        <TD>
                          <div className="flex min-w-56 items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-100">
                                {deal.name}
                              </p>
                              <p className="text-neutral-text-secondary mt-0.5 truncate text-xs">
                                {deal.client} ·{' '}
                                {deal.company ?? deal.relatedClient}
                              </p>
                            </div>
                            <ChevronRight
                              className="ml-auto h-4 w-4 text-slate-500 transition group-hover:text-cyan-200"
                              aria-hidden="true"
                            />
                          </div>
                        </TD>
                        {isColumnVisible('client') ? (
                          <TD className="text-neutral-text-secondary">
                            <div className="min-w-44">
                              <p className="truncate text-neutral-100">
                                {deal.client}
                              </p>
                              <p className="text-neutral-text-secondary mt-0.5 truncate text-xs">
                                {deal.company ?? deal.relatedClient}
                              </p>
                            </div>
                          </TD>
                        ) : null}
                        {isColumnVisible('status') ? (
                          <TD>
                            <Badge variant={statusVariant[deal.status]}>
                              {deal.status}
                            </Badge>
                          </TD>
                        ) : null}
                        {isColumnVisible('stage') ? (
                          <TD className="text-neutral-text-secondary">
                            {deal.stage}
                          </TD>
                        ) : null}
                        {isColumnVisible('value') ? (
                          <TD>{formatCurrency(deal.value)}</TD>
                        ) : null}
                        {isColumnVisible('probability') ? (
                          <TD className="text-neutral-text-secondary">
                            {deal.probability}%
                          </TD>
                        ) : null}
                        {isColumnVisible('expectedRevenue') ? (
                          <TD>{formatCurrency(expectedRevenue(deal))}</TD>
                        ) : null}
                        {isColumnVisible('nextStep') ? (
                          <TD className="text-neutral-text-secondary">
                            <div className="min-w-56">{deal.nextStep}</div>
                          </TD>
                        ) : null}
                        {isColumnVisible('owner') ? (
                          <TD className="text-neutral-text-secondary">
                            {getOwnerName(workspaceOwners, deal.ownerId)}
                          </TD>
                        ) : null}
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            ) : (
              <div className="p-4">
                <EmptyState
                  title="No pipeline activity found"
                  description="Try clearing the active filter or changing your search filters."
                  actionLabel="Clear filter"
                  onAction={clearActiveMetricFilter}
                />
              </div>
            )}
          </Card>
        </div>

        {message ? (
          <div
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-sm text-cyan-100"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}

        {selectedDeal ? (
          <PipelineDealDrawer
            deal={selectedDeal}
            workspaceOwners={workspaceOwners}
            canEditOwners={canEditOwners}
            onOwnerChange={updateDealOwner}
            onUpdateDeal={updateDealRecord}
            onClose={() => setSelectedDeal(null)}
            onPlaceholder={showPlaceholder}
            activityRecords={activityRecords}
            workspaceId={workspaceId}
          />
        ) : null}
      </div>
    </DashboardShell>
  )
}

function MetricCard({
  metric,
  isActive,
  onClick,
}: {
  metric: MetricSummary
  isActive: boolean
  onClick: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useEffect(() => {
    if (!isTooltipVisible) return

    const updateTooltipPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const viewportPadding = 16
      const width = Math.min(320, window.innerWidth - viewportPadding * 2)
      const preferredLeft = rect.left + rect.width / 2 - width / 2

      setTooltipStyle({
        top: rect.bottom + 8,
        left: Math.max(
          viewportPadding,
          Math.min(preferredLeft, window.innerWidth - width - viewportPadding),
        ),
        width,
      })
    }

    updateTooltipPosition()
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)

    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [isTooltipVisible])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={isActive}
        aria-describedby={`${metric.id}-helper`}
        onClick={onClick}
        onFocus={() => setIsTooltipVisible(true)}
        onBlur={() => setIsTooltipVisible(false)}
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
        className={cn(
          'rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.04] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          isActive && activeMetricToneClass[metric.id],
        )}
      >
        <span className="text-neutral-text-secondary text-xs">
          {metric.label}
        </span>
        <span className="mt-2 block text-2xl font-semibold text-neutral-100">
          {metric.value}
        </span>
        <span className="text-neutral-text-secondary mt-1 block text-xs">
          {metric.helper}
        </span>
      </button>

      {isTooltipVisible && tooltipStyle
        ? createPortal(
            <div
              id={`${metric.id}-helper`}
              role="tooltip"
              style={{
                top: tooltipStyle.top,
                left: tooltipStyle.left,
                width: tooltipStyle.width,
              }}
              className="pointer-events-none fixed z-[1000] rounded-xl border border-cyan-300/20 bg-slate-950/95 px-3 py-2 text-xs leading-relaxed text-cyan-50 opacity-100 shadow-2xl shadow-black/40 backdrop-blur"
            >
              {metric.tooltip}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function MetricDrilldown({
  metricFilter,
  deals,
  selectedDrilldownFilter,
  onSelectDrilldown,
}: {
  metricFilter: MetricFilter
  deals: PipelineDeal[]
  selectedDrilldownFilter: DrilldownSelection | null
  onSelectDrilldown: (selection: DrilldownSelection) => void
}) {
  const openDeals = deals.filter(isOpenPipelineDeal)
  const activeDeals = deals.filter((deal) => deal.status === 'Active')
  const atRiskDeals = deals.filter((deal) => deal.status === 'At Risk')
  const closedWonDeals = deals.filter((deal) => deal.status === 'Closed-Won')
  const closedWonValue = closedWonDeals.reduce(
    (sum, deal) => sum + deal.value,
    0,
  )
  const activePipelineValue = openDeals.reduce(
    (sum, deal) => sum + deal.value,
    0,
  )
  const atRiskValue = atRiskDeals.reduce((sum, deal) => sum + deal.value, 0)
  const forecastDeals = deals.filter(isForecastableDeal)
  const forecast = forecastDeals.reduce(
    (sum, deal) => sum + expectedRevenue(deal),
    0,
  )
  const averageProbability = forecastDeals.length
    ? Math.round(
        forecastDeals.reduce((sum, deal) => sum + deal.probability, 0) /
          forecastDeals.length,
      )
    : 0
  const largestDeal = [...deals].sort((a, b) => b.value - a.value)[0]
  const smallestDeal = [...deals].sort((a, b) => a.value - b.value)[0]
  const highestForecastDeal = [...forecastDeals].sort(
    (a, b) => expectedRevenue(b) - expectedRevenue(a),
  )[0]
  const averageActiveDeal = Math.round(
    activePipelineValue / Math.max(openDeals.length, 1),
  )

  const summary: Array<{
    label: string
    value: string
    selection: DrilldownSelection
  }> =
    metricFilter === 'openDeals'
      ? [
          {
            label: 'Active Deals',
            value: activeDeals.length.toString(),
            selection: { type: 'activeDeals', label: 'Active Deals' },
          },
          {
            label: 'At-Risk Deals',
            value: atRiskDeals.length.toString(),
            selection: { type: 'atRiskDeals', label: 'At-Risk Deals' },
          },
          {
            label: 'Needs Action',
            value: openDeals
              .filter((deal) => Boolean(deal.nextStep))
              .length.toString(),
            selection: { type: 'needsAction', label: 'Needs Action' },
          },
        ]
      : metricFilter === 'pipelineValue'
        ? [
            {
              label: 'Total Active Value',
              value: formatCurrency(activePipelineValue),
              selection: {
                type: 'totalActiveValue',
                label: 'Total Active Value',
              },
            },
            {
              label: 'At-Risk Value',
              value: formatCurrency(atRiskValue),
              selection: { type: 'atRiskValue', label: 'At-Risk Value' },
            },
            {
              label: 'Closed-Won Revenue',
              value: formatCurrency(closedWonValue),
              selection: {
                type: 'closedWonRevenue',
                label: 'Closed-Won Revenue',
              },
            },
          ]
        : metricFilter === 'expectedRevenue'
          ? [
              {
                label: 'Weighted Forecast',
                value: formatCurrency(forecast),
                selection: {
                  type: 'weightedForecast',
                  label: 'Weighted Forecast',
                },
              },
              {
                label: 'Average Probability',
                value: `${averageProbability}%`,
                selection: {
                  type: 'averageProbability',
                  label: 'Average Probability',
                },
              },
              {
                label: 'Highest Forecast Deal',
                value: highestForecastDeal?.name ?? 'None',
                selection: {
                  type: 'highestForecastDeal',
                  label: 'Highest Forecast Deal',
                  dealId: highestForecastDeal?.id,
                },
              },
            ]
          : [
              {
                label: 'Average Active Deal',
                value: formatCurrency(averageActiveDeal),
                selection: {
                  type: 'averageActiveDeal',
                  label: 'Average Active Deal',
                },
              },
              {
                label: 'Largest Deal',
                value: largestDeal ? formatCurrency(largestDeal.value) : '$0',
                selection: {
                  type: 'largestDeal',
                  label: 'Largest Deal',
                  dealId: largestDeal?.id,
                },
              },
              {
                label: 'Smallest Deal',
                value: smallestDeal ? formatCurrency(smallestDeal.value) : '$0',
                selection: {
                  type: 'smallestDeal',
                  label: 'Smallest Deal',
                  dealId: smallestDeal?.id,
                },
              },
            ]

  const isSelectionActive = (selection: DrilldownSelection) => {
    if (!selectedDrilldownFilter) return false
    if (selection.type !== selectedDrilldownFilter.type) return false
    if (selection.stage !== selectedDrilldownFilter.stage) return false
    if (selection.dealId !== selectedDrilldownFilter.dealId) return false
    if (selection.bucket !== selectedDrilldownFilter.bucket) return false
    return true
  }

  return (
    <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-2 sm:grid-cols-3">
          {summary.map((item) => (
            <SummaryDrilldownButton
              key={item.label}
              label={item.label}
              value={item.value}
              isActive={isSelectionActive(item.selection)}
              onClick={() => onSelectDrilldown(item.selection)}
            />
          ))}
        </div>
        <MetricVisual
          metricFilter={metricFilter}
          deals={deals}
          selectedDrilldownFilter={selectedDrilldownFilter}
          onSelectDrilldown={onSelectDrilldown}
        />
      </div>
    </div>
  )
}

function SummaryDrilldownButton({
  label,
  value,
  isActive,
  onClick,
}: {
  label: string
  value: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
        isActive && 'border-cyan-300/45 bg-cyan-300/[0.08]',
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

function MetricVisual({
  metricFilter,
  deals,
  selectedDrilldownFilter,
  onSelectDrilldown,
}: {
  metricFilter: MetricFilter
  deals: PipelineDeal[]
  selectedDrilldownFilter: DrilldownSelection | null
  onSelectDrilldown: (selection: DrilldownSelection) => void
}) {
  const isSelectionActive = (selection: DrilldownSelection) => {
    if (!selectedDrilldownFilter) return false
    if (selection.type !== selectedDrilldownFilter.type) return false
    if (selection.stage !== selectedDrilldownFilter.stage) return false
    if (selection.dealId !== selectedDrilldownFilter.dealId) return false
    if (selection.bucket !== selectedDrilldownFilter.bucket) return false
    return true
  }

  if (metricFilter === 'expectedRevenue') {
    const forecastDeals = [...deals]
      .filter(isForecastableDeal)
      .sort((a, b) => expectedRevenue(b) - expectedRevenue(a))

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
        <p className="text-xs font-medium text-neutral-100">Forecast by Deal</p>
        <div className="mt-3 space-y-1.5">
          {forecastDeals.slice(0, 4).map((deal) => {
            const selection: DrilldownSelection = {
              type: 'deal',
              label: deal.name,
              dealId: deal.id,
            }

            return (
              <ProgressRow
                key={deal.id}
                label={deal.name}
                value={`${deal.probability}%`}
                width={deal.probability}
                isActive={isSelectionActive(selection)}
                onClick={() => onSelectDrilldown(selection)}
                ariaLabel={`Filter table to ${deal.name}`}
              />
            )
          })}
        </div>
      </div>
    )
  }

  if (metricFilter === 'averageDealSize') {
    const buckets: Array<{
      label: string
      bucket: DealSizeBucket
      deals: PipelineDeal[]
    }> = [
      {
        label: 'Under $5k',
        bucket: 'under-5k',
        deals: deals.filter((deal) => getDealBucket(deal) === 'under-5k'),
      },
      {
        label: '$5k-$10k',
        bucket: '5k-10k',
        deals: deals.filter((deal) => getDealBucket(deal) === '5k-10k'),
      },
      {
        label: '$10k-$20k',
        bucket: '10k-20k',
        deals: deals.filter((deal) => getDealBucket(deal) === '10k-20k'),
      },
      {
        label: '$20k+',
        bucket: '20k-plus',
        deals: deals.filter((deal) => getDealBucket(deal) === '20k-plus'),
      },
    ]
    const maxCount = Math.max(
      ...buckets.map((bucket) => bucket.deals.length),
      1,
    )

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
        <p className="text-xs font-medium text-neutral-100">
          Deal Size Distribution
        </p>
        <div className="mt-3 space-y-1.5">
          {buckets.map((bucket) => {
            const total = bucket.deals.reduce(
              (sum, deal) => sum + deal.value,
              0,
            )
            const selection: DrilldownSelection = {
              type: 'bucket',
              label: bucket.label,
              bucket: bucket.bucket,
            }

            return (
              <ProgressRow
                key={bucket.label}
                label={bucket.label}
                value={`${bucket.deals.length} deals - ${formatCurrency(total)}`}
                width={(bucket.deals.length / maxCount) * 100}
                isActive={isSelectionActive(selection)}
                onClick={() => onSelectDrilldown(selection)}
                ariaLabel={`Filter table to ${bucket.label} deals`}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const chartDeals =
    metricFilter === 'pipelineValue' || metricFilter === 'openDeals'
      ? deals.filter(isOpenPipelineDeal)
      : deals
  const stageTotals = stageOptions
    .filter((stage): stage is PipelineStage => stage !== 'All')
    .map((stage) => ({
      stage,
      value: chartDeals
        .filter((deal) => deal.stage === stage)
        .reduce((sum, deal) => sum + deal.value, 0),
    }))
    .filter((item) => item.value > 0)
  const maxValue = Math.max(...stageTotals.map((item) => item.value), 1)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-xs font-medium text-neutral-100">
        {metricFilter === 'openDeals'
          ? 'Open Pipeline by Stage'
          : 'Pipeline Value by Stage'}
      </p>
      <div className="mt-3 space-y-1.5">
        {stageTotals.slice(0, 5).map((item) => {
          const selection: DrilldownSelection = {
            type: 'stage',
            label: item.stage,
            stage: item.stage,
          }

          return (
            <ProgressRow
              key={item.stage}
              label={item.stage}
              value={formatCurrency(item.value)}
              width={(item.value / maxValue) * 100}
              isActive={isSelectionActive(selection)}
              onClick={() => onSelectDrilldown(selection)}
              ariaLabel={`Filter table to ${item.stage} deals`}
            />
          )
        })}
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  width,
  isActive,
  onClick,
  ariaLabel,
}: {
  label: string
  value: string
  width: number
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-cyan-300/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
        isActive && 'bg-cyan-300/[0.08]',
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

const drawerPipelineStages = [
  'New',
  'Quote',
  'Negotiation',
  'Accepted',
  'Payment',
  'Closed',
] as const

function getDrawerPipelineStage(deal: PipelineDeal) {
  if (deal.status === 'Closed-Won' || deal.status === 'Closed-Lost') {
    return 'Closed'
  }

  if (deal.stage === 'Quote Preparation' || deal.stage === 'Quote Sent')
    return 'Quote'
  if (deal.stage === 'Negotiation') return 'Negotiation'
  if (deal.stage === 'Accepted') return 'Accepted'
  if (deal.stage === 'Payment Pending') return 'Payment'

  return 'New'
}

function PipelineDealDrawer({
  deal,
  workspaceOwners,
  canEditOwners,
  onOwnerChange,
  onUpdateDeal,
  onClose,
  onPlaceholder,
  activityRecords,
  workspaceId,
}: {
  deal: PipelineDeal
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  onOwnerChange: (dealId: string, ownerId: string) => void
  onUpdateDeal: (dealId: string, updates: Partial<PipelineDeal>) => void
  onClose: () => void
  onPlaceholder: (message: string) => void
  activityRecords: WorkspaceActivityRecord[]
  workspaceId: string
}) {
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(deal.name)
  const [draftStatus, setDraftStatus] = useState<PipelineStatus>(deal.status)
  const [draftStage, setDraftStage] = useState<PipelineStage>(deal.stage)
  const [draftValue, setDraftValue] = useState(String(deal.value))
  const [draftProbability, setDraftProbability] = useState(
    String(deal.probability),
  )
  const [draftOwnerId, setDraftOwnerId] = useState(deal.ownerId)
  const [draftNextStep, setDraftNextStep] = useState(deal.nextStep)
  const [stageFocusRequested, setStageFocusRequested] = useState(false)
  const [stageDirty, setStageDirty] = useState(false)
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
    setDraftName(deal.name)
    setDraftStatus(deal.status)
    setDraftStage(deal.stage)
    setDraftValue(String(deal.value))
    setDraftProbability(String(deal.probability))
    setDraftOwnerId(deal.ownerId)
    setDraftNextStep(deal.nextStep)
    setStageFocusRequested(false)
    setStageDirty(false)
  }, [deal])

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
    setDraftName(deal.name)
    setDraftStatus(deal.status)
    setDraftStage(deal.stage)
    setDraftValue(String(deal.value))
    setDraftProbability(String(deal.probability))
    setDraftOwnerId(deal.ownerId)
    setDraftNextStep(deal.nextStep)
    setStageFocusRequested(false)
    setStageDirty(false)
  }

  const saveEditing = () => {
    const value = Number(draftValue)
    const probability = Number(draftProbability)
    onUpdateDeal(deal.id, {
      name: draftName.trim() || deal.name,
      status: draftStatus,
      stage: draftStage,
      value: Number.isFinite(value) ? value : deal.value,
      probability: Number.isFinite(probability)
        ? Math.min(100, Math.max(0, probability))
        : deal.probability,
      ownerId: draftOwnerId,
      nextStep: draftNextStep.trim() || deal.nextStep,
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
        (Number.isFinite(draftValueNumber) ? draftValueNumber : deal.value) *
          ((Number.isFinite(draftProbabilityNumber)
            ? Math.min(100, Math.max(0, draftProbabilityNumber))
            : deal.probability) /
            100),
      )
    : expectedRevenue(deal)

  const showDrawerPlaceholder = (message: string) => {
    setDrawerMessage(message)
    onPlaceholder(message)
  }
  const currentStage = getDrawerPipelineStage(deal)
  const currentStageIndex = drawerPipelineStages.indexOf(currentStage)
  const relatedActivity = useMemo(
    () =>
      getRelatedActivityRecords(activityRecords, {
        leadId: deal.leadId,
        sourceLeadId: deal.sourceLeadId,
        opportunityId: deal.id,
        clientId: deal.clientId,
        companyName: deal.company,
        clientName: deal.client,
      }),
    [activityRecords, deal],
  )
  const contactIdentity = resolveContactIdentity(workspaceId, deal)
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
        recordId: deal.id,
        recordType: 'note',
        action: 'noteAdded',
        title: 'Client Notes updated',
        description: `${contactIdentity.contactName} shared client notes were updated.`,
        metadata: {
          saleId: deal.id,
          opportunityId: deal.sourceOpportunityId ?? deal.id,
          leadId: deal.sourceLeadId ?? deal.leadId ?? null,
          sourceLeadId: deal.sourceLeadId ?? deal.leadId ?? null,
          clientId: deal.clientId ?? null,
          companyName: deal.company ?? deal.relatedClient,
          clientName: deal.client,
          sharedContactId: contactIdentity.id,
        },
      }),
    )
  }

  const saveSaleNotes = (nextNotes: string) => {
    onUpdateDeal(deal.id, {
      saleNotes: nextNotes,
      notes: nextNotes,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close sales pipeline details"
        className="hidden flex-1 cursor-default sm:block"
        onClick={requestClose}
      />
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isEditing ? 'Editing deal' : deal.name}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {deal.client}
              </p>
              <p className="text-neutral-text-secondary text-xs">
                {deal.company ?? deal.relatedClient}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={statusVariant[isEditing ? draftStatus : deal.status]}
                >
                  {isEditing ? draftStatus : deal.status}
                </Badge>
                <Badge variant="purple">
                  {isEditing ? draftStage : deal.stage}
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
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-cyan-100">
                {stageDirty
                  ? 'Unsaved changes — Save changes to apply the new stage and update the pipeline.'
                  : stageFocusRequested
                    ? 'Select a new stage, then save your changes.'
                    : 'Editing deal. Changes are saved locally for this workspace preview.'}
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
          <DrawerSection title="Pipeline Progress">
            <div className="grid gap-2 sm:grid-cols-5">
              {drawerPipelineStages.map((stage, index) => {
                const isCurrent = stage === currentStage
                const isComplete = index < currentStageIndex
                const isClosed = stage === 'Closed'
                const closedTone =
                  deal.status === 'Closed-Won'
                    ? 'border-emerald-300/50 bg-emerald-400/[0.1] text-emerald-100'
                    : 'border-rose-300/50 bg-rose-400/[0.1] text-rose-100'

                return (
                  <div
                    key={stage}
                    className={cn(
                      'text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-center text-xs transition',
                      isComplete &&
                        'border-cyan-300/20 bg-cyan-300/[0.04] text-cyan-100/80',
                      isCurrent &&
                        'border-cyan-300/45 bg-cyan-300/[0.08] font-semibold text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]',
                      isCurrent && isClosed && closedTone,
                    )}
                  >
                    {stage}
                    {isCurrent && isClosed ? (
                      <span className="mt-1 block text-[10px] font-medium">
                        {deal.status === 'Closed-Won' ? 'Won' : 'Lost'}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </DrawerSection>

          <DrawerSection title="Deal Details">
            <div className="grid gap-3 sm:grid-cols-2">
              {isEditing ? (
                <>
                  <EditableField label="Deal Title">
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label="Status">
                    <Select
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatus(event.target.value as PipelineStatus)
                      }
                    >
                      {statusOptions
                        .filter(
                          (option): option is PipelineStatus =>
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
                        const nextStage = event.target.value as PipelineStage
                        setDraftStage(nextStage)
                        setStageDirty(nextStage !== deal.stage)
                        setStageFocusRequested(false)
                      }}
                    >
                      {stageOptions
                        .filter(
                          (option): option is PipelineStage => option !== 'All',
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
                  <EditableField label={ownershipLabels.pipeline.drawer}>
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
                  <InfoItem label="Status" value={deal.status} />
                  <InfoItem label="Stage" value={deal.stage} />
                  <InfoItem label="Value" value={formatCurrency(deal.value)} />
                </>
              )}
              <InfoItem
                label="Expected Revenue"
                value={formatCurrency(displayedExpectedRevenue)}
              />
              {!isEditing ? (
                <InfoItem label="Probability" value={`${deal.probability}%`} />
              ) : null}
              {!isEditing && canEditOwners ? (
                <EditableOwnerItem
                  label={ownershipLabels.pipeline.drawer}
                  value={deal.ownerId}
                  owners={workspaceOwners}
                  onChange={(ownerId) => onOwnerChange(deal.id, ownerId)}
                />
              ) : !isEditing ? (
                <InfoItem
                  label={ownershipLabels.pipeline.drawer}
                  value={getOwnerName(workspaceOwners, deal.ownerId)}
                />
              ) : null}
              {deal.riskReason ? (
                <InfoItem label="Risk Reason" value={deal.riskReason} />
              ) : null}
              {!isEditing ? (
                <InfoItem label="Next Step" value={deal.nextStep} />
              ) : null}
              <InfoItem label="Contact" value={deal.client} />
              <InfoItem
                label="Company"
                value={deal.company ?? deal.relatedClient}
              />
            </div>
          </DrawerSection>

          <NotesCard
            title="Client Notes"
            description="Shared throughout the customer relationship."
            value={contactIdentity.sharedNotes}
            onSave={saveClientNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <NotesCard
            title="Sale Notes"
            description="Only for this Sale."
            value={deal.saleNotes ?? deal.notes}
            onSave={saveSaleNotes}
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
                : deal.activity.map((item) => ({
                    id: item.id,
                    title: item.label,
                    description: item.detail,
                    timestamp: formatWorkspaceDateTime(item.timestamp),
                    category: 'Sales Pipeline',
                  }))
            }
          />
          <LinkedRecordsCard
            title="Connected Records"
            records={[
              ...((deal.sourceLeadId ?? deal.leadId)
                ? [
                    {
                      label: 'Source Lead',
                      value: deal.client,
                      helper: 'Open the Lead that created this Sale.',
                      href: `/dashboard/${workspaceId}/leads?leadId=${encodeURIComponent(
                        deal.sourceLeadId ?? deal.leadId ?? '',
                      )}#leads-workspace`,
                    },
                  ]
                : []),
              ...(deal.sourceOpportunityId
                ? [
                    {
                      label: 'Source Opportunity',
                      value: deal.name.replace(/\s+Sale$/, ' Opportunity'),
                      helper: 'Open the Opportunity that created this Sale.',
                      href: `/dashboard/${workspaceId}/opportunities?opportunityId=${encodeURIComponent(
                        deal.sourceOpportunityId,
                      )}#opportunities-workspace`,
                    },
                  ]
                : []),
              ...(deal.clientId
                ? [
                    {
                      label: 'Client',
                      value: deal.company ?? deal.relatedClient,
                      helper: 'Open the Client connected to this Sale.',
                      href: `/dashboard/${workspaceId}/clients?clientId=${encodeURIComponent(
                        deal.clientId,
                      )}`,
                    },
                  ]
                : []),
            ]}
          />

          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <DrawerActionGroup label="Primary">
                {['Create Task', 'Message Client', 'Schedule Follow-Up'].map(
                  (action, index) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant={
                        index === 0
                          ? 'outline'
                          : index === 1
                            ? 'subtle'
                            : 'ghost'
                      }
                      onClick={() =>
                        showDrawerPlaceholder(
                          `${action} will connect when pipeline workflows are enabled.`,
                        )
                      }
                    >
                      {action}
                    </Button>
                  ),
                )}
              </DrawerActionGroup>
              <DrawerActionGroup label="Manage">
                {['Update Stage', 'Mark Closed-Won', 'Mark Closed-Lost'].map(
                  (action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        action === 'Mark Closed-Won'
                          ? onUpdateDeal(deal.id, { stage: 'Closed-Won' })
                          : action === 'Mark Closed-Lost'
                            ? onUpdateDeal(deal.id, { stage: 'Closed-Lost' })
                            : requestStageMove()
                      }
                    >
                      {action}
                    </Button>
                  ),
                )}
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
                  onClick={() =>
                    showDrawerPlaceholder(
                      'Trigger Workflow will connect when pipeline workflows are enabled.',
                    )
                  }
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
        className="mt-2"
        aria-label={label}
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
