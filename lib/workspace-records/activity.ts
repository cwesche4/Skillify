import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'
import { getLocalTimestamp } from '@/lib/formatting/dates'

export type WorkspaceActivityRecordType =
  | 'lead'
  | 'client'
  | 'task'
  | 'serviceRequest'
  | 'opportunity'
  | 'sale'
  | 'automation'
  | 'note'

export type WorkspaceActivityAction =
  | 'created'
  | 'updated'
  | 'assigned'
  | 'completed'
  | 'deleted'
  | 'statusChanged'
  | 'ownerChanged'
  | 'noteAdded'
  | 'automationTriggered'
  | 'automationFailed'

export type WorkspaceActivityRecord = {
  id: string
  workspaceId: string
  recordId: string
  recordType: WorkspaceActivityRecordType
  action: WorkspaceActivityAction
  title: string
  description: string
  timestamp: string
  actor?: string
  metadata?: Record<string, string | number | boolean | null>
}

const STORAGE_PREFIX = 'skillify-preview-activity'

function getPreviewActivityStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function createWorkspaceActivityRecord(
  event: Omit<WorkspaceActivityRecord, 'id' | 'timestamp'> & {
    id?: string
    timestamp?: string
  },
): WorkspaceActivityRecord {
  const timestamp = event.timestamp ?? getLocalTimestamp()
  return {
    ...event,
    id:
      event.id ??
      `activity-${event.recordType}-${event.recordId}-${event.action}-${timestamp}`,
    timestamp,
  }
}

export function readPreviewActivity(
  workspaceId: string,
): WorkspaceActivityRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewActivityStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as WorkspaceActivityRecord[]) : []
  } catch {
    return []
  }
}

export function writePreviewActivity(
  workspaceId: string,
  activity: WorkspaceActivityRecord[],
) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewActivityStorageKey(workspaceId),
    JSON.stringify(activity),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'activity')
}

export function appendPreviewActivity(
  workspaceId: string,
  event: WorkspaceActivityRecord,
) {
  const current = readPreviewActivity(workspaceId).filter(
    (record) => record.id !== event.id,
  )
  const next = [event, ...current].slice(0, 200)
  writePreviewActivity(workspaceId, next)
  return next
}

type RelatedActivityLookup = {
  leadId?: string | null
  sourceLeadId?: string | null
  opportunityId?: string | null
  clientId?: string | null
  taskIds?: string[]
  serviceRequestIds?: string[]
  companyName?: string | null
  clientName?: string | null
}

function metadataValueMatches(
  metadata: WorkspaceActivityRecord['metadata'],
  values: Set<string>,
) {
  if (!metadata) return false
  return Object.values(metadata).some((value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return false
    return values.has(String(value))
  })
}

export function getRelatedActivityRecords(
  activity: WorkspaceActivityRecord[],
  lookup: RelatedActivityLookup,
) {
  const ids = new Set(
    [
      lookup.leadId,
      lookup.sourceLeadId,
      lookup.opportunityId,
      lookup.clientId,
      ...(lookup.taskIds ?? []),
      ...(lookup.serviceRequestIds ?? []),
    ].filter((value): value is string => Boolean(value)),
  )
  const names = new Set(
    [lookup.companyName, lookup.clientName].filter((value): value is string =>
      Boolean(value),
    ),
  )
  const seen = new Set<string>()

  return activity
    .filter((event) => {
      if (ids.has(event.recordId)) return true
      if (metadataValueMatches(event.metadata, ids)) return true
      if (metadataValueMatches(event.metadata, names)) return true
      return false
    })
    .filter((event) => {
      if (seen.has(event.id)) return false
      seen.add(event.id)
      return true
    })
    .sort((first, second) => second.timestamp.localeCompare(first.timestamp))
}

export type WorkspaceActivityCategory =
  | 'Lead Pipeline'
  | 'Opportunity Pipeline'
  | 'Sales Pipeline'
  | 'Client Activity'
  | 'General Activity'

export function getWorkspaceActivityCategory(
  event: Pick<WorkspaceActivityRecord, 'recordType' | 'title' | 'metadata'>,
): WorkspaceActivityCategory {
  const title = event.title.toLowerCase()

  if (event.recordType === 'lead' || title.includes('lead')) {
    return 'Lead Pipeline'
  }
  if (
    event.recordType === 'opportunity' &&
    (title.includes('stage') ||
      title.includes('won') ||
      title.includes('lost') ||
      title.includes('reopened') ||
      title.includes('created'))
  ) {
    return 'Opportunity Pipeline'
  }
  if (
    event.recordType === 'opportunity' ||
    title.includes('probability') ||
    title.includes('forecast') ||
    title.includes('value') ||
    title.includes('next step') ||
    title.includes('deal')
  ) {
    return 'Sales Pipeline'
  }
  if (
    event.recordType === 'client' ||
    event.recordType === 'task' ||
    event.recordType === 'serviceRequest' ||
    title.includes('client') ||
    title.includes('fulfillment') ||
    title.includes('health') ||
    title.includes('owner') ||
    title.includes('task') ||
    title.includes('request')
  ) {
    return 'Client Activity'
  }
  return 'General Activity'
}
