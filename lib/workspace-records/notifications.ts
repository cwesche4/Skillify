import type { WorkspaceActivityRecord } from '@/lib/workspace-records/activity'

export type WorkspaceNotificationType =
  | 'overdueTask'
  | 'failedAutomation'
  | 'newLead'
  | 'proposalSent'
  | 'proposalViewed'
  | 'opportunityWon'
  | 'serviceRequestSubmitted'
  | 'clientNeedsAttention'

export type WorkspaceNotification = {
  id: string
  workspaceId: string
  type: WorkspaceNotificationType
  title: string
  description: string
  recordId?: string
  recordType?: WorkspaceActivityRecord['recordType']
  createdAt: string
  read: boolean
}

export function createNotificationFromActivity(
  event: WorkspaceActivityRecord,
): WorkspaceNotification | null {
  if (event.recordType === 'lead' && event.action === 'created') {
    return createNotification(event, 'newLead')
  }
  if (
    event.recordType === 'automation' &&
    event.action === 'automationFailed'
  ) {
    return createNotification(event, 'failedAutomation')
  }
  if (
    event.recordType === 'opportunity' &&
    event.title.toLowerCase().includes('won')
  ) {
    return createNotification(event, 'opportunityWon')
  }
  if (event.recordType === 'serviceRequest' && event.action === 'created') {
    return createNotification(event, 'serviceRequestSubmitted')
  }
  if (
    event.recordType === 'client' &&
    event.title.toLowerCase().includes('health')
  ) {
    return createNotification(event, 'clientNeedsAttention')
  }
  return null
}

function createNotification(
  event: WorkspaceActivityRecord,
  type: WorkspaceNotificationType,
): WorkspaceNotification {
  return {
    id: `notification-${event.id}`,
    workspaceId: event.workspaceId,
    type,
    title: event.title,
    description: event.description,
    recordId: event.recordId,
    recordType: event.recordType,
    createdAt: event.timestamp,
    read: false,
  }
}
