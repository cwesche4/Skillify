export type ServiceRequestStatus =
  | 'New'
  | 'Scheduled'
  | 'In Progress'
  | 'Waiting On Client'
  | 'Completed'
  | 'Cancelled'

export type ServiceRequestPriority = 'Low' | 'Normal' | 'High' | 'Urgent'

export type ServiceRequestType = string

export type WorkspaceServiceRequestTypeOption = {
  id: string
  workspaceId: string
  label: string
  normalizedLabel: string
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type ServiceRequestTimelineItem = {
  id: string
  label: string
  timestamp: string
  description: string
}

export type ServiceRequestRelatedRecords = {
  linkedClient: string
  linkedTasks: string
  linkedOpportunity: string
}

export type WorkspaceServiceRequest = {
  id: string
  workspaceId: string
  workspaceSlug?: string
  clientId?: string | null
  clientName?: string | null
  customerName: string
  company: string
  email: string
  phone: string
  title: string
  description: string
  notes: string
  priority: ServiceRequestPriority
  status: ServiceRequestStatus
  serviceType: ServiceRequestType
  valueCents?: number
  currency?: string
  assignedToOwnerId: string
  scheduledFor: string | null
  estimatedDuration: string
  createdAt: string
  completedAt?: string | null
  source?: 'Client' | 'Manual' | 'Workflow' | 'AI Coach'
  relatedRecordType?: 'client' | 'lead' | 'opportunity' | 'task' | 'automation'
  relatedRecordId?: string | null
  relatedRecordLabel?: string | null
  relatedRecords: ServiceRequestRelatedRecords
  timeline: ServiceRequestTimelineItem[]
}
