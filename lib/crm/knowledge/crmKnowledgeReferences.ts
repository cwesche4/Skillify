import {
  type CRMEntityType,
  type CRMKnowledgeRecordSource,
  type CRMReference,
} from '@/lib/crm/knowledge/crmKnowledgeTypes'

export function createCRMReference({
  workspaceId,
  entityType,
  entityId,
  label,
  safeSummary,
  timestamp,
  source,
  metadata,
}: {
  workspaceId: string
  entityType: CRMEntityType
  entityId: string
  label: string
  safeSummary?: string
  timestamp?: string
  source?: CRMKnowledgeRecordSource
  metadata?: CRMReference['metadata']
}): CRMReference {
  return {
    id: `crm-reference:${workspaceId}:${entityType}:${entityId}`,
    workspaceId,
    entityType,
    entityId,
    label,
    safeSummary: safeSummary ?? label,
    timestamp,
    source: source ?? 'unknown',
    metadata,
  }
}
