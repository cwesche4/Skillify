import type {
  CommerceCustomer,
  CommerceCustomerTypeDefinition,
} from '@/lib/commerce/types'

export const DEFAULT_CUSTOMER_TYPE_NAMES = [
  'Residential',
  'Commercial',
  'Retail',
  'Wholesale',
  'Distributor',
  'Government',
  'Nonprofit',
  'Employee',
  'Internal',
] as const

export function normalizeCustomerTypeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanCustomerTypeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function createCustomerTypeId(name: string) {
  const slug = normalizeCustomerTypeName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `ctype_${slug}` : ''
}

export function createDefaultCustomerTypes({
  workspaceId,
  now,
}: {
  workspaceId: string
  now: string
}): CommerceCustomerTypeDefinition[] {
  return DEFAULT_CUSTOMER_TYPE_NAMES.map(
    (name, index) =>
      ({
        id: createCustomerTypeId(name),
        workspaceId,
        name,
        normalizedName: normalizeCustomerTypeName(name),
        isActive: true,
        isArchived: false,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      }) satisfies CommerceCustomerTypeDefinition,
  )
}

export function validateCustomerTypeName(
  name: string,
  existingTypes: CommerceCustomerTypeDefinition[],
  ignoredTypeId?: string,
) {
  const cleaned = cleanCustomerTypeName(name)
  if (!cleaned) return 'Customer type name is required.'
  if (cleaned.length > 48)
    return 'Customer type names must be 48 characters or fewer.'
  const normalizedName = normalizeCustomerTypeName(cleaned)
  const duplicate = existingTypes.find(
    (type) =>
      type.id !== ignoredTypeId && type.normalizedName === normalizedName,
  )
  if (duplicate) return 'A customer type with this name already exists.'
  return undefined
}

export function getCustomerTypeUsageCount(
  typeId: string,
  customers: CommerceCustomer[],
) {
  return customers.filter((customer) => customer.customerTypeId === typeId)
    .length
}

export function getCustomerTypeUsageMap(
  types: CommerceCustomerTypeDefinition[],
  customers: CommerceCustomer[],
) {
  return new Map(
    types.map((type) => [
      type.id,
      getCustomerTypeUsageCount(type.id, customers),
    ]),
  )
}

export function getCustomerTypeLabel(
  typeId: string | undefined,
  types: CommerceCustomerTypeDefinition[],
) {
  if (!typeId) return 'Not set'
  return types.find((type) => type.id === typeId)?.name ?? typeId
}

function getLegacyTypeName(customer: CommerceCustomer) {
  if (customer.legacyCustomerTypeName) return customer.legacyCustomerTypeName
  const raw = customer.customerType
  if (!raw) return undefined
  if (raw === 'RESIDENTIAL') return 'Residential'
  if (raw === 'COMMERCIAL') return 'Commercial'
  if (raw === 'RETAIL') return 'Retail'
  if (raw === 'WHOLESALE') return 'Wholesale'
  if (raw === 'DISTRIBUTOR') return 'Distributor'
  if (raw === 'GOVERNMENT') return 'Government'
  if (raw === 'NONPROFIT') return 'Nonprofit'
  if (raw === 'EMPLOYEE') return 'Employee'
  if (raw === 'INTERNAL') return 'Internal'
  return undefined
}

export function normalizeCustomerTypeAssignments({
  customers,
  types,
  workspaceId,
  now,
}: {
  customers: CommerceCustomer[]
  types: CommerceCustomerTypeDefinition[]
  workspaceId: string
  now: string
}) {
  const nextTypes = types.length
    ? [...types]
    : createDefaultCustomerTypes({ workspaceId, now })
  let changed = types.length === 0

  const getOrCreateType = (typeName: string) => {
    const cleaned = cleanCustomerTypeName(typeName)
    if (!cleaned) return null
    const normalizedName = normalizeCustomerTypeName(cleaned)
    const existing = nextTypes.find(
      (type) => type.normalizedName === normalizedName,
    )
    if (existing) return existing
    const type: CommerceCustomerTypeDefinition = {
      id: createCustomerTypeId(cleaned),
      workspaceId,
      name: cleaned,
      normalizedName,
      isActive: true,
      isArchived: false,
      sortOrder: nextTypes.length,
      createdAt: now,
      updatedAt: now,
    }
    nextTypes.push(type)
    changed = true
    return type
  }

  const nextCustomers = customers.map((customer) => {
    if (customer.customerTypeId) return customer
    const legacyName = getLegacyTypeName(customer)
    if (!legacyName) return customer
    const type = getOrCreateType(legacyName)
    if (!type) return customer
    changed = true
    return {
      ...customer,
      customerTypeId: type.id,
      legacyCustomerTypeName: undefined,
      updatedAt: customer.updatedAt,
    }
  })

  return { customers: nextCustomers, types: nextTypes, changed }
}
