import type { SchedulingLinkedRecordType } from '@/lib/scheduling/types'

export type LinkedRecordNavigationTarget = {
  href: string
  route: string
  sectionAnchor: string
  queryParam: string
  recordId: string
}

const navigationByType: Partial<
  Record<
    SchedulingLinkedRecordType,
    {
      route: string
      sectionAnchor: string
      queryParam: string
    }
  >
> = {
  lead: {
    route: 'leads',
    sectionAnchor: 'leads-workspace',
    queryParam: 'leadId',
  },
  opportunity: {
    route: 'opportunities',
    sectionAnchor: 'opportunities-workspace',
    queryParam: 'opportunityId',
  },
  sale: {
    route: 'sales-pipeline',
    sectionAnchor: 'sales-pipeline-workspace',
    queryParam: 'dealId',
  },
  client: {
    route: 'clients',
    sectionAnchor: 'client-relationships',
    queryParam: 'clientId',
  },
  serviceRequest: {
    route: 'service-requests',
    sectionAnchor: 'service-requests-workspace',
    queryParam: 'requestId',
  },
  customer: {
    route: 'customers',
    sectionAnchor: 'commerce-customers-workspace',
    queryParam: 'customerId',
  },
  order: {
    route: 'orders',
    sectionAnchor: 'commerce-orders-workspace',
    queryParam: 'orderId',
  },
  fulfillment: {
    route: 'fulfillment',
    sectionAnchor: 'commerce-fulfillment-workspace',
    queryParam: 'fulfillmentId',
  },
  product: {
    route: 'products',
    sectionAnchor: 'commerce-products-workspace',
    queryParam: 'productId',
  },
  job: {
    route: 'scheduling/jobs',
    sectionAnchor: 'scheduled-jobs-workspace',
    queryParam: 'jobId',
  },
}

export function getLinkedRecordNavigationTarget({
  workspaceSlug,
  recordType,
  recordId,
}: {
  workspaceSlug: string
  recordType: SchedulingLinkedRecordType
  recordId: string
}): LinkedRecordNavigationTarget | null {
  const target = navigationByType[recordType]
  const id = recordId.trim()
  if (!target || !id) return null
  const route = `/dashboard/${encodeURIComponent(workspaceSlug)}/${target.route}`
  const query = `${target.queryParam}=${encodeURIComponent(id)}&recordType=${encodeURIComponent(recordType)}`
  return {
    ...target,
    route,
    recordId: id,
    href: `${route}?${query}#${target.sectionAnchor}`,
  }
}
