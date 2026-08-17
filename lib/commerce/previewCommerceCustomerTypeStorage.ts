import type {
  CommerceCustomer,
  CommerceCustomerTypeDefinition,
} from '@/lib/commerce/types'
import {
  cleanCustomerTypeName,
  createCustomerTypeId,
  createDefaultCustomerTypes,
  getCustomerTypeUsageCount,
  normalizeCustomerTypeName,
  validateCustomerTypeName,
} from '@/lib/commerce/customerTypeRegistry'

export type VersionedCommerceCustomerTypeShape = {
  version: 1
  workspaceId: string
  records: CommerceCustomerTypeDefinition[]
}

export const commercePreviewCustomerTypesChangedEvent =
  'skillify-preview-commerce-customer-types-changed'

function nowIso() {
  return new Date().toISOString()
}

function notifyTypesChanged(workspaceId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(commercePreviewCustomerTypesChangedEvent, {
      detail: { workspaceId },
    }),
  )
}

export function getCommerceCustomerTypesStorageKey(workspaceId: string) {
  return `skillify-preview-commerce:${workspaceId}:customer-types:v1`
}

export function normalizePreviewCustomerType(
  type: Partial<CommerceCustomerTypeDefinition>,
  workspaceId: string,
  fallbackSortOrder = 0,
): CommerceCustomerTypeDefinition | null {
  const name = cleanCustomerTypeName(type.name ?? '')
  const normalizedName = normalizeCustomerTypeName(type.normalizedName ?? name)
  if (!name || !normalizedName) return null
  const createdAt = type.createdAt ?? nowIso()
  const isArchived = Boolean(type.isArchived)
  return {
    id: type.id?.trim() || createCustomerTypeId(name),
    workspaceId,
    name,
    normalizedName,
    isActive: !isArchived && type.isActive !== false,
    isArchived,
    sortOrder: Number.isFinite(Number(type.sortOrder))
      ? Number(type.sortOrder)
      : fallbackSortOrder,
    createdAt,
    updatedAt: type.updatedAt ?? createdAt,
    archivedAt: isArchived ? (type.archivedAt ?? createdAt) : undefined,
  }
}

export function getPreviewCustomerTypes(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  if (!storage) {
    return createDefaultCustomerTypes({ workspaceId, now: nowIso() })
  }
  try {
    const rawValue = storage.getItem(
      getCommerceCustomerTypesStorageKey(workspaceId),
    )
    if (!rawValue) {
      const defaults = createDefaultCustomerTypes({
        workspaceId,
        now: nowIso(),
      })
      savePreviewCustomerTypes({ workspaceId, types: defaults, storage })
      return defaults
    }
    const parsed = JSON.parse(
      rawValue,
    ) as Partial<VersionedCommerceCustomerTypeShape>
    if (
      parsed.version !== 1 ||
      parsed.workspaceId !== workspaceId ||
      !Array.isArray(parsed.records)
    ) {
      return createDefaultCustomerTypes({ workspaceId, now: nowIso() })
    }
    const seen = new Set<string>()
    return parsed.records
      .map((type, index) =>
        normalizePreviewCustomerType(type, workspaceId, index),
      )
      .filter((type): type is CommerceCustomerTypeDefinition => {
        if (!type || seen.has(type.normalizedName)) return false
        seen.add(type.normalizedName)
        return true
      })
      .sort((first, second) => first.sortOrder - second.sortOrder)
  } catch {
    return createDefaultCustomerTypes({ workspaceId, now: nowIso() })
  }
}

export function savePreviewCustomerTypes({
  workspaceId,
  types,
  storage,
}: {
  workspaceId: string
  types: CommerceCustomerTypeDefinition[]
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const normalized = types
    .map((type, index) =>
      normalizePreviewCustomerType(type, workspaceId, index),
    )
    .filter((type): type is CommerceCustomerTypeDefinition => Boolean(type))
    .sort((first, second) => first.sortOrder - second.sortOrder)
  if (targetStorage) {
    targetStorage.setItem(
      getCommerceCustomerTypesStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: normalized,
      } satisfies VersionedCommerceCustomerTypeShape),
    )
  }
  notifyTypesChanged(workspaceId)
  return normalized
}

export function createPreviewCustomerType({
  workspaceId,
  name,
  storage,
}: {
  workspaceId: string
  name: string
  storage?: Storage | null
}) {
  const types = getPreviewCustomerTypes(workspaceId, storage)
  const error = validateCustomerTypeName(name, types)
  if (error) return { type: null, errors: { name: error } }
  const cleaned = cleanCustomerTypeName(name)
  const now = nowIso()
  const type: CommerceCustomerTypeDefinition = {
    id: createCustomerTypeId(cleaned),
    workspaceId,
    name: cleaned,
    normalizedName: normalizeCustomerTypeName(cleaned),
    isActive: true,
    isArchived: false,
    sortOrder: types.length,
    createdAt: now,
    updatedAt: now,
  }
  savePreviewCustomerTypes({ workspaceId, types: [...types, type], storage })
  return { type, errors: {} }
}

export function renamePreviewCustomerType({
  workspaceId,
  typeId,
  name,
  storage,
}: {
  workspaceId: string
  typeId: string
  name: string
  storage?: Storage | null
}) {
  const types = getPreviewCustomerTypes(workspaceId, storage)
  const type = types.find((record) => record.id === typeId)
  if (!type) return { type: null, errors: { type: 'Customer type not found.' } }
  const error = validateCustomerTypeName(name, types, typeId)
  if (error) return { type: null, errors: { name: error } }
  const cleaned = cleanCustomerTypeName(name)
  const renamed = {
    ...type,
    name: cleaned,
    normalizedName: normalizeCustomerTypeName(cleaned),
    updatedAt: nowIso(),
  }
  savePreviewCustomerTypes({
    workspaceId,
    types: types.map((record) => (record.id === typeId ? renamed : record)),
    storage,
  })
  return { type: renamed, errors: {} }
}

export function archivePreviewCustomerType({
  workspaceId,
  typeId,
  storage,
}: {
  workspaceId: string
  typeId: string
  storage?: Storage | null
}) {
  return setPreviewCustomerTypeArchived({
    workspaceId,
    typeId,
    archived: true,
    storage,
  })
}

export function restorePreviewCustomerType({
  workspaceId,
  typeId,
  storage,
}: {
  workspaceId: string
  typeId: string
  storage?: Storage | null
}) {
  return setPreviewCustomerTypeArchived({
    workspaceId,
    typeId,
    archived: false,
    storage,
  })
}

function setPreviewCustomerTypeArchived({
  workspaceId,
  typeId,
  archived,
  storage,
}: {
  workspaceId: string
  typeId: string
  archived: boolean
  storage?: Storage | null
}) {
  const types = getPreviewCustomerTypes(workspaceId, storage)
  const type = types.find((record) => record.id === typeId)
  if (!type) return { type: null, errors: { type: 'Customer type not found.' } }
  const now = nowIso()
  const next = {
    ...type,
    isActive: !archived,
    isArchived: archived,
    updatedAt: now,
    archivedAt: archived ? now : undefined,
  }
  savePreviewCustomerTypes({
    workspaceId,
    types: types.map((record) => (record.id === typeId ? next : record)),
    storage,
  })
  return { type: next, errors: {} }
}

export function reorderPreviewCustomerType({
  workspaceId,
  typeId,
  direction,
  storage,
}: {
  workspaceId: string
  typeId: string
  direction: 'up' | 'down'
  storage?: Storage | null
}) {
  const types = getPreviewCustomerTypes(workspaceId, storage)
  const active = types.filter((type) => !type.isArchived)
  const index = active.findIndex((type) => type.id === typeId)
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || nextIndex < 0 || nextIndex >= active.length) {
    return { types, errors: {} }
  }
  const reordered = [...active]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(nextIndex, 0, moved!)
  const orderById = new Map(reordered.map((type, order) => [type.id, order]))
  const nextTypes = types.map((type) =>
    orderById.has(type.id)
      ? { ...type, sortOrder: orderById.get(type.id)!, updatedAt: nowIso() }
      : type,
  )
  return {
    types: savePreviewCustomerTypes({ workspaceId, types: nextTypes, storage }),
    errors: {},
  }
}

export function deleteUnusedPreviewCustomerType({
  workspaceId,
  typeId,
  customers,
  storage,
}: {
  workspaceId: string
  typeId: string
  customers: CommerceCustomer[]
  storage?: Storage | null
}) {
  const types = getPreviewCustomerTypes(workspaceId, storage)
  if (getCustomerTypeUsageCount(typeId, customers) > 0) {
    return {
      deleted: false,
      errors: {
        type: 'This customer type is assigned to one or more customers.',
      },
    }
  }
  savePreviewCustomerTypes({
    workspaceId,
    types: types.filter((type) => type.id !== typeId),
    storage,
  })
  return { deleted: true, errors: {} }
}
