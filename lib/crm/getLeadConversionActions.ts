import {
  LeadConversionDestination,
  type LeadConversionDestination as LeadConversionDestinationValue,
} from '@/lib/prisma/enums'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

export type LeadConversionAction = {
  destination: LeadConversionDestinationValue
  label: string
  helper: string
  isDefault: boolean
}

export function getAvailableLeadConversionDestinations(
  capabilities: WorkspaceCapabilities,
) {
  if (!capabilities.modules.leads) return []

  const defaultDestination = capabilities.conversion.defaultLeadDestination
  const destinations = new Set<LeadConversionDestinationValue>()

  if (!capabilities.modules.opportunities) {
    if (capabilities.modules.sales) {
      destinations.add(LeadConversionDestination.SALE)
    } else if (hasCustomerDestination(capabilities)) {
      destinations.add(LeadConversionDestination.CUSTOMER)
    }
    return Array.from(destinations)
  }

  if (isDestinationEnabled(defaultDestination, capabilities)) {
    destinations.add(defaultDestination)
  } else {
    destinations.add(LeadConversionDestination.OPPORTUNITY)
  }

  if (capabilities.conversion.allowDirectLeadToSale) {
    if (capabilities.modules.opportunities) {
      destinations.add(LeadConversionDestination.OPPORTUNITY)
    }
    if (capabilities.modules.sales) {
      destinations.add(LeadConversionDestination.SALE)
    }
  }

  return Array.from(destinations)
}

export function getLeadConversionActions(
  capabilities: WorkspaceCapabilities,
  options: { converted?: boolean } = {},
): LeadConversionAction[] {
  if (options.converted) return []

  return getAvailableLeadConversionDestinations(capabilities).map(
    (destination) => ({
      destination,
      label: getLeadConversionLabel(
        destination,
        capabilities.terminology.customerSingular,
      ),
      helper: getLeadConversionHelper(destination),
      isDefault: destination === capabilities.conversion.defaultLeadDestination,
    }),
  )
}

export function getLeadConversionLabel(
  destination: LeadConversionDestinationValue,
  customerSingular = 'Client',
) {
  if (destination === LeadConversionDestination.OPPORTUNITY) {
    return 'Convert to Opportunity'
  }
  if (destination === LeadConversionDestination.CUSTOMER) {
    return `Convert to ${customerSingular}`
  }
  return 'Convert to Sale'
}

export function getLeadConversionHelper(
  destination: LeadConversionDestinationValue,
) {
  if (destination === LeadConversionDestination.OPPORTUNITY) {
    return 'Move this lead into discovery, scoping, proposal preparation, or negotiation.'
  }
  if (destination === LeadConversionDestination.CUSTOMER) {
    return 'Move this inquiry into your customer records.'
  }
  return 'Move this lead directly into the Sales pipeline.'
}

function isDestinationEnabled(
  destination: LeadConversionDestinationValue,
  capabilities: WorkspaceCapabilities,
) {
  if (destination === LeadConversionDestination.OPPORTUNITY) {
    return capabilities.modules.opportunities
  }
  if (destination === LeadConversionDestination.CUSTOMER) {
    return hasCustomerDestination(capabilities)
  }
  return capabilities.modules.sales
}

function hasCustomerDestination(capabilities: WorkspaceCapabilities) {
  return capabilities.modules.customers || capabilities.modules.clients
}
