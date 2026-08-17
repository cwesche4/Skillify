import type {
  CommerceCustomer,
  CommerceCustomerTag,
} from '@/lib/commerce/types'

export const COMMERCE_CUSTOMER_TAG_LIMITS = {
  maxLabelLength: 48,
} as const

export const SUGGESTED_CUSTOMER_TAG_LABELS = [
  'VIP',
  'Repeat Buyer',
  'Local',
  'Tax Exempt',
  'High Value',
  'Contractor',
  'Builder',
  'Installer',
] as const

export function normalizeCustomerTagLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanCustomerTagLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ')
}

export function createCustomerTagId(label: string) {
  const slug = normalizeCustomerTagLabel(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `ctag_${slug}` : ''
}

export function validateCustomerTagLabel(
  label: string,
  existingTags: CommerceCustomerTag[],
  ignoredTagId?: string,
) {
  const cleaned = cleanCustomerTagLabel(label)
  if (!cleaned) return 'Tag name is required.'
  if (cleaned.length > COMMERCE_CUSTOMER_TAG_LIMITS.maxLabelLength) {
    return `Tag names must be ${COMMERCE_CUSTOMER_TAG_LIMITS.maxLabelLength} characters or fewer.`
  }
  const normalizedLabel = normalizeCustomerTagLabel(cleaned)
  const duplicate = existingTags.find(
    (tag) => tag.id !== ignoredTagId && tag.normalizedLabel === normalizedLabel,
  )
  if (duplicate) return 'A tag with this name already exists.'
  return undefined
}

export function getCustomerTagUsageCount(
  tagId: string,
  customers: CommerceCustomer[],
) {
  return customers.filter((customer) => customer.tags?.includes(tagId)).length
}

export function getCustomerTagUsageMap(
  tags: CommerceCustomerTag[],
  customers: CommerceCustomer[],
) {
  return new Map(
    tags.map((tag) => [tag.id, getCustomerTagUsageCount(tag.id, customers)]),
  )
}

export function getCustomerTagLabel(
  tagReference: string,
  tags: CommerceCustomerTag[],
) {
  const found =
    tags.find((tag) => tag.id === tagReference) ??
    tags.find(
      (tag) => tag.normalizedLabel === normalizeCustomerTagLabel(tagReference),
    )
  return found?.label ?? tagReference
}

export function hasCustomerTag(
  customer: CommerceCustomer,
  label: string,
  tags: CommerceCustomerTag[] = [],
) {
  const normalized = normalizeCustomerTagLabel(label)
  return (customer.tags ?? []).some((tagReference) => {
    if (normalizeCustomerTagLabel(tagReference) === normalized) return true
    const found = tags.find((tag) => tag.id === tagReference)
    return found?.normalizedLabel === normalized
  })
}

export function getCustomerDisplayTags(
  customer: CommerceCustomer,
  tags: CommerceCustomerTag[],
) {
  return (customer.tags ?? [])
    .map((tagReference) => {
      const tag =
        tags.find((candidate) => candidate.id === tagReference) ??
        tags.find(
          (candidate) =>
            candidate.normalizedLabel ===
            normalizeCustomerTagLabel(tagReference),
        )
      return {
        id: tag?.id ?? tagReference,
        label: tag?.label ?? tagReference,
        status: tag?.status ?? 'active',
      } as const
    })
    .filter((tag) => tag.label.trim())
}

export function normalizeCustomerTagAssignments({
  customers,
  tags,
  workspaceId,
  now,
}: {
  customers: CommerceCustomer[]
  tags: CommerceCustomerTag[]
  workspaceId: string
  now: string
}) {
  const nextTags = [...tags]
  let changed = false
  const getOrCreateTag = (labelOrId: string) => {
    const cleaned = cleanCustomerTagLabel(labelOrId)
    if (!cleaned) return null
    const existingById = nextTags.find((tag) => tag.id === cleaned)
    if (existingById) return existingById
    const normalizedLabel = normalizeCustomerTagLabel(cleaned)
    const existingByLabel = nextTags.find(
      (tag) => tag.normalizedLabel === normalizedLabel,
    )
    if (existingByLabel) return existingByLabel
    const tag: CommerceCustomerTag = {
      id: createCustomerTagId(cleaned),
      workspaceId,
      label: cleaned,
      normalizedLabel,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    nextTags.push(tag)
    changed = true
    return tag
  }

  const nextCustomers = customers.map((customer) => {
    const nextCustomerTags = Array.from(
      new Set(
        (customer.tags ?? [])
          .map((tagReference) => getOrCreateTag(tagReference)?.id)
          .filter(Boolean) as string[],
      ),
    )
    if (nextCustomerTags.join('|') !== (customer.tags ?? []).join('|')) {
      changed = true
      return {
        ...customer,
        tags: nextCustomerTags,
        updatedAt: customer.updatedAt,
      }
    }
    return customer
  })

  return { customers: nextCustomers, tags: nextTags, changed }
}
