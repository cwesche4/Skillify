'use client'

import React, {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Pencil, Plus, X } from 'lucide-react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
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
import { Textarea } from '@/components/ui/Textarea'
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
  RecordTimeline,
  SavedViewTabs,
  SignalMatrix,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import type { WorkspaceClient } from '@/lib/clients/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import { cn } from '@/lib/utils'
import { formatWorkspaceDateTime } from '@/lib/formatting/dates'
import { ownershipLabels } from '@/lib/ownership-labels'
import {
  type WorkspaceOwner,
  getActiveOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import {
  demoTaskToday,
  type RelatedRecordType,
  type WorkItemChecklistItem,
  type WorkItemParentType,
  type TaskPriority,
  type TaskRecord,
  type TaskSource,
  type TaskStatus,
} from '@/lib/tasks/demoTasks'
import {
  getOpenWorkItems,
  getWorkItemChecklist,
  getWorkItemChecklistProgress,
  getWorkItemParent,
} from '@/lib/tasks/workItems'
import { getTaskCustomerIdentity } from '@/lib/tasks/taskIdentity'
import {
  mergeTaskRecords,
  readPreviewTasks,
  removePreviewTask,
  upsertPreviewTask,
} from '@/lib/tasks/previewTaskStorage'
import {
  appendPreviewActivity,
  createWorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { updateTaskRecordWithRules } from '@/lib/workspace-records/crmMutations'
import {
  getDueOrOverdueOpenTasks,
  getDueTodayOpenTasks,
  getOverdueOpenTasks,
  sortTasksByDueDatePriority,
  getTaskClient,
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

type TaskMetric =
  | 'openTasks'
  | 'dueToday'
  | 'overdue'
  | 'dueOrOverdue'
  | 'completedThisWeek'
type TaskDrilldown =
  | { type: 'metric'; label: string; metric: TaskMetric }
  | { type: 'owner'; label: string; ownerId: string }

const today = demoTaskToday

const statusOptions: Array<'All' | TaskStatus> = [
  'All',
  'Open',
  'In Progress',
  'Waiting',
  'Completed',
  'Canceled',
]

const priorityOptions: Array<'All' | TaskPriority> = [
  'All',
  'Urgent',
  'High',
  'Medium',
  'Low',
]

const statusVariant: Record<TaskStatus, BadgeVariant> = {
  Open: 'blue',
  'In Progress': 'purple',
  Waiting: 'orange',
  Completed: 'green',
  Canceled: 'slate',
}

const priorityVariant: Record<TaskPriority, BadgeVariant> = {
  Low: 'slate',
  Medium: 'blue',
  High: 'orange',
  Urgent: 'red',
}

const sourceVariant: Record<TaskSource, BadgeVariant> = {
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

const tasksTableColumns: TableColumnConfig[] = [
  { id: 'task', label: 'Task', required: true },
  { id: 'client', label: 'Parent' },
  { id: 'progress', label: 'Checklist' },
  { id: 'assignedTo', label: ownershipLabels.tasks.table },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'source', label: 'Source' },
  { id: 'actions', label: 'Actions' },
]

const metricTone: Record<TaskMetric, string> = {
  openTasks: 'border-cyan-300/50 bg-cyan-300/[0.065] shadow-cyan-400/[0.08]',
  dueToday:
    'border-violet-300/50 bg-violet-400/[0.065] shadow-violet-400/[0.08]',
  overdue: 'border-rose-300/50 bg-rose-400/[0.065] shadow-rose-400/[0.08]',
  dueOrOverdue:
    'border-amber-300/50 bg-amber-400/[0.065] shadow-amber-400/[0.08]',
  completedThisWeek:
    'border-emerald-300/50 bg-emerald-400/[0.065] shadow-emerald-400/[0.08]',
}

function isIncomplete(task: TaskRecord) {
  return task.status !== 'Completed' && task.status !== 'Canceled'
}

function isDueToday(task: TaskRecord) {
  return getDueTodayOpenTasks([task], today).length === 1
}

function isOverdue(task: TaskRecord) {
  return getOverdueOpenTasks([task], today).length === 1
}

function isDueOrOverdue(task: TaskRecord) {
  return getDueOrOverdueOpenTasks([task], today).length === 1
}

function getDaysBetween(startDate: string, endDate = today) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime()
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime()
  return Math.max(Math.round((end - start) / 86_400_000), 0)
}

function getTaskAgeLabel(task: TaskRecord) {
  const days = getDaysBetween(task.createdAt)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function getOverdueAgeLabel(task: TaskRecord) {
  if (!isOverdue(task)) return null

  const days = getDaysBetween(task.dueDate)
  return `${days} ${days === 1 ? 'day' : 'days'} overdue`
}

function getTaskTimeStatus(task: TaskRecord) {
  if (task.status === 'Completed') return 'Completed'
  if (task.status === 'In Progress' || task.status === 'Waiting') {
    return 'In progress'
  }

  return 'Not started'
}

function getWorkflowProgressIndex(status: TaskStatus) {
  switch (status) {
    case 'Open':
      return 1
    case 'In Progress':
      return 2
    case 'Waiting':
      return 3
    case 'Completed':
      return 4
    case 'Canceled':
      return 1
  }
}

function isCompletedThisWeek(task: TaskRecord) {
  return Boolean(task.completedAt && task.completedAt >= '2026-06-22')
}

function isRowActionTarget(target: EventTarget) {
  return target instanceof Element
    ? Boolean(target.closest('button,a,input,select,textarea,label'))
    : false
}

function sameTaskDrilldown(a: TaskDrilldown, b: TaskDrilldown | null) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function TasksClient({
  tasks,
  clients,
  serviceRequests = [],
  leads = [],
  opportunities = [],
  workspaceOwners,
  canManageOwners = false,
  terminology,
}: {
  tasks: TaskRecord[]
  clients: WorkspaceClient[]
  serviceRequests?: WorkspaceServiceRequest[]
  leads?: LeadRecord[]
  opportunities?: OpportunityRecord[]
  workspaceOwners: WorkspaceOwner[]
  canManageOwners?: boolean
  terminology?: WorkspaceRecordTerminology
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const workspaceId = tasks[0]?.workspaceId ?? clients[0]?.workspaceId ?? 'demo'
  const workspaceSlug = pathname.split('/')[2] ?? workspaceId
  const terms = terminology ?? DEFAULT_WORKSPACE_RECORD_TERMINOLOGY
  const ownerOptions = useMemo(
    () => getActiveOwners(workspaceOwners),
    [workspaceOwners],
  )
  const currentUserOwnerId =
    ownerOptions.find((owner) => owner.type === 'USER')?.id ??
    ownerOptions[0]?.id
  const [taskRecords, setTaskRecords] = useState<TaskRecord[]>(tasks)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>(
    'All',
  )
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [clientFilterId, setClientFilterId] = useState<string | null>(null)
  const [serviceRequestFilterId, setServiceRequestFilterId] = useState<
    string | null
  >(null)
  const [projectFilterId, setProjectFilterId] = useState<string | null>(null)
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [selectedMetric, setSelectedMetric] = useState<TaskMetric | null>(null)
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<TaskDrilldown | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [selectedRelatedClient, setSelectedRelatedClient] =
    useState<WorkspaceClient | null>(null)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const taskColumnConfigs = useMemo<TableColumnConfig[]>(
    () =>
      tasksTableColumns.map((column) =>
        column.id === 'task'
          ? { ...column, label: terms.taskSingular }
          : column.id === 'client'
            ? { ...column, label: 'Parent' }
            : column,
      ),
    [terms.taskSingular],
  )
  const { visibleColumns, isColumnVisible, toggleColumn, resetColumns } =
    useTableColumnVisibility('tasks', taskColumnConfigs)

  useEffect(() => {
    setTaskRecords(mergeTaskRecords(tasks, readPreviewTasks(workspaceId)))
  }, [tasks, workspaceId])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (
        event.detail.scope !== 'tasks' ||
        (event.detail.workspaceId !== workspaceId &&
          event.detail.workspaceId !== workspaceSlug)
      ) {
        return
      }

      setTaskRecords(mergeTaskRecords(tasks, readPreviewTasks(workspaceId)))
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
  }, [tasks, workspaceId, workspaceSlug])

  useEffect(() => {
    setSelectedTask((current) =>
      current
        ? (taskRecords.find((record) => record.id === current.id) ?? current)
        : current,
    )
  }, [taskRecords])

  const metrics = useMemo(
    () => [
      {
        id: 'openTasks' as const,
        label: `Open ${terms.taskPlural}`,
        value: taskRecords.filter(isIncomplete).length.toString(),
        helper: 'Work requiring attention',
        tooltip: `Incomplete ${terms.taskPlural.toLowerCase()} that still need action or review.`,
      },
      {
        id: 'dueToday' as const,
        label: 'Due Today',
        value: taskRecords.filter(isDueToday).length.toString(),
        helper: 'Require action today',
        tooltip: `${terms.taskPlural} due today based on the current workspace schedule.`,
      },
      {
        id: 'overdue' as const,
        label: 'Overdue',
        value: taskRecords.filter(isOverdue).length.toString(),
        helper: `Past due ${terms.taskPlural.toLowerCase()}`,
        tooltip: `Incomplete ${terms.taskPlural.toLowerCase()} with due dates before today.`,
      },
      {
        id: 'dueOrOverdue' as const,
        label: 'Due or Overdue',
        value: taskRecords.filter(isDueOrOverdue).length.toString(),
        helper: 'Workspace-wide due work',
        tooltip: `Open workspace ${terms.taskPlural.toLowerCase()} due today or already overdue.`,
      },
      {
        id: 'completedThisWeek' as const,
        label: 'Completed This Week',
        value: taskRecords.filter(isCompletedThisWeek).length.toString(),
        helper: 'Finished in the last 7 days',
        tooltip: `${terms.taskPlural} completed during the current 7-day reporting window.`,
      },
    ],
    [taskRecords, terms.taskPlural],
  )

  const taskVisuals = useMemo(() => {
    const statusBreakdown: InsightBreakdownPoint[] = statusOptions
      .filter((status): status is TaskStatus => status !== 'All')
      .map((status, index) => ({
        label: status,
        value: taskRecords.filter((task) => task.status === status).length,
        color:
          status === 'Completed'
            ? '#34d399'
            : status === 'Canceled'
              ? '#94a3b8'
              : ['#22d3ee', '#8b5cf6', '#f59e0b', '#fb7185'][index % 4],
      }))
    const priorityBreakdown: InsightBreakdownPoint[] = priorityOptions
      .filter((priority): priority is TaskPriority => priority !== 'All')
      .map((priority, index) => ({
        label: priority,
        value: taskRecords.filter((task) => task.priority === priority).length,
        color:
          priority === 'Urgent'
            ? '#fb7185'
            : priority === 'High'
              ? '#f59e0b'
              : ['#22d3ee', '#8b5cf6', '#34d399'][index % 3],
      }))
    const completionTrend: InsightSeriesPoint[] = [
      {
        label: 'Jun 23',
        value: 1,
        secondary: taskRecords.filter(isIncomplete).length + 3,
      },
      {
        label: 'Jun 24',
        value: 2,
        secondary: taskRecords.filter(isIncomplete).length + 2,
      },
      {
        label: 'Jun 25',
        value: 3,
        secondary: taskRecords.filter(isIncomplete).length + 2,
      },
      {
        label: 'Jun 26',
        value: 4,
        secondary: taskRecords.filter(isIncomplete).length + 1,
      },
      {
        label: 'Today',
        value: taskRecords.filter(isCompletedThisWeek).length,
        secondary: taskRecords.filter(isIncomplete).length,
      },
    ]

    return {
      completionTrend,
      triageSignals: [
        {
          label: 'Due Today',
          value: taskRecords.filter(isDueToday).length.toString(),
          helper: 'Requires action',
          tone: 'purple' as const,
        },
        {
          label: 'Overdue',
          value: taskRecords.filter(isOverdue).length.toString(),
          helper: 'Past due',
          tone:
            taskRecords.filter(isOverdue).length > 0
              ? ('rose' as const)
              : ('green' as const),
        },
        {
          label: 'In Progress',
          value: taskRecords
            .filter((task) => task.status === 'In Progress')
            .length.toString(),
          helper: 'Currently moving',
          tone: 'cyan' as const,
        },
        {
          label: 'Completed',
          value: taskRecords.filter(isCompletedThisWeek).length.toString(),
          helper: 'This week',
          tone: 'green' as const,
        },
      ],
      priorityBreakdown,
      statusBreakdown,
    }
  }, [taskRecords])

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    const forceShowCompleted =
      selectedMetric === 'completedThisWeek' || statusFilter === 'Completed'

    const filtered = taskRecords.filter((task) => {
      const matchesSearch = query
        ? [
            task.title,
            task.description,
            task.notes,
            task.relatedRecord,
            getOwnerName(workspaceOwners, task.ownerId),
            task.source,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true
      const matchesStatus =
        statusFilter === 'All' || task.status === statusFilter
      const matchesPriority =
        priorityFilter === 'All' || task.priority === priorityFilter
      const matchesOwner = ownerFilter === 'All' || task.ownerId === ownerFilter
      const matchesClient = clientFilterId
        ? task.clientId === clientFilterId ||
          (task.relatedRecordType === 'client' &&
            task.relatedRecordId === clientFilterId)
        : true
      const parent = getWorkItemParent(task)
      const matchesServiceRequest = serviceRequestFilterId
        ? parent.type === 'serviceRequest' &&
          parent.id === serviceRequestFilterId
        : true
      const matchesProject = projectFilterId
        ? parent.type === 'project' && parent.id === projectFilterId
        : true
      const matchesMyTasks = myTasksOnly
        ? task.ownerId === currentUserOwnerId
        : true
      const matchesCompleted =
        forceShowCompleted || showCompleted ? true : task.status !== 'Completed'
      const matchesMetric =
        selectedMetric === 'openTasks'
          ? isIncomplete(task)
          : selectedMetric === 'dueToday'
            ? isDueToday(task)
            : selectedMetric === 'overdue'
              ? isOverdue(task)
              : selectedMetric === 'dueOrOverdue'
                ? isDueOrOverdue(task)
                : selectedMetric === 'completedThisWeek'
                  ? isCompletedThisWeek(task)
                  : true
      const matchesDrilldown = selectedDrilldown
        ? selectedDrilldown.type === 'owner'
          ? task.ownerId === selectedDrilldown.ownerId
          : selectedDrilldown.metric === selectedMetric
        : true

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesOwner &&
        matchesClient &&
        matchesServiceRequest &&
        matchesProject &&
        matchesMyTasks &&
        matchesCompleted &&
        matchesMetric &&
        matchesDrilldown
      )
    })

    if (
      selectedMetric !== 'completedThisWeek' &&
      statusFilter !== 'Completed'
    ) {
      return sortTasksByDueDatePriority(filtered)
    }

    return filtered
  }, [
    clientFilterId,
    myTasksOnly,
    ownerFilter,
    priorityFilter,
    projectFilterId,
    search,
    selectedDrilldown,
    selectedMetric,
    serviceRequestFilterId,
    showCompleted,
    statusFilter,
    taskRecords,
    currentUserOwnerId,
    workspaceOwners,
  ])
  const forceShowCompleted =
    selectedMetric === 'completedThisWeek' || statusFilter === 'Completed'

  const scrollTarget =
    searchParams.get('view') ||
    searchParams.get('taskId') ||
    searchParams.get('clientId') ||
    searchParams.get('serviceRequestId') ||
    searchParams.get('projectId')
      ? 'tasks-workspace'
      : null

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredTasks.length}:${selectedTask?.id ?? ''}`,
  )

  const activeMetric = metrics.find((metric) => metric.id === selectedMetric)
  const activeClientFilter = clientFilterId
    ? (clients.find((client) => client.id === clientFilterId) ?? null)
    : null

  const selectMetric = useCallback((metric: TaskMetric) => {
    setSelectedMetric(metric)
    setSelectedDrilldown(null)
  }, [])

  const clearFilter = useCallback(() => {
    setSelectedMetric(null)
    setSelectedDrilldown(null)
    setPriorityFilter('All')
    setStatusFilter('All')
    setMyTasksOnly(false)
  }, [])

  const clearClientFilter = useCallback(() => {
    setClientFilterId(null)
    setServiceRequestFilterId(null)
    setProjectFilterId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('clientId')
    params.delete('serviceRequestId')
    params.delete('projectId')
    if (params.get('view') === 'client-tasks') params.delete('view')
    const query = params.toString()
    const hash = window.location.hash || '#tasks-workspace'
    router.replace(
      query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`,
      {
        scroll: false,
      },
    )
  }, [pathname, router, searchParams])

  const closeTaskDrawer = () => {
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

  const applySavedView = useCallback(
    (viewId: string) => {
      setActiveSavedViewId(viewId)
      setSearch('')
      setSelectedDrilldown(null)
      setPriorityFilter('All')
      setStatusFilter('All')
      setOwnerFilter('All')
      setClientFilterId(null)
      setServiceRequestFilterId(null)
      setProjectFilterId(null)
      setMyTasksOnly(false)
      setShowCompleted(true)
      if (viewId === 'due-today') {
        selectMetric('dueToday')
        return
      }
      if (viewId === 'overdue') {
        selectMetric('overdue')
        return
      }
      if (viewId === 'due-or-overdue') {
        selectMetric('dueOrOverdue')
        return
      }
      if (viewId === 'open') {
        selectMetric('openTasks')
        return
      }
      if (viewId === 'completed-week') {
        selectMetric('completedThisWeek')
        return
      }
      if (viewId === 'my-tasks') {
        setSelectedMetric(null)
        setMyTasksOnly(true)
        return
      }
      if (viewId === 'high-priority') {
        setSelectedMetric(null)
        setPriorityFilter('High')
        return
      }
      if (viewId === 'completed') {
        setSelectedMetric(null)
        setStatusFilter('Completed')
        return
      }
      if (viewId === 'client-tasks') {
        setSelectedMetric(null)
        return
      }
      clearFilter()
    },
    [clearFilter, selectMetric],
  )

  useEffect(() => {
    const view = searchParams.get('view')
    const taskId = searchParams.get('taskId')
    const clientId = searchParams.get('clientId')
    const serviceRequestId = searchParams.get('serviceRequestId')
    const projectId = searchParams.get('projectId')

    if (view) applySavedView(view)
    setClientFilterId(clientId)
    setServiceRequestFilterId(serviceRequestId)
    setProjectFilterId(projectId)
    if (taskId) {
      const task = taskRecords.find((record) => record.id === taskId)
      if (task) setSelectedTask(task)
    }
  }, [applySavedView, searchParams, taskRecords])

  const expectedStatusForView =
    activeSavedViewId === 'completed' ? 'Completed' : 'All'
  const expectedPriorityForView =
    activeSavedViewId === 'high-priority' ? 'High' : 'All'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      search,
      statusFilter: statusFilter === expectedStatusForView ? '' : statusFilter,
      priorityFilter:
        priorityFilter === expectedPriorityForView ? '' : priorityFilter,
      ownerFilter: ownerFilter === 'All' ? '' : ownerFilter,
      clientFilterId,
      serviceRequestFilterId,
      projectFilterId,
      myTasksOnly: activeSavedViewId === 'my-tasks' ? false : myTasksOnly,
      showCompleted: showCompleted ? false : true,
    },
    onClear: () => {
      setSearch('')
      setStatusFilter(expectedStatusForView as 'All' | TaskStatus)
      setPriorityFilter(expectedPriorityForView as 'All' | TaskPriority)
      setOwnerFilter('All')
      setClientFilterId(null)
      setServiceRequestFilterId(null)
      setProjectFilterId(null)
      setMyTasksOnly(activeSavedViewId === 'my-tasks')
      setShowCompleted(true)
    },
  })

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('All')
    setPriorityFilter('All')
    setOwnerFilter('All')
    setClientFilterId(null)
    setServiceRequestFilterId(null)
    setProjectFilterId(null)
    setMyTasksOnly(false)
    setShowCompleted(true)
    clearFilter()
  }

  const showPlaceholder = (action: string) => {
    setMessage(`${action} will connect when task workflows are enabled.`)
  }

  const openTask = (task: TaskRecord) => setSelectedTask(task)
  const openRelatedClient = (task: TaskRecord) => {
    const client = getTaskClient(clients, task)
    if (client) setSelectedRelatedClient(client)
  }

  const updateTaskOwner = (taskId: string, ownerId: string) => {
    updateTaskRecord(taskId, { ownerId })
  }

  const updateTaskRecord = (taskId: string, updates: Partial<TaskRecord>) => {
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
    upsertPreviewTask(workspaceId, nextTask)
    upsertPreviewTask(workspaceSlug, nextTask)
    events.forEach((event) => {
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    })
    showPlaceholder('Saved locally for this workspace preview.')
  }

  const deleteTaskRecord = (taskId: string) => {
    const task = taskRecords.find((record) => record.id === taskId)
    setTaskRecords((current) => current.filter((task) => task.id !== taskId))
    setSelectedTask(null)
    removePreviewTask(workspaceId, taskId)
    removePreviewTask(workspaceSlug, taskId)
    if (task) {
      const event = createWorkspaceActivityRecord({
        workspaceId: task.workspaceId,
        recordId: task.id,
        recordType: 'task',
        action: 'deleted',
        title: 'Task deleted',
        description: `${task.title} was removed from the workspace preview.`,
      })
      appendPreviewActivity(event.workspaceId, event)
      appendPreviewActivity(workspaceSlug, event)
    }
    showPlaceholder('Task removed from this workspace preview.')
  }

  const createTaskRecord = (task: TaskRecord) => {
    setTaskRecords((current) => mergeTaskRecords([task], current))
    upsertPreviewTask(workspaceId, task)
    upsertPreviewTask(workspaceSlug, task)
    const event = createWorkspaceActivityRecord({
      workspaceId: task.workspaceId,
      recordId: task.id,
      recordType: 'task',
      action: 'created',
      title: 'Task created',
      description: `${task.title} was added to the workspace preview.`,
    })
    appendPreviewActivity(event.workspaceId, event)
    appendPreviewActivity(workspaceSlug, event)
    setMessage(
      `${terms.taskSingular} saved locally for this workspace preview.`,
    )
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    task: TaskRecord,
  ) => {
    if (isRowActionTarget(event.target)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openTask(task)
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6 overflow-x-hidden">
        <PageHeader
          title={terms.taskPlural}
          description={`Manage internal ${terms.taskPlural.toLowerCase()}, follow-ups, ${terms.customerSingular.toLowerCase()} deliverables, and automation-generated action items.`}
          actions={
            <Button
              type="button"
              onClick={() => setIsNewTaskOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              New {terms.taskSingular}
            </Button>
          }
        />

        {message ? (
          <div
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <SalesKpiCard
              key={metric.id}
              id={`tasks-${metric.id}`}
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
              tooltip={metric.tooltip}
              isActive={selectedMetric === metric.id}
              toneClass={metricTone[metric.id]}
              onClick={() => selectMetric(metric.id)}
            />
          ))}
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <ChartCard
            title="Work triage matrix"
            description="Immediate operating signals for overdue work, active tasks, and completed output."
          >
            <SignalMatrix data={taskVisuals.triageSignals} columns={4} />
          </ChartCard>
          <ChartCard
            title={`${terms.taskPlural} by status`}
            description="Current queue state across the workspace."
          >
            <DonutBreakdown
              data={taskVisuals.statusBreakdown}
              centerValue={taskRecords.length.toString()}
              centerLabel="Items"
            />
          </ChartCard>
        </section>

        <ChartCard
          title={`${terms.taskPlural} by priority`}
          description="Urgency mix for internal work and follow-ups."
        >
          <HorizontalBarList data={taskVisuals.priorityBreakdown} />
        </ChartCard>

        <RecommendedActionsCard
          description="Focus on the work that unblocks customers and overdue operations."
          actions={[
            {
              title: 'Clear overdue work',
              detail:
                'Overdue tasks should be reviewed before new work is added.',
              tone: 'rose',
              cta: 'Show overdue',
              onClick: () => selectMetric('overdue'),
            },
            {
              title: 'Work due today',
              detail: 'Use today’s task queue as the operational focus list.',
              tone: 'purple',
              cta: 'Show due today',
              onClick: () => selectMetric('dueToday'),
            },
            {
              title: 'Assign unowned work',
              detail: 'Keep ownership clear before tasks fall behind.',
              tone: 'cyan',
              cta: 'Manage owners',
              onClick: () =>
                showPlaceholder(
                  'Manage owners will connect to workspace team settings',
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
              label: `All ${terms.taskPlural}`,
              count: taskRecords.length,
            },
            {
              id: 'due-or-overdue',
              label: 'Due or Overdue',
              count: taskRecords.filter(isDueOrOverdue).length,
              tone: 'amber',
            },
            {
              id: 'due-today',
              label: 'Due Today',
              count: taskRecords.filter(isDueToday).length,
              tone: 'purple',
            },
            {
              id: 'overdue',
              label: 'Overdue',
              count: taskRecords.filter(isOverdue).length,
              tone: 'rose',
            },
            {
              id: 'my-tasks',
              label: `My ${terms.taskPlural}`,
              count: taskRecords.filter(
                (task) => task.ownerId === currentUserOwnerId,
              ).length,
              tone: 'purple',
            },
            {
              id: 'high-priority',
              label: 'High Priority',
              count: taskRecords.filter((task) => task.priority === 'High')
                .length,
              tone: 'amber',
            },
            {
              id: 'open',
              label: 'Open',
              count: taskRecords.filter(isIncomplete).length,
              tone: 'cyan',
            },
            {
              id: 'completed',
              label: 'Completed',
              count: taskRecords.filter((task) => task.status === 'Completed')
                .length,
              tone: 'green',
            },
            {
              id: 'completed-week',
              label: 'Completed This Week',
              count: taskRecords.filter(isCompletedThisWeek).length,
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

        <Card id="tasks-workspace" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>{terms.taskSingular} Filters</CardTitle>
            <CardDescription>
              Search, segment, and focus the workspace work queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${terms.taskPlural.toLowerCase()}...`}
                aria-label={`Search ${terms.taskPlural.toLowerCase()}`}
              />
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'All' | TaskStatus)
                }
                aria-label="Filter by status"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All statuses' : status}
                  </option>
                ))}
              </Select>
              <Select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as 'All' | TaskPriority)
                }
                aria-label="Filter by priority"
              >
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority === 'All' ? 'All priorities' : priority}
                  </option>
                ))}
              </Select>
              <Select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                aria-label="Filter by assignee"
              >
                <option value="All">{ownershipLabels.tasks.filterAll}</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="text-neutral-text-secondary inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={myTasksOnly}
                  onChange={(event) => setMyTasksOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
                />
                My {terms.taskPlural}
              </label>
              <label className="text-neutral-text-secondary inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={forceShowCompleted || showCompleted}
                  disabled={forceShowCompleted}
                  onChange={(event) => setShowCompleted(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {forceShowCompleted ? 'Completed included' : 'Show Completed'}
              </label>
              {canManageOwners ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    showPlaceholder(
                      'Manage owners will connect to workspace team settings',
                    )
                  }
                >
                  Manage owners
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{terms.taskPlural} Workspace</CardTitle>
                <CardDescription>
                  Track meaningful units of work, parent records, checklist
                  progress, and assignments.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TableColumnsButton
                  columns={taskColumnConfigs}
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
                  selectedDrilldown &&
                  selectedDrilldown.label !== activeMetric.label
                    ? ` / ${selectedDrilldown.label}`
                    : ''
                }`}
                onClear={clearFilter}
              />
            ) : null}
            {activeClientFilter ? (
              <ActiveFilter
                label={`${terms.customerSingular}: ${activeClientFilter.company}`}
                onClear={clearClientFilter}
              />
            ) : null}
          </CardHeader>

          <TaskDrilldown
            selectedMetric={selectedMetric}
            selectedDrilldown={selectedDrilldown}
            onSelect={setSelectedDrilldown}
            workspaceOwners={workspaceOwners}
            tasks={taskRecords}
          />

          {filteredTasks.length > 0 ? (
            <Table
              className="min-w-[1120px]"
              containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
            >
              <THead>
                <TR>
                  <TH>{terms.taskSingular}</TH>
                  {isColumnVisible('client') ? <TH>Parent</TH> : null}
                  {isColumnVisible('progress') ? <TH>Checklist</TH> : null}
                  {isColumnVisible('assignedTo') ? (
                    <TH>{ownershipLabels.tasks.table}</TH>
                  ) : null}
                  {isColumnVisible('dueDate') ? <TH>Due Date</TH> : null}
                  {isColumnVisible('status') ? <TH>Status</TH> : null}
                  {isColumnVisible('priority') ? <TH>Priority</TH> : null}
                  {isColumnVisible('source') ? <TH>Source</TH> : null}
                  {isColumnVisible('actions') ? <TH>Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {filteredTasks.map((task) => {
                  const linkedClient = getTaskClient(clients, task)
                  const parent = getWorkItemParent(task)
                  const parentTypeLabel = getTaskParentTypeLabel(
                    parent.type,
                    terms,
                  )
                  const identity = getTaskCustomerIdentity(task, linkedClient)
                  const checklistProgress = getWorkItemChecklistProgress(task)

                  return (
                    <TR
                      key={task.id}
                      tabIndex={0}
                      onClick={() => openTask(task)}
                      onKeyDown={(event) => handleRowKeyDown(event, task)}
                      className={cn(
                        'group cursor-pointer transition duration-200 hover:-translate-y-px hover:border-cyan-300/20 hover:bg-cyan-300/[0.035] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                        selectedTask?.id === task.id && 'bg-cyan-300/[0.045]',
                      )}
                    >
                      <TD>
                        <div>
                          <p className="font-medium text-neutral-100">
                            {task.title}
                          </p>
                          {identity.workItemSubtitle ? (
                            <p className="text-neutral-text-secondary mt-1 line-clamp-1 text-xs">
                              {identity.workItemSubtitle}
                            </p>
                          ) : null}
                        </div>
                      </TD>
                      {isColumnVisible('client') ? (
                        <TD>
                          <div>
                            <p className="text-sm font-medium text-neutral-100">
                              {parent.label}
                            </p>
                            <p className="text-neutral-text-secondary text-xs">
                              {parentTypeLabel}
                            </p>
                          </div>
                        </TD>
                      ) : null}
                      {isColumnVisible('progress') ? (
                        <TD>
                          <div>
                            <p className="text-sm font-medium text-neutral-100">
                              {checklistProgress.label}
                            </p>
                            <div
                              className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800"
                              aria-hidden="true"
                            >
                              <span
                                className="block h-full rounded-full bg-cyan-300/70"
                                style={{
                                  width: `${checklistProgress.percent}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TD>
                      ) : null}
                      {isColumnVisible('assignedTo') ? (
                        <TD>{getOwnerName(workspaceOwners, task.ownerId)}</TD>
                      ) : null}
                      {isColumnVisible('dueDate') ? (
                        <TD>
                          <div>
                            <span
                              className={cn(
                                'text-sm',
                                isOverdue(task)
                                  ? 'text-rose-300'
                                  : isDueToday(task)
                                    ? 'text-amber-200'
                                    : 'text-neutral-100',
                              )}
                            >
                              {task.dueDate}
                            </span>
                            {getOverdueAgeLabel(task) ? (
                              <p className="mt-1 text-[11px] font-medium text-rose-300">
                                {getOverdueAgeLabel(task)}
                              </p>
                            ) : null}
                          </div>
                        </TD>
                      ) : null}
                      {isColumnVisible('status') ? (
                        <TD>
                          <Badge variant={statusVariant[task.status]}>
                            {task.status}
                          </Badge>
                        </TD>
                      ) : null}
                      {isColumnVisible('priority') ? (
                        <TD>
                          <Badge variant={priorityVariant[task.priority]}>
                            {task.priority}
                          </Badge>
                        </TD>
                      ) : null}
                      {isColumnVisible('source') ? (
                        <TD>
                          <Badge variant={sourceVariant[task.source]}>
                            {task.source}
                          </Badge>
                        </TD>
                      ) : null}
                      {isColumnVisible('actions') ? (
                        <TD>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                openTask(task)
                              }}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                showPlaceholder(
                                  `Complete ${terms.taskSingular}`,
                                )
                              }}
                            >
                              Complete
                            </Button>
                            <ChevronRight
                              className="text-neutral-text-secondary h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-cyan-100"
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
          ) : (
            <div className="p-4">
              <EmptyState
                title="No tasks found"
                description="Try clearing the active filter or changing your search filters."
                actionLabel="Reset filters"
                onAction={resetFilters}
              />
            </div>
          )}
        </Card>

        {selectedTask ? (
          <TaskDrawer
            task={selectedTask}
            linkedClient={getTaskClient(clients, selectedTask)}
            workspaceSlug={workspaceSlug}
            onClose={closeTaskDrawer}
            workspaceOwners={workspaceOwners}
            canEditOwners={canManageOwners}
            onOwnerChange={updateTaskOwner}
            onOpenClient={setSelectedRelatedClient}
            onUpdateTask={updateTaskRecord}
            onDeleteTask={deleteTaskRecord}
            terminology={terms}
          />
        ) : null}

        {selectedRelatedClient ? (
          <RelatedClientDrawer
            client={selectedRelatedClient}
            workspaceOwners={workspaceOwners}
            terminology={terms}
            onClose={() => setSelectedRelatedClient(null)}
          />
        ) : null}

        {isNewTaskOpen ? (
          <NewTaskModal
            onClose={() => setIsNewTaskOpen(false)}
            onCreateTask={createTaskRecord}
            workspaceId={workspaceId}
            existingTasks={taskRecords}
            clients={clients}
            serviceRequests={serviceRequests}
            leads={leads}
            opportunities={opportunities}
            workspaceOwners={workspaceOwners}
            terminology={terms}
          />
        ) : null}
      </div>
    </DashboardShell>
  )
}

function TaskDrilldown({
  selectedMetric,
  selectedDrilldown,
  onSelect,
  workspaceOwners,
  tasks,
}: {
  selectedMetric: TaskMetric | null
  selectedDrilldown: TaskDrilldown | null
  onSelect: (selection: TaskDrilldown) => void
  workspaceOwners: WorkspaceOwner[]
  tasks: TaskRecord[]
}) {
  if (!selectedMetric) return null

  const tiles =
    selectedMetric === 'openTasks'
      ? getActiveOwners(workspaceOwners)
          .map((owner) => {
            const ownerTasks = tasks.filter(
              (task) => task.ownerId === owner.id && isIncomplete(task),
            )
            const overdueCount = ownerTasks.filter(isOverdue).length
            const pendingCount = ownerTasks.filter(
              (task) => task.status === 'Waiting',
            ).length
            const summaryCount =
              overdueCount > 0
                ? overdueCount
                : pendingCount > 0
                  ? pendingCount
                  : ownerTasks.length
            const summaryLabel =
              overdueCount > 0
                ? `${summaryCount} overdue ${summaryCount === 1 ? 'task' : 'tasks'}`
                : pendingCount > 0
                  ? `${summaryCount} pending ${summaryCount === 1 ? 'task' : 'tasks'}`
                  : `${summaryCount} open ${summaryCount === 1 ? 'task' : 'tasks'}`

            return {
              label: `Assigned to ${owner.name}`,
              value: summaryLabel,
              selection: {
                type: 'owner',
                label: `Assigned to ${owner.name}`,
                ownerId: owner.id,
              } as TaskDrilldown,
            }
          })
          .filter((tile) => {
            const selection = tile.selection
            return (
              selection.type !== 'owner' ||
              tasks.some(
                (task) =>
                  task.ownerId === selection.ownerId && isIncomplete(task),
              )
            )
          })
      : selectedMetric === 'dueToday'
        ? [
            {
              label: 'Due Today',
              value: tasks.filter(isDueToday).length,
              selection: {
                type: 'metric',
                label: 'Due Today',
                metric: selectedMetric,
              } as TaskDrilldown,
            },
            {
              label: 'High Priority',
              value: tasks.filter(
                (task) =>
                  isDueToday(task) &&
                  (task.priority === 'High' || task.priority === 'Urgent'),
              ).length,
              selection: {
                type: 'metric',
                label: 'High Priority Today',
                metric: selectedMetric,
              } as TaskDrilldown,
            },
          ]
        : selectedMetric === 'overdue'
          ? [
              {
                label: 'Urgent Overdue',
                value: tasks.filter(
                  (task) => isOverdue(task) && task.priority === 'Urgent',
                ).length,
                selection: {
                  type: 'metric',
                  label: 'Urgent Overdue',
                  metric: selectedMetric,
                } as TaskDrilldown,
              },
              {
                label: 'All Overdue',
                value: tasks.filter(isOverdue).length,
                selection: {
                  type: 'metric',
                  label: 'All Overdue',
                  metric: selectedMetric,
                } as TaskDrilldown,
              },
            ]
          : [
              {
                label: 'Completed',
                value: tasks.filter(isCompletedThisWeek).length,
                selection: {
                  type: 'metric',
                  label: 'Completed',
                  metric: selectedMetric,
                } as TaskDrilldown,
              },
              {
                label: 'Automation Assisted',
                value: tasks.filter(
                  (task) =>
                    isCompletedThisWeek(task) &&
                    ['Workflow', 'Automation', 'AI Coach'].includes(
                      task.source,
                    ),
                ).length,
                selection: {
                  type: 'metric',
                  label: 'Automation Assisted',
                  metric: selectedMetric,
                } as TaskDrilldown,
              },
            ]

  if (selectedMetric === 'openTasks' && tiles.length === 0) {
    return (
      <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
        <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
          <p className="text-sm font-medium text-neutral-100">
            No assigned task owners yet.
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Assign a task to a workspace member, team, or automation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-800 px-4 pb-4 sm:px-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            aria-pressed={sameTaskDrilldown(tile.selection, selectedDrilldown)}
            onClick={() => onSelect(tile.selection)}
            className={cn(
              'flex min-h-[76px] flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
              sameTaskDrilldown(tile.selection, selectedDrilldown) &&
                'border-cyan-300/45 bg-cyan-300/[0.08]',
            )}
          >
            <span className="text-neutral-text-secondary text-[11px] uppercase tracking-wide">
              {tile.label}
            </span>
            <span className="mt-1 text-sm font-semibold normal-case text-neutral-100">
              {tile.value}
            </span>
          </button>
        ))}
      </div>
    </div>
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

function RelatedClientDrawer({
  client,
  workspaceOwners,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  onClose,
}: {
  client: WorkspaceClient
  workspaceOwners: WorkspaceOwner[]
  terminology?: WorkspaceRecordTerminology
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close ${terminology.customerSingular.toLowerCase()} details`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                {client.name}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {client.company}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="green">{client.status}</Badge>
                <Badge variant="blue">{client.pipelineStage}</Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
        </div>

        <div className="space-y-4 p-5">
          <DrawerSection title={`${terminology.customerSingular} Overview`}>
            <InfoGrid>
              <InfoItem label="Email" value={client.email} />
              <InfoItem label="Phone" value={client.phone} />
              <InfoItem label="Company" value={client.company} />
              <InfoItem label="Status" value={client.status} />
              <InfoItem
                label="Fulfillment Stage"
                value={client.pipelineStage}
              />
              <InfoItem
                label={ownershipLabels.clients.drawer}
                value={getOwnerName(workspaceOwners, client.ownerId)}
              />
              <InfoItem label="Next Action" value={client.nextAction} />
              <InfoItem label="Health" value={client.health} />
            </InfoGrid>
          </DrawerSection>

          <DrawerSection title="Notes">
            <p className="text-neutral-text-secondary text-sm leading-6">
              {client.notes}
            </p>
          </DrawerSection>
        </div>
      </aside>
    </div>
  )
}

function TaskDrawer({
  task,
  linkedClient,
  workspaceSlug,
  onClose,
  workspaceOwners,
  canEditOwners,
  onOwnerChange,
  onOpenClient,
  onUpdateTask,
  onDeleteTask,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  task: TaskRecord
  linkedClient: WorkspaceClient | null
  workspaceSlug: string
  onClose: () => void
  workspaceOwners: WorkspaceOwner[]
  canEditOwners: boolean
  onOwnerChange: (taskId: string, ownerId: string) => void
  onOpenClient: (client: WorkspaceClient) => void
  onUpdateTask: (taskId: string, updates: Partial<TaskRecord>) => void
  onDeleteTask: (taskId: string) => void
  terminology?: WorkspaceRecordTerminology
}) {
  const parent = getWorkItemParent(task)
  const parentTypeLabel = getTaskParentTypeLabel(parent.type, terminology)
  const identity = getTaskCustomerIdentity(task, linkedClient)
  const checklist = getWorkItemChecklist(task)
  const checklistProgress = getWorkItemChecklistProgress(task)
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
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70">
      <button
        type="button"
        aria-label={`Close ${terminology.taskSingular.toLowerCase()} details`}
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="drawer-surface flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="drawer-header-surface sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-app-primary text-lg font-semibold">
                {isEditing
                  ? `Editing ${terminology.taskSingular.toLowerCase()}`
                  : task.title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {parent.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant={statusVariant[isEditing ? draftStatus : task.status]}
                >
                  {isEditing ? draftStatus : task.status}
                </Badge>
                <Badge
                  variant={
                    priorityVariant[isEditing ? draftPriority : task.priority]
                  }
                >
                  {isEditing ? draftPriority : task.priority}
                </Badge>
                <Badge variant={sourceVariant[task.source]}>
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
          <DrawerSection title="Workflow Progress">
            <TaskWorkflowProgress task={task} />
          </DrawerSection>

          <DrawerSection title={`${terminology.taskSingular} Details`}>
            <InfoGrid>
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
                  {canEditOwners ? (
                    <EditableOwnerItem
                      label={ownershipLabels.tasks.drawer}
                      value={task.ownerId}
                      owners={workspaceOwners}
                      onChange={(ownerId) => onOwnerChange(task.id, ownerId)}
                    />
                  ) : (
                    <InfoItem
                      label={ownershipLabels.tasks.drawer}
                      value={getOwnerName(workspaceOwners, task.ownerId)}
                    />
                  )}
                  <InfoItem label="Due Date" value={task.dueDate} />
                </>
              )}
              <InfoItem
                label="Created Date"
                value={formatWorkspaceDateTime(task.createdAt)}
              />
              <InfoItem
                label={`${terminology.taskSingular} Age`}
                value={getTaskAgeLabel(task)}
              />
              <InfoItem label="Source" value={task.source} />
              <InfoItem label="Estimated Time" value={task.estimatedTime} />
              <InfoItem label="Time Status" value={getTaskTimeStatus(task)} />
              {task.status === 'Completed' ? (
                <>
                  <InfoItem
                    label="Actual Time"
                    value={task.actualTime ?? task.estimatedTime}
                  />
                  <InfoItem
                    label="Completed At"
                    value={task.completedAt ?? 'Completed'}
                  />
                </>
              ) : null}
              {getOverdueAgeLabel(task) ? (
                <InfoItem
                  label="Overdue Age"
                  value={getOverdueAgeLabel(task) ?? ''}
                />
              ) : null}
            </InfoGrid>
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

          <DrawerSection title="Parent">
            <InfoGrid>
              <InfoItem label="Parent" value={parentTypeLabel} />
              <InfoItem label="Record" value={parent.label} />
              {identity.customerName ? (
                <ClientInfoItem
                  client={linkedClient}
                  fallback={identity.customerName}
                  terminology={terminology}
                  onOpenClient={onOpenClient}
                />
              ) : null}
              {identity.companyName ? (
                <InfoItem label="Company" value={identity.companyName} />
              ) : null}
            </InfoGrid>
          </DrawerSection>

          <DrawerSection title="Checklist">
            {checklist.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-neutral-100">
                      {checklistProgress.label}
                    </span>
                    <span className="text-neutral-text-secondary">
                      {checklistProgress.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-cyan-300/70"
                      style={{ width: `${checklistProgress.percent}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                          item.completed
                            ? 'border-cyan-300/60 bg-cyan-300/[0.16] text-cyan-100'
                            : 'border-slate-700 bg-slate-950 text-slate-500',
                        )}
                        aria-hidden="true"
                      >
                        {item.completed ? '✓' : ''}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            item.completed
                              ? 'text-neutral-100'
                              : 'text-neutral-text-secondary',
                          )}
                        >
                          {item.title}
                        </p>
                        {item.completedAt ? (
                          <p className="text-neutral-text-secondary mt-1 text-xs">
                            Completed{' '}
                            {formatWorkspaceDateTime(item.completedAt)}
                          </p>
                        ) : null}
                        {item.notes ? (
                          <p className="text-neutral-text-secondary mt-1 text-xs">
                            {item.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-neutral-text-secondary rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-4 text-sm">
                No checklist items added.
              </p>
            )}
          </DrawerSection>

          <LinkedRecordsCard
            title="Related Records"
            records={[
              {
                label: `Parent ${parentTypeLabel}`,
                value: parent.label,
                helper: `Primary record this ${terminology.taskSingular.toLowerCase()} belongs to.`,
                href:
                  parent.type === 'serviceRequest'
                    ? buildRelatedRecordHref({
                        workspaceSlug,
                        type: 'serviceRequest',
                        id: parent.id,
                      })
                    : parent.type === 'project'
                      ? buildRelatedRecordHref({
                          workspaceSlug,
                          type: 'project',
                          id: parent.id,
                        })
                      : parent.type === 'client'
                        ? buildRelatedRecordHref({
                            workspaceSlug,
                            type: 'client',
                            id: parent.id,
                          })
                        : parent.type === 'opportunity'
                          ? buildRelatedRecordHref({
                              workspaceSlug,
                              type: 'opportunity',
                              id: parent.id,
                            })
                          : parent.type === 'lead'
                            ? buildRelatedRecordHref({
                                workspaceSlug,
                                type: 'lead',
                                id: parent.id,
                              })
                            : undefined,
              },
              ...(linkedClient
                ? [
                    {
                      label: terminology.customerSingular,
                      value: linkedClient.name,
                      helper: linkedClient.company
                        ? linkedClient.company
                        : `Open the linked ${terminology.customerSingular.toLowerCase()} record.`,
                      href: buildRelatedRecordHref({
                        workspaceSlug,
                        type: 'client',
                        id: linkedClient.id,
                      }),
                    },
                  ]
                : []),
              {
                label: terminology.taskSingular,
                value: task.title,
                helper: `Current ${terminology.taskSingular.toLowerCase()} record.`,
              },
              {
                label: ownershipLabels.tasks.drawer,
                value: getOwnerName(workspaceOwners, task.ownerId),
                helper: `Workspace member, team, or automation responsible for this ${terminology.taskSingular.toLowerCase()}.`,
              },
              {
                label: 'Checklist Progress',
                value: checklistProgress.label,
                helper:
                  checklistProgress.total > 0
                    ? `${checklistProgress.percent}% of checklist items complete.`
                    : 'No checklist has been added yet.',
              },
            ]}
          />

          <DrawerSection title="Activity Timeline">
            <TaskTimeline task={task} />
          </DrawerSection>

          <DrawerSection title="Related Actions">
            <div className="space-y-3">
              <div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
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
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-700/80 bg-slate-950/45 text-neutral-100 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                  onClick={() => setIsEditing(true)}
                >
                  Reassign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-700/80 bg-slate-950/45 text-neutral-100 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                  onClick={() => setIsEditing(true)}
                >
                  Reschedule
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
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => onDeleteTask(task.id)}
                >
                  Delete {terminology.taskSingular}
                </Button>
              </div>
            </div>
          </DrawerSection>
        </div>
      </aside>
    </div>
  )
}

function TaskTimeline({ task }: { task: TaskRecord }) {
  return (
    <RecordTimeline
      events={task.timeline.map((item) => ({
        id: `${item.title}-${item.timestamp}`,
        title: item.title,
        description: item.detail,
        timestamp: formatWorkspaceDateTime(item.timestamp),
        tone: item.tone,
      }))}
    />
  )
}

function TaskDescriptionContent({ task }: { task: TaskRecord }) {
  const description = task.description.trim()
  const notes = task.notes.trim()
  const showNotes = notes && notes !== description

  if (!description && !notes) {
    return (
      <div className="drawer-panel-muted text-neutral-text-secondary rounded-xl border border-dashed p-4 text-sm">
        No task details added.
      </div>
    )
  }

  return (
    <div className="text-app-primary space-y-3 text-sm leading-relaxed">
      {description ? <p>{description}</p> : null}
      {showNotes ? (
        <p className="text-neutral-text-secondary">{notes}</p>
      ) : null}
    </div>
  )
}

function TaskWorkflowProgress({ task }: { task: TaskRecord }) {
  const steps = ['Created', 'Assigned', 'In Progress', 'Waiting', 'Complete']
  const activeIndex = getWorkflowProgressIndex(task.status)

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[520px] grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const isActive = index <= activeIndex
          const isCurrent =
            (task.status === 'Open' && step === 'Assigned') ||
            (task.status === 'In Progress' && step === 'In Progress') ||
            (task.status === 'Waiting' && step === 'Waiting') ||
            (task.status === 'Completed' && step === 'Complete') ||
            (task.status === 'Canceled' && step === 'Assigned')

          return (
            <div key={step} className="relative">
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    'absolute left-[calc(50%+18px)] top-4 h-px w-[calc(100%-36px)]',
                    index < activeIndex ? 'bg-cyan-300/70' : 'bg-slate-800',
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex flex-col items-center text-center">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold transition',
                    isActive
                      ? 'border-cyan-300/60 bg-cyan-300/[0.12] text-cyan-100'
                      : 'border-slate-800 bg-slate-950/70 text-slate-500',
                    isCurrent && 'shadow-[0_0_18px_rgba(34,211,238,0.24)]',
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'mt-2 text-[11px] font-medium',
                    isActive
                      ? 'text-neutral-100'
                      : 'text-neutral-text-secondary',
                  )}
                >
                  {step}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type TaskParentSelectionType =
  | 'serviceRequest'
  | 'project'
  | 'client'
  | 'opportunity'
  | 'lead'
  | 'internal'

type TaskParentOption = {
  type: Exclude<TaskParentSelectionType, 'internal'>
  id: string
  label: string
  customerName?: string | null
  companyName?: string | null
  clientId?: string | null
  opportunityId?: string | null
  opportunityLabel?: string | null
  leadId?: string | null
}

const taskParentTypeLabels: Record<TaskParentSelectionType, string> = {
  serviceRequest: 'Service Request',
  project: 'Project',
  client: 'Client',
  opportunity: 'Opportunity',
  lead: 'Lead',
  internal: 'Internal Task',
}

function getTaskParentSelectionLabel(
  type: TaskParentSelectionType,
  terminology: WorkspaceRecordTerminology,
) {
  if (type === 'serviceRequest') return terminology.serviceRequestSingular
  if (type === 'client') return terminology.customerSingular
  if (type === 'internal') return `Internal ${terminology.taskSingular}`
  return taskParentTypeLabels[type]
}

function getTaskParentTypeLabel(
  type: WorkItemParentType,
  terminology: WorkspaceRecordTerminology,
) {
  if (type === 'serviceRequest') return terminology.serviceRequestSingular
  if (type === 'client') return terminology.customerSingular
  if (type === 'internal') return `Internal ${terminology.taskSingular}`
  return type === 'project'
    ? 'Project'
    : type === 'opportunity'
      ? 'Opportunity'
      : type === 'lead'
        ? 'Lead'
        : 'Record'
}

function cleanDisplayValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function taskParentTypeToRelatedType(
  type: TaskParentSelectionType,
): TaskRecord['relatedType'] {
  switch (type) {
    case 'serviceRequest':
      return 'Service Request'
    case 'project':
      return 'Project'
    case 'client':
      return 'Client'
    case 'opportunity':
      return 'Opportunity'
    case 'lead':
      return 'Lead'
    case 'internal':
      return 'Internal'
  }
}

function taskParentTypeToSource(type: TaskParentSelectionType): TaskSource {
  switch (type) {
    case 'serviceRequest':
      return 'Service Request'
    case 'project':
      return 'Project'
    case 'client':
      return 'Client'
    case 'opportunity':
      return 'Opportunity'
    case 'lead':
      return 'Lead Follow-Up'
    case 'internal':
      return 'Manual'
  }
}

function getProjectParentOptions(tasks: TaskRecord[]): TaskParentOption[] {
  const projects = new Map<string, TaskParentOption>()
  tasks.forEach((task) => {
    const parent = getWorkItemParent(task)
    if (parent.type !== 'project') return
    if (projects.has(parent.id)) return
    projects.set(parent.id, {
      type: 'project',
      id: parent.id,
      label: parent.label,
      customerName: task.clientName,
      clientId: task.clientId,
    })
  })
  return Array.from(projects.values())
}

function buildParentOptions({
  type,
  clients,
  serviceRequests,
  leads,
  opportunities,
  existingTasks,
}: {
  type: TaskParentSelectionType
  clients: WorkspaceClient[]
  serviceRequests: WorkspaceServiceRequest[]
  leads: LeadRecord[]
  opportunities: OpportunityRecord[]
  existingTasks: TaskRecord[]
}): TaskParentOption[] {
  switch (type) {
    case 'serviceRequest':
      return serviceRequests.map((request) => {
        const opportunity = opportunities.find(
          (opportunity) =>
            opportunity.clientId === request.clientId ||
            cleanDisplayValue(opportunity.company) ===
              cleanDisplayValue(request.company) ||
            opportunity.client === request.company,
        )
        return {
          type,
          id: request.id,
          label: request.title,
          customerName: request.customerName || request.clientName,
          companyName: request.company,
          clientId: request.clientId,
          opportunityId: opportunity?.id,
          opportunityLabel: opportunity?.name,
        }
      })
    case 'project':
      return getProjectParentOptions(existingTasks)
    case 'client':
      return clients.map((client) => ({
        type,
        id: client.id,
        label: client.name,
        customerName: client.name,
        companyName: client.company,
        clientId: client.id,
        opportunityId: client.sourceOpportunityId,
        opportunityLabel: client.sourceOpportunityId
          ? 'Linked opportunity'
          : null,
        leadId: client.sourceLeadId,
      }))
    case 'opportunity':
      return opportunities.map((opportunity) => ({
        type,
        id: opportunity.id,
        label: opportunity.name,
        customerName: opportunity.contactName ?? opportunity.client,
        companyName: opportunity.company ?? opportunity.client,
        clientId: opportunity.clientId,
        opportunityId: opportunity.id,
        opportunityLabel: opportunity.name,
        leadId: opportunity.leadId ?? opportunity.sourceLeadId,
      }))
    case 'lead':
      return leads.map((lead) => ({
        type,
        id: lead.id,
        label: lead.name,
        customerName: lead.name,
        companyName: lead.company,
        leadId: lead.id,
      }))
    case 'internal':
      return []
  }
}

function NewTaskModal({
  onClose,
  onCreateTask,
  workspaceId,
  existingTasks,
  clients,
  serviceRequests,
  leads,
  opportunities,
  workspaceOwners,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
}: {
  onClose: () => void
  onCreateTask: (task: TaskRecord) => void
  workspaceId: string
  existingTasks: TaskRecord[]
  clients: WorkspaceClient[]
  serviceRequests: WorkspaceServiceRequest[]
  leads: LeadRecord[]
  opportunities: OpportunityRecord[]
  workspaceOwners: WorkspaceOwner[]
  terminology?: WorkspaceRecordTerminology
}) {
  const ownerOptions = getActiveOwners(workspaceOwners)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [ownerId, setOwnerId] = useState(ownerOptions[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('2026-06-30')
  const [parentType, setParentType] =
    useState<TaskParentSelectionType>('serviceRequest')
  const [parentId, setParentId] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('30 min')
  const [notes, setNotes] = useState('')
  const [checklistExpanded, setChecklistExpanded] = useState(false)
  const [checklistDrafts, setChecklistDrafts] = useState<
    Array<{ id: string; title: string }>
  >([])
  const [error, setError] = useState<string | null>(null)

  const parentOptions = useMemo(
    () =>
      buildParentOptions({
        type: parentType,
        clients,
        serviceRequests,
        leads,
        opportunities,
        existingTasks,
      }),
    [clients, existingTasks, leads, opportunities, parentType, serviceRequests],
  )

  const selectedParent =
    parentType === 'internal'
      ? null
      : (parentOptions.find((option) => option.id === parentId) ?? null)

  useEffect(() => {
    if (parentType === 'internal') {
      setParentId('')
      return
    }
    setParentId((current) =>
      parentOptions.some((option) => option.id === current)
        ? current
        : (parentOptions[0]?.id ?? ''),
    )
  }, [parentOptions, parentType])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const addChecklistItem = () => {
    setChecklistExpanded(true)
    setChecklistDrafts((current) => [
      ...current,
      { id: `checklist-${Date.now()}-${current.length}`, title: '' },
    ])
  }

  const moveChecklistItem = (index: number, direction: -1 | 1) => {
    setChecklistDrafts((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const handleCreate = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(`${terminology.taskSingular} name is required.`)
      return
    }
    if (parentType !== 'internal' && !selectedParent) {
      setError(
        `Choose a ${getTaskParentSelectionLabel(parentType, terminology)} record.`,
      )
      return
    }

    const checklist: WorkItemChecklistItem[] = checklistDrafts
      .map((item, index) => ({
        id: item.id || `checklist-${Date.now()}-${index}`,
        title: item.title.trim(),
        completed: false,
      }))
      .filter((item) => item.title)

    const relatedRecordType: RelatedRecordType =
      parentType === 'internal' ? 'internal' : parentType
    const relatedLabel =
      parentType === 'internal'
        ? 'Internal operations'
        : (selectedParent?.label ?? 'Related record')
    const taskId = `task-${Date.now()}`
    const task: TaskRecord = {
      id: taskId,
      workspaceId,
      title: trimmedTitle,
      status,
      priority,
      relatedRecord: relatedLabel,
      relatedType: taskParentTypeToRelatedType(parentType),
      relatedRecordType,
      relatedRecordId:
        parentType === 'internal' ? taskId : (selectedParent?.id ?? ''),
      relatedRecordLabel: relatedLabel,
      parentType: parentType as WorkItemParentType,
      parentId: parentType === 'internal' ? taskId : selectedParent?.id,
      parentLabel: relatedLabel,
      checklist,
      clientId: selectedParent?.clientId ?? undefined,
      clientName: selectedParent?.customerName ?? undefined,
      dueDate,
      ownerId,
      assignedOwner: getOwnerName(workspaceOwners, ownerId),
      source: taskParentTypeToSource(parentType),
      createdAt: new Date().toISOString(),
      estimatedTime: estimatedTime.trim() || '30 min',
      description: description.trim(),
      notes: notes.trim(),
      timeline: [
        {
          title: 'Task created',
          detail:
            parentType === 'internal'
              ? 'Created as internal work.'
              : `Created from ${getTaskParentSelectionLabel(parentType, terminology)} context.`,
          timestamp: new Date().toISOString(),
          tone: 'cyan',
        },
      ],
    }

    onCreateTask(task)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-task-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2
              id="new-task-title"
              className="text-lg font-semibold text-neutral-100"
            >
              New {terminology.taskSingular}
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Create one clear {terminology.taskSingular.toLowerCase()} with one
              authoritative related record.
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

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {error ? (
              <div className="rounded-xl border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-100 sm:col-span-2">
                {error}
              </div>
            ) : null}
            <FormField
              label={`${terminology.taskSingular} Name`}
              className="sm:col-span-2"
            >
              <Input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (error) setError(null)
                }}
                placeholder={`Enter ${terminology.taskSingular.toLowerCase()} name`}
                aria-invalid={Boolean(error && !title.trim())}
              />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the work to be completed"
              />
            </FormField>
            <FormField label="Priority">
              <Select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskPriority)
                }
              >
                {priorityOptions
                  .filter((priority) => priority !== 'All')
                  .map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as TaskStatus)
                }
              >
                {statusOptions
                  .filter((status) => status !== 'All')
                  .map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label={ownershipLabels.tasks.drawer}>
              <Select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Due Date">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </FormField>
            <FormField label="Related to">
              <Select
                value={parentType}
                onChange={(event) => {
                  setParentType(event.target.value as TaskParentSelectionType)
                  setError(null)
                }}
              >
                {(
                  [
                    'serviceRequest',
                    'project',
                    'client',
                    'opportunity',
                    'lead',
                    'internal',
                  ] as TaskParentSelectionType[]
                ).map((type) => (
                  <option key={type} value={type}>
                    {getTaskParentSelectionLabel(type, terminology)}
                  </option>
                ))}
              </Select>
            </FormField>
            {parentType !== 'internal' ? (
              <FormField
                label={getTaskParentSelectionLabel(parentType, terminology)}
              >
                <Select
                  value={parentId}
                  onChange={(event) => {
                    setParentId(event.target.value)
                    setError(null)
                  }}
                >
                  {parentOptions.length ? (
                    parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">No records available</option>
                  )}
                </Select>
              </FormField>
            ) : (
              <div className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-sm">
                Internal tasks do not require a parent record.
              </div>
            )}
            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 sm:col-span-2">
              <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-wide">
                Connected context
              </p>
              {parentType === 'internal' ? (
                <p className="mt-1 text-sm text-neutral-100">Internal work</p>
              ) : selectedParent ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {selectedParent.customerName ? (
                    <InfoPill
                      label={terminology.customerSingular}
                      value={selectedParent.customerName}
                    />
                  ) : null}
                  {cleanDisplayValue(selectedParent.companyName) ? (
                    <InfoPill
                      label="Company"
                      value={
                        cleanDisplayValue(selectedParent.companyName) ?? ''
                      }
                    />
                  ) : null}
                  {selectedParent.opportunityLabel ? (
                    <InfoPill
                      label="Opportunity"
                      value={selectedParent.opportunityLabel}
                    />
                  ) : null}
                  {!selectedParent.customerName &&
                  !cleanDisplayValue(selectedParent.companyName) &&
                  !selectedParent.opportunityLabel ? (
                    <p className="text-neutral-text-secondary text-sm">
                      No additional connected context is available.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-neutral-text-secondary mt-1 text-sm">
                  Choose a record to see connected context.
                </p>
              )}
            </div>
            <FormField label="Estimated Time">
              <Input
                value={estimatedTime}
                onChange={(event) => setEstimatedTime(event.target.value)}
                placeholder="30 min"
              />
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add internal notes"
              />
            </FormField>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    Checklist
                  </p>
                  <p className="text-neutral-text-secondary text-xs">
                    Add smaller checklist items inside this{' '}
                    {terminology.taskSingular.toLowerCase()}.
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setChecklistExpanded((current) => !current)
                    if (!checklistExpanded && checklistDrafts.length === 0) {
                      setChecklistDrafts([
                        { id: `checklist-${Date.now()}-0`, title: '' },
                      ])
                    }
                  }}
                >
                  {checklistExpanded ? 'Hide checklist' : 'Add checklist'}
                </Button>
              </div>
              {checklistExpanded ? (
                <div className="mt-3 space-y-2">
                  {checklistDrafts.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <Input
                        value={item.title}
                        onChange={(event) => {
                          const value = event.target.value
                          setChecklistDrafts((current) =>
                            current.map((draft) =>
                              draft.id === item.id
                                ? { ...draft, title: value }
                                : draft,
                            ),
                          )
                        }}
                        placeholder={`Checklist item ${index + 1}`}
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveChecklistItem(index, -1)}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={index === checklistDrafts.length - 1}
                          onClick={() => moveChecklistItem(index, 1)}
                        >
                          Down
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            setChecklistDrafts((current) =>
                              current.filter((draft) => draft.id !== item.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={addChecklistItem}
                  >
                    Add item
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate}>
            Create {terminology.taskSingular}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-neutral-text-secondary text-[11px] uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  )
}

function FormField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('space-y-1.5', className)}>
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
      </span>
      {children}
    </label>
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

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function ClientInfoItem({
  client,
  fallback,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  onOpenClient,
}: {
  client: WorkspaceClient | null
  fallback: string
  terminology?: WorkspaceRecordTerminology
  onOpenClient: (client: WorkspaceClient) => void
}) {
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <p className="text-neutral-text-secondary text-[11px] uppercase tracking-[0.18em]">
        {terminology.customerSingular}
      </p>
      {client ? (
        <button
          type="button"
          onClick={() => onOpenClient(client)}
          className="mt-1 text-left text-sm font-medium text-cyan-700 transition hover:text-cyan-800 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-cyan-100 dark:hover:text-cyan-50"
        >
          {client.name}
        </button>
      ) : (
        <p className="text-app-primary mt-1 text-sm font-medium">{fallback}</p>
      )}
    </div>
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
