import type { WorkspaceServiceRequestTypeOption } from '@/lib/service-requests/types'
import {
  cleanServiceRequestTypeLabel,
  createDefaultServiceBusinessJobTypes,
  createServiceRequestTypeId,
  normalizeServiceRequestTypeLabel,
  validateServiceRequestTypeLabel,
} from '@/lib/service-requests/serviceRequestTypeRegistry'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

export type VersionedServiceRequestTypeShape = {
  version: 1
  workspaceId: string
  records: WorkspaceServiceRequestTypeOption[]
}

const STORAGE_PREFIX = 'skillify-preview-service-request-types'

function nowIso() {
  return new Date().toISOString()
}

export function getPreviewServiceRequestTypesStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}:v1`
}

function notifyTypesChanged(workspaceId: string) {
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'serviceRequests')
}

export function normalizePreviewServiceRequestType(
  type: Partial<WorkspaceServiceRequestTypeOption>,
  workspaceId: string,
): WorkspaceServiceRequestTypeOption | null {
  const label = cleanServiceRequestTypeLabel(type.label ?? '')
  const normalizedLabel = normalizeServiceRequestTypeLabel(
    type.normalizedLabel ?? label,
  )
  if (!label || !normalizedLabel) return null
  const createdAt = type.createdAt ?? nowIso()
  const status = type.status === 'archived' ? 'archived' : 'active'
  return {
    id: type.id?.trim() || createServiceRequestTypeId(label),
    workspaceId,
    label,
    normalizedLabel,
    status,
    createdAt,
    updatedAt: type.updatedAt ?? createdAt,
    archivedAt:
      status === 'archived' ? (type.archivedAt ?? createdAt) : undefined,
  }
}

export function readPreviewServiceRequestTypes(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(
      storage.getItem(getPreviewServiceRequestTypesStorageKey(workspaceId)) ??
        '',
    ) as Partial<VersionedServiceRequestTypeShape>
    if (
      parsed.version !== 1 ||
      parsed.workspaceId !== workspaceId ||
      !Array.isArray(parsed.records)
    ) {
      return []
    }
    const seen = new Set<string>()
    return parsed.records
      .map((type) => normalizePreviewServiceRequestType(type, workspaceId))
      .filter((type): type is WorkspaceServiceRequestTypeOption => {
        if (!type || seen.has(type.normalizedLabel)) return false
        seen.add(type.normalizedLabel)
        return true
      })
  } catch {
    return []
  }
}

export function savePreviewServiceRequestTypes({
  workspaceId,
  types,
  storage,
}: {
  workspaceId: string
  types: WorkspaceServiceRequestTypeOption[]
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const normalized = types
    .map((type) => normalizePreviewServiceRequestType(type, workspaceId))
    .filter((type): type is WorkspaceServiceRequestTypeOption => Boolean(type))
    .sort((first, second) => first.label.localeCompare(second.label))
  if (targetStorage) {
    targetStorage.setItem(
      getPreviewServiceRequestTypesStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: normalized,
      } satisfies VersionedServiceRequestTypeShape),
    )
  }
  notifyTypesChanged(workspaceId)
  return normalized
}

export function getPreviewServiceRequestTypes(
  workspaceId: string,
  storage?: Storage | null,
) {
  const existing = readPreviewServiceRequestTypes(workspaceId, storage)
  if (existing.length > 0) return existing
  const defaults = createDefaultServiceBusinessJobTypes(workspaceId)
  return savePreviewServiceRequestTypes({
    workspaceId,
    types: defaults,
    storage,
  })
}

export function createPreviewServiceRequestType({
  workspaceId,
  label,
  storage,
}: {
  workspaceId: string
  label: string
  storage?: Storage | null
}) {
  const types = getPreviewServiceRequestTypes(workspaceId, storage)
  const error = validateServiceRequestTypeLabel(label, types)
  if (error) return { type: null, errors: { label: error } }
  const cleaned = cleanServiceRequestTypeLabel(label)
  const now = nowIso()
  const type: WorkspaceServiceRequestTypeOption = {
    id: createServiceRequestTypeId(cleaned),
    workspaceId,
    label: cleaned,
    normalizedLabel: normalizeServiceRequestTypeLabel(cleaned),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  savePreviewServiceRequestTypes({
    workspaceId,
    types: [...types, type],
    storage,
  })
  return { type, errors: {} }
}

export function renamePreviewServiceRequestType({
  workspaceId,
  typeId,
  label,
  storage,
}: {
  workspaceId: string
  typeId: string
  label: string
  storage?: Storage | null
}) {
  const types = getPreviewServiceRequestTypes(workspaceId, storage)
  const type = types.find((record) => record.id === typeId)
  if (!type) return { type: null, errors: { type: 'Job type not found.' } }
  const error = validateServiceRequestTypeLabel(label, types, typeId)
  if (error) return { type: null, errors: { label: error } }
  const renamed = {
    ...type,
    label: cleanServiceRequestTypeLabel(label),
    normalizedLabel: normalizeServiceRequestTypeLabel(label),
    updatedAt: nowIso(),
  }
  savePreviewServiceRequestTypes({
    workspaceId,
    types: types.map((record) => (record.id === typeId ? renamed : record)),
    storage,
  })
  return { type: renamed, errors: {} }
}

export function archivePreviewServiceRequestType({
  workspaceId,
  typeId,
  storage,
}: {
  workspaceId: string
  typeId: string
  storage?: Storage | null
}) {
  const types = getPreviewServiceRequestTypes(workspaceId, storage)
  const type = types.find((record) => record.id === typeId)
  if (!type) return { type: null, errors: { type: 'Job type not found.' } }
  const now = nowIso()
  const next = {
    ...type,
    status: 'archived' as const,
    updatedAt: now,
    archivedAt: now,
  }
  savePreviewServiceRequestTypes({
    workspaceId,
    types: types.map((record) => (record.id === typeId ? next : record)),
    storage,
  })
  return { type: next, errors: {} }
}

export function restorePreviewServiceRequestType({
  workspaceId,
  typeId,
  storage,
}: {
  workspaceId: string
  typeId: string
  storage?: Storage | null
}) {
  const types = getPreviewServiceRequestTypes(workspaceId, storage)
  const type = types.find((record) => record.id === typeId)
  if (!type) return { type: null, errors: { type: 'Job type not found.' } }
  const next = {
    ...type,
    status: 'active' as const,
    updatedAt: nowIso(),
    archivedAt: undefined,
  }
  savePreviewServiceRequestTypes({
    workspaceId,
    types: types.map((record) => (record.id === typeId ? next : record)),
    storage,
  })
  return { type: next, errors: {} }
}
