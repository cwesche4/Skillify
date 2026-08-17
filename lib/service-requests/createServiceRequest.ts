import type { WorkspaceClient } from '@/lib/clients/types'
import type {
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
  WorkspaceServiceRequest,
} from '@/lib/service-requests/types'
import type { WorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'
import { getLocalTimestamp } from '@/lib/formatting/dates'

export type CreateWorkspaceServiceRequestInput = {
  client: WorkspaceClient
  title: string
  description?: string
  serviceType: ServiceRequestType
  priority: ServiceRequestPriority
  status?: ServiceRequestStatus
  valueCents?: number
  currency?: string
  ownerId: string
  ownerName: string
  scheduledFor?: string | null
  estimatedDuration?: string
  source?: WorkspaceServiceRequest['source']
  terminology: WorkspaceRecordTerminology
}

export function createWorkspaceServiceRequestFromClient({
  client,
  title,
  description,
  serviceType,
  priority,
  status = 'New',
  valueCents,
  currency = 'USD',
  ownerId,
  ownerName,
  scheduledFor,
  estimatedDuration = '1 hour',
  source = 'Client',
  terminology,
}: CreateWorkspaceServiceRequestInput): WorkspaceServiceRequest {
  const createdAt = getLocalTimestamp()
  const requestId = `request-client-${client.id}-${Date.now()}`
  const requestTitle = title.trim()

  return {
    id: requestId,
    workspaceId: client.workspaceId,
    workspaceSlug: client.workspaceId,
    clientId: client.id,
    clientName: client.company,
    customerName: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    title: requestTitle,
    description:
      description?.trim() ||
      `${terminology.serviceRequestSingular} created from ${client.company}'s ${terminology.customerSingular.toLowerCase()} context.`,
    notes:
      'Preview request. Changes are stored locally for this workspace session.',
    priority,
    status,
    serviceType,
    valueCents,
    currency,
    assignedToOwnerId: ownerId,
    scheduledFor: scheduledFor ?? null,
    estimatedDuration,
    createdAt,
    completedAt: status === 'Completed' ? createdAt : null,
    source,
    relatedRecordType: 'client',
    relatedRecordId: client.id,
    relatedRecordLabel: client.company,
    relatedRecords: {
      linkedClient: client.company,
      linkedTasks: `No linked ${terminology.taskPlural.toLowerCase()} yet`,
      linkedOpportunity: '',
    },
    timeline: [
      {
        id: `${requestId}-created`,
        label: `${terminology.serviceRequestSingular} created`,
        timestamp: createdAt,
        description: `Created from ${client.company}'s ${terminology.customerSingular.toLowerCase()} profile.`,
      },
      {
        id: `${requestId}-assigned`,
        label: 'Assigned',
        timestamp: createdAt,
        description: `Assigned to ${ownerName}.`,
      },
    ],
  }
}
