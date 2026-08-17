import { describe, expect, it } from 'vitest'

import {
  getQualifiedLeadPromptCopy,
  resolveLeadStageConversionAction,
  resolveQualifiedLeadAction,
} from '@/lib/crm/leadLifecycle'
import { leadStageOptions } from '@/lib/crm/pipelineStageRegistry'
import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import type { LeadRecord } from '@/lib/sales/demoSalesRecords'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'

const baseCapabilities: WorkspaceCapabilities = {
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  modules: {
    leads: true,
    opportunities: true,
    sales: true,
    clients: true,
    customers: false,
    products: false,
    orders: false,
    fulfillment: false,
    inventory: false,
    subscriptions: false,
    wholesale: false,
    returns: false,
    discounts: false,
    suppliers: false,
    commerceCrm: false,
  },
  commerce: {
    commerceEnabled: false,
    customersEnabled: false,
    productsEnabled: false,
    ordersEnabled: false,
    fulfillmentEnabled: false,
    inventoryEnabled: false,
    subscriptionsEnabled: false,
    wholesaleEnabled: false,
    returnsEnabled: false,
    discountsEnabled: false,
    suppliersEnabled: false,
    commerceCrmEnabled: false,
  },
  terminology: {
    leadSingular: 'Lead',
    leadPlural: 'Leads',
    opportunitySingular: 'Opportunity',
    opportunityPlural: 'Opportunities',
    clientSingular: 'Client',
    clientPlural: 'Clients',
    customerSingular: 'Client',
    customerPlural: 'Clients',
    serviceRequestSingular: 'Service Request',
    serviceRequestPlural: 'Service Requests',
    taskSingular: 'Task',
    taskPlural: 'Tasks',
    salesLabel: 'Sales',
    commerce: {
      customerSingular: 'Customer',
      customerPlural: 'Customers',
      productSingular: 'Product',
      productPlural: 'Products',
      orderSingular: 'Order',
      orderPlural: 'Orders',
      fulfillmentSingular: 'Fulfillment',
      fulfillmentPlural: 'Fulfillment',
      inventory: 'Inventory',
      subscriptionSingular: 'Subscription',
      subscriptionPlural: 'Subscriptions',
      wholesaleAccount: 'Wholesale Account',
      returnSingular: 'Return',
      returnPlural: 'Returns',
    },
  },
  conversion: {
    defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    allowDirectLeadToSale: true,
    qualifiedLeadBehavior: QualifiedLeadBehavior.ASK,
  },
  scheduling: getWorkspaceSchedulingCapabilities({
    businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  }),
}

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-1',
    name: 'Rachel Adams',
    company: 'Adams Bookkeeping',
    status: 'Contacted',
    stage: 'Contacted',
    source: 'Website Form',
    value: 1200,
    nextStep: 'Follow up',
    ownerId: 'owner',
    createdAt: '2026-06-01',
    converted: false,
    notes: 'Notes',
    ...overrides,
  }
}

describe('qualified lead lifecycle', () => {
  it('keeps Converted out of manually selectable Lead stages', () => {
    expect(leadStageOptions).toEqual([
      'New',
      'Contacted',
      'Nurture',
      'Qualified',
      'Disqualified',
    ])
    expect(leadStageOptions).not.toContain('Converted')
  })

  it('prompts when an active lead transitions into Qualified in ASK mode', () => {
    const action = resolveQualifiedLeadAction({
      before: lead(),
      after: lead({ status: 'Qualified', stage: 'Qualified' }),
      capabilities: baseCapabilities,
    })

    expect(action).toEqual({
      type: 'PROMPT',
      destination: LeadConversionDestination.OPPORTUNITY,
    })
    expect(
      getQualifiedLeadPromptCopy(lead(), LeadConversionDestination.OPPORTUNITY)
        .primaryAction,
    ).toBe('Convert to Opportunity')
  })

  it('does not prompt for leads that were already Qualified or converted', () => {
    expect(
      resolveQualifiedLeadAction({
        before: lead({ status: 'Qualified', stage: 'Qualified' }),
        after: lead({
          status: 'Qualified',
          stage: 'Qualified',
          notes: 'Updated',
        }),
        capabilities: baseCapabilities,
      }).type,
    ).toBe('NONE')
    expect(
      resolveQualifiedLeadAction({
        before: lead({
          converted: true,
          status: 'Converted',
          stage: 'Qualified',
        }),
        after: lead({
          converted: true,
          status: 'Converted',
          stage: 'Qualified',
        }),
        capabilities: baseCapabilities,
      }).type,
    ).toBe('NONE')
  })

  it('auto-converts or keeps Qualified based on workspace behavior', () => {
    const after = lead({ status: 'Qualified', stage: 'Qualified' })
    expect(
      resolveQualifiedLeadAction({
        before: lead(),
        after,
        capabilities: {
          ...baseCapabilities,
          conversion: {
            ...baseCapabilities.conversion,
            qualifiedLeadBehavior: QualifiedLeadBehavior.AUTO_CONVERT,
            defaultLeadDestination: LeadConversionDestination.SALE,
          },
        },
      }),
    ).toEqual({
      type: 'AUTO_CONVERT',
      destination: LeadConversionDestination.SALE,
    })
    expect(
      resolveQualifiedLeadAction({
        before: lead(),
        after,
        capabilities: {
          ...baseCapabilities,
          conversion: {
            ...baseCapabilities.conversion,
            qualifiedLeadBehavior: QualifiedLeadBehavior.KEEP_QUALIFIED,
          },
        },
      }).type,
    ).toBe('NONE')
  })

  it('auto-converts Simple Service Won leads through the Customer conversion path', () => {
    expect(
      resolveLeadStageConversionAction({
        before: lead({ status: 'Contacted', stage: 'Follow-Up' }),
        after: lead({ status: 'Qualified', stage: 'Won' }),
        capabilities: {
          ...baseCapabilities,
          businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
          modules: {
            ...baseCapabilities.modules,
            opportunities: false,
            sales: false,
            clients: true,
          },
          conversion: {
            ...baseCapabilities.conversion,
            defaultLeadDestination: LeadConversionDestination.CUSTOMER,
          },
        },
      }),
    ).toEqual({
      type: 'AUTO_CONVERT',
      destination: LeadConversionDestination.CUSTOMER,
    })
  })

  it('does not treat Simple Service Lost as conversion', () => {
    expect(
      resolveLeadStageConversionAction({
        before: lead({ status: 'Contacted', stage: 'Contacted' }),
        after: lead({ status: 'Disqualified', stage: 'Lost' }),
        capabilities: {
          ...baseCapabilities,
          businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
          modules: {
            ...baseCapabilities.modules,
            opportunities: false,
            sales: false,
            clients: true,
          },
          conversion: {
            ...baseCapabilities.conversion,
            defaultLeadDestination: LeadConversionDestination.CUSTOMER,
          },
        },
      }).type,
    ).toBe('NONE')
  })
})
