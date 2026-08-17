import type { WorkspaceClient } from '@/lib/clients/types'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import type { TaskRecord } from '@/lib/tasks/demoTasks'

export type WorkspaceSearchRecordType =
  | 'lead'
  | 'opportunity'
  | 'client'
  | 'task'
  | 'serviceRequest'
  | 'automation'
  | 'note'

export type WorkspaceSearchResult = {
  id: string
  type: WorkspaceSearchRecordType
  title: string
  subtitle?: string
  href?: string
  keywords: string
}

export function searchWorkspaceRecords(
  query: string,
  records: {
    leads?: LeadRecord[]
    opportunities?: OpportunityRecord[]
    clients?: WorkspaceClient[]
    tasks?: TaskRecord[]
    serviceRequests?: WorkspaceServiceRequest[]
  },
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return buildWorkspaceSearchIndex(records).filter((record) =>
    record.keywords.includes(normalizedQuery),
  )
}

export function buildWorkspaceSearchIndex(records: {
  leads?: LeadRecord[]
  opportunities?: OpportunityRecord[]
  clients?: WorkspaceClient[]
  tasks?: TaskRecord[]
  serviceRequests?: WorkspaceServiceRequest[]
}): WorkspaceSearchResult[] {
  return [
    ...(records.leads ?? []).map((lead) => ({
      id: lead.id,
      type: 'lead' as const,
      title: lead.name,
      subtitle: lead.company,
      keywords: [
        lead.name,
        lead.company,
        lead.status,
        lead.source,
        lead.nextStep,
        lead.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })),
    ...(records.opportunities ?? []).map((opportunity) => ({
      id: opportunity.id,
      type: 'opportunity' as const,
      title: opportunity.name,
      subtitle: opportunity.client,
      keywords: [
        opportunity.name,
        opportunity.client,
        opportunity.status,
        opportunity.stage,
        opportunity.nextStep,
        opportunity.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })),
    ...(records.clients ?? []).map((client) => ({
      id: client.id,
      type: 'client' as const,
      title: client.company,
      subtitle: client.name,
      keywords: [
        client.company,
        client.name,
        client.status,
        client.pipelineStage,
        client.nextAction,
        client.notes,
        ...client.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })),
    ...(records.tasks ?? []).map((task) => ({
      id: task.id,
      type: 'task' as const,
      title: task.title,
      subtitle:
        task.clientName ?? task.relatedRecordLabel ?? task.relatedRecord,
      keywords: [
        task.title,
        task.clientName,
        task.relatedRecordLabel,
        task.relatedRecord,
        task.status,
        task.priority,
        task.source,
        task.description,
        task.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })),
    ...(records.serviceRequests ?? []).map((request) => ({
      id: request.id,
      type: 'serviceRequest' as const,
      title: request.title,
      subtitle: request.company,
      keywords: [
        request.title,
        request.company,
        request.customerName,
        request.status,
        request.priority,
        request.serviceType,
        request.description,
        request.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })),
  ]
}
