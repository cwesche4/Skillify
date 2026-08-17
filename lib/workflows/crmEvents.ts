import type { WorkspaceActivityRecord } from '@/lib/workspace-records/activity'

export type WorkflowCrmEventName =
  | 'lead.created'
  | 'lead.converted'
  | 'opportunity.created'
  | 'opportunity.stage_changed'
  | 'opportunity.won'
  | 'opportunity.lost'
  | 'client.created'
  | 'client.health_changed'
  | 'task.created'
  | 'task.completed'
  | 'service_request.created'
  | 'service_request.completed'
  | 'automation.failed'

export type WorkflowCrmEvent = {
  name: WorkflowCrmEventName
  workspaceId: string
  recordId: string
  recordType: WorkspaceActivityRecord['recordType']
  timestamp: string
  payload: Record<string, unknown>
}

const activityToWorkflowEvent: Partial<Record<string, WorkflowCrmEventName>> = {
  'lead:created': 'lead.created',
  'lead:statusChanged:Lead converted to opportunity': 'lead.converted',
  'opportunity:created': 'opportunity.created',
  'opportunity:updated:Opportunity stage changed': 'opportunity.stage_changed',
  'opportunity:statusChanged:Opportunity won': 'opportunity.won',
  'opportunity:statusChanged:Opportunity lost': 'opportunity.lost',
  'client:created': 'client.created',
  'client:updated:Client health changed': 'client.health_changed',
  'task:created': 'task.created',
  'task:completed': 'task.completed',
  'serviceRequest:created': 'service_request.created',
  'serviceRequest:completed': 'service_request.completed',
  'automation:automationFailed': 'automation.failed',
}

export function mapActivityToWorkflowCrmEvent(
  event: WorkspaceActivityRecord,
): WorkflowCrmEvent | null {
  const specificKey = `${event.recordType}:${event.action}:${event.title}`
  const genericKey = `${event.recordType}:${event.action}`
  const name =
    activityToWorkflowEvent[specificKey] ?? activityToWorkflowEvent[genericKey]

  if (!name) return null

  return {
    name,
    workspaceId: event.workspaceId,
    recordId: event.recordId,
    recordType: event.recordType,
    timestamp: event.timestamp,
    payload: {
      title: event.title,
      description: event.description,
      ...event.metadata,
    },
  }
}

export function getWorkflowTriggerEventOptions() {
  return [
    'lead.created',
    'lead.converted',
    'opportunity.created',
    'opportunity.stage_changed',
    'opportunity.won',
    'opportunity.lost',
    'client.created',
    'client.health_changed',
    'task.created',
    'task.completed',
    'service_request.created',
    'service_request.completed',
    'automation.failed',
  ] satisfies WorkflowCrmEventName[]
}
