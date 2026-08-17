import {
  getPreviewCustomers,
  getPreviewFulfillments,
  getPreviewOrders,
  getPreviewProducts,
} from '@/lib/commerce/previewCommerceStorage'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import {
  mergeClientRecords,
  readPreviewClients,
} from '@/lib/clients/previewClientStorage'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import {
  mergeServiceRequestRecords,
  readPreviewServiceRequests,
} from '@/lib/service-requests/previewServiceRequestStorage'
import { demoLeads, demoOpportunities } from '@/lib/sales/demoSalesRecords'
import {
  mergeLeadRecords,
  readPreviewLeads,
} from '@/lib/sales/previewLeadStorage'
import {
  mergeOpportunityRecords,
  readPreviewOpportunities,
} from '@/lib/sales/previewOpportunityStorage'
import { readPreviewSales } from '@/lib/sales/previewSaleStorage'
import { formatLinkedRecordType } from '@/lib/scheduling/schedulingFormatters'
import type {
  SchedulingCapabilities,
  SchedulingLinkedRecordType,
} from '@/lib/scheduling/types'

export type SchedulingMemberOption = {
  id: string
  label: string
  secondary?: string
  role?: string
}

export type SchedulingLinkedRecordOption = {
  recordType: SchedulingLinkedRecordType
  recordId: string
  label: string
  secondary?: string
  context?: string
}

export function normalizeSchedulingMemberOptions(
  members: Array<{
    id?: string | null
    userId?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
    status?: string | null
    removedAt?: string | null
  }>,
): SchedulingMemberOption[] {
  const seenIds = new Set<string>()
  const seenUserIds = new Set<string>()
  return members
    .filter((member) => {
      const status = member.status?.toLowerCase()
      return status !== 'inactive' && status !== 'removed' && !member.removedAt
    })
    .map((member) => {
      const id = member.id?.trim() || member.userId?.trim() || ''
      const userId = member.userId?.trim()
      if (!id || seenIds.has(id) || (userId && seenUserIds.has(userId))) {
        return null
      }
      seenIds.add(id)
      if (userId) seenUserIds.add(userId)
      return {
        id,
        label: member.fullName?.trim() || member.email?.trim() || id,
        secondary: member.email?.trim() || member.role?.trim() || undefined,
        role: member.role?.trim() || undefined,
      }
    })
    .filter(Boolean) as SchedulingMemberOption[]
}

export function getSupportedLinkedRecordTypes(
  capabilities: SchedulingCapabilities,
): SchedulingLinkedRecordType[] {
  const fields: SchedulingLinkedRecordType[] = []
  if (capabilities.supportsLeadLinks) fields.push('lead')
  if (capabilities.supportsOpportunityLinks) fields.push('opportunity')
  if (capabilities.supportsSaleLinks) fields.push('sale')
  if (capabilities.supportsClientLinks) fields.push('client')
  if (capabilities.supportsJobLinks) fields.push('serviceRequest', 'job')
  if (capabilities.supportsCustomerLinks) fields.push('customer')
  if (capabilities.supportsOrderLinks) fields.push('order')
  if (capabilities.supportsFulfillmentLinks) fields.push('fulfillment')
  if (capabilities.supportsProductLinks) fields.push('product')
  return fields
}

export function getSchedulingLinkedRecordOptions({
  workspaceId,
  recordType,
}: {
  workspaceId: string
  recordType: SchedulingLinkedRecordType
}): SchedulingLinkedRecordOption[] {
  if (typeof window === 'undefined') return []

  const options = resolveOptions({ workspaceId, recordType })
  return options
    .filter((option) => option.recordId && option.label)
    .sort((first, second) => first.label.localeCompare(second.label))
}

export function getSchedulingLinkedRecordLabel(
  recordType: SchedulingLinkedRecordType,
  recordId: string,
  fallback?: string,
) {
  const label = fallback?.trim()
  return label || `${formatLinkedRecordType(recordType)} ${recordId}`
}

function resolveOptions({
  workspaceId,
  recordType,
}: {
  workspaceId: string
  recordType: SchedulingLinkedRecordType
}): SchedulingLinkedRecordOption[] {
  switch (recordType) {
    case 'lead':
      return mergeLeadRecords(demoLeads, readPreviewLeads(workspaceId)).map(
        (lead) => ({
          recordType,
          recordId: lead.id,
          label: lead.name,
          secondary: [lead.company, lead.stage, lead.contactEmail]
            .filter(Boolean)
            .join(' - '),
          context: lead.value ? currency(lead.value) : undefined,
        }),
      )
    case 'opportunity':
      return mergeOpportunityRecords(
        demoOpportunities,
        readPreviewOpportunities(workspaceId),
      ).map((opportunity) => ({
        recordType,
        recordId: opportunity.id,
        label: opportunity.name,
        secondary: [opportunity.client, opportunity.stage]
          .filter(Boolean)
          .join(' - '),
        context: currency(opportunity.value),
      }))
    case 'sale':
      return readPreviewSales(workspaceId).map((sale) => ({
        recordType,
        recordId: sale.id,
        label: sale.name,
        secondary: [sale.company, sale.stage].filter(Boolean).join(' - '),
        context: currency(sale.value),
      }))
    case 'client':
      return mergeClientRecords(
        createMockWorkspaceClients(workspaceId),
        readPreviewClients(workspaceId),
      ).map((client) => ({
        recordType,
        recordId: client.id,
        label: client.name,
        secondary: [client.company, client.email].filter(Boolean).join(' - '),
        context: client.status,
      }))
    case 'serviceRequest':
      return mergeServiceRequestRecords(
        createMockServiceRequests(workspaceId),
        readPreviewServiceRequests(workspaceId),
      ).map((request) => ({
        recordType,
        recordId: request.id,
        label: request.title,
        secondary: [request.customerName, request.company, request.status]
          .filter(Boolean)
          .join(' - '),
        context: request.priority,
      }))
    case 'customer':
      return getPreviewCustomers(workspaceId).map((customer) => ({
        recordType,
        recordId: customer.id,
        label: customer.displayName,
        secondary: [customer.companyName, customer.email]
          .filter(Boolean)
          .join(' - '),
        context: customer.lifecycleStatus,
      }))
    case 'order':
      return getPreviewOrders(workspaceId).map((order) => ({
        recordType,
        recordId: order.id,
        label: order.orderNumber,
        secondary: order.customerSnapshot?.displayName,
        context: currency(order.total),
      }))
    case 'fulfillment':
      return getPreviewFulfillments(workspaceId).map((fulfillment) => ({
        recordType,
        recordId: fulfillment.id,
        label: fulfillment.fulfillmentNumber,
        secondary: fulfillment.orderId,
        context: fulfillment.status,
      }))
    case 'product':
      return getPreviewProducts(workspaceId).map((product) => ({
        recordType,
        recordId: product.id,
        label: product.name,
        secondary: [product.sku, product.category].filter(Boolean).join(' - '),
        context: product.status,
      }))
    case 'job':
      return []
    default:
      return []
  }
}

function currency(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
