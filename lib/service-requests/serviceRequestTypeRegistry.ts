import type {
  WorkspaceServiceRequest,
  WorkspaceServiceRequestTypeOption,
} from '@/lib/service-requests/types'

export const SERVICE_REQUEST_TYPE_LIMITS = {
  maxLabelLength: 48,
} as const

export const DEFAULT_SERVICE_BUSINESS_JOB_TYPES = [
  'Service Call',
  'Estimate / Visit',
  'Maintenance',
  'Repair',
  'Follow-Up',
] as const

export function normalizeServiceRequestTypeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanServiceRequestTypeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ')
}

export function createServiceRequestTypeId(label: string) {
  const slug = normalizeServiceRequestTypeLabel(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `job_type_${slug}` : ''
}

export function createDefaultServiceBusinessJobTypes(
  workspaceId: string,
  now = new Date().toISOString(),
): WorkspaceServiceRequestTypeOption[] {
  return DEFAULT_SERVICE_BUSINESS_JOB_TYPES.map((label) => ({
    id: createServiceRequestTypeId(label),
    workspaceId,
    label,
    normalizedLabel: normalizeServiceRequestTypeLabel(label),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }))
}

export function validateServiceRequestTypeLabel(
  label: string,
  existingTypes: WorkspaceServiceRequestTypeOption[],
  ignoredTypeId?: string,
) {
  const cleaned = cleanServiceRequestTypeLabel(label)
  if (!cleaned) return 'Job type name is required.'
  if (cleaned.length > SERVICE_REQUEST_TYPE_LIMITS.maxLabelLength) {
    return `Job type names must be ${SERVICE_REQUEST_TYPE_LIMITS.maxLabelLength} characters or fewer.`
  }
  const normalizedLabel = normalizeServiceRequestTypeLabel(cleaned)
  const duplicate = existingTypes.find(
    (type) =>
      type.id !== ignoredTypeId && type.normalizedLabel === normalizedLabel,
  )
  if (duplicate) return 'A job type with this name already exists.'
  return undefined
}

export function getServiceRequestTypeUsageCount(
  typeLabel: string,
  requests: WorkspaceServiceRequest[],
) {
  const normalized = normalizeServiceRequestTypeLabel(typeLabel)
  return requests.filter(
    (request) =>
      normalizeServiceRequestTypeLabel(request.serviceType) === normalized,
  ).length
}

export function getServiceRequestTypeUsageMap(
  types: WorkspaceServiceRequestTypeOption[],
  requests: WorkspaceServiceRequest[],
) {
  return new Map(
    types.map((type) => [
      type.id,
      getServiceRequestTypeUsageCount(type.label, requests),
    ]),
  )
}

export function getServiceRequestTypeOptions({
  configuredTypes,
  requests = [],
  includeArchived = false,
}: {
  configuredTypes: WorkspaceServiceRequestTypeOption[]
  requests?: WorkspaceServiceRequest[]
  includeArchived?: boolean
}) {
  const seen = new Set<string>()
  const configured = configuredTypes
    .filter((type) => includeArchived || type.status === 'active')
    .map((type) => type.label)

  return [...configured, ...requests.map((request) => request.serviceType)]
    .map(cleanServiceRequestTypeLabel)
    .filter((label) => {
      const normalized = normalizeServiceRequestTypeLabel(label)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}
