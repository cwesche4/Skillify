import type { LeadRecord } from '@/lib/sales/demoSalesRecords'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

const STORAGE_PREFIX = 'skillify-preview-leads'

function getPreviewLeadStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function mergeLeadRecords(
  baseLeads: LeadRecord[],
  previewLeads: LeadRecord[],
) {
  const seen = new Set<string>()
  return [...previewLeads, ...baseLeads].filter((lead) => {
    if (seen.has(lead.id)) return false
    seen.add(lead.id)
    return true
  })
}

export function readPreviewLeads(workspaceId: string): LeadRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewLeadStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as LeadRecord[]) : []
  } catch {
    return []
  }
}

export function writePreviewLeads(workspaceId: string, leads: LeadRecord[]) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewLeadStorageKey(workspaceId),
    JSON.stringify(leads),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'leads')
}

export function upsertPreviewLead(workspaceId: string, lead: LeadRecord) {
  const currentLeads = readPreviewLeads(workspaceId).filter(
    (record) => record.id !== lead.id,
  )
  const nextLeads = [lead, ...currentLeads]
  writePreviewLeads(workspaceId, nextLeads)
  return nextLeads
}
