import { getLocalTimestamp } from '@/lib/formatting/dates'
import type { WorkspaceClient } from '@/lib/clients/types'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import type { SaleRecord } from '@/lib/sales/previewSaleStorage'

const STORAGE_PREFIX = 'skillify-preview-contact-identities'

export type SharedContactIdentity = {
  id: string
  workspaceId: string
  contactName: string
  companyName?: string
  email?: string
  phone?: string
  jobTitle?: string
  preferredContactMethod?: string
  address?: string
  sharedNotes?: string
  updatedAt: string
}

export type IdentityBackedRecord = Partial<
  Pick<
    LeadRecord,
    | 'id'
    | 'name'
    | 'company'
    | 'contactEmail'
    | 'contactPhone'
    | 'sharedContactId'
  >
> &
  Partial<
    Pick<
      OpportunityRecord,
      | 'contactName'
      | 'contactEmail'
      | 'contactPhone'
      | 'company'
      | 'sharedContactId'
    >
  > &
  Partial<
    Pick<
      SaleRecord,
      | 'contactName'
      | 'contactEmail'
      | 'contactPhone'
      | 'company'
      | 'sharedContactId'
    >
  > &
  Partial<
    Pick<
      WorkspaceClient,
      'name' | 'email' | 'phone' | 'company' | 'sharedContactId'
    >
  >

export function getContactIdentityStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function readContactIdentities(
  workspaceId: string,
): SharedContactIdentity[] {
  if (typeof window === 'undefined') return []
  try {
    const value = window.sessionStorage.getItem(
      getContactIdentityStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as SharedContactIdentity[]) : []
  } catch {
    return []
  }
}

export function writeContactIdentities(
  workspaceId: string,
  identities: SharedContactIdentity[],
) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(
    getContactIdentityStorageKey(workspaceId),
    JSON.stringify(identities),
  )
}

export function getSharedContactIdForRecord(record: IdentityBackedRecord) {
  return (
    record.sharedContactId ??
    `contact-${record.id ?? slugify(record.company ?? record.contactName ?? record.name ?? 'unknown')}`
  )
}

export function resolveContactIdentity(
  workspaceId: string,
  record: IdentityBackedRecord,
): SharedContactIdentity {
  const id = getSharedContactIdForRecord(record)
  const existing = readContactIdentities(workspaceId).find(
    (identity) => identity.id === id,
  )
  if (existing) return existing
  return {
    id,
    workspaceId,
    contactName:
      record.contactName ?? record.name ?? record.company ?? 'Unknown contact',
    companyName: record.company,
    email: record.contactEmail ?? record.email,
    phone: record.contactPhone ?? record.phone,
    updatedAt: getLocalTimestamp(),
  }
}

export function upsertContactIdentity(
  workspaceId: string,
  identity: SharedContactIdentity,
) {
  const timestamp = getLocalTimestamp()
  const nextIdentity = {
    ...identity,
    workspaceId,
    updatedAt: timestamp,
  }
  const next = [
    nextIdentity,
    ...readContactIdentities(workspaceId).filter(
      (record) => record.id !== identity.id,
    ),
  ]
  writeContactIdentities(workspaceId, next)
  return nextIdentity
}

export function ensureContactIdentity(
  workspaceId: string,
  record: IdentityBackedRecord,
) {
  return upsertContactIdentity(
    workspaceId,
    resolveContactIdentity(workspaceId, record),
  )
}

export function applyIdentityToLead<T extends LeadRecord>(
  lead: T,
  identity: SharedContactIdentity,
): T {
  return {
    ...lead,
    sharedContactId: identity.id,
    name: identity.contactName || lead.name,
    company: identity.companyName || lead.company,
    contactEmail: identity.email,
    contactPhone: identity.phone,
  }
}

export function applyIdentityToOpportunity<T extends OpportunityRecord>(
  opportunity: T,
  identity: SharedContactIdentity,
): T {
  return {
    ...opportunity,
    sharedContactId: identity.id,
    contactName: identity.contactName || opportunity.contactName,
    client: identity.companyName || opportunity.client,
    company: identity.companyName || opportunity.company,
    contactEmail: identity.email,
    contactPhone: identity.phone,
  }
}

export function applyIdentityToSale<T extends SaleRecord>(
  sale: T,
  identity: SharedContactIdentity,
): T {
  return {
    ...sale,
    sharedContactId: identity.id,
    contactName: identity.contactName || sale.contactName,
    company: identity.companyName || sale.company,
    contactEmail: identity.email,
    contactPhone: identity.phone,
  }
}

export function applyIdentityToClient<T extends WorkspaceClient>(
  client: T,
  identity: SharedContactIdentity,
): T {
  return {
    ...client,
    sharedContactId: identity.id,
    name: identity.contactName || client.name,
    company: identity.companyName || client.company,
    email: identity.email || client.email,
    phone: identity.phone || client.phone,
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
