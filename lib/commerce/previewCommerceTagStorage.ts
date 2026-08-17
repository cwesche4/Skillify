import type {
  CommerceCustomer,
  CommerceCustomerTag,
} from '@/lib/commerce/types'
import {
  cleanCustomerTagLabel,
  createCustomerTagId,
  getCustomerTagUsageCount,
  normalizeCustomerTagLabel,
  validateCustomerTagLabel,
} from '@/lib/commerce/customerTagRegistry'

export type VersionedCommerceCustomerTagShape = {
  version: 1
  workspaceId: string
  records: CommerceCustomerTag[]
}

export const commercePreviewCustomerTagsChangedEvent =
  'skillify-preview-commerce-customer-tags-changed'

function nowIso() {
  return new Date().toISOString()
}

function notifyTagsChanged(workspaceId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(commercePreviewCustomerTagsChangedEvent, {
      detail: { workspaceId },
    }),
  )
}

export function getCommerceCustomerTagsStorageKey(workspaceId: string) {
  return `skillify-preview-commerce:${workspaceId}:customer-tags:v1`
}

export function normalizePreviewCustomerTag(
  tag: Partial<CommerceCustomerTag>,
  workspaceId: string,
): CommerceCustomerTag | null {
  const label = cleanCustomerTagLabel(tag.label ?? '')
  const normalizedLabel = normalizeCustomerTagLabel(
    tag.normalizedLabel ?? label,
  )
  if (!label || !normalizedLabel) return null
  const createdAt = tag.createdAt ?? nowIso()
  const status = tag.status === 'archived' ? 'archived' : 'active'
  return {
    id: tag.id?.trim() || createCustomerTagId(label),
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

export function getPreviewCustomerTags(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(
      storage.getItem(getCommerceCustomerTagsStorageKey(workspaceId)) ?? '',
    ) as Partial<VersionedCommerceCustomerTagShape>
    if (
      parsed.version !== 1 ||
      parsed.workspaceId !== workspaceId ||
      !Array.isArray(parsed.records)
    ) {
      return []
    }
    const seen = new Set<string>()
    return parsed.records
      .map((tag) => normalizePreviewCustomerTag(tag, workspaceId))
      .filter((tag): tag is CommerceCustomerTag => {
        if (!tag || seen.has(tag.normalizedLabel)) return false
        seen.add(tag.normalizedLabel)
        return true
      })
  } catch {
    return []
  }
}

export function savePreviewCustomerTags({
  workspaceId,
  tags,
  storage,
}: {
  workspaceId: string
  tags: CommerceCustomerTag[]
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const normalized = tags
    .map((tag) => normalizePreviewCustomerTag(tag, workspaceId))
    .filter((tag): tag is CommerceCustomerTag => Boolean(tag))
    .sort((first, second) => first.label.localeCompare(second.label))
  if (targetStorage) {
    targetStorage.setItem(
      getCommerceCustomerTagsStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: normalized,
      } satisfies VersionedCommerceCustomerTagShape),
    )
  }
  notifyTagsChanged(workspaceId)
  return normalized
}

export function createPreviewCustomerTag({
  workspaceId,
  label,
  storage,
}: {
  workspaceId: string
  label: string
  storage?: Storage | null
}) {
  const tags = getPreviewCustomerTags(workspaceId, storage)
  const error = validateCustomerTagLabel(label, tags)
  if (error) return { tag: null, errors: { label: error } }
  const cleaned = cleanCustomerTagLabel(label)
  const now = nowIso()
  const tag: CommerceCustomerTag = {
    id: createCustomerTagId(cleaned),
    workspaceId,
    label: cleaned,
    normalizedLabel: normalizeCustomerTagLabel(cleaned),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  savePreviewCustomerTags({ workspaceId, tags: [...tags, tag], storage })
  return { tag, errors: {} }
}

export function renamePreviewCustomerTag({
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
  const tags = getPreviewCustomerTags(workspaceId, storage)
  const tag = tags.find((record) => record.id === tagId)
  if (!tag) return { tag: null, errors: { tag: 'Tag not found.' } }
  const error = validateCustomerTagLabel(label, tags, tagId)
  if (error) return { tag: null, errors: { label: error } }
  const cleaned = cleanCustomerTagLabel(label)
  const renamed = {
    ...tag,
    label: cleaned,
    normalizedLabel: normalizeCustomerTagLabel(cleaned),
    updatedAt: nowIso(),
  }
  savePreviewCustomerTags({
    workspaceId,
    tags: tags.map((record) => (record.id === tagId ? renamed : record)),
    storage,
  })
  return { tag: renamed, errors: {} }
}

export function archivePreviewCustomerTag({
  workspaceId,
  tagId,
  storage,
}: {
  workspaceId: string
  tagId: string
  storage?: Storage | null
}) {
  return setPreviewCustomerTagStatus({
    workspaceId,
    tagId,
    status: 'archived',
    storage,
  })
}

export function restorePreviewCustomerTag({
  workspaceId,
  tagId,
  storage,
}: {
  workspaceId: string
  tagId: string
  storage?: Storage | null
}) {
  return setPreviewCustomerTagStatus({
    workspaceId,
    tagId,
    status: 'active',
    storage,
  })
}

function setPreviewCustomerTagStatus({
  workspaceId,
  tagId,
  status,
  storage,
}: {
  workspaceId: string
  tagId: string
  status: 'active' | 'archived'
  storage?: Storage | null
}) {
  const tags = getPreviewCustomerTags(workspaceId, storage)
  const tag = tags.find((record) => record.id === tagId)
  if (!tag) return { tag: null, errors: { tag: 'Tag not found.' } }
  const now = nowIso()
  const next = {
    ...tag,
    status,
    updatedAt: now,
    archivedAt: status === 'archived' ? now : undefined,
  }
  savePreviewCustomerTags({
    workspaceId,
    tags: tags.map((record) => (record.id === tagId ? next : record)),
    storage,
  })
  return { tag: next, errors: {} }
}

export function deleteUnusedPreviewCustomerTag({
  workspaceId,
  tagId,
  customers,
  storage,
}: {
  workspaceId: string
  tagId: string
  customers: CommerceCustomer[]
  storage?: Storage | null
}) {
  const tags = getPreviewCustomerTags(workspaceId, storage)
  if (getCustomerTagUsageCount(tagId, customers) > 0) {
    return {
      deleted: false,
      errors: { tag: 'This tag is assigned to one or more customers.' },
    }
  }
  savePreviewCustomerTags({
    workspaceId,
    tags: tags.filter((tag) => tag.id !== tagId),
    storage,
  })
  return { deleted: true, errors: {} }
}
