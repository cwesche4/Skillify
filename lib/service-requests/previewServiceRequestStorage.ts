import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

const STORAGE_PREFIX = 'skillify-preview-service-requests'

function getPreviewServiceRequestStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function mergeServiceRequestRecords(
  baseRequests: WorkspaceServiceRequest[],
  previewRequests: WorkspaceServiceRequest[],
) {
  const seen = new Set<string>()
  return [...previewRequests, ...baseRequests].filter((request) => {
    if (seen.has(request.id)) return false
    seen.add(request.id)
    return true
  })
}

export function readPreviewServiceRequests(
  workspaceId: string,
): WorkspaceServiceRequest[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewServiceRequestStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as WorkspaceServiceRequest[]) : []
  } catch {
    return []
  }
}

export function writePreviewServiceRequests(
  workspaceId: string,
  requests: WorkspaceServiceRequest[],
) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewServiceRequestStorageKey(workspaceId),
    JSON.stringify(requests),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'serviceRequests')
}

export function appendPreviewServiceRequest(
  workspaceId: string,
  request: WorkspaceServiceRequest,
) {
  const nextRequests = mergeServiceRequestRecords(
    readPreviewServiceRequests(workspaceId),
    [request],
  )
  writePreviewServiceRequests(workspaceId, nextRequests)
  return nextRequests
}

export function upsertPreviewServiceRequest(
  workspaceId: string,
  request: WorkspaceServiceRequest,
) {
  const currentRequests = readPreviewServiceRequests(workspaceId).filter(
    (record) => record.id !== request.id,
  )
  const nextRequests = [request, ...currentRequests]
  writePreviewServiceRequests(workspaceId, nextRequests)
  return nextRequests
}

export function removePreviewServiceRequest(
  workspaceId: string,
  requestId: string,
) {
  const nextRequests = readPreviewServiceRequests(workspaceId).filter(
    (request) => request.id !== requestId,
  )
  writePreviewServiceRequests(workspaceId, nextRequests)
  return nextRequests
}
