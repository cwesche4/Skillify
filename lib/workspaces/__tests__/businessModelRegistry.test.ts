import { describe, expect, it } from 'vitest'

import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import {
  getWorkspaceBusinessModelDefinition,
  getWorkspaceBusinessModelDefaults,
  listWorkspaceBusinessModels,
} from '@/lib/workspaces/businessModelRegistry'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

describe('workspace business model registry', () => {
  it('returns the four supported operating models', () => {
    expect(listWorkspaceBusinessModels().map((model) => model.id)).toEqual([
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      WorkspaceBusinessModel.DIRECT_SALES,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    ])
  })

  it('uses simplified display names for workspace creation', () => {
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ).name,
    ).toBe('Service Business')
    expect(
      getWorkspaceBusinessModelDefinition(WorkspaceBusinessModel.DIRECT_SALES)
        .name,
    ).toBe('Sales & Services')
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.CONSULTATIVE_SALES,
      ).name,
    ).toBe('Consultative Sales')
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.PRODUCT_COMMERCE,
      ).name,
    ).toBe('Product & Commerce')
  })

  it('uses acquisition-focused display workflows', () => {
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ).defaultWorkflow,
    ).toBe('Leads -> Customers')
    expect(
      getWorkspaceBusinessModelDefinition(WorkspaceBusinessModel.DIRECT_SALES)
        .defaultWorkflow,
    ).toBe('Leads -> Sales -> Clients')
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.CONSULTATIVE_SALES,
      ).defaultWorkflow,
    ).toBe('Leads -> Opportunities -> Sales -> Clients')
    expect(
      getWorkspaceBusinessModelDefinition(
        WorkspaceBusinessModel.PRODUCT_COMMERCE,
      ).defaultWorkflow,
    ).toBe('Customers -> Orders -> Fulfillment')
  })

  it('configures simple service with direct lead to customer conversion', () => {
    const definition = getWorkspaceBusinessModelDefinition(
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    )
    const capabilities = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ),
    )

    expect(definition.defaultWorkflow).toBe('Leads -> Customers')
    expect(definition.defaultWorkflow).not.toContain('Jobs')
    expect(definition.defaultWorkflow).not.toContain('Job Steps')
    expect(capabilities.modules.leads).toBe(true)
    expect(capabilities.modules.clients).toBe(true)
    expect(capabilities.modules.opportunities).toBe(false)
    expect(capabilities.modules.sales).toBe(false)
    expect(capabilities.modules.customers).toBe(false)
    expect(capabilities.terminology.customerPlural).toBe('Customers')
    expect(capabilities.terminology.serviceRequestPlural).toBe('Jobs')
    expect(capabilities.terminology.taskPlural).toBe('Job Steps')
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.CUSTOMER,
    )
  })

  it('configures consultative sales with opportunities', () => {
    const capabilities = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(
        WorkspaceBusinessModel.CONSULTATIVE_SALES,
      ),
    )

    expect(capabilities.modules.opportunities).toBe(true)
    expect(capabilities.modules.sales).toBe(true)
    expect(capabilities.modules.clients).toBe(true)
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.OPPORTUNITY,
    )
  })

  it('configures direct sales without opportunities', () => {
    const capabilities = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(WorkspaceBusinessModel.DIRECT_SALES),
    )

    expect(capabilities.modules.opportunities).toBe(false)
    expect(capabilities.modules.sales).toBe(true)
    expect(capabilities.terminology.customerPlural).toBe('Clients')
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.SALE,
    )
  })

  it('configures product commerce with customer terminology', () => {
    const definition = getWorkspaceBusinessModelDefinition(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    const capabilities = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(
        WorkspaceBusinessModel.PRODUCT_COMMERCE,
      ),
    )

    expect(definition.defaultWorkflow).toBe(
      'Customers -> Orders -> Fulfillment',
    )
    expect(capabilities.modules.customers).toBe(true)
    expect(capabilities.modules.products).toBe(true)
    expect(capabilities.modules.orders).toBe(true)
    expect(capabilities.modules.fulfillment).toBe(true)
    expect(capabilities.commerce.commerceEnabled).toBe(true)
    expect(capabilities.commerce.productsEnabled).toBe(true)
    expect(capabilities.commerce.inventoryEnabled).toBe(false)
    expect(capabilities.commerce.subscriptionsEnabled).toBe(false)
    expect(capabilities.commerce.wholesaleEnabled).toBe(false)
    expect(capabilities.commerce.returnsEnabled).toBe(false)
    expect(capabilities.commerce.discountsEnabled).toBe(false)
    expect(capabilities.commerce.suppliersEnabled).toBe(false)
    expect(capabilities.modules.leads).toBe(false)
    expect(capabilities.modules.opportunities).toBe(false)
    expect(capabilities.modules.sales).toBe(false)
    expect(capabilities.modules.commerceCrm).toBe(false)
    expect(capabilities.terminology.customerPlural).toBe('Customers')
    expect(capabilities.terminology.commerce.orderPlural).toBe('Orders')
    expect(capabilities.terminology.commerce.fulfillmentPlural).toBe(
      'Fulfillment',
    )
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.CUSTOMER,
    )
  })

  it('keeps service layouts out of commerce modules', () => {
    const simple = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ),
    )
    const consultative = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(
        WorkspaceBusinessModel.CONSULTATIVE_SALES,
      ),
    )
    const direct = getWorkspaceCapabilities(
      getWorkspaceBusinessModelDefaults(WorkspaceBusinessModel.DIRECT_SALES),
    )

    for (const capabilities of [simple, consultative, direct]) {
      expect(capabilities.commerce.commerceEnabled).toBe(false)
      expect(capabilities.modules.customers).toBe(false)
      expect(capabilities.modules.products).toBe(false)
      expect(capabilities.modules.orders).toBe(false)
      expect(capabilities.modules.fulfillment).toBe(false)
      expect(capabilities.modules.clients).toBe(true)
    }
    expect(simple.terminology.customerPlural).toBe('Customers')
    expect(consultative.terminology.customerPlural).toBe('Clients')
    expect(direct.terminology.customerPlural).toBe('Clients')
  })

  it('keeps commerce capability resolution workspace specific', () => {
    const commerce = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      commerceEnabled: true,
    })
    const service = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      commerceEnabled: false,
    })

    expect(commerce.modules.products).toBe(true)
    expect(service.modules.products).toBe(false)
  })

  it('never resolves default conversion to Opportunity when opportunities are disabled', () => {
    const capabilities = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      opportunitiesEnabled: false,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    })

    expect(capabilities.modules.opportunities).toBe(false)
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.SALE,
    )
  })

  it('falls back stale simple-service Opportunity defaults to Customer, not Sales', () => {
    const capabilities = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      opportunitiesEnabled: false,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    })

    expect(capabilities.modules.sales).toBe(false)
    expect(capabilities.conversion.defaultLeadDestination).toBe(
      LeadConversionDestination.CUSTOMER,
    )
  })
})
