'use client'

import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import {
  type KeyboardEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Download,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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
import { ConfigurationQuickAdd } from '@/components/ui/ConfigurationQuickAdd'
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
  RecordTimeline,
  SavedViewTabs,
  StageRail,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { Textarea } from '@/components/ui/Textarea'
import {
  formatWorkspaceCompactDate,
  formatWorkspaceDateTime,
  getLocalTimestamp,
} from '@/lib/formatting/dates'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  mergeClientRecords,
  readPreviewClients,
  upsertPreviewClient,
} from '@/lib/clients/previewClientStorage'
import { getClientTagOptions } from '@/lib/clients/clientTagRegistry'
import {
  createPreviewClientTag,
  getPreviewClientTags,
} from '@/lib/clients/previewClientTagStorage'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
  getRelatedActivityRecords,
  getWorkspaceActivityCategory,
  readPreviewActivity,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import {
  resolveContactIdentity,
  upsertContactIdentity,
} from '@/lib/crm/contactIdentity'
import { applyWorkspaceClientDerivations } from '@/lib/workspace-records/businessRules'
import {
  updateClientRecordWithRules,
  updateServiceRequestRecordWithRules,
  updateTaskRecordWithRules,
} from '@/lib/workspace-records/crmMutations'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'
import {
  getClientServiceRequestSummary,
  getClientTaskSummary,
  getTasksForClient,
} from '@/lib/workspace-records/relationships'
import {
  appendPreviewServiceRequest,
  mergeServiceRequestRecords,
  readPreviewServiceRequests,
  removePreviewServiceRequest,
  upsertPreviewServiceRequest,
} from '@/lib/service-requests/previewServiceRequestStorage'
import { createWorkspaceServiceRequestFromClient } from '@/lib/service-requests/createServiceRequest'
import { getServiceRequestTypeOptions } from '@/lib/service-requests/serviceRequestTypeRegistry'
import {
  createPreviewServiceRequestType,
  getPreviewServiceRequestTypes,
} from '@/lib/service-requests/previewServiceRequestTypeStorage'
import {
  createPreviewRevenueTransaction,
  readPreviewRevenueTransactions,
  updatePreviewRevenueTransaction,
} from '@/lib/revenue/previewRevenueStorage'
import {
  canUsePreviewRevenueFallback,
  durableRevenueFailureMessage,
} from '@/lib/revenue/revenuePersistenceMode'
import { dollarsToCents, formatRevenueCurrency } from '@/lib/revenue/money'
import { getCustomerLifetimeValue } from '@/lib/revenue/revenueResolver'
import type { WorkspaceRevenueTransaction } from '@/lib/revenue/types'
import type {
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
  WorkspaceServiceRequest,
} from '@/lib/service-requests/types'
import {
  demoTaskToday,
  type TaskPriority,
  type TaskRecord,
  type TaskSource,
  type TaskStatus,
} from '@/lib/tasks/demoTasks'
import {
  appendPreviewTask,
  mergeTaskRecords,
  readPreviewTasks,
  removePreviewTask,
  upsertPreviewTask,
} from '@/lib/tasks/previewTaskStorage'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import {
  DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  type WorkspaceRecordTerminology,
  getWorkspacePresentationProfile,
} from '@/lib/workspaces/workspacePresentation'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { cn } from '@/lib/utils'
import { useClearFilters } from '@/hooks/useClearFilters'
import type {
  ClientHealth,
  ClientStatus,
  ClientTag,
  PipelineStage,
  WorkspaceClient,
} from '@/lib/clients/types'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'

type FilterValue<T extends string> = 'All' | T
type ClientsView = 'table' | 'pipeline'
type SortKey = 'pipelineStage' | 'lastActivity' | 'openTasks' | 'value'
type SortDirection = 'asc' | 'desc'
type RevenueMutationResult = {
  transaction?: WorkspaceRevenueTransaction
  error?: string
}

const statusOptions: Array<FilterValue<ClientStatus>> = [
  'All',
  'Active',
  'Waiting',
  'Completed',
  'Maintenance',
  'Inactive',
]

const pipelineStageOptions: Array<FilterValue<PipelineStage>> = [
  'All',
  'Onboarding',
  'In Progress',
  'Waiting on Client',
  'Review / Approval',
  'Completed',
  'Maintenance',
  'Inactive',
]

const pipelineSummaryStages: PipelineStage[] = [
  'Onboarding',
  'In Progress',
  'Waiting on Client',
  'Review / Approval',
  'Completed',
  'Maintenance',
  'Inactive',
]

const statusVariant: Record<ClientStatus, BadgeVariant> = {
  Active: 'green',
  Waiting: 'yellow',
  Completed: 'purple',
  Maintenance: 'blue',
  Inactive: 'gray',
}

const tagVariant: Record<string, BadgeVariant> = {
  Website: 'blue',
  Automation: 'purple',
  'Review Request': 'green',
  'High Value': 'brand',
  'Needs Follow-up': 'orange',
  'Needs Follow-Up': 'orange',
  VIP: 'brand',
  Recurring: 'green',
  'New Customer': 'blue',
}

function getClientTagVariant(tag: string): BadgeVariant {
  return tagVariant[tag] ?? 'slate'
}

const healthVariant: Record<ClientHealth, BadgeVariant> = {
  Healthy: 'green',
  'Needs Attention': 'orange',
  'At Risk': 'red',
  Unresponsive: 'yellow',
}

const taskStatusVariant: Record<TaskStatus, BadgeVariant> = {
  Open: 'blue',
  'In Progress': 'purple',
  Waiting: 'orange',
  Completed: 'green',
  Canceled: 'slate',
}

const taskPriorityVariant: Record<TaskPriority, BadgeVariant> = {
  Low: 'slate',
  Medium: 'blue',
  High: 'orange',
  Urgent: 'red',
}

const taskSourceVariant: Record<TaskSource, BadgeVariant> = {
  Manual: 'slate',
  Workflow: 'purple',
  'AI Coach': 'brand',
  'Lead Automation': 'blue',
  'Missed Call': 'red',
  'Lead Follow-Up': 'orange',
  Opportunity: 'green',
  Client: 'brand',
  'Service Request': 'blue',
  Project: 'purple',
  Automation: 'purple',
}

const serviceRequestStatusVariant: Record<ServiceRequestStatus, BadgeVariant> =
  {
    New: 'blue',
    Scheduled: 'purple',
    'In Progress': 'brand',
    'Waiting On Client': 'yellow',
    Completed: 'green',
    Cancelled: 'gray',
  }

const serviceRequestPriorityVariant: Record<
  ServiceRequestPriority,
  BadgeVariant
> = {
  Low: 'slate',
  Normal: 'blue',
  High: 'orange',
  Urgent: 'red',
}

const serviceRequestTypeBadgeClass: Record<string, string> = {
  'Website Update': 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  'Lead Follow-up': 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  'Automation Issue': 'border-indigo-400/30 bg-indigo-400/10 text-indigo-200',
  'Review Request': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  'Support Request': 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  'Field Service': 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  'Service Call': 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  'Estimate / Visit': 'border-violet-400/30 bg-violet-400/10 text-violet-100',
  Maintenance: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  Repair: 'border-orange-400/30 bg-orange-400/10 text-orange-100',
  'Follow-Up': 'border-sky-400/30 bg-sky-400/10 text-sky-100',
}

function getServiceRequestTypeBadgeClass(serviceType: string) {
  return (
    serviceRequestTypeBadgeClass[serviceType] ??
    'border-slate-400/30 bg-slate-400/10 text-slate-200'
  )
}

const clientsTableColumns: TableColumnConfig[] = [
  { id: 'client', label: 'Client', required: true },
  { id: 'status', label: 'Status' },
  { id: 'pipelineStage', label: 'Fulfillment Stage' },
  { id: 'lastActivity', label: 'Last Activity' },
  { id: 'openTasks', label: 'Open Tasks' },
  { id: 'value', label: 'Value' },
  { id: 'owner', label: ownershipLabels.clients.table },
  { id: 'tags', label: 'Tags' },
  { id: 'actions', label: 'Actions' },
]

const pipelineStageRank = new Map(
  pipelineSummaryStages.map((stage, index) => [stage, index]),
)

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(
        target.closest(
          'button,a,input,select,textarea,[data-client-row-action]',
        ),
      )
    : false
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatActivityDate(value: string) {
  return formatWorkspaceCompactDate(value)
}

function getClientInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function mergePreviewActivityRecords(...groups: WorkspaceActivityRecord[][]) {
  const seen = new Set<string>()
  return groups.flat().filter((record) => {
    if (seen.has(record.id)) return false
    seen.add(record.id)
    return true
  })
}

export function ClientsClient({
  clients,
  tasks,
  serviceRequests,
  hasRealClients,
  workspaceOwners,
  canEditOwners = false,
  terminology,
  capabilities,
}: {
  clients: WorkspaceClient[]
  tasks: TaskRecord[]
  serviceRequests: WorkspaceServiceRequest[]
  hasRealClients: boolean
  workspaceOwners: WorkspaceOwner[]
  canEditOwners?: boolean
  terminology?: WorkspaceRecordTerminology
  capabilities?: WorkspaceCapabilities
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const workspaceId =
    clients[0]?.workspaceId ??
    tasks[0]?.workspaceId ??
    serviceRequests[0]?.workspaceId ??
    'demo'
  const workspaceSlug = pathname.split('/')[2] ?? workspaceId
  const terms = terminology ?? DEFAULT_WORKSPACE_RECORD_TERMINOLOGY
  const presentation = capabilities
    ? getWorkspacePresentationProfile(capabilities)
    : null
  const opportunitiesEnabled = Boolean(capabilities?.modules.opportunities)
  const isSimpleService = presentation?.pipelineMode === 'leadToCustomer'
  const readMergedPreviewClients = useCallback(
    () =>
      mergeClientRecords(
        mergeClientRecords(clients, readPreviewClients(workspaceId)),
        readPreviewClients(workspaceSlug),
      ),
    [clients, workspaceId, workspaceSlug],
  )
  const readMergedPreviewActivity = useCallback(
    () =>
      mergePreviewActivityRecords(
        readPreviewActivity(workspaceId),
        readPreviewActivity(workspaceSlug),
      ),
    [workspaceId, workspaceSlug],
  )
  const [baseClientRecords, setBaseClientRecords] =
    useState<WorkspaceClient[]>(clients)
  const [taskRecords, setTaskRecords] = useState<TaskRecord[]>(tasks)
  const [requestRecords, setRequestRecords] =
    useState<WorkspaceServiceRequest[]>(serviceRequests)
  const [workspaceCustomerTags, setWorkspaceCustomerTags] = useState(() =>
    getPreviewClientTags(workspaceId),
  )
  const [workspaceJobTypes, setWorkspaceJobTypes] = useState(() =>
    getPreviewServiceRequestTypes(workspaceId),
  )
  const [revenueTransactions, setRevenueTransactions] = useState<
    WorkspaceRevenueTransaction[]
  >(() => readPreviewRevenueTransactions(workspaceId))
  const [activityRecords, setActivityRecords] = useState<
    WorkspaceActivityRecord[]
  >([])
  const [view, setView] = useState<ClientsView>('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<ClientStatus>>('All')
  const [pipelineFilter, setPipelineFilter] =
    useState<FilterValue<PipelineStage>>('All')
  const [tagFilter, setTagFilter] = useState<FilterValue<ClientTag>>('All')
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedClient, setSelectedClient] = useState<WorkspaceClient | null>(
    null,
  )
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [selectedRequest, setSelectedRequest] =
    useState<WorkspaceServiceRequest | null>(null)
  const [taskCreationClient, setTaskCreationClient] =
    useState<WorkspaceClient | null>(null)
  const [requestCreationClient, setRequestCreationClient] =
    useState<WorkspaceClient | null>(null)
  const [createdTaskLink, setCreatedTaskLink] = useState<{
    taskId: string
  } | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clientColumnConfigs = useMemo<TableColumnConfig[]>(
    () =>
      clientsTableColumns
        .filter((column) => !isSimpleService || column.id !== 'pipelineStage')
        .map((column) =>
          column.id === 'client'
            ? { ...column, label: terms.customerSingular }
            : column.id === 'openTasks'
              ? { ...column, label: `Open ${terms.taskPlural}` }
              : column.id === 'value' && isSimpleService
                ? { ...column, label: 'Lifetime Value' }
                : column,
        ),
    [isSimpleService, terms.customerSingular, terms.taskPlural],
  )
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('clients', clientColumnConfigs)
  const clientRecords = useMemo(
    () =>
      applyWorkspaceClientDerivations(
        baseClientRecords,
        taskRecords,
        requestRecords,
      ),
    [baseClientRecords, requestRecords, taskRecords],
  )

  const customerTagOptions = useMemo<Array<FilterValue<ClientTag>>>(
    () => [
      'All',
      ...getClientTagOptions({
        configuredTags: workspaceCustomerTags,
        clients: clientRecords,
      }),
    ],
    [clientRecords, workspaceCustomerTags],
  )
  const serviceRequestTypeOptions = useMemo<ServiceRequestType[]>(
    () =>
      getServiceRequestTypeOptions({
        configuredTypes: workspaceJobTypes,
        requests: requestRecords,
      }),
    [requestRecords, workspaceJobTypes],
  )
  const visibleStatusOptions = useMemo<Array<FilterValue<ClientStatus>>>(
    () => (isSimpleService ? ['All', 'Active', 'Inactive'] : statusOptions),
    [isSimpleService],
  )

  const customerLifetimeValues = useMemo(
    () =>
      new Map(
        clientRecords.map((client) => [
          client.id,
          getCustomerLifetimeValue({
            workspaceId,
            client,
            transactions: revenueTransactions,
            serviceRequests: requestRecords,
          }),
        ]),
      ),
    [clientRecords, requestRecords, revenueTransactions, workspaceId],
  )

  const closeClientDrawer = () => {
    setSelectedClient(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('clientId')
    params.delete('action')
    const query = params.toString()
    const hash = window.location.hash
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const closeRelatedTaskDrawer = () => {
    setSelectedTask(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('taskId')
    const query = params.toString()
    const hash = window.location.hash
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const closeRelatedRequestDrawer = () => {
    setSelectedRequest(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('requestId')
    const query = params.toString()
    const hash = window.location.hash
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()

    return clientRecords.filter((client) => {
      const matchesSearch = query
        ? [
            client.name,
            client.company,
            client.email,
            client.phone,
            client.notes,
            getOwnerName(workspaceOwners, client.ownerId),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true
      const relationshipStatus = isSimpleService
        ? client.status === 'Inactive'
          ? 'Inactive'
          : 'Active'
        : client.status
      const matchesStatus =
        statusFilter === 'All' || relationshipStatus === statusFilter
      const matchesPipeline =
        isSimpleService ||
        pipelineFilter === 'All' ||
        client.pipelineStage === pipelineFilter
      const normalizedTagFilter = tagFilter.toLowerCase()
      const matchesTag =
        tagFilter === 'All' ||
        client.tags.some((tag) => tag.toLowerCase() === normalizedTagFilter)

      return matchesSearch && matchesStatus && matchesPipeline && matchesTag
    })
  }, [
    clientRecords,
    isSimpleService,
    pipelineFilter,
    search,
    statusFilter,
    tagFilter,
    workspaceOwners,
  ])

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((first, second) => {
      let comparison = 0

      if (sortKey === 'pipelineStage') {
        comparison =
          (pipelineStageRank.get(first.pipelineStage) ?? 0) -
          (pipelineStageRank.get(second.pipelineStage) ?? 0)
      } else if (sortKey === 'lastActivity') {
        comparison =
          new Date(first.lastActivity).getTime() -
          new Date(second.lastActivity).getTime()
      } else if (sortKey === 'value' && isSimpleService) {
        comparison =
          (customerLifetimeValues.get(first.id) ?? 0) -
          (customerLifetimeValues.get(second.id) ?? 0)
      } else {
        comparison = first[sortKey] - second[sortKey]
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [
    customerLifetimeValues,
    filteredClients,
    isSimpleService,
    sortDirection,
    sortKey,
  ])

  const scrollTarget =
    searchParams.get('clientId') || searchParams.get('view')
      ? 'client-relationships'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredClients.length}:${selectedClient?.id ?? ''}`,
  )

  const kpis = useMemo(() => {
    if (!hasRealClients) {
      return [
        {
          label: `Total ${terms.customerPlural}`,
          value: '24',
          helper: 'Preview CRM records',
        },
        {
          label: `Active ${terms.customerPlural}`,
          value: '18',
          helper: 'Currently in motion',
        },
        {
          label: 'New This Month',
          value: '5',
          helper: 'Added this month',
        },
        {
          label: 'Active Fulfillment',
          value: '7',
          helper: `${terms.customerSingular} work in motion`,
        },
      ]
    }

    return [
      {
        label: `Total ${terms.customerPlural}`,
        value: clientRecords.length.toString(),
        helper: 'All tracked relationships',
      },
      {
        label: `Active ${terms.customerPlural}`,
        value: clientRecords
          .filter((client) => client.status === 'Active')
          .length.toString(),
        helper: 'Currently in motion',
      },
      {
        label: 'New This Month',
        value: clientRecords
          .filter((client) => {
            const activityDate = new Date(client.lastActivity)
            const currentDate = new Date()
            return (
              activityDate.getMonth() === currentDate.getMonth() &&
              activityDate.getFullYear() === currentDate.getFullYear()
            )
          })
          .length.toString(),
        helper: 'Added this month',
      },
      {
        label: 'Active Fulfillment',
        value: clientRecords
          .filter(
            (client) =>
              !['Completed'].includes(client.pipelineStage) &&
              !['Completed', 'Maintenance', 'Inactive'].includes(client.status),
          )
          .length.toString(),
        helper: `${terms.customerSingular} work in motion`,
      },
    ]
  }, [
    clientRecords,
    hasRealClients,
    terms.customerPlural,
    terms.customerSingular,
  ])

  const clientVisuals = useMemo(() => {
    const getClientValue = (client: WorkspaceClient) =>
      isSimpleService
        ? (customerLifetimeValues.get(client.id) ?? 0) / 100
        : client.value
    const totalValue = clientRecords.reduce(
      (sum, client) => sum + getClientValue(client),
      0,
    )
    const valueTrend: InsightSeriesPoint[] = [
      { label: 'May', value: Math.round(totalValue * 0.52) },
      { label: 'Jun 1', value: Math.round(totalValue * 0.62) },
      { label: 'Jun 8', value: Math.round(totalValue * 0.72) },
      { label: 'Jun 15', value: Math.round(totalValue * 0.82) },
      { label: 'Today', value: totalValue },
    ]
    const statusBreakdown: InsightBreakdownPoint[] = statusOptions
      .filter((status): status is ClientStatus => status !== 'All')
      .map((status, index) => ({
        label: status,
        value: clientRecords.filter((client) => client.status === status)
          .length,
        color:
          status === 'Active'
            ? '#34d399'
            : status === 'Inactive'
              ? '#94a3b8'
              : ['#22d3ee', '#8b5cf6', '#60a5fa', '#f59e0b'][index % 4],
      }))
    const topClients: InsightBreakdownPoint[] = [...clientRecords]
      .sort((a, b) => getClientValue(b) - getClientValue(a))
      .slice(0, 5)
      .map((client, index) => ({
        label: client.name,
        value: getClientValue(client),
        helper: isSimpleService
          ? client.status === 'Inactive'
            ? 'Inactive'
            : 'Active'
          : `${client.pipelineStage} · ${client.status}`,
        color: ['#22d3ee', '#8b5cf6', '#34d399', '#f59e0b', '#60a5fa'][
          index % 5
        ],
      }))

    return {
      statusBreakdown,
      stageRail: pipelineSummaryStages.map((stage) => {
        const stageClients = clientRecords.filter(
          (client) => client.pipelineStage === stage,
        )
        return {
          label: stage,
          value: stageClients.length.toString(),
          helper: formatCurrency(
            stageClients.reduce(
              (sum, client) => sum + getClientValue(client),
              0,
            ),
          ),
          active: stageClients.length > 0,
          tone:
            stage === 'Waiting on Client'
              ? ('amber' as const)
              : stage === 'Completed'
                ? ('green' as const)
                : ('cyan' as const),
        }
      }),
      topClients,
      totalValue,
      valueTrend,
    }
  }, [clientRecords, customerLifetimeValues, isSimpleService])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('All')
    setPipelineFilter('All')
    setTagFilter('All')
  }

  const applySavedView = useCallback(
    (viewId: string) => {
      setActiveSavedViewId(viewId)
      setSearch('')
      setStatusFilter('All')
      setPipelineFilter('All')
      setTagFilter('All')

      if (viewId === 'active') setStatusFilter('Active')
      if (viewId === 'needs-attention') setTagFilter('Needs Follow-Up')
      if (!isSimpleService && viewId === 'waiting')
        setPipelineFilter('Waiting on Client')
      if (viewId === 'high-value')
        setTagFilter(isSimpleService ? 'VIP' : 'High Value')
      if (!isSimpleService && viewId === 'maintenance')
        setStatusFilter('Maintenance')
    },
    [isSimpleService],
  )

  useEffect(() => {
    const clientId = searchParams.get('clientId')
    const taskId = searchParams.get('taskId')
    const requestId = searchParams.get('requestId')
    const action = searchParams.get('action')
    const view = searchParams.get('view')
    const searchQuery = searchParams.get('search')

    if (searchQuery) setSearch(searchQuery)
    if (view) applySavedView(view)
    if (clientId) {
      const client = clientRecords.find((record) => record.id === clientId)
      if (client) {
        setSelectedClient(client)
        if (action === 'create-task') setTaskCreationClient(client)
        if (action === 'create-request') setRequestCreationClient(client)
      }
    }
    if (taskId) {
      const task = taskRecords.find((record) => record.id === taskId)
      if (task) setSelectedTask(task)
    }
    if (requestId) {
      const request = requestRecords.find((record) => record.id === requestId)
      if (request) setSelectedRequest(request)
    }
  }, [applySavedView, clientRecords, requestRecords, searchParams, taskRecords])

  useEffect(() => {
    if (!isSimpleService) return
    if (view === 'pipeline') setView('table')
    if (sortKey === 'pipelineStage') setSortKey('lastActivity')
    if (pipelineFilter !== 'All') setPipelineFilter('All')
  }, [isSimpleService, pipelineFilter, sortKey, view])

  const showPlaceholder = (text: string) => {
    setMessage(text)
  }

  const refreshRevenueTransactions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/revenue/transactions`,
        { cache: 'no-store' },
      )
      if (!response.ok) throw new Error('Revenue records unavailable')
      const data = (await response.json()) as {
        transactions?: WorkspaceRevenueTransaction[]
      }
      setRevenueTransactions(data.transactions ?? [])
    } catch {
      if (canUsePreviewRevenueFallback()) {
        setRevenueTransactions(readPreviewRevenueTransactions(workspaceId))
        return
      }
      setRevenueTransactions([])
      setMessage('Revenue records could not be loaded durably.')
    }
  }, [workspaceId])

  const quickAddCustomerTag = (label: string) => {
    const result = createPreviewClientTag({
      workspaceId,
      label,
    })
    if (result.tag) {
      setWorkspaceCustomerTags(getPreviewClientTags(workspaceId))
      return { label: result.tag.label }
    }
    return {
      error:
        result.errors.label ??
        `${terms.customerSingular} tag could not be created.`,
    }
  }

  const quickAddJobType = (label: string) => {
    const result = createPreviewServiceRequestType({
      workspaceId,
      label,
    })
    if (result.type) {
      setWorkspaceJobTypes(getPreviewServiceRequestTypes(workspaceId))
      return { label: result.type.label }
    }
    return {
      error:
        result.errors.label ??
        `${terms.serviceRequestSingular} type could not be created.`,
    }
  }

  useEffect(() => {
    setBaseClientRecords(readMergedPreviewClients())
    setWorkspaceCustomerTags(getPreviewClientTags(workspaceId))
    void refreshRevenueTransactions()
  }, [readMergedPreviewClients, refreshRevenueTransactions, workspaceId])

  useEffect(() => {
    setTaskRecords(mergeTaskRecords(tasks, readPreviewTasks(workspaceId)))
  }, [tasks, workspaceId])

  useEffect(() => {
    setRequestRecords(
      mergeServiceRequestRecords(
        serviceRequests,
        readPreviewServiceRequests(workspaceId),
      ),
    )
    setWorkspaceJobTypes(getPreviewServiceRequestTypes(workspaceId))
  }, [serviceRequests, workspaceId])

  useEffect(() => {
    setActivityRecords(readMergedPreviewActivity())
  }, [readMergedPreviewActivity])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (
        event.detail.workspaceId !== workspaceId &&
        event.detail.workspaceId !== workspaceSlug
      ) {
        return
      }

      if (event.detail.scope === 'clients') {
        setBaseClientRecords(readMergedPreviewClients())
        setWorkspaceCustomerTags(getPreviewClientTags(workspaceId))
        void refreshRevenueTransactions()
      }
      if (event.detail.scope === 'tasks') {
        setTaskRecords(mergeTaskRecords(tasks, readPreviewTasks(workspaceId)))
      }
      if (event.detail.scope === 'serviceRequests') {
        setRequestRecords(
          mergeServiceRequestRecords(
            serviceRequests,
            readPreviewServiceRequests(workspaceId),
          ),
        )
        setWorkspaceJobTypes(getPreviewServiceRequestTypes(workspaceId))
      }
      if (event.detail.scope === 'activity') {
        setActivityRecords(readMergedPreviewActivity())
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
    readMergedPreviewActivity,
    readMergedPreviewClients,
    refreshRevenueTransactions,
    serviceRequests,
    tasks,
    workspaceId,
    workspaceSlug,
  ])

  useEffect(() => {
    setSelectedClient((current) =>
      current
        ? (clientRecords.find((record) => record.id === current.id) ?? current)
        : current,
    )
  }, [clientRecords])

  useEffect(() => {
    setSelectedTask((current) =>
      current
        ? (taskRecords.find((record) => record.id === current.id) ?? current)
        : current,
    )
  }, [taskRecords])

  useEffect(() => {
    setSelectedRequest((current) =>
      current
        ? (requestRecords.find((record) => record.id === current.id) ?? current)
        : current,
    )
  }, [requestRecords])

  const openClientProfile = (client: WorkspaceClient) => {
    setSelectedClient(client)
  }

  const openClientTaskCreation = (client: WorkspaceClient) => {
    setSelectedClient(client)
    setTaskCreationClient(client)
    setCreatedTaskLink(null)
  }

  const openClientRequestCreation = (client: WorkspaceClient) => {
    setSelectedClient(client)
    setRequestCreationClient(client)
  }

  const createClientTask = (client: WorkspaceClient, task: TaskRecord) => {
    appendPreviewTask(client.workspaceId, task)
    appendPreviewTask(workspaceSlug, task)
    const event = createWorkspaceActivityRecord({
      workspaceId: task.workspaceId,
      recordId: task.id,
      recordType: 'task',
      action: 'created',
      title: `${terms.taskSingular} created`,
      description: `${task.title} was created for ${client.company}.`,
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    setTaskRecords((current) => mergeTaskRecords(current, [task]))
    setCreatedTaskLink({ taskId: task.id })
    setTaskCreationClient(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    const query = params.toString()
    const hash = window.location.hash || '#client-relationships'
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
    showPlaceholder(
      `${terms.taskSingular} created in preview workspace. Saved to this workspace preview. Database persistence will be connected next.`,
    )
  }

  const updateClientTaskRecord = (
    taskId: string,
    updates: Partial<TaskRecord>,
  ) => {
    const sourceTask =
      selectedTask?.id === taskId
        ? selectedTask
        : taskRecords.find((task) => task.id === taskId)
    if (!sourceTask) return

    const { record: nextTask, events } = updateTaskRecordWithRules(
      sourceTask,
      updates,
    )
    setTaskRecords((current) =>
      current.map((task) => (task.id === taskId ? nextTask : task)),
    )
    setSelectedTask((current) => (current?.id === taskId ? nextTask : current))
    upsertPreviewTask(nextTask.workspaceId, nextTask)
    upsertPreviewTask(workspaceSlug, nextTask)
    events.forEach((event) => {
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    })
    showPlaceholder('Saved locally for this workspace preview.')
  }

  const deleteClientTaskRecord = (task: TaskRecord) => {
    const event = createWorkspaceActivityRecord({
      workspaceId: task.workspaceId,
      recordId: task.id,
      recordType: 'task',
      action: 'deleted',
      title: `${terms.taskSingular} deleted`,
      description: `${task.title} was removed from the workspace preview.`,
    })
    setTaskRecords((current) =>
      current.filter((record) => record.id !== task.id),
    )
    setSelectedTask(null)
    removePreviewTask(task.workspaceId, task.id)
    removePreviewTask(workspaceSlug, task.id)
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    showPlaceholder(
      `${terms.taskSingular} removed from this workspace preview.`,
    )
  }

  const createClientServiceRequest = (
    client: WorkspaceClient,
    request: WorkspaceServiceRequest,
  ) => {
    const nextRequest = { ...request, workspaceSlug }
    appendPreviewServiceRequest(client.workspaceId, nextRequest)
    appendPreviewServiceRequest(workspaceSlug, nextRequest)
    const event = createWorkspaceActivityRecord({
      workspaceId: nextRequest.workspaceId,
      recordId: nextRequest.id,
      recordType: 'serviceRequest',
      action: 'created',
      title: `${terms.serviceRequestSingular} submitted`,
      description: `${nextRequest.title} was created for ${client.company}.`,
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    setRequestRecords((current) =>
      mergeServiceRequestRecords(current, [nextRequest]),
    )
    setRequestCreationClient(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    const query = params.toString()
    const hash = window.location.hash || '#client-relationships'
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
    showPlaceholder(
      `${terms.serviceRequestSingular} created in preview workspace. Database persistence will be connected later.`,
    )
  }

  const updateClientServiceRequestRecord = (
    requestId: string,
    updates: Partial<WorkspaceServiceRequest>,
  ) => {
    const sourceRequest =
      selectedRequest?.id === requestId
        ? selectedRequest
        : requestRecords.find((request) => request.id === requestId)
    if (!sourceRequest) return

    const { record: nextRequest, events } = updateServiceRequestRecordWithRules(
      sourceRequest,
      updates,
    )
    setRequestRecords((current) =>
      current.map((request) =>
        request.id === requestId ? nextRequest : request,
      ),
    )
    setSelectedRequest((current) =>
      current?.id === requestId ? nextRequest : current,
    )
    upsertPreviewServiceRequest(nextRequest.workspaceId, nextRequest)
    upsertPreviewServiceRequest(workspaceSlug, nextRequest)
    events.forEach((event) => {
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    })
    showPlaceholder('Saved locally for this workspace preview.')
  }

  const deleteClientServiceRequestRecord = (
    request: WorkspaceServiceRequest,
  ) => {
    const event = createWorkspaceActivityRecord({
      workspaceId: request.workspaceId,
      recordId: request.id,
      recordType: 'serviceRequest',
      action: 'deleted',
      title: `${terms.serviceRequestSingular} deleted`,
      description: `${request.title} was removed from the workspace preview.`,
    })
    setRequestRecords((current) =>
      current.filter((record) => record.id !== request.id),
    )
    setSelectedRequest(null)
    removePreviewServiceRequest(request.workspaceId, request.id)
    removePreviewServiceRequest(workspaceSlug, request.id)
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    showPlaceholder(
      `${terms.serviceRequestSingular} removed from this workspace preview.`,
    )
  }

  const recordClientRevenue = async ({
    client,
    amount,
    description,
    occurredAt,
    sourceId,
  }: {
    client: WorkspaceClient
    amount: string
    description: string
    occurredAt: string
    sourceId?: string
  }): Promise<RevenueMutationResult> => {
    const amountCents = dollarsToCents(amount)
    if (amountCents <= 0) return { error: 'Enter an amount greater than $0.' }
    let transaction: WorkspaceRevenueTransaction
    try {
      const response = await fetch(
        `/api/workspaces/${client.workspaceId}/revenue/transactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            amountCents,
            currency: 'USD',
            occurredAt,
            description,
            sourceType: sourceId ? 'JOB' : 'MANUAL',
            sourceId: sourceId ?? null,
          }),
        },
      )
      const data = (await response.json().catch(() => ({}))) as {
        message?: string
        transaction?: WorkspaceRevenueTransaction
      }
      if (!response.ok || !data.transaction) {
        return {
          error:
            data.message ??
            'Revenue could not be recorded. Check your permissions and try again.',
        }
      }
      transaction = data.transaction
      setRevenueTransactions((current) => [
        transaction,
        ...current.filter((record) => record.id !== transaction.id),
      ])
      void refreshRevenueTransactions()
    } catch {
      if (!canUsePreviewRevenueFallback()) {
        return { error: durableRevenueFailureMessage() }
      }
      transaction = createPreviewRevenueTransaction({
        workspaceId: client.workspaceId,
        transaction: {
          clientId: client.id,
          amountCents,
          currency: 'USD',
          occurredAt: occurredAt
            ? new Date(`${occurredAt}T12:00:00`).toISOString()
            : getLocalTimestamp(),
          description,
          sourceType: sourceId ? 'JOB' : 'MANUAL',
          sourceId: sourceId ?? null,
          status: 'recognized',
        },
      })
      if (workspaceSlug !== client.workspaceId) {
        createPreviewRevenueTransaction({
          workspaceId: workspaceSlug,
          transaction,
        })
      }
      setRevenueTransactions(readPreviewRevenueTransactions(client.workspaceId))
    }
    const event = createWorkspaceActivityRecord({
      workspaceId: client.workspaceId,
      recordId: transaction.id,
      recordType: 'note',
      action: 'created',
      title: 'Revenue recorded',
      description: `${formatRevenueCurrency(transaction.amountCents)} recorded for ${client.company}.`,
      metadata: {
        clientId: client.id,
        companyName: client.company,
        revenueTransactionId: transaction.id,
        sourceId: sourceId ?? null,
      },
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    setActivityRecords(readMergedPreviewActivity())
    showPlaceholder(
      `Revenue recorded for ${client.company}. ${formatRevenueCurrency(transaction.amountCents)} now contributes to recognized revenue and lifetime value.`,
    )
    return { transaction }
  }

  const voidClientRevenue = async (
    transaction: WorkspaceRevenueTransaction,
  ): Promise<RevenueMutationResult> => {
    try {
      const response = await fetch(
        `/api/workspaces/${transaction.workspaceId}/revenue/transactions/${transaction.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'void' }),
        },
      )
      const data = (await response.json().catch(() => ({}))) as {
        message?: string
        transactions?: WorkspaceRevenueTransaction[]
        transaction?: WorkspaceRevenueTransaction
      }
      if (!response.ok || !data.transaction) {
        return {
          error: data.message ?? 'Revenue could not be voided. Try again.',
        }
      }
      setRevenueTransactions(
        data.transactions ??
          revenueTransactions.map((record) =>
            record.id === data.transaction?.id ? data.transaction : record,
          ),
      )
      return { transaction: data.transaction }
    } catch {
      if (!canUsePreviewRevenueFallback()) {
        return {
          error: 'Revenue could not be voided durably. Nothing changed.',
        }
      }
      const updated = updatePreviewRevenueTransaction({
        workspaceId: transaction.workspaceId,
        transactionId: transaction.id,
        updates: { status: 'void' },
      })
      setRevenueTransactions(
        readPreviewRevenueTransactions(transaction.workspaceId),
      )
      return updated
        ? { transaction: updated }
        : { error: 'Revenue transaction not found.' }
    }
  }

  const handleClientRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    client: WorkspaceClient,
  ) => {
    if (isRowActionTarget(event.target)) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openClientProfile(client)
    }
  }

  const handleRowActionClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
  }

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextSortKey)
    setSortDirection(nextSortKey === 'pipelineStage' ? 'asc' : 'desc')
  }

  const handlePipelineDragEnd = (event: DragEndEvent) => {
    const clientId = String(event.active.id)
    const nextStage = event.over?.id as PipelineStage | undefined

    if (!nextStage || !pipelineSummaryStages.includes(nextStage)) return

    const client = clientRecords.find((record) => record.id === clientId)
    if (!client || client.pipelineStage === nextStage) return

    const { record: nextClient, events } = updateClientRecordWithRules(client, {
      pipelineStage: nextStage,
    })
    setBaseClientRecords((records) =>
      records.map((record) => (record.id === clientId ? nextClient : record)),
    )
    setSelectedClient((current) =>
      current?.id === clientId ? nextClient : current,
    )
    upsertPreviewClient(nextClient.workspaceId, nextClient)
    upsertPreviewClient(workspaceSlug, nextClient)
    events.forEach((event) => {
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    })
    showPlaceholder('Fulfillment stage updated. Database sync coming soon.')
  }

  const updateClientOwner = (clientId: string, ownerId: string) => {
    updateClientRecord(clientId, { ownerId })
  }

  const updateClientRecord = (
    clientId: string,
    updates: Partial<WorkspaceClient>,
  ) => {
    const sourceClient =
      baseClientRecords.find((record) => record.id === clientId) ??
      clientRecords.find((record) => record.id === clientId)
    if (!sourceClient) return

    const { record: nextClient, events } = updateClientRecordWithRules(
      sourceClient,
      updates,
    )
    setBaseClientRecords((records) =>
      records.map((record) => (record.id === clientId ? nextClient : record)),
    )
    setSelectedClient((current) =>
      current?.id === clientId ? nextClient : current,
    )
    upsertPreviewClient(nextClient.workspaceId, nextClient)
    upsertPreviewClient(workspaceSlug, nextClient)
    events.forEach((event) => {
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    })
    showPlaceholder(
      `${terms.customerSingular} changes saved locally for this workspace preview.`,
    )
  }

  const expectedStatusForView =
    activeSavedViewId === 'active'
      ? 'Active'
      : activeSavedViewId === 'maintenance'
        ? 'Maintenance'
        : 'All'
  const expectedPipelineForView =
    activeSavedViewId === 'waiting' ? 'Waiting on Client' : 'All'
  const expectedTagForView =
    activeSavedViewId === 'high-value'
      ? isSimpleService
        ? 'VIP'
        : 'High Value'
      : activeSavedViewId === 'needs-attention'
        ? 'Needs Follow-Up'
        : 'All'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === expectedStatusForView ? '' : statusFilter,
      pipelineFilter:
        pipelineFilter === expectedPipelineForView ? '' : pipelineFilter,
      tagFilter: tagFilter === expectedTagForView ? '' : tagFilter,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter(expectedStatusForView as FilterValue<ClientStatus>)
      setPipelineFilter(expectedPipelineForView as FilterValue<PipelineStage>)
      setTagFilter(expectedTagForView as FilterValue<ClientTag>)
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title={terms.customerPlural}
        description={
          isSimpleService
            ? `Manage paying ${terms.customerPlural.toLowerCase()}, relationship status, follow-ups, and connected ${terms.serviceRequestPlural.toLowerCase()} across this workspace.`
            : `Manage paying ${terms.customerPlural.toLowerCase()}, fulfillment activity, follow-ups, and delivery status across this workspace.`
        }
        actions={
          <>
            <Button
              type="button"
              onClick={() => setAddClientOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Add {terms.customerSingular}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                showPlaceholder(
                  `${terms.customerSingular} import will connect to CSV upload soon.`,
                )
              }
              leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
            >
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                showPlaceholder(
                  `${terms.customerSingular} export will connect to CRM data soon.`,
                )
              }
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              Export
            </Button>
          </>
        }
      />

      {message ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100"
          role="status"
          aria-live="polite"
        >
          <span>{message}</span>
          {createdTaskLink ? (
            <Link
              href={`${pathname.replace(/\/clients$/, '/tasks')}?taskId=${encodeURIComponent(
                createdTaskLink.taskId,
              )}#tasks-workspace`}
              className="rounded-lg border border-cyan-300/30 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-50 transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            >
              View in {terms.taskPlural}
            </Link>
          ) : null}
        </div>
      ) : null}

      {!hasRealClients ? (
        <div className="flex justify-end">
          <Badge variant="slate">Preview CRM data</Badge>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="metric-card-surface p-4">
            <p className="text-metric-muted text-xs">{kpi.label}</p>
            <p className="text-metric mt-2 text-2xl font-semibold">
              {kpi.value}
            </p>
            <p className="text-metric-muted mt-1 text-xs">{kpi.helper}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        {isSimpleService ? null : (
          <ChartCard
            title="Fulfillment stage rail"
            description="Paying customers grouped by delivery status and current account value."
          >
            <StageRail data={clientVisuals.stageRail} />
          </ChartCard>
        )}
        <ChartCard
          title={`${terms.customerPlural} by status`}
          description="Relationship mix across active and completed accounts."
        >
          <DonutBreakdown
            data={clientVisuals.statusBreakdown}
            centerValue={clientRecords.length.toString()}
            centerLabel={terms.customerPlural}
          />
        </ChartCard>
      </section>

      <ChartCard
        title={`Top ${terms.customerPlural.toLowerCase()} by value`}
        description="Highest-value customer records in this workspace preview."
      >
        <HorizontalBarList data={clientVisuals.topClients} valuePrefix="$" />
      </ChartCard>

      <RecommendedActionsCard
        description={
          isSimpleService
            ? `Keep ${terms.customerPlural.toLowerCase()} current and move connected ${terms.serviceRequestPlural.toLowerCase()} forward.`
            : 'Keep fulfillment moving and protect account health.'
        }
        actions={[
          isSimpleService
            ? {
                title: `Review ${terms.customerPlural.toLowerCase()} needing follow-up`,
                detail: `${terms.customerPlural} tagged Needs Follow-Up should get a clear next contact or connected ${terms.serviceRequestSingular.toLowerCase()}.`,
                tone: 'amber' as const,
                cta: 'Show needs follow-up',
                onClick: () => setTagFilter('Needs Follow-Up'),
              }
            : {
                title: `Review waiting ${terms.customerPlural.toLowerCase()}`,
                detail: `Waiting-on-${terms.customerSingular.toLowerCase()} work should get a clear next action.`,
                tone: 'amber' as const,
                cta: 'Filter waiting stage',
                onClick: () => setPipelineFilter('Waiting on Client'),
              },
          {
            title: 'Prioritize high-value accounts',
            detail: `Use the top-${terms.customerSingular.toLowerCase()} list to focus account owner follow-up.`,
            tone: 'cyan',
            cta: 'Sort by value',
            onClick: () => {
              setSortKey('value')
              setSortDirection('desc')
            },
          },
          {
            title: `Create ${terms.customerSingular.toLowerCase()} ${terms.taskSingular.toLowerCase()} workflow`,
            detail: `Turn recurring ${terms.customerSingular.toLowerCase()} follow-ups into tracked ${terms.taskPlural.toLowerCase()}.`,
            tone: 'purple',
            cta: 'Preview action',
            onClick: () =>
              showPlaceholder(
                `${terms.customerSingular} ${terms.taskSingular.toLowerCase()} creation is currently in preview. Connected ${terms.taskSingular.toLowerCase()} workflows will be available soon.`,
              ),
          },
        ]}
      />

      <SavedViewTabs
        activeViewId={activeSavedViewId}
        onSelect={applySavedView}
        views={[
          { id: 'all', label: 'All', count: clientRecords.length },
          {
            id: 'active',
            label: 'Active',
            count: clientRecords.filter((client) => client.status === 'Active')
              .length,
            tone: 'green',
          },
          {
            id: 'needs-attention',
            label: 'Needs Attention',
            count: clientRecords.filter(
              (client) =>
                client.tags.includes('Needs Follow-Up') ||
                client.tags.includes('Needs Follow-up'),
            ).length,
            tone: 'amber',
          },
          !isSimpleService
            ? {
                id: 'waiting',
                label: 'Waiting on Client',
                count: clientRecords.filter(
                  (client) => client.pipelineStage === 'Waiting on Client',
                ).length,
                tone: 'purple',
              }
            : null,
          {
            id: 'high-value',
            label: isSimpleService ? 'VIP' : 'High Value',
            count: clientRecords.filter((client) =>
              client.tags.includes(isSimpleService ? 'VIP' : 'High Value'),
            ).length,
            tone: 'cyan',
          },
          !isSimpleService
            ? {
                id: 'maintenance',
                label: 'Maintenance',
                count: clientRecords.filter(
                  (client) => client.status === 'Maintenance',
                ).length,
                tone: 'slate',
              }
            : null,
        ].filter(
          (
            view,
          ): view is {
            id: string
            label: string
            count: number
            tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'slate'
          } => Boolean(view),
        )}
        trailingAction={
          <ClearFiltersButton
            count={activeFilterCount}
            onClear={clearFilters}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{terms.customerSingular} Filters</CardTitle>
          <CardDescription>
            Search and segment {terms.customerSingular.toLowerCase()} records by
            relationship status{isSimpleService ? '' : ', pipeline stage'}, and
            tags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <label>
              <span className="sr-only">
                Search {terms.customerPlural.toLowerCase()}
              </span>
              <div className="relative">
                <Search
                  className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${terms.customerPlural.toLowerCase()}...`}
                  className="pl-9"
                />
              </div>
            </label>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as FilterValue<ClientStatus>)
              }
              aria-label="Status filter"
            >
              {visibleStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {isSimpleService ? null : (
              <Select
                value={pipelineFilter}
                onChange={(event) =>
                  setPipelineFilter(
                    event.target.value as FilterValue<PipelineStage>,
                  )
                }
                aria-label="Fulfillment stage filter"
              >
                {pipelineStageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={tagFilter}
              onChange={(event) =>
                setTagFilter(event.target.value as FilterValue<ClientTag>)
              }
              aria-label="Tag filter"
            >
              {customerTagOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card id="client-relationships" className="scroll-mt-28">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{terms.customerSingular} Relationships</CardTitle>
              <CardDescription>
                Workspace {terms.customerSingular.toLowerCase()} records,{' '}
                {terms.taskPlural.toLowerCase()}
                {isSimpleService ? '' : ', fulfillment stages'}, and recent{' '}
                {terms.customerSingular.toLowerCase()} activity.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{filteredClients.length} shown</Badge>
              {isSimpleService ? null : (
                <div
                  className="inline-flex rounded-xl border border-slate-800 bg-slate-950/70 p-1"
                  aria-label={`${terms.customerSingular} view`}
                >
                  {(['table', 'pipeline'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={view === option}
                      onClick={() => setView(option)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        view === option
                          ? 'bg-cyan-300/15 text-cyan-100 shadow-sm shadow-cyan-950/40'
                          : 'text-neutral-text-secondary hover:bg-white/[0.04] hover:text-neutral-100'
                      }`}
                    >
                      {option === 'table' ? 'Table' : 'Pipeline'}
                    </button>
                  ))}
                </div>
              )}
              {view === 'table' ? (
                <TableColumnsButton
                  columns={clientColumnConfigs}
                  visibleColumns={visibleColumns}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
              ) : null}
            </div>
          </div>
        </CardHeader>
        {filteredClients.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={`No ${terms.customerPlural.toLowerCase()} match your filters.`}
              description={`Try changing the search, status${isSimpleService ? '' : ', fulfillment stage'}, or tag.`}
              actionLabel="Reset filters"
              onAction={resetFilters}
            />
          </div>
        ) : view === 'table' ? (
          <Table
            className="min-w-[1240px]"
            containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
          >
            <THead>
              <TR>
                <TH>{terms.customerSingular}</TH>
                {isColumnVisible('status') ? <TH>Status</TH> : null}
                {!isSimpleService && isColumnVisible('pipelineStage') ? (
                  <TH>
                    <SortableHeader
                      label="Fulfillment Stage"
                      sortKey="pipelineStage"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TH>
                ) : null}
                {isColumnVisible('lastActivity') ? (
                  <TH>
                    <SortableHeader
                      label="Last Activity"
                      sortKey="lastActivity"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TH>
                ) : null}
                {isColumnVisible('openTasks') ? (
                  <TH>
                    <SortableHeader
                      label={`Open ${terms.taskPlural}`}
                      sortKey="openTasks"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TH>
                ) : null}
                {isColumnVisible('value') ? (
                  <TH>
                    <SortableHeader
                      label={isSimpleService ? 'Lifetime Value' : 'Value'}
                      sortKey="value"
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TH>
                ) : null}
                {isColumnVisible('owner') ? (
                  <TH>{ownershipLabels.clients.table}</TH>
                ) : null}
                {isColumnVisible('tags') ? <TH>Tags</TH> : null}
                {isColumnVisible('actions') ? <TH>Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {sortedClients.map((client) => {
                const taskSummary = getClientTaskSummary(taskRecords, client.id)
                const relationshipStatus: ClientStatus =
                  client.status === 'Inactive' ? 'Inactive' : 'Active'

                return (
                  <TR
                    key={client.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${client.name} ${terms.customerSingular.toLowerCase()} profile`}
                    className="cursor-pointer hover:bg-cyan-300/[0.05] focus-visible:bg-cyan-300/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
                    onClick={(event) => {
                      if (isRowActionTarget(event.target)) return
                      openClientProfile(client)
                    }}
                    onKeyDown={(event) => handleClientRowKeyDown(event, client)}
                  >
                    <TD>
                      <div className="flex min-w-64 items-center gap-3">
                        <ClientInitials name={client.name} />
                        <div className="min-w-0">
                          <p className="text-app-primary font-medium">
                            {client.name}
                          </p>
                          <p className="text-neutral-text-secondary text-xs">
                            {client.company}
                          </p>
                          <p className="text-neutral-text-secondary mt-1 text-[11px]">
                            {client.email || client.phone}
                          </p>
                        </div>
                      </div>
                    </TD>
                    {isColumnVisible('status') ? (
                      <TD>
                        <Badge
                          variant={
                            statusVariant[
                              isSimpleService
                                ? relationshipStatus
                                : client.status
                            ]
                          }
                        >
                          {isSimpleService ? relationshipStatus : client.status}
                        </Badge>
                        <div className="mt-1">
                          <Badge
                            size="xs"
                            variant={healthVariant[client.health]}
                          >
                            {client.health}
                          </Badge>
                        </div>
                      </TD>
                    ) : null}
                    {!isSimpleService && isColumnVisible('pipelineStage') ? (
                      <TD className="text-neutral-text-secondary">
                        {client.pipelineStage}
                      </TD>
                    ) : null}
                    {isColumnVisible('lastActivity') ? (
                      <TD className="text-neutral-text-secondary">
                        {formatActivityDate(client.lastActivity)}
                      </TD>
                    ) : null}
                    {isColumnVisible('openTasks') ? (
                      <TD>
                        <div>
                          <span className="text-app-primary text-sm">
                            {taskSummary.openCount}
                          </span>
                          {taskSummary.overdueCount > 0 ? (
                            <p className="mt-1 text-[11px] font-medium text-rose-300">
                              {taskSummary.overdueCount} overdue
                            </p>
                          ) : null}
                          {taskSummary.nextDueDate ? (
                            <p className="text-neutral-text-secondary mt-1 text-[11px]">
                              Next due {taskSummary.nextDueDate}
                            </p>
                          ) : null}
                        </div>
                      </TD>
                    ) : null}
                    {isColumnVisible('value') ? (
                      <TD>
                        {isSimpleService
                          ? formatRevenueCurrency(
                              customerLifetimeValues.get(client.id) ?? 0,
                            )
                          : formatCurrency(client.value)}
                      </TD>
                    ) : null}
                    {isColumnVisible('owner') ? (
                      <TD className="text-neutral-text-secondary">
                        {getOwnerName(workspaceOwners, client.ownerId)}
                      </TD>
                    ) : null}
                    {isColumnVisible('tags') ? (
                      <TD>
                        <div className="flex min-w-44 flex-wrap gap-1.5">
                          {client.tags.map((tag) => (
                            <Badge
                              key={tag}
                              size="xs"
                              variant={getClientTagVariant(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                    ) : null}
                    {isColumnVisible('actions') ? (
                      <TD>
                        <div
                          className="flex min-w-48 flex-wrap items-center gap-1.5"
                          data-client-row-action
                        >
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={(event) => {
                              handleRowActionClick(event)
                              openClientProfile(client)
                            }}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="subtle"
                            onClick={(event) => {
                              handleRowActionClick(event)
                              openClientTaskCreation(client)
                            }}
                          >
                            Add {terms.taskSingular}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={(event) => {
                              handleRowActionClick(event)
                              showPlaceholder(
                                `${terms.customerSingular} messaging will connect to email/SMS soon.`,
                              )
                            }}
                            leftIcon={
                              <MessageSquare
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            }
                          >
                            Message
                          </Button>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                )
              })}
            </TBody>
          </Table>
        ) : (
          <PipelineBoard
            clients={sortedClients}
            tasks={taskRecords}
            onOpenClient={openClientProfile}
            onDragEnd={handlePipelineDragEnd}
          />
        )}
      </Card>

      {!isSimpleService && view === 'table' ? (
        <PipelinePreview clients={clientRecords} />
      ) : null}

      {selectedClient ? (
        <ClientProfileDrawer
          client={selectedClient}
          tasks={taskRecords}
          serviceRequests={requestRecords}
          revenueTransactions={revenueTransactions}
          activityRecords={activityRecords}
          onCreateTask={openClientTaskCreation}
          onCreateRequest={openClientRequestCreation}
          onRecordRevenue={recordClientRevenue}
          onVoidRevenue={voidClientRevenue}
          workspaceOwners={workspaceOwners}
          canEditOwners={canEditOwners}
          workspaceSlug={workspaceSlug}
          onOwnerChange={updateClientOwner}
          onUpdateClient={updateClientRecord}
          onOpenTask={setSelectedTask}
          onOpenRequest={setSelectedRequest}
          onClose={closeClientDrawer}
          onPlaceholder={showPlaceholder}
          terminology={terms}
          isSimpleService={isSimpleService}
          opportunitiesEnabled={opportunitiesEnabled}
          customerTagOptions={customerTagOptions}
          onCreateCustomerTag={quickAddCustomerTag}
        />
      ) : null}

      {selectedTask ? (
        <RelatedTaskDrawer
          task={selectedTask}
          workspaceOwners={workspaceOwners}
          workspaceSlug={workspaceSlug}
          onClose={closeRelatedTaskDrawer}
          onUpdateTask={updateClientTaskRecord}
          onDeleteTask={deleteClientTaskRecord}
          terminology={terms}
        />
      ) : null}

      {selectedRequest ? (
        <RelatedServiceRequestDrawer
          request={selectedRequest}
          workspaceOwners={workspaceOwners}
          workspaceSlug={workspaceSlug}
          onClose={closeRelatedRequestDrawer}
          onUpdateRequest={updateClientServiceRequestRecord}
          onDeleteRequest={deleteClientServiceRequestRecord}
          onPlaceholder={showPlaceholder}
          terminology={terms}
          serviceTypeOptions={serviceRequestTypeOptions}
          onCreateServiceType={quickAddJobType}
        />
      ) : null}

      {addClientOpen ? (
        <AddClientDrawer
          onClose={() => setAddClientOpen(false)}
          onSubmit={() => {
            setAddClientOpen(false)
            showPlaceholder(
              `${terms.customerSingular} creation will connect to the database soon.`,
            )
          }}
          terminology={terms}
        />
      ) : null}

      {taskCreationClient ? (
        <ClientTaskDrawer
          client={taskCreationClient}
          workspaceOwners={workspaceOwners}
          onClose={() => setTaskCreationClient(null)}
          onCreate={createClientTask}
          terminology={terms}
        />
      ) : null}

      {requestCreationClient ? (
        <ClientServiceRequestDrawer
          client={requestCreationClient}
          workspaceOwners={workspaceOwners}
          onClose={() => setRequestCreationClient(null)}
          onCreate={createClientServiceRequest}
          terminology={terms}
          serviceTypeOptions={serviceRequestTypeOptions}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          onCreateServiceType={quickAddJobType}
        />
      ) : null}
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  direction: SortDirection
  onSort: (sortKey: SortKey) => void
}) {
  const isActive = activeSortKey === sortKey
  const indicator = isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1.5 rounded-md text-left transition hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50 ${
        isActive ? 'text-cyan-100' : 'text-neutral-text-secondary'
      }`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="text-[10px]" aria-hidden="true">
        {indicator}
      </span>
    </button>
  )
}

function ClientInitials({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/10 text-xs font-semibold text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/[0.08] dark:text-cyan-100">
      {getClientInitials(name)}
    </span>
  )
}

function PipelinePreview({ clients }: { clients: WorkspaceClient[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fulfillment Preview</CardTitle>
        <CardDescription>
          Stage-level customer counts and delivery value. Pipeline board changes
          are local-only until CRM persistence is connected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {pipelineSummaryStages.map((stage) => {
            const stageClients = clients.filter(
              (client) => client.pipelineStage === stage,
            )
            const totalValue = stageClients.reduce(
              (sum, client) => sum + client.value,
              0,
            )
            return (
              <div
                key={stage}
                className="metric-card-surface rounded-xl border p-3"
              >
                <p className="text-metric min-h-10 text-xs font-medium">
                  {stage}
                </p>
                <p className="text-metric mt-2 text-xl font-semibold">
                  {stageClients.length}
                </p>
                <p className="text-metric-muted mt-1 text-xs">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function PipelineBoard({
  clients,
  tasks,
  onOpenClient,
  onDragEnd,
}: {
  clients: WorkspaceClient[]
  tasks: TaskRecord[]
  onOpenClient: (client: WorkspaceClient) => void
  onDragEnd: (event: DragEndEvent) => void
}) {
  const clientsByStage = useMemo(() => {
    return pipelineSummaryStages.map((stage) => {
      const stageClients = clients.filter(
        (client) => client.pipelineStage === stage,
      )
      const totalValue = stageClients.reduce(
        (sum, client) => sum + client.value,
        0,
      )

      return {
        stage,
        clients: stageClients,
        totalValue,
      }
    })
  }, [clients])

  return (
    <CardContent>
      <DndContext onDragEnd={onDragEnd}>
        <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 -mx-1 flex min-h-[520px] gap-4 overflow-x-auto px-1 pb-3 lg:min-h-[700px] [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar]:h-2">
          {clientsByStage.map(
            ({ stage, clients: stageClients, totalValue }) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                clients={stageClients}
                tasks={tasks}
                totalValue={totalValue}
                onOpenClient={onOpenClient}
              />
            ),
          )}
        </div>
      </DndContext>
    </CardContent>
  )
}

function PipelineColumn({
  stage,
  clients,
  tasks,
  totalValue,
  onOpenClient,
}: {
  stage: PipelineStage
  clients: WorkspaceClient[]
  tasks: TaskRecord[]
  totalValue: number
  onOpenClient: (client: WorkspaceClient) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  })

  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[520px] min-h-[520px] w-[330px] min-w-[320px] shrink-0 flex-col rounded-2xl border bg-slate-950/45 transition lg:max-h-[700px] lg:min-h-[700px] ${
        isOver ? 'border-cyan-300/50 bg-cyan-300/[0.06]' : 'border-slate-800'
      }`}
      aria-label={`${stage} pipeline column`}
    >
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-800/80 bg-slate-950/95 px-3.5 py-3.5 backdrop-blur">
        <h3 className="text-sm font-semibold text-neutral-100">{stage}</h3>
        <p className="mt-1 text-xs font-medium text-cyan-100">
          {clients.length} {clients.length === 1 ? 'client' : 'clients'} •{' '}
          {formatCurrency(totalValue)}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex min-h-0 flex-1 p-3.5">
          <div className="text-neutral-text-secondary flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/35 px-3 py-6 text-center text-xs">
            No clients
          </div>
        </div>
      ) : (
        <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800/80 hover:scrollbar-thumb-cyan-400/50 min-h-0 flex-1 space-y-2 overflow-y-auto p-3.5 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800/80 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
          {clients.map((client) => (
            <PipelineClientCard
              key={client.id}
              client={client}
              tasks={tasks}
              onOpenClient={onOpenClient}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PipelineClientCard({
  client,
  tasks,
  onOpenClient,
}: {
  client: WorkspaceClient
  tasks: TaskRecord[]
  onOpenClient: (client: WorkspaceClient) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: client.id,
    })

  const hiddenTagCount = Math.max(client.tags.length - 2, 0)
  const visibleTags = client.tags.slice(0, 2)
  const taskSummary = getClientTaskSummary(tasks, client.id)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpenClient(client)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpenClient(client)
        }
      }}
      className={`rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-left shadow-sm shadow-black/20 transition-[background-color,border-color,box-shadow,opacity] duration-200 hover:border-cyan-300/40 hover:bg-slate-900/80 hover:shadow-md hover:shadow-cyan-950/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50 ${
        isDragging
          ? 'z-40 cursor-grabbing border-cyan-300/60 opacity-95 shadow-2xl shadow-cyan-950/40'
          : 'cursor-grab'
      }`}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) ${
                isDragging ? 'scale(1.02) rotate(0.5deg)' : ''
              }`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ClientInitials name={client.name} />
          <div className="min-w-0">
            <p className="text-app-primary truncate text-sm font-semibold">
              {client.name}
            </p>
            <p className="text-neutral-text-secondary mt-0.5 truncate text-xs">
              {client.company}
            </p>
          </div>
        </div>
        <p className="bg-app-surface-muted text-app-primary shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold">
          {formatCurrency(client.value)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge size="xs" variant={statusVariant[client.status]}>
          {client.status}
        </Badge>
        <Badge size="xs" variant={healthVariant[client.health]}>
          {client.health}
        </Badge>
      </div>

      <div className="mt-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2.5 py-2">
        <p className="text-neutral-text-secondary text-[10px] font-medium uppercase tracking-wide">
          Next Action
        </p>
        <p className="mt-1 text-xs text-neutral-100">{client.nextAction}</p>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
        <span className="text-neutral-text-secondary">
          {taskSummary.openCount} open{' '}
          {taskSummary.openCount === 1 ? 'task' : 'tasks'}
          {taskSummary.overdueCount > 0
            ? ` • ${taskSummary.overdueCount} overdue`
            : ''}
        </span>
        <span className="text-neutral-text-secondary">
          {formatActivityDate(client.lastActivity)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {visibleTags.map((tag) => (
          <Badge key={tag} size="xs" variant={getClientTagVariant(tag)}>
            {tag}
          </Badge>
        ))}
        {hiddenTagCount > 0 ? (
          <Badge size="xs" variant="slate">
            +{hiddenTagCount}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function ClientProfileDrawer({
  client,
  tasks,
  serviceRequests,
  revenueTransactions,
  activityRecords,
  workspaceOwners,
  canEditOwners,
  workspaceSlug,
  onOwnerChange,
  onUpdateClient,
  onOpenTask,
  onOpenRequest,
  onCreateTask,
  onCreateRequest,
  onRecordRevenue,
  onVoidRevenue,
  onClose,
  onPlaceholder,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  isSimpleService,
  opportunitiesEnabled,
  customerTagOptions,
  onCreateCustomerTag,
}: {
  client: WorkspaceClient
  tasks: TaskRecord[]
  serviceRequests: WorkspaceServiceRequest[]
  revenueTransactions: WorkspaceRevenueTransaction[]
  activityRecords: WorkspaceActivityRecord[]
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  workspaceSlug: string
  onOwnerChange: (clientId: string, ownerId: string) => void
  onUpdateClient: (clientId: string, updates: Partial<WorkspaceClient>) => void
  onOpenTask: (task: TaskRecord) => void
  onOpenRequest: (request: WorkspaceServiceRequest) => void
  onCreateTask: (client: WorkspaceClient) => void
  onCreateRequest: (client: WorkspaceClient) => void
  onRecordRevenue: (input: {
    client: WorkspaceClient
    amount: string
    description: string
    occurredAt: string
    sourceId?: string
  }) => Promise<RevenueMutationResult>
  onVoidRevenue: (
    transaction: WorkspaceRevenueTransaction,
  ) => Promise<RevenueMutationResult>
  onClose: () => void
  onPlaceholder: (message: string) => void
  terminology?: WorkspaceRecordTerminology
  isSimpleService: boolean
  opportunitiesEnabled: boolean
  customerTagOptions: Array<FilterValue<ClientTag>>
  onCreateCustomerTag: (label: string) => { label?: string; error?: string }
}) {
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [revenueFormOpen, setRevenueFormOpen] = useState(false)
  const [revenueAmount, setRevenueAmount] = useState('')
  const [revenueDescription, setRevenueDescription] = useState('')
  const [revenueDate, setRevenueDate] = useState(demoTaskToday)
  const [revenueSourceId, setRevenueSourceId] = useState('')
  const [revenueError, setRevenueError] = useState<string | null>(null)
  const [revenueSaving, setRevenueSaving] = useState(false)
  const [draftEmail, setDraftEmail] = useState(client.email)
  const [draftPhone, setDraftPhone] = useState(client.phone)
  const [draftCompany, setDraftCompany] = useState(client.company)
  const [draftOwnerId, setDraftOwnerId] = useState(client.ownerId)
  const [draftStatus, setDraftStatus] = useState<ClientStatus>(
    client.status === 'Inactive' ? 'Inactive' : 'Active',
  )
  const [draftPipelineStage, setDraftPipelineStage] = useState<PipelineStage>(
    client.pipelineStage,
  )
  const [draftHealth, setDraftHealth] = useState<ClientHealth>(client.health)
  const [draftValue, setDraftValue] = useState(String(client.value))
  const [draftNextAction, setDraftNextAction] = useState(client.nextAction)
  const [draftTags, setDraftTags] = useState<ClientTag[]>(client.tags)
  const [identityVersion, setIdentityVersion] = useState(0)
  const [hasDirtyInlineNotes, setHasDirtyInlineNotes] = useState(false)
  const taskSummary = getClientTaskSummary(tasks, client.id)
  const requestSummary = getClientServiceRequestSummary(
    serviceRequests,
    client.id,
    client.company,
  )
  const customerLifetimeValueCents = getCustomerLifetimeValue({
    workspaceId: client.workspaceId,
    client,
    transactions: revenueTransactions,
    serviceRequests,
  })
  const clientRevenueTransactions = useMemo(
    () =>
      revenueTransactions
        .filter(
          (transaction) =>
            transaction.workspaceId === client.workspaceId &&
            (transaction.clientId === client.id ||
              transaction.customerId === client.id),
        )
        .sort((first, second) =>
          second.occurredAt.localeCompare(first.occurredAt),
        ),
    [client.id, client.workspaceId, revenueTransactions],
  )
  const relatedActivity = useMemo(() => {
    const taskIds = new Set(taskSummary.relatedTasks.map((task) => task.id))
    const requestIds = new Set(
      requestSummary.relatedRequests.map((request) => request.id),
    )
    const staticActivity = client.activity.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      timestamp: item.timestamp,
      category: `${terminology.customerSingular} Activity`,
    }))
    const sharedActivity = getRelatedActivityRecords(activityRecords, {
      clientId: client.id,
      taskIds: Array.from(taskIds),
      serviceRequestIds: Array.from(requestIds),
      companyName: client.company,
      clientName: client.name,
    }).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      category: getWorkspaceActivityCategory(event),
    }))
    const seen = new Set<string>()

    return [...sharedActivity, ...staticActivity]
      .filter((event) => {
        if (seen.has(event.id)) return false
        seen.add(event.id)
        return true
      })
      .sort((first, second) => second.timestamp.localeCompare(first.timestamp))
  }, [
    activityRecords,
    client.activity,
    client.company,
    client.id,
    client.name,
    requestSummary.relatedRequests,
    taskSummary.relatedTasks,
    terminology.customerSingular,
  ])

  const showDrawerPlaceholder = (message: string) => {
    setDrawerMessage(message)
    onPlaceholder(message)
  }

  const requestClose = useCallback(() => {
    if (
      hasDirtyInlineNotes &&
      !window.confirm('Discard unsaved note changes?')
    ) {
      return
    }
    onClose()
  }, [hasDirtyInlineNotes, onClose])

  const contactIdentity = resolveContactIdentity(workspaceSlug, client)
  const relationshipStatus: ClientStatus =
    client.status === 'Inactive' ? 'Inactive' : 'Active'
  void identityVersion

  const saveClientNotes = (nextNotes: string) => {
    upsertContactIdentity(workspaceSlug, {
      ...contactIdentity,
      sharedNotes: nextNotes || undefined,
    })
    setIdentityVersion((current) => current + 1)
    const event = createWorkspaceActivityRecord({
      workspaceId: client.workspaceId,
      recordId: client.id,
      recordType: 'note',
      action: 'noteAdded',
      title: `${terminology.customerSingular} Notes updated`,
      description: `${client.company} shared ${terminology.customerSingular.toLowerCase()} notes were updated.`,
      metadata: {
        clientId: client.id,
        companyName: client.company,
        clientName: client.name,
        sharedContactId: contactIdentity.id,
      },
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
  }

  const saveInternalNotes = (nextNotes: string) => {
    onUpdateClient(client.id, {
      internalNotes: nextNotes,
      notes: nextNotes,
    })
  }

  const submitRevenue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dollarsToCents(revenueAmount) <= 0) {
      setRevenueError('Enter an amount greater than $0.')
      return
    }
    setRevenueSaving(true)
    const result = await onRecordRevenue({
      client,
      amount: revenueAmount,
      description: revenueDescription.trim() || 'Revenue recorded',
      occurredAt: revenueDate,
      sourceId: revenueSourceId || undefined,
    })
    setRevenueSaving(false)
    if (result.error) {
      setRevenueError(result.error)
      return
    }
    setRevenueFormOpen(false)
    setRevenueAmount('')
    setRevenueDescription('')
    setRevenueDate(demoTaskToday)
    setRevenueSourceId('')
    setRevenueError(null)
  }

  useEffect(() => {
    setIsEditing(false)
    setDraftEmail(client.email)
    setDraftPhone(client.phone)
    setDraftCompany(client.company)
    setDraftOwnerId(client.ownerId)
    setDraftStatus(client.status === 'Inactive' ? 'Inactive' : 'Active')
    setDraftPipelineStage(client.pipelineStage)
    setDraftHealth(client.health)
    setDraftValue(String(client.value))
    setDraftNextAction(client.nextAction)
    setDraftTags(client.tags)
  }, [client])

  const cancelEditing = () => {
    setIsEditing(false)
    setDraftEmail(client.email)
    setDraftPhone(client.phone)
    setDraftCompany(client.company)
    setDraftOwnerId(client.ownerId)
    setDraftStatus(client.status === 'Inactive' ? 'Inactive' : 'Active')
    setDraftPipelineStage(client.pipelineStage)
    setDraftHealth(client.health)
    setDraftValue(String(client.value))
    setDraftNextAction(client.nextAction)
    setDraftTags(client.tags)
  }

  const toggleDraftTag = (tag: ClientTag) => {
    setDraftTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    )
  }

  const saveEditing = () => {
    const parsedValue = Number(draftValue)
    onUpdateClient(client.id, {
      email: draftEmail.trim() || client.email,
      phone: draftPhone.trim() || client.phone,
      company: draftCompany.trim() || client.company,
      ownerId: draftOwnerId,
      status: isSimpleService ? draftStatus : client.status,
      pipelineStage: isSimpleService
        ? client.pipelineStage
        : draftPipelineStage,
      health: draftHealth,
      value: isSimpleService
        ? client.value
        : Number.isFinite(parsedValue)
          ? parsedValue
          : client.value,
      nextAction: isSimpleService
        ? client.nextAction
        : draftNextAction.trim() || client.nextAction,
      tags: draftTags,
      lastActivity: getLocalTimestamp(),
    })
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70">
      <button
        type="button"
        aria-label={`Close ${terminology.customerSingular.toLowerCase()} profile`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={requestClose}
      />
      <aside className="drawer-surface flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="drawer-header-surface sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-app-primary text-lg font-semibold">
                  {client.name}
                </h2>
                <Badge
                  variant={
                    statusVariant[
                      isSimpleService
                        ? isEditing
                          ? draftStatus
                          : relationshipStatus
                        : client.status
                    ]
                  }
                >
                  {isSimpleService
                    ? isEditing
                      ? draftStatus
                      : relationshipStatus
                    : client.status}
                </Badge>
                <Badge
                  variant={
                    healthVariant[isEditing ? draftHealth : client.health]
                  }
                >
                  {isEditing ? draftHealth : client.health}
                </Badge>
                {isEditing ? <Badge variant="brand">Editing</Badge> : null}
              </div>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {isEditing ? draftCompany : client.company}
              </p>
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
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  showDrawerPlaceholder(
                    `${terminology.customerSingular} messaging will connect to email/SMS soon.`,
                  )
                }
                leftIcon={
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                }
              >
                Message
              </Button>
              <Button
                type="button"
                size="xs"
                variant="subtle"
                onClick={() => onCreateTask(client)}
              >
                Add {terminology.taskSingular}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="subtle"
                onClick={() => onCreateRequest(client)}
              >
                New {terminology.serviceRequestSingular}
              </Button>
              {isSimpleService ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setRevenueFormOpen((current) => !current)}
                >
                  Record Revenue
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {taskSummary.relatedTasks.length > 0 ? (
                <Button asChild size="xs" variant="outline">
                  <Link
                    href={`/dashboard/${workspaceSlug}/tasks?clientId=${encodeURIComponent(
                      client.id,
                    )}#tasks-workspace`}
                  >
                    Open {terminology.taskPlural}
                  </Link>
                </Button>
              ) : null}
              {requestSummary.relatedRequests.length > 0 ? (
                <Button asChild size="xs" variant="outline">
                  <Link
                    href={`/dashboard/${workspaceSlug}/service-requests?clientId=${encodeURIComponent(
                      client.id,
                    )}#request-queue`}
                  >
                    Open {terminology.serviceRequestPlural}
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() =>
                  showDrawerPlaceholder(
                    `Click ${terminology.customerSingular} Notes or Internal Notes below to add notes.`,
                  )
                }
              >
                Add Note
              </Button>
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
          {revenueFormOpen ? (
            <form
              className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3"
              onSubmit={submitRevenue}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
                    Record Revenue
                  </p>
                  <p className="text-xs text-emerald-100/70">
                    Counts as recognized revenue and this{' '}
                    {terminology.customerSingular.toLowerCase()}&apos;s lifetime
                    value.
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setRevenueFormOpen(false)}
                >
                  Cancel
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueAmount}
                  onChange={(event) => {
                    setRevenueAmount(event.target.value)
                    setRevenueError(null)
                  }}
                  placeholder="Amount"
                  aria-label="Revenue amount"
                  aria-invalid={Boolean(revenueError)}
                />
                <Input
                  type="date"
                  value={revenueDate}
                  onChange={(event) => setRevenueDate(event.target.value)}
                  aria-label="Revenue date"
                />
                <Input
                  value={revenueDescription}
                  onChange={(event) =>
                    setRevenueDescription(event.target.value)
                  }
                  placeholder="Description"
                  aria-label="Revenue description"
                  className="sm:col-span-2"
                />
                <Select
                  value={revenueSourceId}
                  onChange={(event) => setRevenueSourceId(event.target.value)}
                  aria-label={`Related ${terminology.serviceRequestSingular}`}
                  className="sm:col-span-2"
                >
                  <option value="">
                    No related{' '}
                    {terminology.serviceRequestSingular.toLowerCase()}
                  </option>
                  {requestSummary.relatedRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.title}
                    </option>
                  ))}
                </Select>
              </div>
              {revenueError ? (
                <p className="mt-2 text-xs font-medium text-rose-200">
                  {revenueError}
                </p>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button type="submit" size="xs" disabled={revenueSaving}>
                  {revenueSaving ? 'Recording...' : 'Record Revenue'}
                </Button>
              </div>
            </form>
          ) : null}
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-cyan-100">
                Editing {terminology.customerSingular.toLowerCase()}. Changes
                are saved locally for this workspace preview.
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
          <DrawerSection title="Overview">
            <div className="space-y-4">
              <OverviewGroup title="Contact">
                {isEditing ? (
                  <>
                    <EditableField label="Email">
                      <Input
                        value={draftEmail}
                        onChange={(event) => setDraftEmail(event.target.value)}
                      />
                    </EditableField>
                    <EditableField label="Phone">
                      <Input
                        value={draftPhone}
                        onChange={(event) => setDraftPhone(event.target.value)}
                      />
                    </EditableField>
                    <EditableField label="Company">
                      <Input
                        value={draftCompany}
                        onChange={(event) =>
                          setDraftCompany(event.target.value)
                        }
                      />
                    </EditableField>
                    <EditableField label={ownershipLabels.clients.drawer}>
                      <Select
                        value={draftOwnerId}
                        onChange={(event) =>
                          setDraftOwnerId(event.target.value)
                        }
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
                    <InfoItem label="Email" value={client.email} />
                    <InfoItem label="Phone" value={client.phone} />
                    <InfoItem label="Company" value={client.company} />
                    {canEditOwners ? (
                      <EditableOwnerItem
                        label={ownershipLabels.clients.drawer}
                        value={client.ownerId}
                        owners={workspaceOwners}
                        onChange={(ownerId) =>
                          onOwnerChange(client.id, ownerId)
                        }
                      />
                    ) : (
                      <InfoItem
                        label={ownershipLabels.clients.drawer}
                        value={getOwnerName(workspaceOwners, client.ownerId)}
                      />
                    )}
                  </>
                )}
              </OverviewGroup>
              <OverviewGroup title="Health / Status">
                {isEditing ? (
                  <>
                    {isSimpleService ? (
                      <EditableField label="Relationship Status">
                        <Select
                          value={draftStatus}
                          onChange={(event) =>
                            setDraftStatus(event.target.value as ClientStatus)
                          }
                        >
                          {(['Active', 'Inactive'] as ClientStatus[]).map(
                            (status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ),
                          )}
                        </Select>
                      </EditableField>
                    ) : (
                      <EditableField label="Fulfillment Stage">
                        <Select
                          value={draftPipelineStage}
                          onChange={(event) =>
                            setDraftPipelineStage(
                              event.target.value as PipelineStage,
                            )
                          }
                        >
                          {pipelineSummaryStages.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </Select>
                      </EditableField>
                    )}
                    <EditableField label="Health">
                      <Select
                        value={draftHealth}
                        onChange={(event) =>
                          setDraftHealth(event.target.value as ClientHealth)
                        }
                      >
                        {(
                          [
                            'Healthy',
                            'Needs Attention',
                            'At Risk',
                            'Unresponsive',
                          ] as ClientHealth[]
                        ).map((health) => (
                          <option key={health} value={health}>
                            {health}
                          </option>
                        ))}
                      </Select>
                    </EditableField>
                    {isSimpleService ? null : (
                      <>
                        <EditableField label="Value">
                          <Input
                            type="number"
                            min="0"
                            value={draftValue}
                            onChange={(event) =>
                              setDraftValue(event.target.value)
                            }
                          />
                        </EditableField>
                        <EditableField label="Next Action">
                          <Input
                            value={draftNextAction}
                            onChange={(event) =>
                              setDraftNextAction(event.target.value)
                            }
                          />
                        </EditableField>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <InfoItem
                      label={
                        isSimpleService
                          ? 'Relationship Status'
                          : 'Fulfillment Stage'
                      }
                      value={
                        isSimpleService
                          ? relationshipStatus
                          : client.pipelineStage
                      }
                    />
                    <InfoItem label="Health" value={client.health} />
                    {isSimpleService ? null : (
                      <>
                        <InfoItem
                          label="Value"
                          value={formatCurrency(client.value)}
                        />
                        <InfoItem
                          label="Next Action"
                          value={client.nextAction}
                        />
                      </>
                    )}
                  </>
                )}
              </OverviewGroup>
              <OverviewGroup title="Workload">
                <InfoItem
                  label={`Open ${terminology.taskPlural}`}
                  value={taskSummary.openCount.toString()}
                />
                <InfoItem
                  label="Due Today"
                  value={taskSummary.dueTodayCount.toString()}
                />
                <InfoItem
                  label={`Overdue ${terminology.taskPlural}`}
                  value={taskSummary.overdueCount.toString()}
                />
                <InfoItem
                  label={`Upcoming ${terminology.taskPlural}`}
                  value={taskSummary.upcomingCount.toString()}
                />
                <InfoItem
                  label={`Open ${terminology.serviceRequestPlural}`}
                  value={requestSummary.openCount.toString()}
                />
                {isSimpleService ? (
                  <InfoItem
                    label="Lifetime Value"
                    value={formatRevenueCurrency(customerLifetimeValueCents)}
                  />
                ) : null}
                <InfoItem
                  label={`Urgent ${terminology.serviceRequestPlural}`}
                  value={requestSummary.urgentCount.toString()}
                />
                <InfoItem
                  label={`Next Scheduled ${terminology.serviceRequestSingular}`}
                  value={
                    requestSummary.nextScheduledAt
                      ? formatActivityDate(requestSummary.nextScheduledAt)
                      : 'No scheduled requests'
                  }
                />
                <InfoItem
                  label={`Recent ${terminology.taskSingular} Activity`}
                  value={
                    taskSummary.mostRecentActivity ??
                    `No ${terminology.taskSingular.toLowerCase()} activity yet`
                  }
                />
              </OverviewGroup>
            </div>
            {isEditing ? (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                <p className="text-neutral-text-secondary mb-2 text-[11px] font-medium uppercase tracking-wide">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {customerTagOptions
                    .filter((tag): tag is ClientTag => tag !== 'All')
                    .map((tag) => {
                      const selected = draftTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleDraftTag(tag)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                            selected
                              ? 'border-cyan-300/45 bg-cyan-300/[0.12] text-cyan-100'
                              : 'text-neutral-text-secondary border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:text-neutral-100',
                          )}
                        >
                          {tag}
                        </button>
                      )
                    })}
                </div>
                <div className="mt-3">
                  <ConfigurationQuickAdd
                    label={`${terminology.customerSingular} Tag`}
                    addLabel={`Add ${terminology.customerSingular} Tag`}
                    manageLabel={`Manage ${terminology.customerSingular} Tags`}
                    manageHref={`/dashboard/${workspaceSlug}/settings#operations-configuration`}
                    hintId={`${client.workspaceId}:customer-tags:profile`}
                    hintTitle={`${terminology.customerSingular} tags are customizable`}
                    hintBody={`Create tags to organize ${terminology.customerPlural.toLowerCase()} your way.`}
                    onCreate={(label) => {
                      const result = onCreateCustomerTag(label)
                      if (result.label) {
                        setDraftTags((current) =>
                          current.includes(result.label as ClientTag)
                            ? current
                            : [...current, result.label as ClientTag],
                        )
                      }
                      return result
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <Badge key={tag} size="xs" variant={getClientTagVariant(tag)}>
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </DrawerSection>

          {isSimpleService ? (
            <DrawerSection title="Revenue History">
              {clientRevenueTransactions.length ? (
                <div className="space-y-2">
                  {clientRevenueTransactions.map((transaction) => {
                    const relatedRequest = transaction.sourceId
                      ? serviceRequests.find(
                          (request) => request.id === transaction.sourceId,
                        )
                      : null
                    return (
                      <div
                        key={transaction.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-neutral-100">
                              {formatRevenueCurrency(transaction.amountCents)}
                            </p>
                            <p className="text-neutral-text-secondary mt-0.5 text-xs">
                              {formatActivityDate(transaction.occurredAt)} ·{' '}
                              {transaction.description}
                            </p>
                            {relatedRequest ? (
                              <p className="text-neutral-text-secondary mt-0.5 text-xs">
                                Related{' '}
                                {terminology.serviceRequestSingular.toLowerCase()}
                                : {relatedRequest.title}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              size="xs"
                              variant={
                                transaction.status === 'void'
                                  ? 'slate'
                                  : 'green'
                              }
                            >
                              {transaction.status === 'void'
                                ? 'Voided'
                                : 'Recognized'}
                            </Badge>
                            {transaction.status !== 'void' ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={async () => {
                                  const result =
                                    await onVoidRevenue(transaction)
                                  if (result.error) {
                                    showDrawerPlaceholder(result.error)
                                    return
                                  }
                                  showDrawerPlaceholder(
                                    `Revenue ${formatRevenueCurrency(
                                      transaction.amountCents,
                                    )} was voided.`,
                                  )
                                }}
                              >
                                Void
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-neutral-text-secondary text-sm">
                  No explicit revenue records yet.
                </p>
              )}
            </DrawerSection>
          ) : null}

          <NotesCard
            title={`${terminology.customerSingular} Notes`}
            description="Shared throughout the customer relationship."
            value={contactIdentity.sharedNotes}
            onSave={saveClientNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />
          <NotesCard
            title="Internal Notes"
            description={`Only for managing this ${terminology.customerSingular} account.`}
            value={client.internalNotes ?? client.notes}
            onSave={saveInternalNotes}
            onDirtyChange={setHasDirtyInlineNotes}
          />

          <CompactActivityTimeline
            events={relatedActivity.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              timestamp: formatWorkspaceDateTime(item.timestamp),
              category: item.category,
            }))}
          />
          <LinkedRecordsCard
            title="Connected Records"
            records={[
              ...(client.sourceLeadId
                ? [
                    {
                      label: 'Source Lead',
                      value: client.name,
                      helper: `Open the Lead that created this ${terminology.customerSingular} relationship.`,
                      href: `/dashboard/${workspaceSlug}/leads?leadId=${encodeURIComponent(
                        client.sourceLeadId,
                      )}#leads-workspace`,
                    },
                  ]
                : []),
              ...(opportunitiesEnabled && client.sourceOpportunityId
                ? [
                    {
                      label: 'Source Opportunity',
                      value: `${client.company} Opportunity`,
                      helper: `Open the Opportunity connected to this ${terminology.customerSingular}.`,
                      href: `/dashboard/${workspaceSlug}/opportunities?opportunityId=${encodeURIComponent(
                        client.sourceOpportunityId,
                      )}#opportunities-workspace`,
                    },
                  ]
                : []),
              ...(client.sourceSaleId
                ? [
                    {
                      label: 'Source Sale',
                      value: `${client.company} Sale`,
                      helper: `Open the Sale that created this ${terminology.customerSingular}.`,
                      href: `/dashboard/${workspaceSlug}/sales-pipeline?dealId=${encodeURIComponent(
                        client.sourceSaleId,
                      )}`,
                    },
                  ]
                : []),
              ...(taskSummary.relatedTasks.length > 0
                ? [
                    {
                      label: terminology.taskPlural,
                      value: `${taskSummary.relatedTasks.length} related`,
                      helper: `Open related ${terminology.taskPlural} for this ${terminology.customerSingular}.`,
                      href: `/dashboard/${workspaceSlug}/tasks?clientId=${encodeURIComponent(
                        client.id,
                      )}#tasks-workspace`,
                    },
                  ]
                : []),
              ...(requestSummary.relatedRequests.length > 0
                ? [
                    {
                      label: terminology.serviceRequestPlural,
                      value: `${requestSummary.relatedRequests.length} related`,
                      helper: `Open related ${terminology.serviceRequestPlural} for this ${terminology.customerSingular}.`,
                      href: `/dashboard/${workspaceSlug}/service-requests?clientId=${encodeURIComponent(
                        client.id,
                      )}#request-queue`,
                    },
                  ]
                : []),
            ]}
          />

          <DrawerSection title={`Related ${terminology.taskPlural}`}>
            <p className="text-neutral-text-secondary mb-3 text-xs">
              Click a {terminology.taskSingular.toLowerCase()} to preview it, or
              open it in the {terminology.taskPlural} workspace.
            </p>
            {taskSummary.relatedTasks.length > 0 ? (
              <div className="space-y-2">
                {taskSummary.relatedTasks.map((task) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Preview ${terminology.taskSingular.toLowerCase()} ${task.title}`}
                    title={`Preview ${task.title}`}
                    onClick={() => onOpenTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenTask(task)
                      }
                    }}
                    className="block w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] hover:shadow-[0_0_18px_rgba(34,211,238,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-100">
                          {task.title}
                        </p>
                        <p className="text-neutral-text-secondary mt-1 text-xs">
                          Due {task.dueDate} · Assigned to{' '}
                          {getOwnerName(workspaceOwners, task.ownerId)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          size="xs"
                          variant={taskStatusVariant[task.status]}
                        >
                          {task.status}
                        </Badge>
                        <Badge
                          size="xs"
                          variant={taskPriorityVariant[task.priority]}
                        >
                          {task.priority}
                        </Badge>
                        <Badge
                          size="xs"
                          variant={taskSourceVariant[task.source]}
                        >
                          {task.source}
                        </Badge>
                        <Link
                          href={`/dashboard/${workspaceSlug}/tasks?taskId=${encodeURIComponent(
                            task.id,
                          )}#tasks-workspace`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full border border-cyan-300/25 px-2 py-0.5 text-[11px] font-medium text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                          aria-label={`Open ${terminology.taskSingular.toLowerCase()} ${task.title} in the ${terminology.taskPlural} workspace`}
                        >
                          Open in {terminology.taskPlural}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-neutral-100">
                  No {terminology.taskPlural.toLowerCase()} connected to this{' '}
                  {terminology.customerSingular.toLowerCase()} yet.
                </p>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Create the first follow-up, deliverable, or internal action
                  for this account.
                </p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-3"
                  onClick={() => onCreateTask(client)}
                >
                  Create {terminology.customerSingular.toLowerCase()}{' '}
                  {terminology.taskSingular.toLowerCase()}
                </Button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title={`Related ${terminology.serviceRequestPlural}`}>
            <p className="text-neutral-text-secondary mb-3 text-xs">
              Click a {terminology.serviceRequestSingular.toLowerCase()} to
              preview it, or open it in the {terminology.serviceRequestPlural}
              workspace.
            </p>
            {requestSummary.relatedRequests.length > 0 ? (
              <div className="space-y-2">
                {requestSummary.relatedRequests.map((request) => (
                  <div
                    key={request.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Preview ${terminology.serviceRequestSingular.toLowerCase()} ${request.title}`}
                    title={`Preview ${request.title}`}
                    onClick={() => onOpenRequest(request)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenRequest(request)
                      }
                    }}
                    className="block w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-left transition hover:border-violet-300/35 hover:bg-violet-300/[0.05] hover:shadow-[0_0_18px_rgba(139,92,246,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-100">
                          {request.title}
                        </p>
                        <p className="text-neutral-text-secondary mt-1 text-xs">
                          {request.scheduledFor
                            ? `Scheduled ${formatActivityDate(request.scheduledFor)}`
                            : 'Not scheduled'}{' '}
                          · Assigned to{' '}
                          {getOwnerName(
                            workspaceOwners,
                            request.assignedToOwnerId,
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          size="xs"
                          variant={serviceRequestStatusVariant[request.status]}
                        >
                          {request.status}
                        </Badge>
                        <Badge
                          size="xs"
                          variant={
                            serviceRequestPriorityVariant[request.priority]
                          }
                        >
                          {request.priority}
                        </Badge>
                        <Badge
                          size="xs"
                          variant="default"
                          className={getServiceRequestTypeBadgeClass(
                            request.serviceType,
                          )}
                        >
                          {request.serviceType}
                        </Badge>
                        <Link
                          href={`/dashboard/${workspaceSlug}/service-requests?requestId=${encodeURIComponent(
                            request.id,
                          )}#request-queue`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full border border-violet-300/25 px-2 py-0.5 text-[11px] font-medium text-violet-100 transition hover:border-violet-200/60 hover:bg-violet-300/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                          aria-label={`Open ${terminology.serviceRequestSingular.toLowerCase()} ${request.title} in the ${terminology.serviceRequestPlural} workspace`}
                        >
                          Open in {terminology.serviceRequestPlural}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-neutral-100">
                  No {terminology.serviceRequestPlural.toLowerCase()} connected
                  to this {terminology.customerSingular.toLowerCase()} yet.
                </p>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Create the first support, fulfillment, or field{' '}
                  {terminology.serviceRequestSingular.toLowerCase()} for this
                  account.
                </p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-3"
                  onClick={() => onCreateRequest(client)}
                >
                  Create {terminology.serviceRequestSingular.toLowerCase()}
                </Button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Automations">
            <div className="grid gap-2 sm:grid-cols-3">
              {client.suggestedAutomations.map((automation) => (
                <div
                  key={automation}
                  className="rounded-xl border border-violet-300/15 bg-violet-300/[0.05] p-3"
                >
                  <p className="text-sm font-medium text-neutral-100">
                    {automation}
                  </p>
                </div>
              ))}
            </div>
          </DrawerSection>

          {opportunitiesEnabled ? (
            <DrawerSection title="Opportunities">
              <div className="grid gap-3 sm:grid-cols-4">
                <InfoItem
                  label="Current Value"
                  value={formatCurrency(client.opportunity.value)}
                />
                <InfoItem
                  label="Next Action"
                  value={client.nextAction || client.opportunity.nextAction}
                />
                <InfoItem
                  label="Probability"
                  value={`${client.opportunity.probability}%`}
                />
                <InfoItem
                  label="Expected Close"
                  value={client.opportunity.expectedCloseWindow}
                />
              </div>
            </DrawerSection>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function RelatedTaskDrawer({
  task,
  workspaceOwners,
  workspaceSlug,
  onClose,
  onUpdateTask,
  onDeleteTask,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  task: TaskRecord
  workspaceOwners: WorkspaceOwner[]
  workspaceSlug: string
  onClose: () => void
  onUpdateTask: (taskId: string, updates: Partial<TaskRecord>) => void
  onDeleteTask: (task: TaskRecord) => void
  terminology?: WorkspaceRecordTerminology
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftDescription, setDraftDescription] = useState(task.description)
  const [draftNotes, setDraftNotes] = useState(task.notes)
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(
    task.priority,
  )
  const [draftStatus, setDraftStatus] = useState<TaskStatus>(task.status)
  const [draftOwnerId, setDraftOwnerId] = useState(task.ownerId)
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate)

  useEffect(() => {
    setIsEditing(false)
    setDraftTitle(task.title)
    setDraftDescription(task.description)
    setDraftNotes(task.notes)
    setDraftPriority(task.priority)
    setDraftStatus(task.status)
    setDraftOwnerId(task.ownerId)
    setDraftDueDate(task.dueDate)
  }, [task])

  const cancelEditing = () => {
    setIsEditing(false)
    setDraftTitle(task.title)
    setDraftDescription(task.description)
    setDraftNotes(task.notes)
    setDraftPriority(task.priority)
    setDraftStatus(task.status)
    setDraftOwnerId(task.ownerId)
    setDraftDueDate(task.dueDate)
  }

  const saveEditing = () => {
    onUpdateTask(task.id, {
      title: draftTitle.trim() || task.title,
      description: draftDescription.trim(),
      notes: draftNotes.trim(),
      priority: draftPriority,
      status: draftStatus,
      ownerId: draftOwnerId,
      assignedOwner: getOwnerName(workspaceOwners, draftOwnerId),
      dueDate: draftDueDate,
    })
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close ${terminology.taskSingular.toLowerCase()} details`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isEditing
                  ? `Editing ${terminology.taskSingular.toLowerCase()}`
                  : task.title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {task.relatedRecordLabel}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={
                    taskStatusVariant[isEditing ? draftStatus : task.status]
                  }
                >
                  {isEditing ? draftStatus : task.status}
                </Badge>
                <Badge
                  variant={
                    taskPriorityVariant[
                      isEditing ? draftPriority : task.priority
                    ]
                  }
                >
                  {isEditing ? draftPriority : task.priority}
                </Badge>
                <Badge variant={taskSourceVariant[task.source]}>
                  {task.source}
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
              {task.id ? (
                <Link
                  href={`/dashboard/${workspaceSlug}/tasks?taskId=${encodeURIComponent(
                    task.id,
                  )}#tasks-workspace`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.05] px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Open in {terminology.taskPlural}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-cyan-100">
                Editing this {terminology.taskSingular.toLowerCase()}. Changes
                are stored locally for this workspace session.
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
          <DrawerSection title={`${terminology.taskSingular} Details`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {isEditing ? (
                <>
                  <EditableField label={`${terminology.taskSingular} Title`}>
                    <Input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                    />
                  </EditableField>
                  <EditableField label="Status">
                    <Select
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatus(event.target.value as TaskStatus)
                      }
                    >
                      {(
                        [
                          'Open',
                          'In Progress',
                          'Waiting',
                          'Completed',
                          'Canceled',
                        ] as TaskStatus[]
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Priority">
                    <Select
                      value={draftPriority}
                      onChange={(event) =>
                        setDraftPriority(event.target.value as TaskPriority)
                      }
                    >
                      {(
                        ['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label={ownershipLabels.tasks.drawer}>
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
                  <EditableField label="Due Date">
                    <Input
                      type="date"
                      value={draftDueDate}
                      onChange={(event) => setDraftDueDate(event.target.value)}
                    />
                  </EditableField>
                </>
              ) : (
                <>
                  <InfoItem label="Status" value={task.status} />
                  <InfoItem label="Priority" value={task.priority} />
                  <InfoItem
                    label={ownershipLabels.tasks.drawer}
                    value={getOwnerName(workspaceOwners, task.ownerId)}
                  />
                  <InfoItem label="Due Date" value={task.dueDate} />
                </>
              )}
              <InfoItem
                label="Created Date"
                value={formatWorkspaceDateTime(task.createdAt)}
              />
              <InfoItem label="Source" value={task.source} />
              <InfoItem
                label={terminology.customerSingular}
                value={task.relatedRecordLabel}
              />
              <InfoItem label="Estimated Time" value={task.estimatedTime} />
            </div>
          </DrawerSection>

          <DrawerSection title="Details">
            {isEditing ? (
              <div className="space-y-3">
                <DrawerTextareaField
                  label="Description"
                  value={draftDescription}
                  onChange={setDraftDescription}
                  heightClassName="h-[120px]"
                />
                <DrawerTextareaField
                  label="Notes"
                  value={draftNotes}
                  onChange={setDraftNotes}
                  heightClassName="h-[100px]"
                />
              </div>
            ) : (
              <TaskDescriptionContent task={task} />
            )}
          </DrawerSection>

          <DrawerSection title="Activity Timeline">
            <div className="space-y-3">
              {task.timeline.map((item) => (
                <div
                  key={`${item.title}-${item.timestamp}`}
                  className="flex gap-3"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {item.title}
                    </p>
                    <p className="text-neutral-text-secondary text-xs">
                      {item.detail}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-[11px]">
                      {formatWorkspaceDateTime(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    task.status === 'Completed'
                      ? onUpdateTask(task.id, {
                          status: 'Open',
                          completedAt: undefined,
                        })
                      : onUpdateTask(task.id, {
                          status: 'Completed',
                          completedAt: demoTaskToday,
                          actualTime: task.actualTime ?? task.estimatedTime,
                        })
                  }
                >
                  {task.status === 'Completed'
                    ? `Reopen ${terminology.taskSingular}`
                    : `Complete ${terminology.taskSingular}`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Reassign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Reschedule
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => onDeleteTask(task)}
                >
                  Delete {terminology.taskSingular}
                </Button>
              </div>
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
            </div>
          </DrawerSection>
        </div>
      </aside>
    </div>
  )
}

function RelatedServiceRequestDrawer({
  request,
  workspaceOwners,
  workspaceSlug,
  onClose,
  onUpdateRequest,
  onDeleteRequest,
  onPlaceholder,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  serviceTypeOptions,
  onCreateServiceType,
}: {
  request: WorkspaceServiceRequest
  workspaceOwners: WorkspaceOwner[]
  workspaceSlug: string
  onClose: () => void
  onUpdateRequest: (
    requestId: string,
    updates: Partial<WorkspaceServiceRequest>,
  ) => void
  onDeleteRequest: (request: WorkspaceServiceRequest) => void
  onPlaceholder: (message: string) => void
  terminology?: WorkspaceRecordTerminology
  serviceTypeOptions: ServiceRequestType[]
  onCreateServiceType: (label: string) => { label?: string; error?: string }
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(request.title)
  const [draftDescription, setDraftDescription] = useState(request.description)
  const [draftNotes, setDraftNotes] = useState(request.notes)
  const [draftPriority, setDraftPriority] = useState<ServiceRequestPriority>(
    request.priority,
  )
  const [draftStatus, setDraftStatus] = useState<ServiceRequestStatus>(
    request.status,
  )
  const [draftServiceType, setDraftServiceType] = useState<ServiceRequestType>(
    request.serviceType,
  )
  const [draftOwnerId, setDraftOwnerId] = useState(request.assignedToOwnerId)
  const [draftValue, setDraftValue] = useState(
    request.valueCents ? String(request.valueCents / 100) : '',
  )
  const [draftScheduledFor, setDraftScheduledFor] = useState(
    request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
  )

  useEffect(() => {
    setIsEditing(false)
    setDraftTitle(request.title)
    setDraftDescription(request.description)
    setDraftNotes(request.notes)
    setDraftPriority(request.priority)
    setDraftStatus(request.status)
    setDraftServiceType(request.serviceType)
    setDraftOwnerId(request.assignedToOwnerId)
    setDraftValue(request.valueCents ? String(request.valueCents / 100) : '')
    setDraftScheduledFor(
      request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
    )
  }, [request])

  const cancelEditing = () => {
    setIsEditing(false)
    setDraftTitle(request.title)
    setDraftDescription(request.description)
    setDraftNotes(request.notes)
    setDraftPriority(request.priority)
    setDraftStatus(request.status)
    setDraftServiceType(request.serviceType)
    setDraftOwnerId(request.assignedToOwnerId)
    setDraftValue(request.valueCents ? String(request.valueCents / 100) : '')
    setDraftScheduledFor(
      request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
    )
  }

  const saveEditing = () => {
    onUpdateRequest(request.id, {
      title: draftTitle.trim() || request.title,
      description: draftDescription.trim(),
      notes: draftNotes.trim(),
      priority: draftPriority,
      status: draftStatus,
      serviceType: draftServiceType,
      valueCents: dollarsToCents(draftValue),
      currency: request.currency || 'USD',
      assignedToOwnerId: draftOwnerId,
      scheduledFor: draftScheduledFor
        ? new Date(draftScheduledFor).toISOString()
        : null,
    })
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close ${terminology.serviceRequestSingular.toLowerCase()} preview`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isEditing
                  ? `Editing ${terminology.serviceRequestSingular.toLowerCase()}`
                  : request.title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {request.customerName} - {request.company}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={
                    serviceRequestStatusVariant[
                      isEditing ? draftStatus : request.status
                    ]
                  }
                >
                  {isEditing ? draftStatus : request.status}
                </Badge>
                <Badge
                  variant={
                    serviceRequestPriorityVariant[
                      isEditing ? draftPriority : request.priority
                    ]
                  }
                >
                  {isEditing ? draftPriority : request.priority}
                </Badge>
                <Badge
                  variant="default"
                  className={getServiceRequestTypeBadgeClass(
                    isEditing ? draftServiceType : request.serviceType,
                  )}
                >
                  {isEditing ? draftServiceType : request.serviceType}
                </Badge>
                {isEditing ? <Badge variant="brand">Editing</Badge> : null}
                <Badge variant="slate">
                  Preview {terminology.serviceRequestSingular.toLowerCase()}
                </Badge>
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
              {request.id ? (
                <Link
                  href={`/dashboard/${workspaceSlug}/service-requests?requestId=${encodeURIComponent(
                    request.id,
                  )}#request-queue`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg border border-violet-300/25 bg-violet-300/[0.05] px-3 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-200/60 hover:bg-violet-300/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                >
                  Open in {terminology.serviceRequestPlural}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-300/20 bg-violet-300/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-violet-100">
                Editing this {terminology.serviceRequestSingular.toLowerCase()}.
                Changes are stored locally for this workspace session.
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
          <DrawerSection
            title={`${terminology.serviceRequestSingular} Details`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {isEditing ? (
                <>
                  <EditableField
                    label={`${terminology.serviceRequestSingular} Title`}
                  >
                    <Input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                    />
                  </EditableField>
                  <EditableField
                    label={`${terminology.serviceRequestSingular} Type`}
                  >
                    <Select
                      value={draftServiceType}
                      onChange={(event) =>
                        setDraftServiceType(
                          event.target.value as ServiceRequestType,
                        )
                      }
                    >
                      {serviceTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                    <div className="mt-3">
                      <ConfigurationQuickAdd
                        label={`${terminology.serviceRequestSingular} Type`}
                        addLabel={`Add ${terminology.serviceRequestSingular} Type`}
                        manageLabel={`Manage ${terminology.serviceRequestSingular} Types`}
                        manageHref={`/dashboard/${workspaceSlug}/settings#operations-configuration`}
                        hintId={`${request.workspaceId}:job-types:related-drawer`}
                        hintTitle={`${terminology.serviceRequestSingular} types are customizable`}
                        hintBody={`Add or manage ${terminology.serviceRequestPlural.toLowerCase()} types without leaving this edit.`}
                        onCreate={(label) => {
                          const result = onCreateServiceType(label)
                          if (result.label) {
                            setDraftServiceType(
                              result.label as ServiceRequestType,
                            )
                          }
                          return result
                        }}
                      />
                    </div>
                  </EditableField>
                  <EditableField label="Priority">
                    <Select
                      value={draftPriority}
                      onChange={(event) =>
                        setDraftPriority(
                          event.target.value as ServiceRequestPriority,
                        )
                      }
                    >
                      {(
                        [
                          'Low',
                          'Normal',
                          'High',
                          'Urgent',
                        ] as ServiceRequestPriority[]
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Status">
                    <Select
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatus(
                          event.target.value as ServiceRequestStatus,
                        )
                      }
                    >
                      {(
                        [
                          'New',
                          'Scheduled',
                          'In Progress',
                          'Waiting On Client',
                          'Completed',
                          'Cancelled',
                        ] as ServiceRequestStatus[]
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </EditableField>
                  <EditableField label="Amount">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                    />
                  </EditableField>
                </>
              ) : (
                <>
                  <InfoItem
                    label={`${terminology.serviceRequestSingular} Type`}
                    value={request.serviceType}
                  />
                  <InfoItem label="Priority" value={request.priority} />
                  <InfoItem label="Status" value={request.status} />
                  <InfoItem
                    label="Amount"
                    value={
                      request.valueCents
                        ? formatRevenueCurrency(request.valueCents)
                        : 'No amount set'
                    }
                  />
                </>
              )}
              <InfoItem
                label="Created"
                value={formatWorkspaceDateTime(request.createdAt)}
              />
            </div>
          </DrawerSection>

          <DrawerSection title="Details">
            {isEditing ? (
              <div className="space-y-3">
                <DrawerTextareaField
                  label="Description"
                  value={draftDescription}
                  onChange={setDraftDescription}
                  heightClassName="h-[120px]"
                />
                <DrawerTextareaField
                  label="Notes"
                  value={draftNotes}
                  onChange={setDraftNotes}
                  heightClassName="h-[100px]"
                />
              </div>
            ) : (
              <div className="space-y-3 text-sm leading-6 text-neutral-100">
                <p>
                  {request.description ||
                    `No ${terminology.serviceRequestSingular.toLowerCase()} details added.`}
                </p>
                {request.notes ? (
                  <p className="text-neutral-text-secondary">{request.notes}</p>
                ) : null}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Scheduling">
            <div className="grid gap-3 sm:grid-cols-2">
              {isEditing ? (
                <>
                  <EditableField label={ownershipLabels.serviceRequests.drawer}>
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
                  <EditableField label="Scheduled">
                    <Input
                      type="datetime-local"
                      value={draftScheduledFor}
                      onChange={(event) =>
                        setDraftScheduledFor(event.target.value)
                      }
                    />
                  </EditableField>
                </>
              ) : (
                <>
                  <InfoItem
                    label={ownershipLabels.serviceRequests.drawer}
                    value={getOwnerName(
                      workspaceOwners,
                      request.assignedToOwnerId,
                    )}
                  />
                  <InfoItem
                    label="Scheduled"
                    value={
                      request.scheduledFor
                        ? formatActivityDate(request.scheduledFor)
                        : 'Not scheduled'
                    }
                  />
                </>
              )}
              <InfoItem
                label="Estimated Duration"
                value={request.estimatedDuration}
              />
            </div>
          </DrawerSection>

          <DrawerSection title="Timeline">
            <div className="space-y-3">
              {request.timeline.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-violet-300" />
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {item.label}
                    </p>
                    <p className="text-neutral-text-secondary text-xs">
                      {item.description}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-[11px]">
                      {formatWorkspaceDateTime(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <DrawerActionGroup label="Primary">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    request.status === 'Completed'
                      ? onUpdateRequest(request.id, {
                          status: 'New',
                          completedAt: null,
                          timeline: [
                            ...request.timeline,
                            {
                              id: `${request.id}-reopened-${Date.now()}`,
                              label: 'Reopened',
                              timestamp: getLocalTimestamp(),
                              description:
                                'Reopened in the client preview drawer.',
                            },
                          ],
                        })
                      : onUpdateRequest(request.id, {
                          status: 'Completed',
                          completedAt: getLocalTimestamp(),
                          timeline: [
                            ...request.timeline,
                            {
                              id: `${request.id}-completed-${Date.now()}`,
                              label: 'Completed',
                              timestamp: getLocalTimestamp(),
                              description:
                                'Marked complete in the client preview drawer.',
                            },
                          ],
                        })
                  }
                >
                  {request.status === 'Completed'
                    ? `Reopen ${terminology.serviceRequestSingular}`
                    : `Mark ${terminology.serviceRequestSingular} Complete`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="subtle"
                  onClick={() =>
                    onPlaceholder(
                      `${terminology.customerSingular} messaging will connect soon.`,
                    )
                  }
                >
                  Message {terminology.customerSingular}
                </Button>
              </DrawerActionGroup>
              <DrawerActionGroup label="Manage">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Reassign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Reschedule
                </Button>
              </DrawerActionGroup>
              <DrawerActionGroup label="Automation">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onPlaceholder('Automation creation will connect soon.')
                  }
                >
                  Create Automation
                </Button>
              </DrawerActionGroup>
              <DrawerActionGroup label="Danger">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => onDeleteRequest(request)}
                >
                  Delete {terminology.serviceRequestSingular}
                </Button>
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
              <p className="text-neutral-text-secondary text-xs">
                Request changes are stored locally for this workspace preview.
              </p>
            </div>
          </DrawerSection>
        </div>
      </aside>
    </div>
  )
}

function TaskDescriptionContent({ task }: { task: TaskRecord }) {
  const description = task.description.trim()
  const notes = task.notes.trim()
  const showNotes = notes && notes !== description

  if (!description && !notes) {
    return (
      <div className="text-neutral-text-secondary rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-4 text-sm">
        No task details added.
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-neutral-100">
      {description ? <p>{description}</p> : null}
      {showNotes ? (
        <p className="text-neutral-text-secondary">{notes}</p>
      ) : null}
    </div>
  )
}

function ClientTaskDrawer({
  client,
  workspaceOwners,
  onClose,
  onCreate,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  client: WorkspaceClient
  workspaceOwners: WorkspaceOwner[]
  onClose: () => void
  onCreate: (client: WorkspaceClient, task: TaskRecord) => void
  terminology?: WorkspaceRecordTerminology
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const defaultOwnerId = activeOwners[0]?.id ?? client.ownerId
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('2026-07-01')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [ownerId, setOwnerId] = useState(defaultOwnerId)
  const [notes, setNotes] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const titleIsValid = title.trim().length > 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const taskTitle = title.trim()
    if (!taskTitle) {
      setTitleError(`${terminology.taskSingular} title is required.`)
      return
    }

    const createdTask: TaskRecord = {
      id: `task-client-${client.id}-${Date.now()}`,
      workspaceId: client.workspaceId,
      title: taskTitle,
      status,
      priority,
      relatedRecord: client.company,
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: client.id,
      relatedRecordLabel: client.company,
      clientId: client.id,
      clientName: client.company,
      dueDate,
      ownerId,
      assignedOwner: getOwnerName(workspaceOwners, ownerId),
      source: 'Client',
      createdAt: demoTaskToday,
      estimatedTime: '30 min',
      description:
        notes.trim() ||
        `${terminology.customerSingular} ${terminology.taskSingular.toLowerCase()} created from ${client.company}'s account context.`,
      notes:
        notes.trim() ||
        'Preview-only task. Production persistence will connect this to workspace task workflows.',
      timeline: [
        {
          title: `${terminology.taskSingular} created`,
          detail: `Created from ${client.company}'s ${terminology.customerSingular.toLowerCase()} profile.`,
          timestamp: `${demoTaskToday} 9:00 AM`,
          tone: 'cyan',
        },
        {
          title: `Assigned to ${getOwnerName(workspaceOwners, ownerId)}`,
          detail: 'Owner selected during client task creation.',
          timestamp: `${demoTaskToday} 9:01 AM`,
          tone: 'purple',
        },
      ],
    }

    onCreate(client, createdTask)
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close create ${terminology.customerSingular.toLowerCase()} ${terminology.taskSingular.toLowerCase()} drawer`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                Create {terminology.customerSingular} {terminology.taskSingular}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Prefilled for {client.company}. {terminology.taskSingular}{' '}
                creation is preview-only until persistence is connected.
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
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          onSubmit={handleSubmit}
        >
          <div className="text-neutral-text-secondary flex flex-wrap items-center gap-2 text-xs">
            <Badge size="xs" variant="slate">
              Local preview {terminology.taskSingular.toLowerCase()}
            </Badge>
            <span>Database persistence will be connected next.</span>
          </div>
          <Input
            value={client.company}
            readOnly
            aria-label={terminology.customerSingular}
            className="opacity-80"
          />
          <Input
            value="Client"
            readOnly
            aria-label={`${terminology.taskSingular} source`}
            className="opacity-80"
          />
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (titleError) setTitleError(null)
            }}
            placeholder={`${terminology.taskSingular} title`}
            aria-label={`${terminology.taskSingular} title`}
            aria-invalid={Boolean(titleError)}
          />
          {titleError ? (
            <p className="-mt-2 text-xs font-medium text-rose-300">
              {titleError}
            </p>
          ) : null}
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={`Notes or ${terminology.taskSingular.toLowerCase()} details`}
            aria-label={`${terminology.taskSingular} notes`}
            rows={4}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority)
              }
              aria-label="Priority"
            >
              {(['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]).map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ),
              )}
            </Select>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              aria-label="Status"
            >
              {(
                [
                  'Open',
                  'In Progress',
                  'Waiting',
                  'Completed',
                  'Canceled',
                ] as TaskStatus[]
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              aria-label={ownershipLabels.tasks.drawer}
            >
              {activeOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="Due date"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!titleIsValid}>
              Create {terminology.taskSingular}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function ClientServiceRequestDrawer({
  client,
  workspaceOwners,
  workspaceSlug,
  workspaceId,
  onClose,
  onCreate,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  serviceTypeOptions,
  onCreateServiceType,
}: {
  client: WorkspaceClient
  workspaceOwners: WorkspaceOwner[]
  workspaceSlug: string
  workspaceId: string
  onClose: () => void
  onCreate: (client: WorkspaceClient, request: WorkspaceServiceRequest) => void
  terminology?: WorkspaceRecordTerminology
  serviceTypeOptions: ServiceRequestType[]
  onCreateServiceType: (label: string) => { label?: string; error?: string }
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const defaultOwnerId = activeOwners[0]?.id ?? client.ownerId
  const [title, setTitle] = useState('')
  const [serviceType, setServiceType] = useState<ServiceRequestType>(
    serviceTypeOptions[0] ?? 'Service Call',
  )
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ServiceRequestPriority>('Normal')
  const [status, setStatus] = useState<ServiceRequestStatus>('New')
  const [amount, setAmount] = useState('')
  const [ownerId, setOwnerId] = useState(defaultOwnerId)
  const [scheduledFor, setScheduledFor] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const titleIsValid = title.trim().length > 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const requestTitle = title.trim()
    if (!requestTitle) {
      setTitleError(`${terminology.serviceRequestSingular} title is required.`)
      return
    }

    const ownerName = getOwnerName(workspaceOwners, ownerId)
    onCreate(
      client,
      createWorkspaceServiceRequestFromClient({
        client,
        title: requestTitle,
        description,
        serviceType,
        priority,
        status,
        valueCents: dollarsToCents(amount),
        currency: 'USD',
        ownerId,
        ownerName,
        scheduledFor: scheduledFor
          ? new Date(scheduledFor).toISOString()
          : null,
        source: 'Client',
        terminology,
      }),
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close create ${terminology.serviceRequestSingular.toLowerCase()} drawer`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                Create {terminology.serviceRequestSingular}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Prefilled for {client.company}.{' '}
                {terminology.serviceRequestPlural} are saved locally in this
                workspace preview.
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
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          onSubmit={handleSubmit}
        >
          <div className="text-neutral-text-secondary flex flex-wrap items-center gap-2 text-xs">
            <Badge size="xs" variant="slate">
              Preview {terminology.serviceRequestSingular.toLowerCase()}
            </Badge>
            <span>Changes are stored locally for this workspace session.</span>
          </div>
          <Input
            value={client.company}
            readOnly
            aria-label={terminology.customerSingular}
            className="opacity-80"
          />
          <Input
            value="Client"
            readOnly
            aria-label={`${terminology.serviceRequestSingular} source`}
            className="opacity-80"
          />
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (titleError) setTitleError(null)
            }}
            placeholder={`${terminology.serviceRequestSingular} title`}
            aria-label={`${terminology.serviceRequestSingular} title`}
            aria-invalid={Boolean(titleError)}
          />
          {titleError ? (
            <p className="-mt-2 text-xs font-medium text-rose-300">
              {titleError}
            </p>
          ) : null}
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={`Description or ${terminology.serviceRequestSingular.toLowerCase()} details`}
            aria-label={`${terminology.serviceRequestSingular} details`}
            rows={4}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={serviceType}
              onChange={(event) =>
                setServiceType(event.target.value as ServiceRequestType)
              }
              aria-label={`${terminology.serviceRequestSingular} type`}
            >
              {serviceTypeOptions.length ? (
                serviceTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              ) : (
                <option value="">
                  No {terminology.serviceRequestSingular.toLowerCase()} types
                  yet
                </option>
              )}
            </Select>
            <Select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as ServiceRequestPriority)
              }
              aria-label="Priority"
            >
              {(
                ['Low', 'Normal', 'High', 'Urgent'] as ServiceRequestPriority[]
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ServiceRequestStatus)
              }
              aria-label="Status"
            >
              {(
                [
                  'New',
                  'Scheduled',
                  'In Progress',
                  'Waiting On Client',
                  'Completed',
                ] as ServiceRequestStatus[]
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <ConfigurationQuickAdd
                label={`${terminology.serviceRequestSingular} Type`}
                addLabel={`Add ${terminology.serviceRequestSingular} Type`}
                manageLabel={`Manage ${terminology.serviceRequestSingular} Types`}
                manageHref={`/dashboard/${workspaceSlug}/settings#operations-configuration`}
                hintId={`${workspaceId}:job-types:client-create`}
                hintTitle={`${terminology.serviceRequestSingular} types are customizable`}
                hintBody={`Create ${terminology.serviceRequestSingular.toLowerCase()} types that match the services your business performs.`}
                onCreate={(label) => {
                  const result = onCreateServiceType(label)
                  if (result.label) {
                    setServiceType(result.label as ServiceRequestType)
                  }
                  return result
                }}
              />
            </div>
            <Select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              aria-label={ownershipLabels.serviceRequests.drawer}
            >
              {activeOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label={`${terminology.serviceRequestSingular} amount`}
              placeholder="Amount"
            />
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              aria-label="Scheduled date and time"
              className="sm:col-span-2"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!titleIsValid}>
              Create {terminology.serviceRequestSingular}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function AddClientDrawer({
  onClose,
  onSubmit,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  onClose: () => void
  onSubmit: () => void
  terminology?: WorkspaceRecordTerminology
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close add ${terminology.customerSingular.toLowerCase()} drawer`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Add {terminology.customerSingular}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Create a {terminology.customerSingular.toLowerCase()} record for
                this workspace.
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
        </div>
        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <Input
            placeholder="Name"
            aria-label={`${terminology.customerSingular} name`}
          />
          <Input placeholder="Company" aria-label="Company" />
          <Input placeholder="Email" type="email" aria-label="Email" />
          <Input placeholder="Phone" aria-label="Phone" />
          <Select defaultValue="Active" aria-label="Status">
            {statusOptions
              .filter((option) => option !== 'All')
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </Select>
          <Select defaultValue="Onboarding" aria-label="Fulfillment stage">
            {pipelineStageOptions
              .filter((option) => option !== 'All')
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </Select>
          <Input
            placeholder="Tags, separated by commas"
            aria-label={`${terminology.customerSingular} tags`}
          />
          <Textarea placeholder="Notes" aria-label="Notes" />
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create {terminology.customerSingular}</Button>
          </div>
        </form>
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

function EditableField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="drawer-panel-muted rounded-xl border p-3">
      <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function OverviewGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-neutral-text-secondary mb-2 text-[11px] font-semibold uppercase tracking-wide">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function DrawerTextareaField({
  label,
  value,
  onChange,
  heightClassName,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  heightClassName: string
}) {
  return (
    <label className="block space-y-2">
      <span className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('min-h-0 resize-none', heightClassName)}
      />
    </label>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <p className="text-neutral-text-secondary text-[11px]">{label}</p>
      <p className="text-app-primary mt-1 text-sm font-medium">{value}</p>
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
    <label className="drawer-panel-muted rounded-xl border p-3">
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
