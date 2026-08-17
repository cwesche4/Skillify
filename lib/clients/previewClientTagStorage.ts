import type { WorkspaceClientTagOption } from '@/lib/clients/types'
import {
  cleanClientTagLabel,
  createClientTagId,
  createDefaultServiceBusinessCustomerTags,
  normalizeClientTagLabel,
  validateClientTagLabel,
} from '@/lib/clients/clientTagRegistry'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

export type VersionedClientTagShape = {
  version: 1
  workspaceId: string
  records: WorkspaceClientTagOption[]
}

const STORAGE_PREFIX = 'skillify-preview-client-tags'

function nowIso() {
  return new Date().toISOString()
}

export function getPreviewClientTagsStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}:v1`
}

function notifyTagsChanged(workspaceId: string) {
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'clients')
}

export function normalizePreviewClientTag(
  tag: Partial<WorkspaceClientTagOption>,
  workspaceId: string,
): WorkspaceClientTagOption | null {
  const label = cleanClientTagLabel(tag.label ?? '')
  const normalizedLabel = normalizeClientTagLabel(tag.normalizedLabel ?? label)
  if (!label || !normalizedLabel) return null
  const createdAt = tag.createdAt ?? nowIso()
  const status = tag.status === 'archived' ? 'archived' : 'active'
  return {
    id: tag.id?.trim() || createClientTagId(label),
    workspaceId,
    label,
    normalizedLabel,
    status,
    createdAt,
    updatedAt: tag.updatedAt ?? createdAt,
    archivedAt:
      status === 'archived' ? (tag.archivedAt ?? createdAt) : undefined,
  }
}

export function readPreviewClientTags(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(
      storage.getItem(getPreviewClientTagsStorageKey(workspaceId)) ?? '',
    ) as Partial<VersionedClientTagShape>
    if (
      parsed.version !== 1 ||
      parsed.workspaceId !== workspaceId ||
      !Array.isArray(parsed.records)
    ) {
      return []
    }
    const seen = new Set<string>()
    return parsed.records
      .map((tag) => normalizePreviewClientTag(tag, workspaceId))
      .filter((tag): tag is WorkspaceClientTagOption => {
        if (!tag || seen.has(tag.normalizedLabel)) return false
        seen.add(tag.normalizedLabel)
        return true
      })
  } catch {
    return []
  }
}

export function savePreviewClientTags({
  workspaceId,
  tags,
  storage,
}: {
  workspaceId: string
  tags: WorkspaceClientTagOption[]
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const normalized = tags
    .map((tag) => normalizePreviewClientTag(tag, workspaceId))
    .filter((tag): tag is WorkspaceClientTagOption => Boolean(tag))
    .sort((first, second) => first.label.localeCompare(second.label))
  if (targetStorage) {
    targetStorage.setItem(
      getPreviewClientTagsStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: normalized,
      } satisfies VersionedClientTagShape),
    )
  }
  notifyTagsChanged(workspaceId)
  return normalized
}

export function getPreviewClientTags(
  workspaceId: string,
  storage?: Storage | null,
) {
  const existing = readPreviewClientTags(workspaceId, storage)
  if (existing.length > 0) return existing
  const defaults = createDefaultServiceBusinessCustomerTags(workspaceId)
  return savePreviewClientTags({ workspaceId, tags: defaults, storage })
}

export function createPreviewClientTag({
  workspaceId,
  label,
  storage,
}: {
  workspaceId: string
  label: string
  storage?: Storage | null
}) {
  const tags = getPreviewClientTags(workspaceId, storage)
  const error = validateClientTagLabel(label, tags)
  if (error) return { tag: null, errors: { label: error } }
  const cleaned = cleanClientTagLabel(label)
  const now = nowIso()
  const tag: WorkspaceClientTagOption = {
    id: createClientTagId(cleaned),
    workspaceId,
    label: cleaned,
    normalizedLabel: normalizeClientTagLabel(cleaned),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  savePreviewClientTags({ workspaceId, tags: [...tags, tag], storage })
  return { tag, errors: {} }
}

export function renamePreviewClientTag({
  workspaceId,
  tagId,
  label,
  storage,
}: {
  workspaceId: string
  tagId: string
  label: string
  storage?: Storage | null
}) {
  const tags = getPreviewClientTags(workspaceId, storage)
  const tag = tags.find((record) => record.id === tagId)
  if (!tag) return { tag: null, errors: { tag: 'Tag not found.' } }
  const error = validateClientTagLabel(label, tags, tagId)
  if (error) return { tag: null, errors: { label: error } }
  const renamed = {
    ...tag,
    label: cleanClientTagLabel(label),
    normalizedLabel: normalizeClientTagLabel(label),
    updatedAt: nowIso(),
  }
  savePreviewClientTags({
    workspaceId,
    tags: tags.map((record) => (record.id === tagId ? renamed : record)),
    storage,
  })
  return { tag: renamed, errors: {} }
}

export function archivePreviewClientTag({
  workspaceId,
  tagId,
  storage,
}: {
  workspaceId: string
  tagId: string
  storage?: Storage | null
}) {
  const tags = getPreviewClientTags(workspaceId, storage)
  const tag = tags.find((record) => record.id === tagId)
  if (!tag) return { tag: null, errors: { tag: 'Tag not found.' } }
  const now = nowIso()
  const next = {
    ...tag,
    status: 'archived' as const,
    updatedAt: now,
    archivedAt: now,
  }
  savePreviewClientTags({
    workspaceId,
    tags: tags.map((record) => (record.id === tagId ? next : record)),
    storage,
  })
  return { tag: next, errors: {} }
}

export function restorePreviewClientTag({
  workspaceId,
  tagId,
  storage,
}: {
  workspaceId: string
  tagId: string
  storage?: Storage | null
}) {
  const tags = getPreviewClientTags(workspaceId, storage)
  const tag = tags.find((record) => record.id === tagId)
  if (!tag) return { tag: null, errors: { tag: 'Tag not found.' } }
  const next = {
    ...tag,
    status: 'active' as const,
    updatedAt: nowIso(),
    archivedAt: undefined,
  }
  savePreviewClientTags({
    workspaceId,
    tags: tags.map((record) => (record.id === tagId ? next : record)),
    storage,
  })
  return { tag: next, errors: {} }
}
