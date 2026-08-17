import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  WorkspaceBusinessModel,
  type LeadConversionDestination as LeadConversionDestinationValue,
  type QualifiedLeadBehavior as QualifiedLeadBehaviorValue,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'
import {
  getWorkspaceBusinessModelDefinition,
  type WorkspaceModuleKey,
} from '@/lib/workspaces/businessModelRegistry'
import {
  DEFAULT_COMMERCE_TERMINOLOGY,
  type CommerceTerminology,
} from '@/lib/commerce/commerceRegistry'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import type {
  SchedulingCapabilities,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export type WorkspaceCapabilitiesSource = {
  businessModel?: WorkspaceBusinessModelValue | string | null
  opportunitiesEnabled?: boolean | null
  commerceEnabled?: boolean | null
  defaultLeadDestination?: LeadConversionDestinationValue | string | null
  allowDirectLeadToSale?: boolean | null
  qualifiedLeadBehavior?: QualifiedLeadBehaviorValue | string | null
  customerSingularLabel?: string | null
  customerPluralLabel?: string | null
  salesLabel?: string | null
  schedulingSettings?: Partial<WorkspaceSchedulingSettings> | null
  timezone?: string | null
}

export type WorkspaceCapabilities = {
  businessModel: WorkspaceBusinessModelValue
  modules: Record<WorkspaceModuleKey, boolean>
  commerce: {
    commerceEnabled: boolean
    customersEnabled: boolean
    productsEnabled: boolean
    ordersEnabled: boolean
    fulfillmentEnabled: boolean
    inventoryEnabled: boolean
    subscriptionsEnabled: boolean
    wholesaleEnabled: boolean
    returnsEnabled: boolean
    discountsEnabled: boolean
    suppliersEnabled: boolean
    commerceCrmEnabled: boolean
  }
  terminology: {
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
    commerce: CommerceTerminology
  }
  conversion: {
    defaultLeadDestination: LeadConversionDestinationValue
    allowDirectLeadToSale: boolean
    qualifiedLeadBehavior: QualifiedLeadBehaviorValue
  }
  scheduling: SchedulingCapabilities
}

function coerceBusinessModel(
  value?: WorkspaceCapabilitiesSource['businessModel'],
): WorkspaceBusinessModelValue {
  if (value && value in WorkspaceBusinessModel) {
    return value as WorkspaceBusinessModelValue
  }
  return WorkspaceBusinessModel.DIRECT_SALES
}

function coerceLeadDestination(
  value?: WorkspaceCapabilitiesSource['defaultLeadDestination'],
): LeadConversionDestinationValue | null {
  if (value && value in LeadConversionDestination) {
    return value as LeadConversionDestinationValue
  }
  return null
}

function coerceQualifiedLeadBehavior(
  value?: WorkspaceCapabilitiesSource['qualifiedLeadBehavior'],
): QualifiedLeadBehaviorValue {
  if (value && value in QualifiedLeadBehavior) {
    return value as QualifiedLeadBehaviorValue
  }
  return QualifiedLeadBehavior.ASK
}

export function getWorkspaceCapabilities(
  workspace?: WorkspaceCapabilitiesSource | null,
): WorkspaceCapabilities {
  const definition = getWorkspaceBusinessModelDefinition(
    coerceBusinessModel(workspace?.businessModel),
  )
  const opportunitiesEnabled =
    workspace?.opportunitiesEnabled ?? definition.opportunitiesEnabled
  const commerceEnabled =
    workspace?.commerceEnabled ?? definition.commerceEnabled
  const modules: WorkspaceCapabilities['modules'] = {
    ...definition.modules,
    opportunities: opportunitiesEnabled,
    products: commerceEnabled && definition.modules.products,
    orders: commerceEnabled && definition.modules.orders,
    fulfillment: commerceEnabled && definition.modules.fulfillment,
    inventory: commerceEnabled && definition.modules.inventory,
    subscriptions: commerceEnabled && definition.modules.subscriptions,
    wholesale: commerceEnabled && definition.modules.wholesale,
    returns: commerceEnabled && definition.modules.returns,
    discounts: commerceEnabled && definition.modules.discounts,
    suppliers: commerceEnabled && definition.modules.suppliers,
    customers: commerceEnabled && definition.modules.customers,
    commerceCrm: commerceEnabled && definition.modules.commerceCrm,
  }

  if (!opportunitiesEnabled) {
    modules.opportunities = false
  }

  const savedDestination = coerceLeadDestination(
    workspace?.defaultLeadDestination,
  )
  const defaultLeadDestination = resolveLeadConversionDestination({
    requestedDestination: savedDestination ?? definition.defaultLeadDestination,
    opportunitiesEnabled,
    commerceEnabled,
    customerDestinationEnabled: modules.clients || modules.customers,
    salesDestinationEnabled: modules.sales,
  })

  const scheduling = getWorkspaceSchedulingCapabilities({
    businessModel: definition.id,
    settings: workspace?.schedulingSettings,
    workspaceTimezone: workspace?.timezone,
  })

  return {
    businessModel: definition.id,
    modules,
    commerce: {
      commerceEnabled,
      customersEnabled: modules.customers,
      productsEnabled: modules.products,
      ordersEnabled: modules.orders,
      fulfillmentEnabled: modules.fulfillment,
      inventoryEnabled: modules.inventory,
      subscriptionsEnabled: modules.subscriptions,
      wholesaleEnabled: modules.wholesale,
      returnsEnabled: modules.returns,
      discountsEnabled: modules.discounts,
      suppliersEnabled: modules.suppliers,
      commerceCrmEnabled: modules.commerceCrm,
    },
    terminology: {
      leadSingular: definition.terminology.leadSingular,
      leadPlural: definition.terminology.leadPlural,
      opportunitySingular: definition.terminology.opportunitySingular,
      opportunityPlural: definition.terminology.opportunityPlural,
      clientSingular:
        workspace?.customerSingularLabel?.trim() ||
        definition.terminology.clientSingular,
      clientPlural:
        workspace?.customerPluralLabel?.trim() ||
        definition.terminology.clientPlural,
      customerSingular:
        workspace?.customerSingularLabel?.trim() ||
        definition.terminology.customerSingular,
      customerPlural:
        workspace?.customerPluralLabel?.trim() ||
        definition.terminology.customerPlural,
      serviceRequestSingular: definition.terminology.serviceRequestSingular,
      serviceRequestPlural: definition.terminology.serviceRequestPlural,
      taskSingular: definition.terminology.taskSingular,
      taskPlural: definition.terminology.taskPlural,
      salesLabel:
        workspace?.salesLabel?.trim() || definition.terminology.salesLabel,
      commerce: {
        ...DEFAULT_COMMERCE_TERMINOLOGY,
        customerSingular:
          workspace?.customerSingularLabel?.trim() ||
          DEFAULT_COMMERCE_TERMINOLOGY.customerSingular,
        customerPlural:
          workspace?.customerPluralLabel?.trim() ||
          DEFAULT_COMMERCE_TERMINOLOGY.customerPlural,
      },
    },
    conversion: {
      defaultLeadDestination,
      allowDirectLeadToSale:
        workspace?.allowDirectLeadToSale ?? definition.allowDirectLeadToSale,
      qualifiedLeadBehavior: coerceQualifiedLeadBehavior(
        workspace?.qualifiedLeadBehavior,
      ),
    },
    scheduling,
  }
}

export function resolveLeadConversionDestination({
  requestedDestination,
  opportunitiesEnabled,
  commerceEnabled,
  customerDestinationEnabled,
  salesDestinationEnabled = true,
}: {
  requestedDestination?: LeadConversionDestinationValue | null
  opportunitiesEnabled: boolean
  commerceEnabled?: boolean
  customerDestinationEnabled?: boolean
  salesDestinationEnabled?: boolean
}): LeadConversionDestinationValue {
  if (requestedDestination === LeadConversionDestination.OPPORTUNITY) {
    if (opportunitiesEnabled) return LeadConversionDestination.OPPORTUNITY
    if (salesDestinationEnabled) return LeadConversionDestination.SALE
    return commerceEnabled || customerDestinationEnabled
      ? LeadConversionDestination.CUSTOMER
      : LeadConversionDestination.SALE
  }
  if (requestedDestination === LeadConversionDestination.CUSTOMER) {
    return commerceEnabled || customerDestinationEnabled
      ? LeadConversionDestination.CUSTOMER
      : LeadConversionDestination.SALE
  }
  return requestedDestination ?? LeadConversionDestination.SALE
}
