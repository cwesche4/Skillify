import { beforeEach, describe, expect, it } from 'vitest'

import {
  getActivePipelineValue,
  getCustomerLifetimeValue,
  getRecognizedRevenue,
} from '@/lib/revenue/revenueResolver'
import {
  createPreviewRevenueTransaction,
  readPreviewRevenueTransactions,
} from '@/lib/revenue/previewRevenueStorage'
import type { WorkspaceRevenueTransaction } from '@/lib/revenue/types'
import type { WorkspaceClient } from '@/lib/clients/types'
import type { CommerceOrder } from '@/lib/commerce/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'

const workspaceId = 'workspace-revenue-test'
const otherWorkspaceId = 'workspace-other'
const now = '2026-07-30T12:00:00.000Z'

function client(overrides: Partial<WorkspaceClient> = {}): WorkspaceClient {
  return {
    id: 'client-1',
    workspaceId,
    name: 'Corbin Wesche',
    company: 'Wesche Home Services',
    email: 'corbin@example.com',
    phone: '+1 555 0100',
    status: 'Active',
    pipelineStage: 'In Progress',
    lastActivity: now,
    openTasks: 0,
    value: 9000,
    nextAction: 'Follow up',
    ownerId: 'owner-1',
    health: 'Healthy',
    tags: [],
    notes: '',
    activity: [],
    tasks: [],
    suggestedAutomations: [],
    opportunity: {
      value: 9000,
      nextAction: 'Follow up',
      probability: 50,
      expectedCloseWindow: 'This month',
    },
    ...overrides,
  }
}

function serviceRequest(
  overrides: Partial<WorkspaceServiceRequest> = {},
): WorkspaceServiceRequest {
  return {
    id: 'job-1',
    workspaceId,
    clientId: 'client-1',
    customerName: 'Corbin Wesche',
    company: 'Wesche Home Services',
    email: 'corbin@example.com',
    phone: '+1 555 0100',
    title: 'Repair visit',
    description: '',
    notes: '',
    priority: 'Normal',
    status: 'Completed',
    serviceType: 'Service Call',
    valueCents: 15000,
    currency: 'USD',
    assignedToOwnerId: 'owner-1',
    scheduledFor: '2026-07-30T09:00:00.000Z',
    estimatedDuration: '1 hr',
    createdAt: '2026-07-30T08:00:00.000Z',
    completedAt: '2026-07-30T10:00:00.000Z',
    source: 'Manual',
    relatedRecords: {
      linkedClient: 'Wesche Home Services',
      linkedTasks: '0',
      linkedOpportunity: 'None',
    },
    timeline: [],
    ...overrides,
  }
}

function transaction(
  overrides: Partial<WorkspaceRevenueTransaction> = {},
): WorkspaceRevenueTransaction {
  return {
    id: 'revenue-1',
    workspaceId,
    clientId: 'client-1',
    customerId: null,
    amountCents: 12500,
    currency: 'USD',
    occurredAt: now,
    description: 'Manual revenue',
    sourceType: 'MANUAL',
    sourceId: null,
    status: 'recognized',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function order(overrides: Partial<CommerceOrder> = {}): CommerceOrder {
  return {
    id: 'order-1',
    workspaceId,
    orderNumber: 'ORD-01001',
    customerId: 'customer-1',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'DELIVERED',
    currency: 'USD',
    subtotal: 100,
    discountTotal: 0,
    taxTotal: 8,
    shippingTotal: 10,
    shippingCharge: 10,
    shippingCost: 4,
    shippingPayer: 'CUSTOMER',
    total: 118,
    lines: [
      {
        id: 'line-1',
        orderId: 'order-1',
        name: 'Widget',
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 8,
        subtotal: 100,
        lineTotal: 108,
      },
    ],
    shippingSameAsBilling: true,
    source: 'MANUAL',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    ...overrides,
  }
}

describe('revenueResolver', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('does not treat lead, opportunity, sale, or customer value as recognized revenue', () => {
    const summary = getRecognizedRevenue({
      workspaceId,
      transactions: [],
      serviceRequests: [],
      commerceOrders: [],
    })

    expect(summary.recognizedRevenueCents).toBe(0)
    expect(
      getCustomerLifetimeValue({
        workspaceId,
        client: client({ value: 9000 }),
        transactions: [],
        serviceRequests: [],
      }),
    ).toBe(0)
  })

  it('keeps active pipeline value separate and dedupes converted leads with opportunities', () => {
    const leads: LeadRecord[] = [
      {
        id: 'lead-1',
        name: 'Lead One',
        company: 'One Co',
        status: 'New',
        stage: 'New Lead',
        source: 'Manual Entry',
        value: 1200,
        nextStep: 'Call',
        ownerId: 'owner-1',
        createdAt: '2026-07-01',
        converted: false,
        notes: '',
      },
      {
        id: 'lead-2',
        name: 'Lead Two',
        company: 'Two Co',
        status: 'Converted',
        stage: 'Converted',
        source: 'Referral',
        value: 5000,
        nextStep: 'Proposal',
        ownerId: 'owner-1',
        createdAt: '2026-07-02',
        converted: true,
        notes: '',
      },
    ]
    const opportunities: OpportunityRecord[] = [
      {
        id: 'opp-1',
        name: 'Converted opportunity',
        client: 'Two Co',
        status: 'Active',
        stage: 'Discovery',
        value: 5000,
        probability: 50,
        ownerId: 'owner-1',
        nextStep: 'Send scope',
        lastActivityAt: now,
        sourceLeadId: 'lead-2',
      },
    ]

    expect(getActivePipelineValue({ leads, opportunities })).toMatchObject({
      leadPipelineValueCents: 120000,
      opportunityPipelineValueCents: 500000,
      totalPipelineValueCents: 620000,
    })
  })

  it('counts manual revenue transactions and keeps customer LTV workspace scoped', () => {
    const transactions = [
      transaction({ amountCents: 12500 }),
      transaction({
        id: 'revenue-other',
        workspaceId: otherWorkspaceId,
        amountCents: 999900,
      }),
      transaction({ id: 'voided', amountCents: 4000, status: 'void' }),
    ]

    expect(
      getRecognizedRevenue({ workspaceId, transactions })
        .recognizedRevenueCents,
    ).toBe(12500)
    expect(
      getCustomerLifetimeValue({
        workspaceId,
        client: client(),
        transactions,
      }),
    ).toBe(12500)
  })

  it('uses completed job fallback revenue and dedupes explicit job-linked revenue', () => {
    const serviceRequests = [
      serviceRequest({ id: 'completed-job', valueCents: 15000 }),
      serviceRequest({
        id: 'open-job',
        status: 'Scheduled',
        valueCents: 20000,
        completedAt: null,
      }),
      serviceRequest({ id: 'explicit-job', valueCents: 27500 }),
    ]
    const transactions = [
      transaction({
        id: 'explicit-job-revenue',
        amountCents: 27500,
        sourceType: 'JOB',
        sourceId: 'explicit-job',
      }),
    ]

    const summary = getRecognizedRevenue({
      workspaceId,
      transactions,
      serviceRequests,
    })

    expect(summary.recognizedRevenueCents).toBe(42500)
    expect(summary.entries.map((entry) => entry.id).sort()).toEqual([
      'job:completed-job',
      'transaction:explicit-job-revenue',
    ])
  })

  it('counts completed recurring-like job occurrences without counting open future visits', () => {
    const summary = getRecognizedRevenue({
      workspaceId,
      serviceRequests: [
        serviceRequest({
          id: 'recurring-template',
          status: 'Scheduled',
          title: 'Weekly maintenance series',
          valueCents: 10000,
          completedAt: null,
        }),
        serviceRequest({
          id: 'recurring-occurrence-1',
          title: 'Weekly maintenance · Jul 10',
          valueCents: 10000,
        }),
        serviceRequest({
          id: 'recurring-occurrence-2',
          title: 'Weekly maintenance · Jul 17',
          valueCents: 10000,
        }),
        serviceRequest({
          id: 'recurring-occurrence-3',
          status: 'Scheduled',
          title: 'Weekly maintenance · Jul 24',
          valueCents: 10000,
          completedAt: null,
        }),
      ],
    })

    expect(summary.recognizedRevenueCents).toBe(20000)
    expect(summary.entries.map((entry) => entry.sourceId).sort()).toEqual([
      'recurring-occurrence-1',
      'recurring-occurrence-2',
    ])
  })

  it('preserves commerce paid order revenue and excludes unpaid or canceled orders', () => {
    const summary = getRecognizedRevenue({
      workspaceId,
      commerceOrders: [
        order(),
        order({ id: 'unpaid-order', paymentStatus: 'UNPAID' }),
        order({ id: 'canceled-order', status: 'CANCELLED' }),
      ],
    })

    expect(summary.recognizedRevenueCents).toBe(11000)
    expect(
      getCustomerLifetimeValue({
        workspaceId,
        customerId: 'customer-1',
        commerceOrders: [order()],
      }),
    ).toBe(11000)
  })

  it('persists manual preview revenue without requiring a job', () => {
    const saved = createPreviewRevenueTransaction({
      workspaceId,
      transaction: {
        clientId: 'client-1',
        amountCents: 6500,
        currency: 'USD',
        occurredAt: now,
        description: 'Counter sale',
        sourceType: 'MANUAL',
      },
    })

    expect(saved.sourceType).toBe('MANUAL')
    expect(readPreviewRevenueTransactions(workspaceId)).toMatchObject([
      { id: saved.id, amountCents: 6500, status: 'recognized' },
    ])
  })
})
