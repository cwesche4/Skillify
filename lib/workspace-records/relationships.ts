export type WorkspaceRecordType =
  | 'lead'
  | 'opportunity'
  | 'client'
  | 'task'
  | 'serviceRequest'
  | 'automation'
  | 'execution'
  | 'report'

export type WorkspaceLinkedRecord = {
  id: string
  workspaceId: string
  type: WorkspaceRecordType
  label: string
  description?: string
  href?: string
}

import type { WorkspaceClient } from '@/lib/clients/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import { demoTaskToday, type TaskRecord } from '@/lib/tasks/demoTasks'

export function createWorkspaceLinkedRecord(
  record: WorkspaceLinkedRecord,
): WorkspaceLinkedRecord {
  return record
}

export function getWorkspaceScopedLinkedRecords(
  records: WorkspaceLinkedRecord[],
  workspaceId: string,
) {
  return records.filter((record) => record.workspaceId === workspaceId)
}

export function getLinkedRecordsByType(
  records: WorkspaceLinkedRecord[],
  type: WorkspaceRecordType,
) {
  return records.filter((record) => record.type === type)
}

export function isIncompleteTask(task: TaskRecord) {
  return task.status !== 'Completed' && task.status !== 'Canceled'
}

export function isTaskDueToday(task: TaskRecord) {
  return getDueTodayOpenTasks([task]).length === 1
}

export function isOverdueTask(task: TaskRecord) {
  return getOverdueOpenTasks([task]).length === 1
}

export function getDueTodayOpenTasks(
  tasks: TaskRecord[],
  today = demoTaskToday,
) {
  return sortTasksByDueDatePriority(
    tasks.filter(
      (task) =>
        isIncompleteTask(task) &&
        Boolean(task.dueDate) &&
        task.dueDate === today,
    ),
  )
}

export function getOverdueOpenTasks(
  tasks: TaskRecord[],
  today = demoTaskToday,
) {
  return sortTasksByDueDatePriority(
    tasks.filter(
      (task) =>
        isIncompleteTask(task) && Boolean(task.dueDate) && task.dueDate < today,
    ),
  )
}

export function getDueOrOverdueOpenTasks(
  tasks: TaskRecord[],
  today = demoTaskToday,
) {
  return sortTasksByDueDatePriority(
    tasks.filter(
      (task) =>
        isIncompleteTask(task) &&
        Boolean(task.dueDate) &&
        task.dueDate <= today,
    ),
  )
}

export const taskPriorityRank: Record<TaskRecord['priority'], number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

export function compareTaskPriority(
  first: TaskRecord['priority'],
  second: TaskRecord['priority'],
) {
  return taskPriorityRank[first] - taskPriorityRank[second]
}

function getTaskStableSortLabel(task: TaskRecord) {
  return [
    task.title,
    task.clientName,
    task.relatedRecordLabel,
    task.relatedRecord,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function compareTaskStableLabel(first: TaskRecord, second: TaskRecord) {
  return getTaskStableSortLabel(first).localeCompare(
    getTaskStableSortLabel(second),
  )
}

type TaskSortFields = {
  dueDate?: string | null
  due?: string | null
  priority: TaskRecord['priority']
  title: string
  clientName?: string | null
  relatedRecordLabel?: string | null
  relatedRecord?: string | null
  owner?: string | null
}

function getTaskSortDueDate(task: TaskSortFields) {
  return task.dueDate ?? task.due ?? null
}

function getTaskSortStableLabel(task: TaskSortFields) {
  return [
    task.title,
    task.clientName,
    task.relatedRecordLabel,
    task.relatedRecord,
    task.owner,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function compareTaskDueDatePriorityFields<T extends TaskSortFields>(
  first: T,
  second: T,
) {
  const firstDueDate = getTaskSortDueDate(first)
  const secondDueDate = getTaskSortDueDate(second)
  const firstHasDueDate = Boolean(firstDueDate)
  const secondHasDueDate = Boolean(secondDueDate)
  if (firstHasDueDate !== secondHasDueDate) return firstHasDueDate ? -1 : 1

  if (firstDueDate && secondDueDate) {
    const dueDateDelta = firstDueDate.localeCompare(secondDueDate)
    if (dueDateDelta !== 0) return dueDateDelta
  }

  const priorityDelta = compareTaskPriority(first.priority, second.priority)
  if (priorityDelta !== 0) return priorityDelta

  return getTaskSortStableLabel(first).localeCompare(
    getTaskSortStableLabel(second),
  )
}

export function compareTasksByDueDatePriority(
  first: TaskRecord,
  second: TaskRecord,
) {
  return compareTaskDueDatePriorityFields(first, second)
}

export const compareDueOrOverdueTasks = compareTasksByDueDatePriority

export function sortTasksByDueDatePriority<T extends TaskRecord>(tasks: T[]) {
  return tasks.slice().sort(compareTasksByDueDatePriority)
}

export function sortTaskLikeByDueDatePriority<T extends TaskSortFields>(
  tasks: T[],
) {
  return tasks.slice().sort(compareTaskDueDatePriorityFields)
}

export function getSortedIncompleteTasksByDueDatePriority(tasks: TaskRecord[]) {
  return sortTasksByDueDatePriority(tasks.filter(isIncompleteTask))
}

export function getDashboardPriorityTasks(
  tasks: TaskRecord[],
  today = demoTaskToday,
) {
  void today
  return getSortedIncompleteTasksByDueDatePriority(tasks)
}

export function getTasksForClient(tasks: TaskRecord[], clientId: string) {
  return tasks.filter(
    (task) =>
      task.clientId === clientId ||
      (task.relatedRecordType === 'client' &&
        task.relatedRecordId === clientId),
  )
}

export function getOpenTasksForClient(tasks: TaskRecord[], clientId: string) {
  return getTasksForClient(tasks, clientId).filter(isIncompleteTask)
}

export function getOverdueTasksForClient(
  tasks: TaskRecord[],
  clientId: string,
) {
  return getTasksForClient(tasks, clientId).filter(isOverdueTask)
}

export function getDueTodayTasksForClient(
  tasks: TaskRecord[],
  clientId: string,
) {
  return getTasksForClient(tasks, clientId).filter(isTaskDueToday)
}

export function getCompletedTasksForClient(
  tasks: TaskRecord[],
  clientId: string,
) {
  return getTasksForClient(tasks, clientId).filter(
    (task) => task.status === 'Completed',
  )
}

export function getUpcomingTasksForClient(
  tasks: TaskRecord[],
  clientId: string,
) {
  return getOpenTasksForClient(tasks, clientId)
    .filter((task) => task.dueDate >= demoTaskToday)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function getNextTaskForClient(tasks: TaskRecord[], clientId: string) {
  return getUpcomingTasksForClient(tasks, clientId)[0] ?? null
}

export function getTaskClient(
  clients: WorkspaceClient[],
  task: TaskRecord,
): WorkspaceClient | null {
  const clientId =
    task.clientId ??
    (task.relatedRecordType === 'client' ? task.relatedRecordId : null)

  return clientId
    ? (clients.find((client) => client.id === clientId) ?? null)
    : null
}

export function getClientTaskSummary(tasks: TaskRecord[], clientId: string) {
  const relatedTasks = getTasksForClient(tasks, clientId)
  const openTasks = relatedTasks.filter(isIncompleteTask)
  const overdueTasks = relatedTasks.filter(isOverdueTask)
  const dueTodayTasks = relatedTasks.filter(isTaskDueToday)
  const completedTasks = relatedTasks.filter(
    (task) => task.status === 'Completed',
  )
  const upcomingTasks = getUpcomingTasksForClient(tasks, clientId)
  const nextTask = upcomingTasks[0] ?? null
  const mostRecentTask =
    [...relatedTasks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0] ?? null

  return {
    relatedTasks,
    openTasks,
    overdueTasks,
    dueTodayTasks,
    completedTasks,
    upcomingTasks,
    nextTask,
    openCount: openTasks.length,
    overdueCount: overdueTasks.length,
    dueTodayCount: dueTodayTasks.length,
    completedCount: completedTasks.length,
    upcomingCount: upcomingTasks.length,
    nextDueDate: nextTask?.dueDate ?? null,
    mostRecentActivity: mostRecentTask
      ? `${mostRecentTask.title} · ${mostRecentTask.createdAt}`
      : null,
  }
}

export function getServiceRequestsForClient(
  requests: WorkspaceServiceRequest[],
  clientId: string,
  clientLabel?: string,
) {
  return requests.filter(
    (request) =>
      request.clientId === clientId ||
      (request.relatedRecordType === 'client' &&
        request.relatedRecordId === clientId) ||
      (clientLabel
        ? [
            request.clientName,
            request.company,
            request.relatedRecordLabel,
            request.relatedRecords.linkedClient,
          ].includes(clientLabel)
        : false),
  )
}

type ServiceRequestStatusFields = {
  status: string
}
type ServiceRequestPriorityFields = {
  status: string
  priority: string
}
type ServiceRequestScheduledFields = ServiceRequestStatusFields & {
  scheduledFor: string | null
}
type LeadStatusFields = {
  status: string
}
type LeadFollowUpFields = {
  followUpDue?: string
  lastActivityAt?: string
  converted?: boolean
  stage?: string
  status?: string
}
type OpportunityStatusFields = {
  status: string
}
type OpportunitySortFields = OpportunityStatusFields & {
  value: number
  probability: number
  lastActivityAt?: string
  name?: string
  client?: string
}
type AutomationStatusFields = {
  status?: string
}

export function isOpenServiceRequest<T extends ServiceRequestStatusFields>(
  request: T,
) {
  return !['Completed', 'Cancelled'].includes(request.status)
}

export function getOpenServiceRequests<T extends ServiceRequestStatusFields>(
  requests: T[],
) {
  return requests.filter(isOpenServiceRequest)
}

export function getUrgentOpenServiceRequests<
  T extends ServiceRequestPriorityFields,
>(requests: T[]) {
  return getOpenServiceRequests(requests).filter(
    (request) => request.priority === 'Urgent',
  )
}

export function getScheduledTodayOpenServiceRequests<
  T extends ServiceRequestScheduledFields,
>(requests: T[], now = new Date()) {
  return getOpenServiceRequests(requests).filter((request) => {
    if (!request.scheduledFor) return false
    return new Date(request.scheduledFor).toDateString() === now.toDateString()
  })
}

export function selectNewLeads<T extends LeadStatusFields>(leads: T[]) {
  return leads.filter((lead) => lead.status === 'New')
}

export function selectLeadsNeedingFollowUp<T extends LeadFollowUpFields>(
  leads: T[],
  today = '2026-06-29',
) {
  return leads.filter(
    (lead) =>
      !lead.converted &&
      lead.stage !== 'Converted' &&
      lead.status !== 'Converted' &&
      lead.stage !== 'Disqualified' &&
      lead.stage !== 'Lost' &&
      lead.status !== 'Disqualified' &&
      Boolean(lead.followUpDue),
  )
}

export function selectOpenOpportunities<T extends OpportunityStatusFields>(
  opportunities: T[],
) {
  return opportunities.filter(
    (opportunity) =>
      opportunity.status !== 'Closed-Won' &&
      opportunity.status !== 'Closed-Lost',
  )
}

export function selectWonOpportunities<T extends OpportunityStatusFields>(
  opportunities: T[],
) {
  return opportunities.filter(
    (opportunity) => opportunity.status === 'Closed-Won',
  )
}

export function selectLostOpportunities<T extends OpportunityStatusFields>(
  opportunities: T[],
) {
  return opportunities.filter(
    (opportunity) => opportunity.status === 'Closed-Lost',
  )
}

function getOpportunityStatusRank(status: string) {
  if (status === 'Active') return 0
  if (status === 'At Risk') return 1
  if (status === 'Closed-Won') return 2
  if (status === 'Closed-Lost') return 3
  return 4
}

export function compareOpportunitiesBySalesPriority<
  T extends OpportunitySortFields,
>(first: T, second: T) {
  const statusDelta =
    getOpportunityStatusRank(first.status) -
    getOpportunityStatusRank(second.status)
  if (statusDelta !== 0) return statusDelta

  const firstExpected = first.value * (first.probability / 100)
  const secondExpected = second.value * (second.probability / 100)
  const expectedDelta = secondExpected - firstExpected
  if (expectedDelta !== 0) return expectedDelta

  const activityDelta = (second.lastActivityAt ?? '').localeCompare(
    first.lastActivityAt ?? '',
  )
  if (activityDelta !== 0) return activityDelta

  return [first.name, first.client]
    .filter(Boolean)
    .join(' ')
    .localeCompare([second.name, second.client].filter(Boolean).join(' '))
}

export function sortOpportunitiesBySalesPriority<
  T extends OpportunitySortFields,
>(opportunities: T[]) {
  return opportunities.slice().sort(compareOpportunitiesBySalesPriority)
}

export function selectActiveAutomations<T extends AutomationStatusFields>(
  automations: T[],
) {
  return automations.filter((automation) => automation.status === 'ACTIVE')
}

export function getOpenServiceRequestsForClient(
  requests: WorkspaceServiceRequest[],
  clientId: string,
  clientLabel?: string,
) {
  return getServiceRequestsForClient(requests, clientId, clientLabel).filter(
    isOpenServiceRequest,
  )
}

export function getClientServiceRequestSummary(
  requests: WorkspaceServiceRequest[],
  clientId: string,
  clientLabel?: string,
) {
  const relatedRequests = getServiceRequestsForClient(
    requests,
    clientId,
    clientLabel,
  )
  const openRequests = relatedRequests.filter(isOpenServiceRequest)
  const urgentRequests = getUrgentOpenServiceRequests(relatedRequests)
  const scheduledRequests = openRequests
    .filter((request) => Boolean(request.scheduledFor))
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
  const completedRequests = relatedRequests.filter(
    (request) => request.status === 'Completed',
  )

  return {
    relatedRequests,
    openRequests,
    urgentRequests,
    scheduledRequests,
    completedRequests,
    openCount: openRequests.length,
    urgentCount: urgentRequests.length,
    completedCount: completedRequests.length,
    nextScheduledAt: scheduledRequests[0]?.scheduledFor ?? null,
  }
}
