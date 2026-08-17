import type { CommerceOrder } from '@/lib/commerce/types'
import type { WorkspaceClient } from '@/lib/clients/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import { calculateOrderFinancialsFromOrder } from '@/lib/commerce/calculateOrderFinancials'
import { normalizeAmountCents, dollarsToCents } from '@/lib/revenue/money'
import type {
  RecognizedRevenueEntry,
  WorkspaceRevenueTransaction,
} from '@/lib/revenue/types'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'

export type RevenueResolutionInput = {
  workspaceId: string
  transactions?: WorkspaceRevenueTransaction[]
  serviceRequests?: WorkspaceServiceRequest[]
  commerceOrders?: CommerceOrder[]
}

export type WorkspaceRevenueSummary = {
  recognizedRevenueCents: number
  entries: RecognizedRevenueEntry[]
}

export type PipelineValueInput = {
  leads?: LeadRecord[]
  opportunities?: OpportunityRecord[]
}

export function isRecognizedRevenueTransaction(
  transaction: WorkspaceRevenueTransaction,
) {
  return (
    transaction.status === 'recognized' &&
    normalizeAmountCents(transaction.amountCents) > 0
  )
}

export function isCompletedRevenueJob(request: WorkspaceServiceRequest) {
  return (
    request.status === 'Completed' &&
    normalizeAmountCents(request.valueCents) > 0
  )
}

export function getRecognizedRevenue({
  workspaceId,
  transactions = [],
  serviceRequests = [],
  commerceOrders = [],
}: RevenueResolutionInput): WorkspaceRevenueSummary {
  const entries: RecognizedRevenueEntry[] = []
  const explicitJobSourceIds = new Set<string>()

  transactions
    .filter(
      (transaction) =>
        transaction.workspaceId === workspaceId &&
        isRecognizedRevenueTransaction(transaction),
    )
    .forEach((transaction) => {
      if (transaction.sourceType === 'JOB' && transaction.sourceId) {
        explicitJobSourceIds.add(transaction.sourceId)
      }
      entries.push({
        id: `transaction:${transaction.id}`,
        workspaceId,
        amountCents: normalizeAmountCents(transaction.amountCents),
        currency: transaction.currency || 'USD',
        occurredAt: transaction.occurredAt,
        description: transaction.description,
        source: 'manualTransaction',
        sourceType: transaction.sourceType,
        sourceId: transaction.sourceId,
        clientId: transaction.clientId,
        customerId: transaction.customerId,
      })
    })

  serviceRequests
    .filter(
      (request) =>
        request.workspaceId === workspaceId &&
        isCompletedRevenueJob(request) &&
        !explicitJobSourceIds.has(request.id),
    )
    .forEach((request) => {
      // TODO: replace completed-job fallback revenue with explicit revenue
      // transactions once invoices/payments exist as durable financial records.
      entries.push({
        id: `job:${request.id}`,
        workspaceId,
        amountCents: normalizeAmountCents(request.valueCents),
        currency: request.currency || 'USD',
        occurredAt: request.completedAt ?? request.createdAt,
        description: request.title,
        source: 'jobFallback',
        sourceType: 'JOB',
        sourceId: request.id,
        clientId: request.clientId,
        customerId: null,
      })
    })

  commerceOrders
    .filter(
      (order) =>
        order.workspaceId === workspaceId &&
        !order.archivedAt &&
        order.status !== 'CANCELLED' &&
        order.paymentStatus === 'PAID',
    )
    .forEach((order) => {
      const financials = calculateOrderFinancialsFromOrder(order)
      const amountCents = dollarsToCents(financials.totalOrderRevenue)
      if (amountCents <= 0) return
      entries.push({
        id: `order:${order.id}`,
        workspaceId,
        amountCents,
        currency: order.currency || 'USD',
        occurredAt: order.updatedAt || order.createdAt,
        description: `Order ${order.orderNumber}`,
        source: 'commerceOrder',
        sourceType: 'ORDER',
        sourceId: order.id,
        customerId: order.customerId,
        clientId: null,
      })
    })

  const recognizedRevenueCents = entries.reduce(
    (sum, entry) => sum + normalizeAmountCents(entry.amountCents),
    0,
  )

  return {
    recognizedRevenueCents,
    entries: entries.sort((first, second) =>
      second.occurredAt.localeCompare(first.occurredAt),
    ),
  }
}

export function getCustomerLifetimeValue({
  workspaceId,
  client,
  customerId,
  transactions = [],
  serviceRequests = [],
  commerceOrders = [],
}: RevenueResolutionInput & {
  client?: WorkspaceClient
  customerId?: string
}) {
  const revenue = getRecognizedRevenue({
    workspaceId,
    transactions,
    serviceRequests,
    commerceOrders,
  })
  const identifiers = new Set<string>()
  if (client?.id) identifiers.add(client.id)
  if (customerId) identifiers.add(customerId)

  return revenue.entries
    .filter((entry) =>
      [entry.clientId, entry.customerId].some(
        (identifier) => identifier && identifiers.has(identifier),
      ),
    )
    .reduce((sum, entry) => sum + normalizeAmountCents(entry.amountCents), 0)
}

export function getActivePipelineValue({
  leads = [],
  opportunities = [],
}: PipelineValueInput) {
  const convertedLeadIds = new Set(
    opportunities
      .map((opportunity) => opportunity.sourceLeadId ?? opportunity.leadId)
      .filter(Boolean) as string[],
  )

  const leadPipelineValue = leads
    .filter((lead) => !lead.converted && !convertedLeadIds.has(lead.id))
    .reduce((sum, lead) => sum + dollarsToCents(lead.value), 0)
  const opportunityPipelineValue = opportunities
    .filter(
      (opportunity) =>
        opportunity.status === 'Active' || opportunity.status === 'At Risk',
    )
    .reduce((sum, opportunity) => sum + dollarsToCents(opportunity.value), 0)

  return {
    leadPipelineValueCents: leadPipelineValue,
    opportunityPipelineValueCents: opportunityPipelineValue,
    totalPipelineValueCents: leadPipelineValue + opportunityPipelineValue,
  }
}
