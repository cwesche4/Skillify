import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  WorkspaceBusinessModel,
  type LeadConversionDestination as LeadConversionDestinationValue,
  type QualifiedLeadBehavior as QualifiedLeadBehaviorValue,
} from '@/lib/prisma/enums'
import type { LeadRecord } from '@/lib/sales/demoSalesRecords'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

export type QualifiedLeadAction =
  | { type: 'NONE' }
  | { type: 'PROMPT'; destination: LeadConversionDestinationValue }
  | { type: 'AUTO_CONVERT'; destination: LeadConversionDestinationValue }

export type LeadStageConversionAction = QualifiedLeadAction

export function getQualifiedLeadDestination(
  capabilities: WorkspaceCapabilities,
): LeadConversionDestinationValue {
  return capabilities.conversion.defaultLeadDestination
}

export function getQualifiedLeadBehavior(
  capabilities: WorkspaceCapabilities,
): QualifiedLeadBehaviorValue {
  return (
    capabilities.conversion.qualifiedLeadBehavior ?? QualifiedLeadBehavior.ASK
  )
}

export function resolveQualifiedLeadAction({
  before,
  after,
  capabilities,
}: {
  before: LeadRecord
  after: LeadRecord
  capabilities: WorkspaceCapabilities
}): QualifiedLeadAction {
  if (!capabilities.modules.leads) return { type: 'NONE' }
  if (before.converted || after.converted) return { type: 'NONE' }
  if (before.stage === 'Qualified') return { type: 'NONE' }
  if (after.stage !== 'Qualified') return { type: 'NONE' }
  if (after.status === 'Disqualified') return { type: 'NONE' }

  const destination = getQualifiedLeadDestination(capabilities)
  if (destination === LeadConversionDestination.CUSTOMER)
    return { type: 'NONE' }

  const behavior = getQualifiedLeadBehavior(capabilities)
  if (behavior === QualifiedLeadBehavior.AUTO_CONVERT) {
    return { type: 'AUTO_CONVERT', destination }
  }
  if (behavior === QualifiedLeadBehavior.KEEP_QUALIFIED) {
    return { type: 'NONE' }
  }
  return { type: 'PROMPT', destination }
}

export function resolveLeadStageConversionAction({
  before,
  after,
  capabilities,
}: {
  before: LeadRecord
  after: LeadRecord
  capabilities: WorkspaceCapabilities
}): LeadStageConversionAction {
  if (!capabilities.modules.leads) return { type: 'NONE' }
  if (before.converted || after.converted) return { type: 'NONE' }

  if (
    capabilities.businessModel ===
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
    before.stage !== 'Won' &&
    after.stage === 'Won' &&
    after.status !== 'Disqualified'
  ) {
    return {
      type: 'AUTO_CONVERT',
      destination: LeadConversionDestination.CUSTOMER,
    }
  }

  return resolveQualifiedLeadAction({ before, after, capabilities })
}

export function getQualifiedLeadPromptCopy(
  lead: LeadRecord,
  destination: LeadConversionDestinationValue,
) {
  const isOpportunity = destination === LeadConversionDestination.OPPORTUNITY
  return {
    title: 'This lead is ready to move forward',
    description: `You marked ${lead.name} as Qualified.`,
    body: isOpportunity
      ? 'Would you like to move it into the Opportunities pipeline?'
      : 'Would you like to move it directly into the Sales pipeline?',
    nextPipeline: isOpportunity ? 'Opportunity' : 'Sale',
    flow: isOpportunity ? 'Lead → Opportunity' : 'Lead → Sale',
    supportingText: isOpportunity
      ? 'Continue with discovery, scoping, proposals, or negotiation.'
      : 'Move this lead directly into the Sales pipeline.',
    primaryAction: isOpportunity ? 'Convert to Opportunity' : 'Convert to Sale',
    secondaryAction: 'Keep as Qualified Lead',
  }
}
