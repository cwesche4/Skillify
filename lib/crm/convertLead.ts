import {
  LeadConversionDestination,
  type LeadConversionDestination as LeadConversionDestinationValue,
} from '@/lib/prisma/enums'
import {
  getAvailableLeadConversionDestinations,
  getLeadConversionHelper,
  getLeadConversionLabel,
} from '@/lib/crm/getLeadConversionActions'
import {
  getWorkspaceCapabilities,
  type WorkspaceCapabilities,
  type WorkspaceCapabilitiesSource,
} from '@/lib/workspaces/getWorkspaceCapabilities'

export type LeadConversionRequest = {
  requestedDestination?: LeadConversionDestinationValue | string | null
}

export type LeadConversionDecision = {
  destination: LeadConversionDestinationValue
  availableDestinations: LeadConversionDestinationValue[]
}

export {
  getAvailableLeadConversionDestinations,
  getLeadConversionHelper,
  getLeadConversionLabel,
}

export function determineLeadConversionDestination(
  workspace: WorkspaceCapabilitiesSource | WorkspaceCapabilities,
  request: LeadConversionRequest = {},
): LeadConversionDecision {
  const capabilities =
    'conversion' in workspace ? workspace : getWorkspaceCapabilities(workspace)
  const availableDestinations =
    getAvailableLeadConversionDestinations(capabilities)

  const requested = request.requestedDestination
    ? String(request.requestedDestination)
    : null

  if (requested) {
    if (!(requested in LeadConversionDestination)) {
      throw new Error('Requested lead conversion destination is not supported.')
    }
    if (
      !availableDestinations.includes(
        requested as LeadConversionDestinationValue,
      )
    ) {
      throw new Error(
        `${requested} conversion is unavailable for this workspace.`,
      )
    }
    return {
      destination: requested as LeadConversionDestinationValue,
      availableDestinations,
    }
  }

  const preferred = capabilities.conversion.defaultLeadDestination

  const destination = availableDestinations.includes(preferred)
    ? preferred
    : availableDestinations[0]

  if (!destination) {
    throw new Error('Lead conversion is unavailable for this workspace.')
  }

  return {
    destination,
    availableDestinations,
  }
}
