import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
  type LeadConversionDestination as LeadConversionDestinationValue,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'

export type WorkspaceModuleKey =
  | 'leads'
  | 'opportunities'
  | 'sales'
  | 'clients'
  | 'customers'
  | 'products'
  | 'orders'
  | 'fulfillment'
  | 'inventory'
  | 'subscriptions'
  | 'wholesale'
  | 'returns'
  | 'discounts'
  | 'suppliers'
  | 'commerceCrm'

export type WorkspaceTerminologyDefaults = {
  leadSingular: string
  leadPlural: string
  opportunitySingular: string
  opportunityPlural: string
  clientSingular: string
  clientPlural: string
  customerSingular: string
  customerPlural: string
  serviceRequestSingular: string
  serviceRequestPlural: string
  taskSingular: string
  taskPlural: string
  salesLabel: string
}

export type WorkspaceBusinessModelDefinition = {
  id: WorkspaceBusinessModelValue
  name: string
  description: string
  recommendedFor: string[]
  defaultWorkflow: string
  modules: Record<WorkspaceModuleKey, boolean>
  terminology: WorkspaceTerminologyDefaults
  defaultLeadDestination: LeadConversionDestinationValue
  opportunitiesEnabled: boolean
  commerceEnabled: boolean
  allowDirectLeadToSale: boolean
}

export const WORKSPACE_BUSINESS_MODELS: Record<
  WorkspaceBusinessModelValue,
  WorkspaceBusinessModelDefinition
> = {
  [WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS]: {
    id: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    name: 'Service Business',
    description:
      'For businesses that usually turn inquiries directly into customers.',
    recommendedFor: ['Home services', 'Field services', 'Lawn & landscaping'],
    defaultWorkflow: 'Leads -> Customers',
    modules: {
      leads: true,
      opportunities: false,
      sales: false,
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
    terminology: {
      leadSingular: 'Lead',
      leadPlural: 'Leads',
      opportunitySingular: 'Opportunity',
      opportunityPlural: 'Opportunities',
      clientSingular: 'Customer',
      clientPlural: 'Customers',
      customerSingular: 'Customer',
      customerPlural: 'Customers',
      serviceRequestSingular: 'Job',
      serviceRequestPlural: 'Jobs',
      taskSingular: 'Job Step',
      taskPlural: 'Job Steps',
      salesLabel: 'Sales',
    },
    defaultLeadDestination: LeadConversionDestination.CUSTOMER,
    opportunitiesEnabled: false,
    commerceEnabled: false,
    allowDirectLeadToSale: false,
  },
  [WorkspaceBusinessModel.CONSULTATIVE_SALES]: {
    id: WorkspaceBusinessModel.CONSULTATIVE_SALES,
    name: 'Consultative Sales',
    description:
      'For businesses with longer sales cycles involving discovery, proposals, scoping, or negotiation.',
    recommendedFor: ['Agencies', 'Consulting', 'Commercial services'],
    defaultWorkflow: 'Leads -> Opportunities -> Sales -> Clients',
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
    },
    defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    opportunitiesEnabled: true,
    commerceEnabled: false,
    allowDirectLeadToSale: true,
  },
  [WorkspaceBusinessModel.DIRECT_SALES]: {
    id: WorkspaceBusinessModel.DIRECT_SALES,
    name: 'Sales & Services',
    description:
      'For businesses that use a dedicated sales or quoting process before someone becomes a client.',
    recommendedFor: [
      'Quote-driven sales',
      'Sales teams',
      'Higher-ticket services',
    ],
    defaultWorkflow: 'Leads -> Sales -> Clients',
    modules: {
      leads: true,
      opportunities: false,
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
    },
    defaultLeadDestination: LeadConversionDestination.SALE,
    opportunitiesEnabled: false,
    commerceEnabled: false,
    allowDirectLeadToSale: true,
  },
  [WorkspaceBusinessModel.PRODUCT_COMMERCE]: {
    id: WorkspaceBusinessModel.PRODUCT_COMMERCE,
    name: 'Product & Commerce',
    description:
      'For businesses that manage customers, products, orders, and fulfillment.',
    recommendedFor: ['Product brands', 'E-commerce', 'Wholesale'],
    defaultWorkflow: 'Customers -> Orders -> Fulfillment',
    modules: {
      leads: false,
      opportunities: false,
      sales: false,
      clients: false,
      customers: true,
      products: true,
      orders: true,
      fulfillment: true,
      inventory: false,
      subscriptions: false,
      wholesale: false,
      returns: false,
      discounts: false,
      suppliers: false,
      commerceCrm: false,
    },
    terminology: {
      leadSingular: 'Lead',
      leadPlural: 'Leads',
      opportunitySingular: 'Opportunity',
      opportunityPlural: 'Opportunities',
      clientSingular: 'Customer',
      clientPlural: 'Customers',
      customerSingular: 'Customer',
      customerPlural: 'Customers',
      serviceRequestSingular: 'Service Request',
      serviceRequestPlural: 'Service Requests',
      taskSingular: 'Task',
      taskPlural: 'Tasks',
      salesLabel: 'Orders',
    },
    defaultLeadDestination: LeadConversionDestination.CUSTOMER,
    opportunitiesEnabled: false,
    commerceEnabled: true,
    allowDirectLeadToSale: false,
  },
}

export function getWorkspaceBusinessModelDefinition(
  model?: WorkspaceBusinessModelValue | string | null,
) {
  if (model && model in WORKSPACE_BUSINESS_MODELS) {
    return WORKSPACE_BUSINESS_MODELS[model as WorkspaceBusinessModelValue]
  }
  return WORKSPACE_BUSINESS_MODELS[WorkspaceBusinessModel.DIRECT_SALES]
}

export function listWorkspaceBusinessModels() {
  return [
    WORKSPACE_BUSINESS_MODELS[WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    WORKSPACE_BUSINESS_MODELS[WorkspaceBusinessModel.DIRECT_SALES],
    WORKSPACE_BUSINESS_MODELS[WorkspaceBusinessModel.CONSULTATIVE_SALES],
    WORKSPACE_BUSINESS_MODELS[WorkspaceBusinessModel.PRODUCT_COMMERCE],
  ]
}

export function getWorkspaceBusinessModelDefaults(
  model: WorkspaceBusinessModelValue,
) {
  const definition = getWorkspaceBusinessModelDefinition(model)
  return {
    businessModel: definition.id,
    opportunitiesEnabled: definition.opportunitiesEnabled,
    commerceEnabled: definition.commerceEnabled,
    defaultLeadDestination: definition.defaultLeadDestination,
    allowDirectLeadToSale: definition.allowDirectLeadToSale,
    customerSingularLabel: definition.terminology.customerSingular,
    customerPluralLabel: definition.terminology.customerPlural,
    salesLabel: definition.terminology.salesLabel,
  }
}
