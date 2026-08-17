import type {
  WorkspaceClient,
  WorkspaceClientTagOption,
} from '@/lib/clients/types'

export const CLIENT_TAG_LIMITS = {
  maxLabelLength: 48,
} as const

export const DEFAULT_SERVICE_BUSINESS_CUSTOMER_TAGS = [
  'VIP',
  'Needs Follow-Up',
  'Recurring',
  'New Customer',
] as const

export function normalizeClientTagLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanClientTagLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ')
}

export function createClientTagId(label: string) {
  const slug = normalizeClientTagLabel(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `client_tag_${slug}` : ''
}

export function createDefaultServiceBusinessCustomerTags(
  workspaceId: string,
  now = new Date().toISOString(),
): WorkspaceClientTagOption[] {
  return DEFAULT_SERVICE_BUSINESS_CUSTOMER_TAGS.map((label) => ({
    id: createClientTagId(label),
    workspaceId,
    label,
    normalizedLabel: normalizeClientTagLabel(label),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }))
}

export function validateClientTagLabel(
  label: string,
  existingTags: WorkspaceClientTagOption[],
  ignoredTagId?: string,
) {
  const cleaned = cleanClientTagLabel(label)
  if (!cleaned) return 'Tag name is required.'
  if (cleaned.length > CLIENT_TAG_LIMITS.maxLabelLength) {
    return `Tag names must be ${CLIENT_TAG_LIMITS.maxLabelLength} characters or fewer.`
  }
  const normalizedLabel = normalizeClientTagLabel(cleaned)
  const duplicate = existingTags.find(
    (tag) => tag.id !== ignoredTagId && tag.normalizedLabel === normalizedLabel,
  )
  if (duplicate) return 'A tag with this name already exists.'
  return undefined
}

export function getClientTagUsageCount(
  tagLabel: string,
  clients: WorkspaceClient[],
) {
  const normalized = normalizeClientTagLabel(tagLabel)
  return clients.filter((client) =>
    client.tags.some((tag) => normalizeClientTagLabel(tag) === normalized),
  ).length
}

export function getClientTagUsageMap(
  tags: WorkspaceClientTagOption[],
  clients: WorkspaceClient[],
) {
  return new Map(
    tags.map((tag) => [tag.id, getClientTagUsageCount(tag.label, clients)]),
  )
}

export function getClientTagOptions({
  configuredTags,
  clients = [],
  includeArchived = false,
}: {
  configuredTags: WorkspaceClientTagOption[]
  clients?: WorkspaceClient[]
  includeArchived?: boolean
}) {
  const seen = new Set<string>()
  const configured = configuredTags
    .filter((tag) => includeArchived || tag.status === 'active')
    .map((tag) => tag.label)

  return [...configured, ...clients.flatMap((client) => client.tags)]
    .map(cleanClientTagLabel)
    .filter((label) => {
      const normalized = normalizeClientTagLabel(label)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}
