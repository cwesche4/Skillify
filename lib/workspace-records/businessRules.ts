import type { WorkspaceClient, ClientHealth } from '@/lib/clients/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import type { TaskRecord } from '@/lib/tasks/demoTasks'
import {
  getClientServiceRequestSummary,
  getClientTaskSummary,
  compareTaskPriority,
  getDueOrOverdueOpenTasks,
  getDueTodayOpenTasks,
  getOpenServiceRequests,
  getOverdueOpenTasks,
  getUrgentOpenServiceRequests,
  isIncompleteTask,
} from '@/lib/workspace-records/relationships'

export type ClientDerivedState = {
  health: ClientHealth
  nextAction: string
  openTasks: number
  overdueTasks: number
  dueTodayTasks: number
  openServiceRequests: number
  urgentServiceRequests: number
  nextTaskDueDate: string | null
  nextScheduledRequestAt: string | null
  fulfillmentProgress: number
  slaStatus: 'on-track' | 'at-risk' | 'breached'
  automationEligibility: string[]
}

export type WorkspaceActivityEvent = {
  id: string
  workspaceId: string
  recordId: string
  recordType:
    | 'client'
    | 'task'
    | 'serviceRequest'
    | 'opportunity'
    | 'automation'
  title: string
  description: string
  timestamp: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

export type WorkspaceCrmSnapshot = {
  workspaceId: string
  clients: WorkspaceClient[]
  tasks: TaskRecord[]
  serviceRequests: WorkspaceServiceRequest[]
}

export type WorkspaceCrmRollup = {
  openTasks: number
  overdueTasks: number
  dueTodayTasks: number
  openServiceRequests: number
  urgentServiceRequests: number
  atRiskClients: number
  needsAttentionClients: number
  nextActions: WorkspaceActivityEvent[]
  workloadByOwner: Array<{
    ownerId: string
    openTasks: number
    overdueTasks: number
    openRequests: number
    urgentRequests: number
    workloadScore: number
  }>
}

export type WorkspaceCrmRecalculation = {
  clients: WorkspaceClient[]
  rollup: WorkspaceCrmRollup
  activityTimeline: WorkspaceActivityEvent[]
}

function byPriorityAndDueDate(first: TaskRecord, second: TaskRecord) {
  const priorityDelta = compareTaskPriority(first.priority, second.priority)
  if (priorityDelta !== 0) return priorityDelta
  return first.dueDate.localeCompare(second.dueDate)
}

function deriveHealth(
  client: WorkspaceClient,
  taskSummary: ReturnType<typeof getClientTaskSummary>,
  requestSummary: ReturnType<typeof getClientServiceRequestSummary>,
): ClientHealth {
  if (
    client.status === 'Inactive' ||
    taskSummary.overdueCount >= 2 ||
    requestSummary.urgentCount > 0
  ) {
    return 'At Risk'
  }

  if (
    client.pipelineStage === 'Waiting on Client' ||
    taskSummary.overdueCount > 0 ||
    taskSummary.dueTodayCount > 0 ||
    requestSummary.openCount > 0
  ) {
    return 'Needs Attention'
  }

  return 'Healthy'
}

function deriveNextAction(
  client: WorkspaceClient,
  taskSummary: ReturnType<typeof getClientTaskSummary>,
  requestSummary: ReturnType<typeof getClientServiceRequestSummary>,
) {
  const nextTask = [
    ...taskSummary.overdueTasks,
    ...taskSummary.dueTodayTasks,
    ...taskSummary.upcomingTasks,
  ].sort(byPriorityAndDueDate)[0]

  if (nextTask) return nextTask.title

  const urgentRequest = requestSummary.urgentRequests[0]
  if (urgentRequest) return urgentRequest.title

  const nextScheduledRequest = requestSummary.scheduledRequests[0]
  if (nextScheduledRequest) return nextScheduledRequest.title

  if (client.pipelineStage === 'Waiting on Client')
    return 'Waiting on client approval'
  if (client.pipelineStage === 'Maintenance') return 'Maintenance check-in due'
  if (client.status === 'Completed') return 'No action needed'

  return client.nextAction || client.pipelineStage
}

export function calculateFulfillmentProgress(client: WorkspaceClient) {
  const stageProgress: Record<string, number> = {
    Onboarding: 15,
    'In Progress': 45,
    'Waiting on Client': 55,
    'Review / Approval': 72,
    Completed: 100,
    Maintenance: 90,
    Inactive: 0,
  }

  return stageProgress[client.pipelineStage] ?? 25
}

export function calculateClientSlaStatus(
  taskSummary: ReturnType<typeof getClientTaskSummary>,
  requestSummary: ReturnType<typeof getClientServiceRequestSummary>,
) {
  if (taskSummary.overdueCount > 0 || requestSummary.urgentCount > 0) {
    return 'breached' as const
  }

  if (taskSummary.dueTodayCount > 0 || requestSummary.openCount > 0) {
    return 'at-risk' as const
  }

  return 'on-track' as const
}

export function getAutomationEligibility(
  client: WorkspaceClient,
  taskSummary: ReturnType<typeof getClientTaskSummary>,
  requestSummary: ReturnType<typeof getClientServiceRequestSummary>,
) {
  const eligibility: string[] = []

  if (taskSummary.overdueCount > 0 || taskSummary.dueTodayCount > 0) {
    eligibility.push('follow-up-reminder')
  }
  if (requestSummary.urgentCount > 0) {
    eligibility.push('urgent-request-escalation')
  }
  if (client.pipelineStage === 'Waiting on Client') {
    eligibility.push('client-approval-follow-up')
  }
  if (client.pipelineStage === 'Completed' || client.status === 'Completed') {
    eligibility.push('review-request')
  }
  if (client.pipelineStage === 'Maintenance') {
    eligibility.push('maintenance-check-in')
  }

  return eligibility
}

export function deriveClientState(
  client: WorkspaceClient,
  tasks: TaskRecord[],
  serviceRequests: WorkspaceServiceRequest[],
): ClientDerivedState {
  const taskSummary = getClientTaskSummary(tasks, client.id)
  const requestSummary = getClientServiceRequestSummary(
    serviceRequests,
    client.id,
    client.company,
  )

  return {
    health: deriveHealth(client, taskSummary, requestSummary),
    nextAction: deriveNextAction(client, taskSummary, requestSummary),
    openTasks: taskSummary.openCount,
    overdueTasks: taskSummary.overdueCount,
    dueTodayTasks: taskSummary.dueTodayCount,
    openServiceRequests: requestSummary.openCount,
    urgentServiceRequests: requestSummary.urgentCount,
    nextTaskDueDate: taskSummary.nextDueDate,
    nextScheduledRequestAt: requestSummary.nextScheduledAt,
    fulfillmentProgress: calculateFulfillmentProgress(client),
    slaStatus: calculateClientSlaStatus(taskSummary, requestSummary),
    automationEligibility: getAutomationEligibility(
      client,
      taskSummary,
      requestSummary,
    ),
  }
}

export function applyWorkspaceClientDerivations(
  clients: WorkspaceClient[],
  tasks: TaskRecord[],
  serviceRequests: WorkspaceServiceRequest[],
) {
  return clients.map((client) => {
    const derived = deriveClientState(client, tasks, serviceRequests)
    return {
      ...client,
      health: derived.health,
      nextAction: derived.nextAction,
      openTasks: derived.openTasks,
    }
  })
}

export function buildWorkspaceActivityTimeline({
  workspaceId,
  tasks,
  serviceRequests,
}: Pick<WorkspaceCrmSnapshot, 'workspaceId' | 'tasks' | 'serviceRequests'>) {
  const taskEvents: WorkspaceActivityEvent[] = tasks.map((task) => ({
    id: `task:${task.id}`,
    workspaceId,
    recordId: task.id,
    recordType: 'task',
    title: task.title,
    description: `${task.status} task due ${task.dueDate}`,
    timestamp: task.completedAt ?? task.createdAt,
    priority:
      task.priority === 'Urgent'
        ? 'urgent'
        : task.priority === 'High'
          ? 'high'
          : task.priority === 'Medium'
            ? 'normal'
            : 'low',
  }))

  const requestEvents: WorkspaceActivityEvent[] = serviceRequests.map(
    (request) => ({
      id: `serviceRequest:${request.id}`,
      workspaceId,
      recordId: request.id,
      recordType: 'serviceRequest',
      title: request.title,
      description: `${request.status} request for ${request.company}`,
      timestamp: request.completedAt ?? request.createdAt,
      priority:
        request.priority === 'Urgent'
          ? 'urgent'
          : request.priority === 'High'
            ? 'high'
            : request.priority === 'Normal'
              ? 'normal'
              : 'low',
    }),
  )

  return [...taskEvents, ...requestEvents].sort((first, second) =>
    second.timestamp.localeCompare(first.timestamp),
  )
}

export function calculateWorkspaceCrmRollup({
  workspaceId,
  clients,
  tasks,
  serviceRequests,
}: WorkspaceCrmSnapshot): WorkspaceCrmRollup {
  const derivedClients = applyWorkspaceClientDerivations(
    clients,
    tasks,
    serviceRequests,
  )

  const ownerIds = new Set<string>()
  tasks.forEach((task) => ownerIds.add(task.ownerId))
  serviceRequests.forEach((request) => ownerIds.add(request.assignedToOwnerId))

  return {
    openTasks: tasks.filter(isIncompleteTask).length,
    overdueTasks: getOverdueOpenTasks(tasks).length,
    dueTodayTasks: getDueTodayOpenTasks(tasks).length,
    openServiceRequests: getOpenServiceRequests(serviceRequests).length,
    urgentServiceRequests: getUrgentOpenServiceRequests(serviceRequests).length,
    atRiskClients: derivedClients.filter(
      (client) => client.health === 'At Risk',
    ).length,
    needsAttentionClients: derivedClients.filter(
      (client) => client.health === 'Needs Attention',
    ).length,
    nextActions: buildWorkspaceActivityTimeline({
      workspaceId,
      tasks: tasks.filter(isIncompleteTask),
      serviceRequests: serviceRequests.filter(
        (request) => !['Completed', 'Cancelled'].includes(request.status),
      ),
    }).slice(0, 8),
    workloadByOwner: [...ownerIds].map((ownerId) => {
      const ownerTasks = tasks.filter((task) => task.ownerId === ownerId)
      const ownerRequests = serviceRequests.filter(
        (request) => request.assignedToOwnerId === ownerId,
      )
      const overdueTasks = getOverdueOpenTasks(ownerTasks).length
      const urgentRequests = getUrgentOpenServiceRequests(ownerRequests).length
      const openTasks = ownerTasks.filter(isIncompleteTask).length
      const openRequests = getOpenServiceRequests(ownerRequests).length

      return {
        ownerId,
        openTasks,
        overdueTasks,
        openRequests,
        urgentRequests,
        workloadScore:
          openTasks +
          openRequests +
          overdueTasks * 2 +
          urgentRequests * 3 +
          getDueOrOverdueOpenTasks(ownerTasks).length,
      }
    }),
  }
}

export function recalculateWorkspaceCrm(
  snapshot: WorkspaceCrmSnapshot,
): WorkspaceCrmRecalculation {
  const clients = applyWorkspaceClientDerivations(
    snapshot.clients,
    snapshot.tasks,
    snapshot.serviceRequests,
  )
  const rollup = calculateWorkspaceCrmRollup(snapshot)
  const activityTimeline = buildWorkspaceActivityTimeline({
    workspaceId: snapshot.workspaceId,
    tasks: snapshot.tasks,
    serviceRequests: snapshot.serviceRequests,
  })

  return {
    clients,
    rollup,
    activityTimeline,
  }
}

export function calculateExpectedRevenue(value: number, probability: number) {
  return Math.round(value * (probability / 100))
}

export function deriveOpportunityProbability({
  currentProbability,
  stage,
  status,
}: {
  currentProbability?: number
  stage: string
  status: string
}) {
  if (status === 'Closed-Won') return 100
  if (status === 'Closed-Lost') return 0
  if (currentProbability != null) return currentProbability

  const stageDefaults: Record<string, number> = {
    'New Lead': 20,
    Qualified: 35,
    Discovery: 45,
    'Discovery Scheduled': 45,
    'Proposal Sent': 65,
    Negotiation: 78,
    Won: 100,
    Lost: 0,
  }

  return stageDefaults[stage] ?? 50
}
