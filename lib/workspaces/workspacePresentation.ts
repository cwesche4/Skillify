import {
  WorkspaceBusinessModel,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

export type WorkspaceOperatingModel =
  | 'simpleService'
  | 'directSales'
  | 'consultativeSales'
  | 'commerce'

export type WorkspaceNavigationMode =
  | 'serviceSimple'
  | 'directSales'
  | 'consultativeSales'
  | 'commerce'

export type WorkspacePresentationProfile = {
  operatingModel: WorkspaceOperatingModel
  navigationMode: WorkspaceNavigationMode
  terminology: WorkspaceCapabilities['terminology']
  pipelineMode:
    | 'leadToCustomer'
    | 'leadToSaleToClient'
    | 'leadToOpportunityToSaleToClient'
    | 'commerce'
}

export function getWorkspaceOperatingModel(
  businessModel: WorkspaceBusinessModelValue,
): WorkspaceOperatingModel {
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) {
    return 'simpleService'
  }
  if (businessModel === WorkspaceBusinessModel.CONSULTATIVE_SALES) {
    return 'consultativeSales'
  }
  if (businessModel === WorkspaceBusinessModel.PRODUCT_COMMERCE) {
    return 'commerce'
  }
  return 'directSales'
}

export function getWorkspacePresentationProfile(
  capabilities: WorkspaceCapabilities,
): WorkspacePresentationProfile {
  const operatingModel = getWorkspaceOperatingModel(capabilities.businessModel)

  if (operatingModel === 'simpleService') {
    return {
      operatingModel,
      navigationMode: 'serviceSimple',
      terminology: capabilities.terminology,
      pipelineMode: 'leadToCustomer',
    }
  }

  if (operatingModel === 'consultativeSales') {
    return {
      operatingModel,
      navigationMode: 'consultativeSales',
      terminology: capabilities.terminology,
      pipelineMode: 'leadToOpportunityToSaleToClient',
    }
  }

  if (operatingModel === 'commerce') {
    return {
      operatingModel,
      navigationMode: 'commerce',
      terminology: capabilities.terminology,
      pipelineMode: 'commerce',
    }
  }

  return {
    operatingModel,
    navigationMode: 'directSales',
    terminology: capabilities.terminology,
    pipelineMode: 'leadToSaleToClient',
  }
}

export type WorkspaceRecordTerminology = Pick<
  WorkspaceCapabilities['terminology'],
  | 'customerSingular'
  | 'customerPlural'
  | 'serviceRequestSingular'
  | 'serviceRequestPlural'
  | 'taskSingular'
  | 'taskPlural'
>

export const DEFAULT_WORKSPACE_RECORD_TERMINOLOGY: WorkspaceRecordTerminology =
  {
    customerSingular: 'Client',
    customerPlural: 'Clients',
    serviceRequestSingular: 'Service Request',
    serviceRequestPlural: 'Service Requests',
    taskSingular: 'Task',
    taskPlural: 'Tasks',
  }

export function getWorkspaceRecordTerminology(
  capabilities: WorkspaceCapabilities,
): WorkspaceRecordTerminology {
  return {
    customerSingular: capabilities.terminology.customerSingular,
    customerPlural: capabilities.terminology.customerPlural,
    serviceRequestSingular: capabilities.terminology.serviceRequestSingular,
    serviceRequestPlural: capabilities.terminology.serviceRequestPlural,
    taskSingular: capabilities.terminology.taskSingular,
    taskPlural: capabilities.terminology.taskPlural,
  }
}

export function getWorkspaceRecordTerminologyForBusinessModel(
  businessModel: WorkspaceBusinessModelValue | string,
): WorkspaceRecordTerminology {
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) {
    return {
      customerSingular: 'Customer',
      customerPlural: 'Customers',
      serviceRequestSingular: 'Job',
      serviceRequestPlural: 'Jobs',
      taskSingular: 'Job Step',
      taskPlural: 'Job Steps',
    }
  }
  return DEFAULT_WORKSPACE_RECORD_TERMINOLOGY
}
