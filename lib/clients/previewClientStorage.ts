import type { WorkspaceClient } from '@/lib/clients/types'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

const STORAGE_PREFIX = 'skillify-preview-clients'

function getPreviewClientStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function mergeClientRecords(
  baseClients: WorkspaceClient[],
  previewClients: WorkspaceClient[],
) {
  const seen = new Set<string>()
  return [...previewClients, ...baseClients].filter((client) => {
    if (seen.has(client.id)) return false
    seen.add(client.id)
    return true
  })
}

export function readPreviewClients(workspaceId: string): WorkspaceClient[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewClientStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as WorkspaceClient[]) : []
  } catch {
    return []
  }
}

export function writePreviewClients(
  workspaceId: string,
  clients: WorkspaceClient[],
) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewClientStorageKey(workspaceId),
    JSON.stringify(clients),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'clients')
}

export function upsertPreviewClient(
  workspaceId: string,
  client: WorkspaceClient,
) {
  const currentClients = readPreviewClients(workspaceId).filter(
    (record) => record.id !== client.id,
  )
  const nextClients = [client, ...currentClients]
  writePreviewClients(workspaceId, nextClients)
  return nextClients
}
