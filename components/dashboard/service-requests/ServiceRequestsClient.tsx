'use client'

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
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
import { Textarea } from '@/components/ui/Textarea'
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
  InsightAreaChart,
  InsightBarChart,
  LinkedRecordsCard,
  RecommendedActionsCard,
  SavedViewTabs,
  SignalMatrix,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { cn } from '@/lib/utils'
import {
  formatWorkspaceDateTime,
  getLocalTimestamp,
} from '@/lib/formatting/dates'
import { dollarsToCents, formatRevenueCurrency } from '@/lib/revenue/money'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import type {
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
  WorkspaceServiceRequest,
} from '@/lib/service-requests/types'
import type { WorkspaceClient } from '@/lib/clients/types'
import { createWorkspaceServiceRequestFromClient } from '@/lib/service-requests/createServiceRequest'
import { getServiceRequestTypeOptions } from '@/lib/service-requests/serviceRequestTypeRegistry'
import {
  getPreviewServiceRequestTypes,
  createPreviewServiceRequestType,
} from '@/lib/service-requests/previewServiceRequestTypeStorage'
import {
  appendPreviewServiceRequest,
  mergeServiceRequestRecords,
  readPreviewServiceRequests,
  removePreviewServiceRequest,
  upsertPreviewServiceRequest,
} from '@/lib/service-requests/previewServiceRequestStorage'
import {
  mergeClientRecords,
  readPreviewClients,
} from '@/lib/clients/previewClientStorage'
import {
  createMockWorkspaceTasks,
  type TaskRecord,
} from '@/lib/tasks/demoTasks'
import {
  mergeTaskRecords,
  readPreviewTasks,
} from '@/lib/tasks/previewTaskStorage'
import {
  getOpenWorkItems,
  getWorkItemChecklistProgress,
  getWorkItemsForParent,
} from '@/lib/tasks/workItems'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { updateServiceRequestRecordWithRules } from '@/lib/workspace-records/crmMutations'
import {
  getOpenServiceRequests,
  getScheduledTodayOpenServiceRequests,
  getUrgentOpenServiceRequests,
} from '@/lib/workspace-records/relationships'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'
import { buildRelatedRecordHref } from '@/lib/workspace-records/relatedRecordLinks'
import {
  DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  type WorkspaceRecordTerminology,
} from '@/lib/workspaces/workspacePresentation'
import { useClearFilters } from '@/hooks/useClearFilters'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'

type FilterValue<T extends string> = 'All' | T
type MetricFilter = 'open' | 'urgent' | 'scheduledToday' | 'completedThisMonth'
type MetricTone = 'open' | 'urgent' | 'scheduled' | 'completed'

const statusOptions: Array<FilterValue<ServiceRequestStatus>> = [
  'All',
  'New',
  'Scheduled',
  'In Progress',
  'Waiting On Client',
  'Completed',
  'Cancelled',
]

const priorityOptions: Array<FilterValue<ServiceRequestPriority>> = [
  'All',
  'Low',
  'Normal',
  'High',
  'Urgent',
]

const statusVariant: Record<ServiceRequestStatus, BadgeVariant> = {
  New: 'blue',
  Scheduled: 'purple',
  'In Progress': 'brand',
  'Waiting On Client': 'yellow',
  Completed: 'green',
  Cancelled: 'gray',
}

const priorityVariant: Record<ServiceRequestPriority, BadgeVariant> = {
  Low: 'slate',
  Normal: 'blue',
  High: 'orange',
  Urgent: 'red',
}

const priorityDotClass: Record<ServiceRequestPriority, string> = {
  Low: 'bg-slate-500/70',
  Normal: 'bg-cyan-300/70',
  High: 'bg-amber-400/80',
  Urgent: 'bg-rose-400',
}

const serviceTypeBadgeClass: Record<string, string> = {
  'Website Update':
    'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  'Lead Follow-up':
    'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-200',
  'Automation Issue':
    'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200',
  'Review Request':
    'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  'Support Request':
    'border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  'Field Service':
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  'Service Call':
    'border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-100',
  'Estimate / Visit':
    'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-100',
  Maintenance:
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
  Repair:
    'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-100',
  'Follow-Up': 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-100',
}

function getServiceTypeBadgeClass(serviceType: string) {
  return (
    serviceTypeBadgeClass[serviceType] ??
    'border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-200'
  )
}

const priorityRank: Record<ServiceRequestPriority, number> = {
  Urgent: 0,
  High: 1,
  Normal: 2,
  Low: 3,
}

const metricToneClass: Record<MetricTone, string> = {
  open: 'hover:border-cyan-500/45 hover:bg-cyan-50 focus-visible:ring-cyan-300/60 dark:hover:border-cyan-300/50 dark:hover:bg-cyan-300/[0.04]',
  urgent:
    'hover:border-rose-500/45 hover:bg-rose-50 focus-visible:ring-rose-300/60 dark:hover:border-rose-300/50 dark:hover:bg-rose-400/[0.04]',
  scheduled:
    'hover:border-violet-500/45 hover:bg-violet-50 focus-visible:ring-violet-300/60 dark:hover:border-violet-300/50 dark:hover:bg-violet-400/[0.04]',
  completed:
    'hover:border-emerald-500/45 hover:bg-emerald-50 focus-visible:ring-emerald-300/60 dark:hover:border-emerald-300/50 dark:hover:bg-emerald-400/[0.04]',
}

const activeMetricToneClass: Record<MetricTone, string> = {
  open: 'border-cyan-500/45 bg-cyan-50 shadow-cyan-400/[0.08] dark:border-cyan-300/50 dark:bg-cyan-300/[0.065]',
  urgent:
    'border-rose-500/45 bg-rose-50 shadow-rose-400/[0.08] dark:border-rose-300/50 dark:bg-rose-400/[0.065]',
  scheduled:
    'border-violet-500/45 bg-violet-50 shadow-violet-400/[0.08] dark:border-violet-300/50 dark:bg-violet-400/[0.065]',
  completed:
    'border-emerald-500/45 bg-emerald-50 shadow-emerald-400/[0.08] dark:border-emerald-300/50 dark:bg-emerald-400/[0.065]',
}

const serviceRequestsTableColumns: TableColumnConfig[] = [
  { id: 'customer', label: 'Customer', required: true },
  { id: 'request', label: 'Request', required: true },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'assignedTo', label: ownershipLabels.serviceRequests.table },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'actions', label: 'Actions' },
]

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'

  return formatWorkspaceDateTime(value)
}

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(target.closest('button,a,input,select,textarea'))
    : false
}

function isCompletedThisMonth(request: WorkspaceServiceRequest) {
  if (!request.completedAt) return false

  const now = new Date()
  const completedAt = new Date(request.completedAt)

  return (
    completedAt.getMonth() === now.getMonth() &&
    completedAt.getFullYear() === now.getFullYear()
  )
}

export function ServiceRequestsClient({
  requests,
  clients = [],
  workspaceOwners,
  canEditOwners = false,
  terminology,
}: {
  requests: WorkspaceServiceRequest[]
  clients?: WorkspaceClient[]
  workspaceOwners: WorkspaceOwner[]
  canEditOwners?: boolean
  terminology?: WorkspaceRecordTerminology
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const workspaceId = requests[0]?.workspaceId ?? 'demo'
  const workspaceSlug = pathname.split('/')[2] ?? workspaceId
  const terms = terminology ?? DEFAULT_WORKSPACE_RECORD_TERMINOLOGY
  const requestQueueRef = useRef<HTMLDivElement | null>(null)
  const [requestRecords, setRequestRecords] = useState(() =>
    mergeServiceRequestRecords(
      requests,
      readPreviewServiceRequests(workspaceId),
    ),
  )
  const [clientRecords, setClientRecords] = useState(() =>
    mergeClientRecords(clients, readPreviewClients(workspaceId)),
  )
  const [workspaceJobTypes, setWorkspaceJobTypes] = useState(() =>
    getPreviewServiceRequestTypes(workspaceId),
  )
  const [workItems, setWorkItems] = useState<TaskRecord[]>(() =>
    mergeTaskRecords(
      createMockWorkspaceTasks(workspaceId),
      readPreviewTasks(workspaceId),
    ),
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<ServiceRequestStatus>>('All')
  const [priorityFilter, setPriorityFilter] =
    useState<FilterValue<ServiceRequestPriority>>('All')
  const [serviceTypeFilter, setServiceTypeFilter] =
    useState<FilterValue<ServiceRequestType>>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    ownershipLabels.serviceRequests.filterAll,
  )
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [clientFilterLabel, setClientFilterLabel] = useState<string | null>(
    null,
  )
  const [selectedRequest, setSelectedRequest] =
    useState<WorkspaceServiceRequest | null>(null)
  const [jobCreationOpen, setJobCreationOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [activeMetricFilter, setActiveMetricFilter] =
    useState<MetricFilter | null>(null)
  const serviceRequestColumnConfigs = useMemo<TableColumnConfig[]>(
    () =>
      serviceRequestsTableColumns.map((column) =>
        column.id === 'request'
          ? { ...column, label: terms.serviceRequestSingular }
          : column.id === 'customer'
            ? { ...column, label: terms.customerSingular }
            : column.id === 'tasks'
              ? { ...column, label: terms.taskPlural }
              : column,
      ),
    [terms.customerSingular, terms.serviceRequestSingular, terms.taskPlural],
  )
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('service-requests', serviceRequestColumnConfigs)

  const serviceTypeOptions = useMemo<Array<FilterValue<ServiceRequestType>>>(
    () => [
      'All',
      ...getServiceRequestTypeOptions({
        configuredTypes: workspaceJobTypes,
        requests: requestRecords,
      }),
    ],
    [requestRecords, workspaceJobTypes],
  )

  const closeRequestDrawer = () => {
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

  const assigneeOptions = useMemo(
    () => [
      ownershipLabels.serviceRequests.filterAll,
      ...getActiveOwners(workspaceOwners),
    ],
    [workspaceOwners],
  )

  useEffect(() => {
    setRequestRecords(
      mergeServiceRequestRecords(
        requests,
        readPreviewServiceRequests(workspaceId),
      ),
    )
    setClientRecords(
      mergeClientRecords(clients, readPreviewClients(workspaceId)),
    )
    setWorkspaceJobTypes(getPreviewServiceRequestTypes(workspaceId))
    setWorkItems(
      mergeTaskRecords(
        createMockWorkspaceTasks(workspaceId),
        readPreviewTasks(workspaceId),
      ),
    )
  }, [clients, requests, workspaceId])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (
        event.detail.workspaceId !== workspaceId &&
        event.detail.workspaceId !== workspaceSlug
      ) {
        return
      }

      if (event.detail.scope === 'serviceRequests') {
        setRequestRecords(
          mergeServiceRequestRecords(
            requests,
            readPreviewServiceRequests(workspaceId),
          ),
        )
        setWorkspaceJobTypes(getPreviewServiceRequestTypes(workspaceId))
      }

      if (event.detail.scope === 'clients') {
        setClientRecords(
          mergeClientRecords(clients, readPreviewClients(workspaceId)),
        )
      }

      if (event.detail.scope === 'tasks') {
        setWorkItems(
          mergeTaskRecords(
            createMockWorkspaceTasks(workspaceId),
            readPreviewTasks(workspaceId),
          ),
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
  }, [clients, requests, workspaceId, workspaceSlug])

  useEffect(() => {
    setSelectedRequest((current) =>
      current
        ? (requestRecords.find((record) => record.id === current.id) ?? current)
        : current,
    )
  }, [requestRecords])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matchesMetricFilter = (request: WorkspaceServiceRequest) => {
      switch (activeMetricFilter) {
        case 'open':
          return getOpenServiceRequests([request]).length === 1
        case 'urgent':
          return getUrgentOpenServiceRequests([request]).length === 1
        case 'scheduledToday':
          return getScheduledTodayOpenServiceRequests([request]).length === 1
        case 'completedThisMonth':
          return request.status === 'Completed' && isCompletedThisMonth(request)
        default:
          return true
      }
    }

    return requestRecords
      .filter((request) => {
        const matchesSearch = query
          ? [
              request.customerName,
              request.company,
              request.title,
              request.description,
              getOwnerName(workspaceOwners, request.assignedToOwnerId),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query)
          : true
        const matchesStatus =
          statusFilter === 'All' || request.status === statusFilter
        const matchesPriority =
          priorityFilter === 'All' || request.priority === priorityFilter
        const matchesServiceType =
          serviceTypeFilter === 'All' ||
          request.serviceType === serviceTypeFilter
        const matchesAssignee =
          assigneeFilter === ownershipLabels.serviceRequests.filterAll ||
          request.assignedToOwnerId === assigneeFilter
        const matchesClient =
          !clientFilter ||
          request.clientId === clientFilter ||
          (request.relatedRecordType === 'client' &&
            request.relatedRecordId === clientFilter) ||
          (clientFilterLabel
            ? [
                request.clientName,
                request.company,
                request.relatedRecordLabel,
                request.relatedRecords.linkedClient,
              ].includes(clientFilterLabel)
            : false)

        return (
          matchesSearch &&
          matchesStatus &&
          matchesPriority &&
          matchesServiceType &&
          matchesAssignee &&
          matchesClient &&
          matchesMetricFilter(request)
        )
      })
      .sort((a, b) => {
        if (activeMetricFilter === 'scheduledToday') {
          return (
            new Date(a.scheduledFor ?? 0).getTime() -
            new Date(b.scheduledFor ?? 0).getTime()
          )
        }

        const priorityDelta =
          priorityRank[a.priority] - priorityRank[b.priority]
        if (priorityDelta !== 0) return priorityDelta
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [
    activeMetricFilter,
    assigneeFilter,
    clientFilter,
    clientFilterLabel,
    priorityFilter,
    requestRecords,
    search,
    serviceTypeFilter,
    statusFilter,
    workspaceOwners,
  ])

  const scrollTarget =
    searchParams.get('view') ||
    searchParams.get('requestId') ||
    searchParams.get('status')
      ? 'request-queue'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredRequests.length}:${selectedRequest?.id ?? ''}`,
  )

  const metrics = useMemo(() => {
    const completedThisMonth =
      requestRecords.filter(isCompletedThisMonth).length

    return [
      {
        id: 'open' as const,
        label: `Open ${terms.serviceRequestPlural}`,
        value: getOpenServiceRequests(requestRecords).length.toString(),
        helper: 'Currently active',
        tone: 'open' as const,
      },
      {
        id: 'urgent' as const,
        label: `Urgent ${terms.serviceRequestPlural}`,
        value: getUrgentOpenServiceRequests(requestRecords).length.toString(),
        helper: 'Needs fast response',
        tone: 'urgent' as const,
      },
      {
        id: 'scheduledToday' as const,
        label: 'Scheduled Today',
        value:
          getScheduledTodayOpenServiceRequests(
            requestRecords,
          ).length.toString(),
        helper: "On today's schedule",
        tone: 'scheduled' as const,
      },
      {
        id: 'completedThisMonth' as const,
        label: 'Completed This Month',
        value: completedThisMonth.toString(),
        helper: `Finished ${terms.serviceRequestPlural.toLowerCase()}`,
        tone: 'completed' as const,
      },
    ]
  }, [requestRecords, terms.serviceRequestPlural])

  const requestVisuals = useMemo(() => {
    const openCount = getOpenServiceRequests(requestRecords).length
    const completedCount = requestRecords.filter(
      (request) => request.status === 'Completed',
    ).length
    const overTime: InsightSeriesPoint[] = [
      { label: 'Jun 1', value: 1, secondary: 0 },
      { label: 'Jun 8', value: 2, secondary: 1 },
      {
        label: 'Jun 15',
        value: Math.max(openCount - 1, 0),
        secondary: Math.max(completedCount - 1, 0),
      },
      { label: 'Jun 22', value: openCount, secondary: completedCount },
      { label: 'Today', value: openCount, secondary: completedCount },
    ]
    const byType: InsightBreakdownPoint[] = serviceTypeOptions
      .filter((type): type is ServiceRequestType => type !== 'All')
      .map((type, index) => ({
        label: type,
        value: requestRecords.filter((request) => request.serviceType === type)
          .length,
        color:
          type === 'Automation Issue'
            ? '#8b5cf6'
            : type === 'Field Service'
              ? '#34d399'
              : ['#22d3ee', '#60a5fa', '#f59e0b', '#fb7185'][index % 4],
      }))
      .filter((item) => item.value > 0)
    const byStatus: InsightBreakdownPoint[] = statusOptions
      .filter((status): status is ServiceRequestStatus => status !== 'All')
      .map((status, index) => ({
        label: status,
        value: requestRecords.filter((request) => request.status === status)
          .length,
        color:
          status === 'Completed'
            ? '#34d399'
            : status === 'Cancelled'
              ? '#94a3b8'
              : ['#22d3ee', '#8b5cf6', '#60a5fa', '#f59e0b'][index % 4],
      }))
      .filter((item) => item.value > 0)

    return {
      byStatus,
      byType,
      overTime,
      triageSignals: [
        {
          label: 'Open',
          value: openCount.toString(),
          helper: 'Active queue',
          tone: 'cyan' as const,
        },
        {
          label: 'Urgent',
          value: getUrgentOpenServiceRequests(requestRecords).length.toString(),
          helper: 'Needs response',
          tone: 'rose' as const,
        },
        {
          label: 'Scheduled',
          value: requestRecords
            .filter((request) => request.status === 'Scheduled')
            .length.toString(),
          helper: 'On calendar',
          tone: 'purple' as const,
        },
        {
          label: 'Completed',
          value: completedCount.toString(),
          helper: 'Finished',
          tone: 'green' as const,
        },
      ],
    }
  }, [requestRecords, serviceTypeOptions])

  const activeMetric = metrics.find(
    (metric) => metric.id === activeMetricFilter,
  )

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('All')
    setPriorityFilter('All')
    setServiceTypeFilter('All')
    setAssigneeFilter(ownershipLabels.serviceRequests.filterAll)
  }

  const clearActiveMetricFilter = useCallback(() => {
    setActiveMetricFilter(null)
  }, [])

  const applyMetricFilter = useCallback((metricFilter: MetricFilter) => {
    setActiveMetricFilter(metricFilter)
    setStatusFilter('All')
    setPriorityFilter('All')

    window.requestAnimationFrame(() => {
      requestQueueRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [])

  const applySavedView = useCallback(
    (viewId: string) => {
      setActiveSavedViewId(viewId)
      setSearch('')
      setPriorityFilter('All')
      setServiceTypeFilter('All')
      setAssigneeFilter(ownershipLabels.serviceRequests.filterAll)
      setClientFilter(null)
      setClientFilterLabel(null)
      if (viewId === 'urgent') {
        applyMetricFilter('urgent')
        return
      }
      if (viewId === 'scheduled-today') {
        applyMetricFilter('scheduledToday')
        return
      }
      if (viewId === 'open') {
        applyMetricFilter('open')
        return
      }
      if (viewId === 'waiting') {
        clearActiveMetricFilter()
        setStatusFilter('Waiting On Client')
        return
      }
      if (viewId === 'completed') {
        clearActiveMetricFilter()
        setStatusFilter('Completed')
        return
      }
      clearActiveMetricFilter()
      setStatusFilter('All')
    },
    [applyMetricFilter, clearActiveMetricFilter],
  )

  useEffect(() => {
    const view = searchParams.get('view')
    const status = searchParams.get('status')
    const requestId = searchParams.get('requestId')
    const clientId = searchParams.get('clientId')
    const clientName = searchParams.get('clientName')

    setClientFilter(clientId)
    setClientFilterLabel(clientName)
    if (view) applySavedView(view)
    if (status) {
      const normalizedStatus = status
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') as ServiceRequestStatus
      if (status === 'open') applySavedView('open')
      else if (status === 'urgent') applySavedView('urgent')
      else if (status === 'scheduled-today') applySavedView('scheduled-today')
      else if (status === 'waiting-on-client') applySavedView('waiting')
      else if (status === 'completed') applySavedView('completed')
      else if (statusOptions.includes(normalizedStatus)) {
        clearActiveMetricFilter()
        setStatusFilter(normalizedStatus)
      }
    }
    if (requestId) {
      const request = requestRecords.find((record) => record.id === requestId)
      if (request) setSelectedRequest(request)
    }
  }, [applySavedView, clearActiveMetricFilter, requestRecords, searchParams])

  const clearClientFilter = () => {
    setClientFilter(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('clientId')
    params.delete('clientName')
    const query = params.toString()
    const hash = window.location.hash || '#request-queue'
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }

  const activeClientFilterName = useMemo(() => {
    if (!clientFilter && !clientFilterLabel) return null
    const request = requestRecords.find(
      (record) =>
        record.clientId === clientFilter ||
        (record.relatedRecordType === 'client' &&
          record.relatedRecordId === clientFilter) ||
        (clientFilterLabel
          ? [
              record.clientName,
              record.company,
              record.relatedRecordLabel,
              record.relatedRecords.linkedClient,
            ].includes(clientFilterLabel)
          : false),
    )
    return (
      request?.clientName ??
      request?.company ??
      clientFilterLabel ??
      'Selected client'
    )
  }, [clientFilter, clientFilterLabel, requestRecords])

  const expectedStatusForView =
    activeSavedViewId === 'waiting'
      ? 'Waiting On Client'
      : activeSavedViewId === 'completed'
        ? 'Completed'
        : 'All'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === expectedStatusForView ? '' : statusFilter,
      priorityFilter: priorityFilter === 'All' ? '' : priorityFilter,
      serviceTypeFilter: serviceTypeFilter === 'All' ? '' : serviceTypeFilter,
      assigneeFilter:
        assigneeFilter === ownershipLabels.serviceRequests.filterAll
          ? ''
          : assigneeFilter,
      clientFilter,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter(
        expectedStatusForView as FilterValue<ServiceRequestStatus>,
      )
      setPriorityFilter('All')
      setServiceTypeFilter('All')
      setAssigneeFilter(ownershipLabels.serviceRequests.filterAll)
      setClientFilter(null)
      setClientFilterLabel(null)
    },
  })

  const showPlaceholder = (text: string) => {
    setMessage(text)
  }

  const appendCreatedServiceRequest = (request: WorkspaceServiceRequest) => {
    appendPreviewServiceRequest(request.workspaceId, request)
    appendPreviewServiceRequest(workspaceSlug, request)
    const event = createWorkspaceActivityRecord({
      workspaceId: request.workspaceId,
      recordId: request.id,
      recordType: 'serviceRequest',
      action: 'created',
      title: `${terms.serviceRequestSingular} created`,
      description: `${request.title} was created for ${request.company}.`,
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    setRequestRecords((current) =>
      mergeServiceRequestRecords(current, [request]),
    )
  }

  const createJobRecord = (
    _client: WorkspaceClient,
    request: WorkspaceServiceRequest,
  ) => {
    void _client
    appendCreatedServiceRequest({ ...request, workspaceSlug })
    setJobCreationOpen(false)
    showPlaceholder(
      `${terms.serviceRequestSingular} created in this workspace preview.`,
    )
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

  const openRequest = (request: WorkspaceServiceRequest) => {
    setSelectedRequest(request)
  }

  const updateRequestRecord = (
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

  const updateRequestOwner = (requestId: string, ownerId: string) => {
    updateRequestRecord(requestId, { assignedToOwnerId: ownerId })
  }

  const deleteRequestRecord = (request: WorkspaceServiceRequest) => {
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

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    request: WorkspaceServiceRequest,
  ) => {
    if (isRowActionTarget(event.target)) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openRequest(request)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={terms.serviceRequestPlural}
        description={`Track incoming ${terms.customerSingular.toLowerCase()} ${terms.serviceRequestPlural.toLowerCase()}, priority, scheduling, assignments, and completion across this workspace.`}
        actions={
          <>
            <Button
              type="button"
              onClick={() => setJobCreationOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              New {terms.serviceRequestSingular}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                showPlaceholder('Request import will connect to CSV soon.')
              }
              leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
            >
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                showPlaceholder('Request export will connect soon.')
              }
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              Export
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="slate">
          Preview {terms.serviceRequestSingular.toLowerCase()}
        </Badge>
        {message ? (
          <div
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-sm text-cyan-100"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = activeMetricFilter === metric.id

          return (
            <button
              key={metric.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => applyMetricFilter(metric.id)}
              className={cn(
                'metric-card-surface rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)]',
                metricToneClass[metric.tone],
                isActive && activeMetricToneClass[metric.tone],
              )}
            >
              <span className="text-metric-muted text-xs">{metric.label}</span>
              <span className="text-metric mt-2 block text-2xl font-semibold">
                {metric.value}
              </span>
              <span className="text-metric-muted mt-1 block text-xs">
                {metric.helper}
              </span>
            </button>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <ChartCard
          title={`${terms.serviceRequestSingular} triage board`}
          description="Fast read on service demand, urgency, scheduling, and completion."
        >
          <SignalMatrix data={requestVisuals.triageSignals} columns={4} />
        </ChartCard>
        <ChartCard
          title={`${terms.serviceRequestPlural} by status`}
          description={`Current ${terms.serviceRequestSingular.toLowerCase()} queue composition.`}
        >
          <DonutBreakdown
            data={requestVisuals.byStatus}
            centerValue={requestRecords.length.toString()}
            centerLabel={terms.serviceRequestPlural}
          />
        </ChartCard>
      </section>

      <ChartCard
        title={`${terms.serviceRequestPlural} by type`}
        description="Service categories creating the most workspace demand."
      >
        <InsightBarChart data={requestVisuals.byType} />
      </ChartCard>

      <RecommendedActionsCard
        description={`Dispatch urgent ${terms.serviceRequestPlural.toLowerCase()} first, then tighten scheduling and assignment.`}
        actions={[
          {
            title: `Dispatch urgent ${terms.serviceRequestPlural.toLowerCase()}`,
            detail: `Urgent work should be assigned or scheduled before lower-priority ${terms.serviceRequestPlural.toLowerCase()}.`,
            tone: 'rose',
            cta: 'Show urgent',
            onClick: () => applyMetricFilter('urgent'),
          },
          {
            title: 'Confirm today’s schedule',
            detail:
              'Scheduled work needs owner clarity and customer expectations.',
            tone: 'purple',
            cta: 'Show scheduled today',
            onClick: () => applyMetricFilter('scheduledToday'),
          },
          {
            title: `Create automation from repeat ${terms.serviceRequestPlural.toLowerCase()}`,
            detail: `Recurring ${terms.serviceRequestSingular.toLowerCase()} types can become intake or follow-up automations.`,
            tone: 'cyan',
            cta: 'Preview action',
            onClick: () =>
              showPlaceholder(
                'Create Automation will connect when service workflows are enabled.',
              ),
          },
        ]}
      />

      <SavedViewTabs
        activeViewId={activeSavedViewId}
        onSelect={applySavedView}
        views={[
          {
            id: 'all',
            label: `All ${terms.serviceRequestPlural}`,
            count: requestRecords.length,
          },
          {
            id: 'open',
            label: 'Open',
            count: getOpenServiceRequests(requestRecords).length,
            tone: 'cyan',
          },
          {
            id: 'urgent',
            label: 'Urgent',
            count: getUrgentOpenServiceRequests(requestRecords).length,
            tone: 'rose',
          },
          {
            id: 'scheduled-today',
            label: 'Scheduled Today',
            count: getScheduledTodayOpenServiceRequests(requestRecords).length,
            tone: 'purple',
          },
          {
            id: 'waiting',
            label: 'Waiting on Client',
            count: requestRecords.filter(
              (request) => request.status === 'Waiting On Client',
            ).length,
            tone: 'amber',
          },
          {
            id: 'completed',
            label: 'Completed',
            count: requestRecords.filter(
              (request) => request.status === 'Completed',
            ).length,
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
          <CardTitle>{terms.serviceRequestSingular} Filters</CardTitle>
          <CardDescription>
            Search and segment incoming{' '}
            {terms.serviceRequestPlural.toLowerCase()} by status, priority,
            service type, and assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
            <label>
              <span className="sr-only">
                Search {terms.serviceRequestPlural.toLowerCase()}
              </span>
              <div className="relative">
                <Search
                  className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${terms.serviceRequestPlural.toLowerCase()}...`}
                  className="pl-9"
                />
              </div>
            </label>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as FilterValue<ServiceRequestStatus>,
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
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value as FilterValue<ServiceRequestPriority>,
                )
              }
              aria-label="Priority filter"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={serviceTypeFilter}
              onChange={(event) =>
                setServiceTypeFilter(
                  event.target.value as FilterValue<ServiceRequestType>,
                )
              }
              aria-label="Service type filter"
            >
              {serviceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              aria-label="Filter by assignee"
            >
              {assigneeOptions.map((option) => (
                <option
                  key={typeof option === 'string' ? option : option.id}
                  value={typeof option === 'string' ? option : option.id}
                >
                  {typeof option === 'string' ? option : option.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Internal workspace queue; client-facing intake/portal belongs in a separate module. */}
      <div id="request-queue" ref={requestQueueRef} className="scroll-mt-28">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{terms.serviceRequestSingular} Queue</CardTitle>
                <CardDescription>
                  {terms.customerSingular}{' '}
                  {terms.serviceRequestPlural.toLowerCase()}, urgency,
                  scheduling, assignments, and next actions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TableColumnsButton
                  columns={serviceRequestColumnConfigs}
                  visibleColumns={visibleColumns}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
                <Badge variant="brand">{filteredRequests.length} shown</Badge>
              </div>
            </div>
            {activeMetric ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/[0.06] dark:text-cyan-100">
                  Active filter: {activeMetric.label}
                </span>
                <button
                  type="button"
                  onClick={clearActiveMetricFilter}
                  className="text-app-secondary text-xs font-medium transition hover:text-cyan-700 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:hover:text-cyan-100"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {activeClientFilterName ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/[0.06] dark:text-violet-100">
                  {terms.customerSingular}: {activeClientFilterName}
                </span>
                <button
                  type="button"
                  onClick={clearClientFilter}
                  className="border-app bg-app-surface-raised text-app-secondary rounded-full border px-2.5 py-1 text-xs font-medium transition hover:border-violet-500/35 hover:bg-violet-500/10 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-violet-300/35 dark:hover:bg-violet-300/[0.08] dark:hover:text-violet-100"
                >
                  Clear client
                </button>
              </div>
            ) : null}
          </CardHeader>
          {filteredRequests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={`No ${terms.serviceRequestPlural.toLowerCase()} found`}
                description={
                  activeClientFilterName
                    ? `Try clearing the ${terms.customerSingular.toLowerCase()} filter or changing your ${terms.serviceRequestSingular.toLowerCase()} filters.`
                    : activeMetricFilter
                      ? 'Try clearing the active filter or changing your search filters.'
                      : 'Try changing your search or filters.'
                }
                actionLabel={
                  activeClientFilterName
                    ? `Clear ${terms.customerSingular.toLowerCase()} filter`
                    : activeMetricFilter
                      ? 'Clear active filter'
                      : 'Reset filters'
                }
                onAction={
                  activeClientFilterName
                    ? clearClientFilter
                    : activeMetricFilter
                      ? clearActiveMetricFilter
                      : resetFilters
                }
              />
            </div>
          ) : (
            <Table
              className="min-w-[940px]"
              containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
            >
              <THead>
                <TR>
                  <TH>{terms.customerSingular}</TH>
                  <TH>{terms.serviceRequestSingular}</TH>
                  {isColumnVisible('priority') ? <TH>Priority</TH> : null}
                  {isColumnVisible('status') ? <TH>Status</TH> : null}
                  {isColumnVisible('assignedTo') ? (
                    <TH>{ownershipLabels.serviceRequests.table}</TH>
                  ) : null}
                  {isColumnVisible('scheduled') ? <TH>Scheduled</TH> : null}
                  {isColumnVisible('actions') ? <TH>Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {filteredRequests.map((request) => {
                  const isSelected = selectedRequest?.id === request.id
                  const isUrgent = request.priority === 'Urgent'

                  return (
                    <TR
                      key={request.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${request.title}`}
                      className={cn(
                        'group cursor-pointer border-l-2 border-l-transparent transition duration-150 hover:-translate-y-px hover:border-slate-700/80 hover:bg-cyan-300/[0.07] hover:shadow-[0_8px_24px_rgba(8,145,178,0.08)] focus-visible:bg-cyan-300/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50',
                        isSelected &&
                          'bg-cyan-300/[0.08] hover:bg-cyan-300/[0.12]',
                        isUrgent &&
                          'border-l-rose-400/80 bg-rose-500/[0.025] hover:bg-rose-500/[0.085] hover:shadow-[0_8px_24px_rgba(244,63,94,0.1)]',
                        isUrgent &&
                          isSelected &&
                          'border-l-rose-300 bg-rose-500/[0.08] hover:bg-rose-500/[0.12]',
                      )}
                      onClick={(event) => {
                        if (isRowActionTarget(event.target)) return
                        openRequest(request)
                      }}
                      onKeyDown={(event) => handleRowKeyDown(event, request)}
                    >
                      <TD>
                        <div className="flex min-w-52 items-center gap-2">
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              priorityDotClass[request.priority],
                            )}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-app-primary truncate font-medium">
                              {request.customerName}
                            </p>
                            <p className="text-app-secondary mt-0.5 truncate text-xs">
                              {request.company}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="min-w-64">
                          <p className="text-app-primary font-medium">
                            {request.title}
                          </p>
                          <p className="text-app-secondary mt-1 line-clamp-1 text-xs">
                            {request.description}
                          </p>
                          <Badge
                            size="xs"
                            variant="default"
                            className={cn(
                              'mt-2 w-fit',
                              getServiceTypeBadgeClass(request.serviceType),
                            )}
                          >
                            {request.serviceType}
                          </Badge>
                        </div>
                      </TD>
                      {isColumnVisible('priority') ? (
                        <TD>
                          <Badge variant={priorityVariant[request.priority]}>
                            {request.priority}
                          </Badge>
                        </TD>
                      ) : null}
                      {isColumnVisible('status') ? (
                        <TD>
                          <Badge variant={statusVariant[request.status]}>
                            {request.status}
                          </Badge>
                        </TD>
                      ) : null}
                      {isColumnVisible('assignedTo') ? (
                        <TD className="text-app-secondary">
                          {getOwnerName(
                            workspaceOwners,
                            request.assignedToOwnerId,
                          )}
                        </TD>
                      ) : null}
                      {isColumnVisible('scheduled') ? (
                        <TD className="text-app-secondary">
                          {formatDate(request.scheduledFor)}
                        </TD>
                      ) : null}
                      {isColumnVisible('actions') ? (
                        <TD>
                          <div className="flex min-w-52 flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                openRequest(request)
                              }}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="subtle"
                              onClick={(event) => {
                                event.stopPropagation()
                                showPlaceholder(
                                  'Request assignment will connect soon.',
                                )
                              }}
                            >
                              Assign
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                showPlaceholder(
                                  'Request scheduling will connect soon.',
                                )
                              }}
                            >
                              Schedule
                            </Button>
                            <ChevronRight
                              className="ml-auto h-4 w-4 text-slate-500 transition group-hover:text-cyan-200"
                              aria-hidden="true"
                            />
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {selectedRequest ? (
        <ServiceRequestDrawer
          request={selectedRequest}
          workItems={workItems}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          workspaceOwners={workspaceOwners}
          canEditOwners={canEditOwners}
          onOwnerChange={updateRequestOwner}
          onUpdateRequest={updateRequestRecord}
          onCreateServiceType={quickAddJobType}
          onDeleteRequest={deleteRequestRecord}
          onClose={closeRequestDrawer}
          onPlaceholder={showPlaceholder}
          terminology={terms}
          serviceTypeOptions={serviceTypeOptions}
        />
      ) : null}

      {jobCreationOpen ? (
        <CreateServiceRequestDrawer
          clients={clientRecords}
          workspaceOwners={workspaceOwners}
          serviceTypeOptions={serviceTypeOptions.filter(
            (option): option is ServiceRequestType => option !== 'All',
          )}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          onCreateServiceType={quickAddJobType}
          onClose={() => setJobCreationOpen(false)}
          onCreate={createJobRecord}
          terminology={terms}
        />
      ) : null}
    </div>
  )
}

function CreateServiceRequestDrawer({
  clients,
  workspaceOwners,
  serviceTypeOptions,
  workspaceSlug,
  workspaceId,
  onCreateServiceType,
  onClose,
  onCreate,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  clients: WorkspaceClient[]
  workspaceOwners: WorkspaceOwner[]
  serviceTypeOptions: ServiceRequestType[]
  workspaceSlug: string
  workspaceId: string
  onCreateServiceType: (label: string) => { label?: string; error?: string }
  onClose: () => void
  onCreate: (client: WorkspaceClient, request: WorkspaceServiceRequest) => void
  terminology?: WorkspaceRecordTerminology
}) {
  const activeOwners = getActiveOwners(workspaceOwners)
  const defaultClient = clients[0] ?? null
  const [clientId, setClientId] = useState(defaultClient?.id ?? '')
  const selectedClient =
    clients.find((client) => client.id === clientId) ?? defaultClient
  const [title, setTitle] = useState('')
  const [serviceType, setServiceType] = useState<ServiceRequestType>(
    serviceTypeOptions[0] ?? 'Service Call',
  )
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ServiceRequestPriority>('Normal')
  const [status, setStatus] = useState<ServiceRequestStatus>('New')
  const [ownerId, setOwnerId] = useState(
    activeOwners[0]?.id ?? selectedClient?.ownerId ?? '',
  )
  const [scheduledFor, setScheduledFor] = useState('')
  const [amount, setAmount] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const requestTitle = title.trim()
    if (!selectedClient) {
      setClientError(`${terminology.customerSingular} is required.`)
      return
    }
    if (!requestTitle) {
      setTitleError(`${terminology.serviceRequestSingular} title is required.`)
      return
    }
    const ownerName = getOwnerName(workspaceOwners, ownerId)
    onCreate(
      selectedClient,
      createWorkspaceServiceRequestFromClient({
        client: selectedClient,
        title: requestTitle,
        description,
        serviceType,
        priority,
        status,
        ownerId,
        ownerName,
        scheduledFor: scheduledFor
          ? new Date(scheduledFor).toISOString()
          : null,
        valueCents: dollarsToCents(amount),
        currency: 'USD',
        source: 'Manual',
        terminology,
      }),
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70">
      <button
        type="button"
        aria-label={`Close create ${terminology.serviceRequestSingular.toLowerCase()} drawer`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="drawer-surface flex h-full w-full max-w-xl flex-col border-l shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="drawer-header-surface border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-app-primary text-lg font-semibold">
                New {terminology.serviceRequestSingular}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Create a canonical{' '}
                {terminology.serviceRequestSingular.toLowerCase()} linked to a{' '}
                {terminology.customerSingular.toLowerCase()}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary rounded-lg border p-2 transition"
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
          <Select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value)
              setClientError(null)
            }}
            aria-label={terminology.customerSingular}
            aria-invalid={Boolean(clientError)}
          >
            {clients.length ? null : (
              <option value="">
                No {terminology.customerPlural.toLowerCase()} available
              </option>
            )}
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company} · {client.name}
              </option>
            ))}
          </Select>
          {clientError ? (
            <p className="-mt-2 text-xs font-medium text-rose-300">
              {clientError}
            </p>
          ) : null}
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
            <div className="sm:col-span-2">
              <ConfigurationQuickAdd
                label={`${terminology.serviceRequestSingular} Type`}
                addLabel={`Add ${terminology.serviceRequestSingular} Type`}
                manageLabel={`Manage ${terminology.serviceRequestSingular} Types`}
                manageHref={`/dashboard/${workspaceSlug}/settings#operations-configuration`}
                hintId={`${workspaceId}:job-types:create`}
                hintTitle={`${terminology.serviceRequestSingular} types are customizable`}
                hintBody={`Create ${terminology.serviceRequestSingular.toLowerCase()} types that match the services your business performs.`}
                onCreate={(label) => {
                  const result = onCreateServiceType(label)
                  if (result.label) setServiceType(result.label)
                  return result
                }}
              />
            </div>
            <Select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as ServiceRequestPriority)
              }
              aria-label="Priority"
            >
              {priorityOptions
                .filter(
                  (option): option is ServiceRequestPriority =>
                    option !== 'All',
                )
                .map((option) => (
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
              {statusOptions
                .filter(
                  (option): option is ServiceRequestStatus => option !== 'All',
                )
                .map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </Select>
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
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              aria-label="Scheduled date and time"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              aria-label="Amount"
              className="sm:col-span-2"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!clients.length || !title.trim()}>
              Create {terminology.serviceRequestSingular}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function ServiceRequestDrawer({
  request,
  workItems,
  workspaceSlug,
  workspaceId,
  workspaceOwners,
  canEditOwners,
  onOwnerChange,
  onUpdateRequest,
  onCreateServiceType,
  onDeleteRequest,
  onClose,
  onPlaceholder,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  serviceTypeOptions,
}: {
  request: WorkspaceServiceRequest
  workItems: TaskRecord[]
  workspaceSlug: string
  workspaceId: string
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  onOwnerChange: (requestId: string, ownerId: string) => void
  onUpdateRequest: (
    requestId: string,
    updates: Partial<WorkspaceServiceRequest>,
  ) => void
  onCreateServiceType: (label: string) => { label?: string; error?: string }
  onDeleteRequest: (request: WorkspaceServiceRequest) => void
  onClose: () => void
  onPlaceholder: (message: string) => void
  terminology?: WorkspaceRecordTerminology
  serviceTypeOptions: Array<FilterValue<ServiceRequestType>>
}) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const [drawerMessage, setDrawerMessage] = useState<string | null>(null)
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
  const [draftScheduledFor, setDraftScheduledFor] = useState(
    request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
  )
  const [draftValue, setDraftValue] = useState(
    request.valueCents ? String(request.valueCents / 100) : '',
  )
  const assignedWorkItems = useMemo(
    () => getWorkItemsForParent(workItems, 'serviceRequest', request.id),
    [request.id, workItems],
  )
  const openAssignedWorkItems = useMemo(
    () => getOpenWorkItems(assignedWorkItems),
    [assignedWorkItems],
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
    setDraftScheduledFor(
      request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
    )
    setDraftValue(request.valueCents ? String(request.valueCents / 100) : '')
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
    setDraftScheduledFor(
      request.scheduledFor ? request.scheduledFor.slice(0, 16) : '',
    )
    setDraftValue(request.valueCents ? String(request.valueCents / 100) : '')
  }

  const saveEditing = () => {
    onUpdateRequest(request.id, {
      title: draftTitle.trim() || request.title,
      description: draftDescription.trim(),
      notes: draftNotes.trim(),
      priority: draftPriority,
      status: draftStatus,
      serviceType: draftServiceType,
      assignedToOwnerId: draftOwnerId,
      scheduledFor: draftScheduledFor
        ? new Date(draftScheduledFor).toISOString()
        : null,
      valueCents: dollarsToCents(draftValue),
      currency: request.currency || 'USD',
    })
    setIsEditing(false)
  }

  const showDrawerPlaceholder = (message: string) => {
    setDrawerMessage(message)
    onPlaceholder(message)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70">
      <button
        type="button"
        aria-label={`Close ${terminology.serviceRequestSingular.toLowerCase()} details`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="drawer-surface flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="drawer-header-surface sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-app-primary text-lg font-semibold">
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
                    statusVariant[isEditing ? draftStatus : request.status]
                  }
                >
                  {isEditing ? draftStatus : request.status}
                </Badge>
                <Badge
                  variant={
                    priorityVariant[
                      isEditing ? draftPriority : request.priority
                    ]
                  }
                >
                  {isEditing ? draftPriority : request.priority}
                </Badge>
                <Badge
                  variant="default"
                  className={getServiceTypeBadgeClass(
                    isEditing ? draftServiceType : request.serviceType,
                  )}
                >
                  {isEditing ? draftServiceType : request.serviceType}
                </Badge>
                {isEditing ? <Badge variant="brand">Editing</Badge> : null}
                {request.scheduledFor ? (
                  <Badge variant="blue">
                    Scheduled {formatDate(request.scheduledFor)}
                  </Badge>
                ) : null}
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
                Editing this {terminology.serviceRequestSingular.toLowerCase()}.
                Changes stay local to this workspace session.
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
          <DrawerSection title={`${terminology.customerSingular} Info`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Name" value={request.customerName} />
              <InfoItem label="Company" value={request.company} />
              <InfoItem label="Email" value={request.email} />
              <InfoItem label="Phone" value={request.phone} />
            </div>
          </DrawerSection>

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
                      {serviceTypeOptions
                        .filter(
                          (option): option is ServiceRequestType =>
                            option !== 'All',
                        )
                        .map((option) => (
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
                        hintId={`${workspaceId}:job-types:edit`}
                        hintTitle={`${terminology.serviceRequestSingular} types are customizable`}
                        hintBody={`Add or manage ${terminology.serviceRequestPlural.toLowerCase()} types without losing this edit.`}
                        onCreate={(label) => {
                          const result = onCreateServiceType(label)
                          if (result.label) setDraftServiceType(result.label)
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
                      {priorityOptions
                        .filter(
                          (option): option is ServiceRequestPriority =>
                            option !== 'All',
                        )
                        .map((option) => (
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
                      {statusOptions
                        .filter(
                          (option): option is ServiceRequestStatus =>
                            option !== 'All',
                        )
                        .map((option) => (
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
                        ? formatRevenueCurrency(
                            request.valueCents,
                            request.currency,
                          )
                        : 'No amount set'
                    }
                  />
                </>
              )}
              <InfoItem label="Created" value={formatDate(request.createdAt)} />
            </div>
          </DrawerSection>

          <DrawerSection title="Details">
            <div className="space-y-3">
              {isEditing ? (
                <>
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
                </>
              ) : (
                <p className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-sm leading-6">
                  {request.description ||
                    `No ${terminology.serviceRequestSingular.toLowerCase()} details added.`}
                </p>
              )}
              {!isEditing && request.notes ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
                    Notes
                  </p>
                  <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
                    {request.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </DrawerSection>

          <DrawerSection title="Scheduling">
            <div className="grid gap-3 sm:grid-cols-3">
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
              ) : canEditOwners ? (
                <EditableOwnerItem
                  label={ownershipLabels.serviceRequests.drawer}
                  value={request.assignedToOwnerId}
                  owners={workspaceOwners}
                  onChange={(ownerId) => onOwnerChange(request.id, ownerId)}
                />
              ) : (
                <InfoItem
                  label={ownershipLabels.serviceRequests.drawer}
                  value={getOwnerName(
                    workspaceOwners,
                    request.assignedToOwnerId,
                  )}
                />
              )}
              {!isEditing ? (
                <InfoItem
                  label="Scheduled"
                  value={formatDate(request.scheduledFor)}
                />
              ) : null}
              <InfoItem
                label="Estimated Duration"
                value={request.estimatedDuration}
              />
            </div>
          </DrawerSection>

          <DrawerSection title="Timeline">
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70">
                {terminology.customerSingular} Activity
              </p>
              {request.timeline.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {item.label}
                    </p>
                    <p className="text-neutral-text-secondary text-xs">
                      {item.description}
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-[11px]">
                      {formatDate(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DrawerSection>

          <LinkedRecordsCard
            title="Related Records"
            records={[
              {
                label: terminology.customerSingular,
                value: request.relatedRecords.linkedClient,
                helper: `${openAssignedWorkItems.length} open work ${
                  openAssignedWorkItems.length === 1 ? 'item' : 'items'
                } assigned to this ${terminology.serviceRequestSingular.toLowerCase()}.`,
                href: request.clientId
                  ? buildRelatedRecordHref({
                      workspaceSlug,
                      type: 'client',
                      id: request.clientId,
                    })
                  : undefined,
              },
              ...assignedWorkItems.map((workItem) => {
                const progress = getWorkItemChecklistProgress(workItem)
                return {
                  label: terminology.taskSingular,
                  value: workItem.title,
                  helper: `${workItem.status} · ${progress.label}`,
                  href: buildRelatedRecordHref({
                    workspaceSlug,
                    type: 'task',
                    id: workItem.id,
                    clientId: request.clientId,
                    serviceRequestId: request.id,
                  }),
                }
              }),
            ]}
          />

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
                              description: 'Reopened in the workspace preview.',
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
                                'Marked complete in the workspace preview.',
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
                  variant="outline"
                  onClick={() =>
                    showDrawerPlaceholder(
                      `${terminology.taskSingular} creation will connect to ${terminology.serviceRequestPlural.toLowerCase()} soon.`,
                    )
                  }
                >
                  Create {terminology.taskSingular}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="subtle"
                  onClick={() =>
                    showDrawerPlaceholder(
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
                    showDrawerPlaceholder(
                      'Automation creation will connect soon.',
                    )
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
                Changes are stored locally for this workspace session.
              </p>
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
      <p className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-app-primary mt-1 text-sm">{value}</p>
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
