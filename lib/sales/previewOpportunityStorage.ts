import {
  demoLeads,
  demoOpportunities,
  type LeadRecord,
  type OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import {
  mergeLeadRecords,
  readPreviewLeads,
  upsertPreviewLead,
} from '@/lib/sales/previewLeadStorage'
import {
  convertLeadDirectlyToSale,
  convertLeadToCustomer,
  createOpportunityFromLead,
} from '@/lib/workspace-records/salesFlow'
import {
  normalizeSaleRecord,
  upsertPreviewSale,
} from '@/lib/sales/previewSaleStorage'
import { upsertPreviewClient } from '@/lib/clients/previewClientStorage'
import { appendPreviewActivity } from '@/lib/workspace-records/activity'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'
import { getLocalTimestamp } from '@/lib/formatting/dates'
import {
  determineLeadConversionDestination,
  type LeadConversionRequest,
} from '@/lib/crm/convertLead'
import {
  applyIdentityToLead,
  applyIdentityToOpportunity,
  applyIdentityToSale,
  ensureContactIdentity,
} from '@/lib/crm/contactIdentity'
import {
  LeadConversionDestination,
  type LeadConversionDestination as LeadConversionDestinationValue,
} from '@/lib/prisma/enums'
import type { WorkspaceCapabilitiesSource } from '@/lib/workspaces/getWorkspaceCapabilities'

const STORAGE_PREFIX = 'skillify-preview-opportunities'

export function getPreviewOpportunityStorageKey(workspaceSlug: string) {
  return `${STORAGE_PREFIX}:${workspaceSlug}`
}

function logOpportunityDebug(message: string, detail?: unknown) {
  if (process.env.NODE_ENV === 'production') return
  console.info(`[Skillify][opportunities] ${message}`, detail ?? '')
}

export function mergeOpportunityRecords(
  baseOpportunities: OpportunityRecord[],
  previewOpportunities: OpportunityRecord[],
) {
  const seen = new Set<string>()
  const seenLeadIds = new Set<string>()
  return [...previewOpportunities, ...baseOpportunities].filter(
    (opportunity) => {
      const sourceLeadId = opportunity.sourceLeadId ?? opportunity.leadId
      if (sourceLeadId) {
        if (seenLeadIds.has(sourceLeadId)) return false
        seenLeadIds.add(sourceLeadId)
      }
      if (seen.has(opportunity.id)) return false
      seen.add(opportunity.id)
      return true
    },
  )
}

export function readPreviewOpportunities(
  workspaceSlug: string,
): OpportunityRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewOpportunityStorageKey(workspaceSlug),
    )
    return value ? (JSON.parse(value) as OpportunityRecord[]) : []
  } catch {
    return []
  }
}

export function writePreviewOpportunities(
  workspaceSlug: string,
  opportunities: OpportunityRecord[],
) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewOpportunityStorageKey(workspaceSlug),
    JSON.stringify(opportunities),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'opportunities')
}

export function upsertPreviewOpportunity(
  workspaceSlug: string,
  opportunity: OpportunityRecord,
) {
  const sourceLeadId = opportunity.sourceLeadId ?? opportunity.leadId
  const currentOpportunities = readPreviewOpportunities(workspaceSlug).filter(
    (record) =>
      record.id !== opportunity.id &&
      (!sourceLeadId ||
        (record.sourceLeadId ?? record.leadId) !== sourceLeadId),
  )
  const nextOpportunities = [opportunity, ...currentOpportunities]
  writePreviewOpportunities(workspaceSlug, nextOpportunities)
  return nextOpportunities
}

export function findPreviewOpportunityForLead(
  workspaceSlug: string,
  leadId: string,
) {
  return readPreviewOpportunities(workspaceSlug).find(
    (opportunity) =>
      (opportunity.sourceLeadId ?? opportunity.leadId) === leadId,
  )
}

function normalizeLeadOpportunity(
  opportunity: OpportunityRecord,
  lead: LeadRecord,
): OpportunityRecord {
  const convertedAt =
    opportunity.convertedAt ??
    lead.convertedAt ??
    opportunity.createdAt ??
    lead.lastActivityAt ??
    getLocalTimestamp()
  const createdAt = convertedAt
  const lastActivityAt = opportunity.lastActivityAt ?? convertedAt
  return {
    ...opportunity,
    id: opportunity.id,
    name: opportunity.name,
    company: opportunity.company ?? lead.company,
    client: opportunity.client ?? lead.company,
    status: opportunity.status ?? 'Active',
    stage: opportunity.stage ?? 'Discovery Scheduled',
    value: opportunity.value ?? lead.value,
    probability: opportunity.probability ?? 45,
    expectedRevenue:
      opportunity.expectedRevenue ??
      Math.round(
        (opportunity.value ?? lead.value) *
          ((opportunity.probability ?? 45) / 100),
      ),
    nextStep:
      opportunity.nextStep ?? lead.nextStep ?? 'Schedule discovery call',
    ownerId: opportunity.ownerId ?? lead.ownerId,
    lastActivityAt,
    leadId: opportunity.leadId ?? lead.id,
    sourceLeadId: opportunity.sourceLeadId ?? lead.id,
    createdAt,
    convertedAt,
  }
}

export function getMergedWorkspaceOpportunities(
  workspaceSlug: string,
  options: { repairConvertedLeads?: boolean } = {},
) {
  const repairConvertedLeads = options.repairConvertedLeads ?? true
  const previewOpportunities = readPreviewOpportunities(workspaceSlug)
  const leads = mergeLeadRecords(demoLeads, readPreviewLeads(workspaceSlug))
  const normalizedPreviewOpportunities = previewOpportunities.map(
    (opportunity) => {
      const sourceLeadId = opportunity.sourceLeadId ?? opportunity.leadId
      const lead = sourceLeadId
        ? leads.find((record) => record.id === sourceLeadId)
        : null

      return lead ? normalizeLeadOpportunity(opportunity, lead) : opportunity
    },
  )
  const repairedConvertedLeadOpportunities = repairConvertedLeads
    ? leads
        .filter((lead) => {
          if (!lead.converted) return false
          if (lead.convertedDestination) {
            return (
              lead.convertedDestination ===
              LeadConversionDestination.OPPORTUNITY
            )
          }
          return !/\bsale\b/i.test(lead.nextStep)
        })
        .filter((lead) => {
          return ![
            ...normalizedPreviewOpportunities,
            ...demoOpportunities,
          ].some(
            (opportunity) =>
              (opportunity.sourceLeadId ?? opportunity.leadId) === lead.id,
          )
        })
        .map((lead) =>
          normalizeLeadOpportunity(
            createOpportunityFromLead(workspaceSlug, lead).opportunity,
            lead,
          ),
        )
    : []

  const merged = mergeOpportunityRecords(demoOpportunities, [
    ...normalizedPreviewOpportunities,
    ...repairedConvertedLeadOpportunities,
  ])
  logOpportunityDebug('loaded merged opportunities', {
    workspaceSlug,
    storageKey: getPreviewOpportunityStorageKey(workspaceSlug),
    baseCount: demoOpportunities.length,
    previewCount: previewOpportunities.length,
    repairedCount: repairedConvertedLeadOpportunities.length,
    mergedCount: merged.length,
  })
  return merged
}

export function convertLeadToOpportunityAndPersist(
  workspaceSlug: string,
  leadId: string,
): OpportunityRecord | null {
  const conversion = convertLeadForWorkspacePreview(workspaceSlug, leadId, {
    workspace: {
      opportunitiesEnabled: true,
      commerceEnabled: false,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
      allowDirectLeadToSale: true,
    },
  })
  return conversion.destination === LeadConversionDestination.OPPORTUNITY
    ? (conversion.record as OpportunityRecord | null)
    : null
}

export function convertLeadForWorkspacePreview(
  workspaceSlug: string,
  leadId: string,
  options: {
    workspace?: WorkspaceCapabilitiesSource | null
    request?: LeadConversionRequest
  } = {},
): {
  destination: LeadConversionDestinationValue
  record:
    | OpportunityRecord
    | {
        id: string
        sourceLeadId?: string
      }
    | null
  message: string
} {
  const leads = mergeLeadRecords(demoLeads, readPreviewLeads(workspaceSlug))
  const lead = leads.find((record) => record.id === leadId)
  const storageKey = getPreviewOpportunityStorageKey(workspaceSlug)

  logOpportunityDebug('converting lead', {
    workspaceSlug,
    leadId,
    storageKey,
    lead,
  })

  if (!lead) {
    logOpportunityDebug('lead conversion failed: lead not found', {
      workspaceSlug,
      leadId,
      storageKey,
    })
    return {
      destination: LeadConversionDestination.SALE,
      record: null,
      message: 'Lead was not found.',
    }
  }

  let decision: ReturnType<typeof determineLeadConversionDestination>
  try {
    decision = determineLeadConversionDestination(
      options.workspace ?? {
        opportunitiesEnabled: true,
        commerceEnabled: false,
        defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
        allowDirectLeadToSale: true,
      },
      options.request,
    )
  } catch (error) {
    return {
      destination: LeadConversionDestination.SALE,
      record: null,
      message:
        error instanceof Error
          ? error.message
          : 'Lead conversion is unavailable for this workspace.',
    }
  }

  if (lead.converted) {
    return {
      destination: decision.destination,
      record: null,
      message: 'This lead has already been converted.',
    }
  }

  if (decision.destination === LeadConversionDestination.SALE) {
    const identity = ensureContactIdentity(workspaceSlug, lead)
    const result = convertLeadDirectlyToSale(workspaceSlug, lead)
    upsertPreviewLead(workspaceSlug, applyIdentityToLead(result.lead, identity))
    upsertPreviewSale(
      workspaceSlug,
      applyIdentityToSale(normalizeSaleRecord(result.sale), identity),
    )
    result.events.forEach((event) =>
      appendPreviewActivity(workspaceSlug, event),
    )
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'leads')
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'sales')
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'activity')
    return {
      destination: decision.destination,
      record: result.sale,
      message: 'Lead converted directly to Sale locally.',
    }
  }

  if (decision.destination === LeadConversionDestination.CUSTOMER) {
    const customerLabel =
      options.workspace?.customerSingularLabel?.trim() || 'Customer'
    const result = convertLeadToCustomer(workspaceSlug, lead, customerLabel)
    upsertPreviewLead(workspaceSlug, result.lead)
    upsertPreviewClient(workspaceSlug, result.customer)
    result.events.forEach((event) =>
      appendPreviewActivity(workspaceSlug, event),
    )
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'leads')
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'clients')
    notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'activity')
    return {
      destination: decision.destination,
      record: result.customer,
      message: `Lead converted to ${customerLabel} locally.`,
    }
  }

  const existingOpportunity = getMergedWorkspaceOpportunities(
    workspaceSlug,
  ).find(
    (opportunity) =>
      (opportunity.sourceLeadId ?? opportunity.leadId) === leadId,
  )
  const identity = ensureContactIdentity(workspaceSlug, lead)
  const result = createOpportunityFromLead(workspaceSlug, lead)
  const opportunity = applyIdentityToOpportunity(
    normalizeLeadOpportunity(existingOpportunity ?? result.opportunity, lead),
    identity,
  )

  upsertPreviewLead(workspaceSlug, applyIdentityToLead(result.lead, identity))
  upsertPreviewOpportunity(workspaceSlug, opportunity)
  result.events.forEach((event) => appendPreviewActivity(workspaceSlug, event))

  const verifiedOpportunity = readPreviewOpportunities(workspaceSlug).find(
    (record) => record.id === opportunity.id,
  )

  logOpportunityDebug('generated opportunity object', opportunity)
  logOpportunityDebug('verified opportunity storage write', {
    workspaceSlug,
    storageKey,
    found: Boolean(verifiedOpportunity),
    storedCount: readPreviewOpportunities(workspaceSlug).length,
  })

  notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'leads')
  notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'opportunities')
  notifyWorkspaceCrmRecordsChanged(workspaceSlug, 'activity')

  return {
    destination: decision.destination,
    record: verifiedOpportunity ?? opportunity,
    message: 'Lead converted and opportunity created locally.',
  }
}
