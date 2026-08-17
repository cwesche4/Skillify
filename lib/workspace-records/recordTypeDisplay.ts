import {
  DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  type WorkspaceRecordTerminology,
} from '@/lib/workspaces/workspacePresentation'

export type CanonicalRecordType =
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'client'
  | 'customer'
  | 'serviceRequest'
  | 'task'
  | 'order'
  | 'fulfillment'
  | 'product'
  | 'job'
  | string

const defaultRecordLabels: Record<
  string,
  { singular: string; plural: string }
> = {
  lead: { singular: 'Lead', plural: 'Leads' },
  opportunity: { singular: 'Opportunity', plural: 'Opportunities' },
  sale: { singular: 'Sale', plural: 'Sales' },
  customer: { singular: 'Customer', plural: 'Customers' },
  order: { singular: 'Order', plural: 'Orders' },
  fulfillment: { singular: 'Fulfillment', plural: 'Fulfillments' },
  product: { singular: 'Product', plural: 'Products' },
  job: { singular: 'Scheduled Job', plural: 'Scheduled Jobs' },
}

function humanizeRecordType(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getRecordTypeDisplayName({
  recordType,
  terminology = DEFAULT_WORKSPACE_RECORD_TERMINOLOGY,
  plural = false,
}: {
  recordType: CanonicalRecordType
  terminology?: WorkspaceRecordTerminology
  plural?: boolean
}) {
  if (recordType === 'client') {
    return plural ? terminology.customerPlural : terminology.customerSingular
  }
  if (recordType === 'serviceRequest') {
    return plural
      ? terminology.serviceRequestPlural
      : terminology.serviceRequestSingular
  }
  if (recordType === 'task') {
    return plural ? terminology.taskPlural : terminology.taskSingular
  }
  const label = defaultRecordLabels[recordType]
  if (label) return plural ? label.plural : label.singular
  const singular = humanizeRecordType(recordType)
  return plural ? `${singular}s` : singular
}
