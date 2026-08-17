import type { WorkspaceClient } from '@/lib/clients/types'
import { resolveContactIdentity } from '@/lib/crm/contactIdentity'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import {
  createWorkspaceActivityRecord,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { getLocalTimestamp } from '@/lib/formatting/dates'

function slugifyId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function createOpportunityFromLead(
  workspaceId: string,
  lead: LeadRecord,
): {
  lead: LeadRecord
  opportunity: OpportunityRecord
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const expectedRevenue = Math.round(lead.value * 0.45)
  const opportunity: OpportunityRecord = {
    id: `opp-from-lead-${lead.id}`,
    name: `${lead.company} Opportunity`,
    client: lead.company,
    contactName: lead.name,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    company: lead.company,
    sharedContactId: lead.sharedContactId,
    leadId: lead.id,
    sourceLeadId: lead.id,
    status: 'Active',
    stage: 'Discovery Scheduled',
    value: lead.value,
    probability: 45,
    expectedRevenue,
    ownerId: lead.ownerId,
    nextStep: lead.nextStep || 'Schedule discovery call',
    lastActivityAt: timestamp,
    createdAt: timestamp,
    convertedAt: timestamp,
    expectedCloseDate: lead.followUpDue,
    notes: lead.notes,
  }
  const convertedLead: LeadRecord = {
    ...lead,
    status: 'Qualified',
    stage: lead.stage,
    converted: true,
    convertedAt: timestamp,
    convertedDestination: 'OPPORTUNITY',
    connectedRecordId: opportunity.id,
    connectedRecordType: 'Opportunity',
    nextStep: 'None - converted',
    followUpDue: undefined,
    lastActivityAt: timestamp,
  }

  return {
    lead: convertedLead,
    opportunity,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-lead-converted-${lead.id}`,
        workspaceId,
        recordId: lead.id,
        recordType: 'lead',
        action: 'statusChanged',
        title: 'Lead converted to Opportunity',
        description: `${lead.name} was converted into ${opportunity.name}.`,
        timestamp,
        metadata: {
          leadId: lead.id,
          sourceLeadId: lead.id,
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          companyName: lead.company,
          clientName: opportunity.client,
          value: opportunity.value,
          ownerId: opportunity.ownerId,
        },
      }),
      createWorkspaceActivityRecord({
        id: `lifecycle-opportunity-created-from-lead-${lead.id}`,
        workspaceId,
        recordId: opportunity.id,
        recordType: 'opportunity',
        action: 'created',
        title: 'Opportunity created',
        description: `${opportunity.name} was created from ${lead.name}.`,
        timestamp,
        metadata: {
          leadId: lead.id,
          sourceLeadId: lead.id,
          opportunityId: opportunity.id,
          companyName: lead.company,
          clientName: opportunity.client,
          value: opportunity.value,
          probability: opportunity.probability,
        },
      }),
    ],
  }
}

export function convertLeadDirectlyToSale(
  workspaceId: string,
  lead: LeadRecord,
): {
  lead: LeadRecord
  sale: {
    id: string
    name: string
    contactName: string
    contactEmail?: string
    contactPhone?: string
    sharedContactId?: string
    company: string
    value: number
    ownerId: string
    sourceLeadId: string
    status: string
    stage: string
    nextStep: string
    convertedAt: string
  }
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const sale = {
    id: `sale-from-lead-${lead.id}`,
    name: `${lead.company} Sale`,
    contactName: lead.name,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    sharedContactId: lead.sharedContactId,
    company: lead.company,
    value: lead.value,
    ownerId: lead.ownerId,
    sourceLeadId: lead.id,
    status: 'Active',
    stage: 'New',
    nextStep: 'Prepare quote',
    convertedAt: timestamp,
  }
  const convertedLead: LeadRecord = {
    ...lead,
    status: 'Qualified',
    stage: lead.stage,
    converted: true,
    convertedAt: timestamp,
    convertedDestination: 'SALE',
    connectedRecordId: sale.id,
    connectedRecordType: 'Sale',
    nextStep: 'None - converted',
    followUpDue: undefined,
    lastActivityAt: timestamp,
  }

  return {
    lead: convertedLead,
    sale,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-lead-converted-sale-${lead.id}`,
        workspaceId,
        recordId: lead.id,
        recordType: 'lead',
        action: 'statusChanged',
        title: 'Lead converted directly to Sale',
        description: `${lead.name} was converted into ${sale.name}.`,
        timestamp,
        metadata: {
          leadId: lead.id,
          sourceLeadId: lead.id,
          saleId: sale.id,
          saleName: sale.name,
          companyName: lead.company,
          contactName: lead.name,
          value: sale.value,
          ownerId: sale.ownerId,
        },
      }),
    ],
  }
}

export function convertLeadToCustomer(
  workspaceId: string,
  lead: LeadRecord,
  customerSingular = 'Customer',
): {
  lead: LeadRecord
  customer: WorkspaceClient
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const identity = resolveContactIdentity(workspaceId, lead)
  const customer: WorkspaceClient = {
    id: `client-from-lead-${lead.id}`,
    workspaceId,
    sharedContactId: identity.id,
    sourceLeadId: lead.id,
    name: identity.contactName,
    company: identity.companyName ?? lead.company,
    email: identity.email ?? lead.contactEmail ?? '',
    phone: identity.phone ?? lead.contactPhone ?? '',
    status: 'Active',
    pipelineStage: 'Onboarding',
    lastActivity: timestamp,
    openTasks: 0,
    value: lead.value,
    nextAction: 'Start customer onboarding',
    ownerId: lead.ownerId,
    health: 'Healthy',
    tags: ['Needs Follow-up'],
    internalNotes: `Created from lead: ${lead.name}.`,
    notes: lead.notes || `Created from lead: ${lead.name}.`,
    activity: [
      {
        id: `activity-customer-created-from-lead-${lead.id}`,
        title: `${customerSingular} created`,
        description: `${lead.name} was converted from a lead.`,
        timestamp,
      },
    ],
    tasks: [],
    suggestedAutomations: ['Customer onboarding', 'Review request follow-up'],
    opportunity: {
      value: lead.value,
      nextAction: 'Start customer onboarding',
      probability: 100,
      expectedCloseWindow: 'Converted',
    },
  }
  const convertedLead: LeadRecord = {
    ...lead,
    status: 'Converted',
    stage: 'Won',
    converted: true,
    convertedAt: timestamp,
    convertedDestination: 'CUSTOMER',
    connectedRecordId: customer.id,
    connectedRecordType: 'Customer',
    nextStep: 'None - converted',
    followUpDue: undefined,
    lastActivityAt: timestamp,
    sharedContactId: identity.id,
  }

  return {
    lead: convertedLead,
    customer,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-lead-converted-customer-${lead.id}`,
        workspaceId,
        recordId: lead.id,
        recordType: 'lead',
        action: 'statusChanged',
        title: `Lead converted to ${customerSingular}`,
        description: `${lead.name} was converted into ${customer.name}.`,
        timestamp,
        metadata: {
          leadId: lead.id,
          sourceLeadId: lead.id,
          customerId: customer.id,
          companyName: lead.company,
          ownerId: customer.ownerId,
        },
      }),
    ],
  }
}

export function markOpportunityWon(
  workspaceId: string,
  opportunity: OpportunityRecord,
): {
  opportunity: OpportunityRecord
  sale: {
    id: string
    name: string
    contactName: string
    company: string
    value: number
    ownerId: string
    sourceLeadId?: string
    sourceOpportunityId: string
    status: string
    stage: string
    nextStep: string
    convertedAt: string
  }
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const saleId = opportunity.saleId ?? `sale-from-opportunity-${opportunity.id}`
  const wonOpportunity: OpportunityRecord = {
    ...opportunity,
    status: 'Closed-Won',
    stage: 'Won',
    probability: 100,
    nextStep: 'Sale created',
    lastActivityAt: timestamp,
    saleId,
  }
  const sale = {
    id: saleId,
    name: `${opportunity.company ?? opportunity.client} Sale`,
    contactName: opportunity.contactName ?? opportunity.client,
    contactEmail: opportunity.contactEmail,
    contactPhone: opportunity.contactPhone,
    sharedContactId: opportunity.sharedContactId,
    company: opportunity.company ?? opportunity.client,
    value: opportunity.value,
    ownerId: opportunity.ownerId,
    sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId,
    sourceOpportunityId: opportunity.id,
    status: 'Active',
    stage: 'New',
    nextStep: 'Prepare quote',
    convertedAt: timestamp,
  }

  return {
    opportunity: wonOpportunity,
    sale,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-opportunity-won-${opportunity.id}`,
        workspaceId,
        recordId: opportunity.id,
        recordType: 'opportunity',
        action: 'statusChanged',
        title: 'Opportunity marked Won and Sale created',
        description: `${opportunity.name} was marked Won and ${sale.name} was created.`,
        timestamp,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          saleId,
          saleName: sale.name,
          companyName: opportunity.company ?? opportunity.client,
          contactName: sale.contactName,
          clientName: opportunity.client,
          value: opportunity.value,
        },
      }),
      createWorkspaceActivityRecord({
        id: `lifecycle-sale-created-from-opportunity-${opportunity.id}`,
        workspaceId,
        recordId: sale.id,
        recordType: 'sale',
        action: 'created',
        title: 'Sale created',
        description: `${sale.name} was created from a won opportunity.`,
        timestamp,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          saleId,
          saleName: sale.name,
          companyName: sale.company,
          contactName: sale.contactName,
          ownerId: sale.ownerId,
        },
      }),
    ],
  }
}

export function markOpportunityLost(
  workspaceId: string,
  opportunity: OpportunityRecord,
  reason = 'Marked lost from sales workspace',
): {
  opportunity: OpportunityRecord
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const lostOpportunity: OpportunityRecord = {
    ...opportunity,
    status: 'Closed-Lost',
    stage: 'Lost',
    probability: 0,
    riskReason: reason,
    nextStep: 'Archive opportunity',
    lastActivityAt: timestamp,
  }

  return {
    opportunity: lostOpportunity,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-opportunity-lost-${opportunity.id}`,
        workspaceId,
        recordId: opportunity.id,
        recordType: 'opportunity',
        action: 'statusChanged',
        title: 'Opportunity lost',
        description: `${opportunity.name} was marked Closed-Lost.`,
        timestamp,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          clientId: opportunity.clientId ?? null,
          companyName: opportunity.company ?? opportunity.client,
          clientName: opportunity.client,
          reason,
          previousStatus: opportunity.status,
        },
      }),
    ],
  }
}

export function reopenOpportunity(
  workspaceId: string,
  opportunity: OpportunityRecord,
): {
  opportunity: OpportunityRecord
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const reopenedOpportunity: OpportunityRecord = {
    ...opportunity,
    status: 'Active',
    stage:
      opportunity.stage === 'Won' || opportunity.stage === 'Lost'
        ? 'Negotiation'
        : opportunity.stage,
    probability:
      opportunity.probability === 0 || opportunity.probability === 100
        ? 50
        : opportunity.probability,
    riskReason: undefined,
    nextStep: 'Review next sales step',
    lastActivityAt: timestamp,
  }

  return {
    opportunity: reopenedOpportunity,
    events: [
      createWorkspaceActivityRecord({
        id: `lifecycle-opportunity-reopened-${opportunity.id}`,
        workspaceId,
        recordId: opportunity.id,
        recordType: 'opportunity',
        action: 'statusChanged',
        title: 'Opportunity reopened',
        description: `${opportunity.name} was reopened for active sales follow-up.`,
        timestamp,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          clientId: opportunity.clientId ?? null,
          companyName: opportunity.company ?? opportunity.client,
          clientName: opportunity.client,
          previousStatus: opportunity.status,
          nextStatus: reopenedOpportunity.status,
          previousStage: opportunity.stage,
          nextStage: reopenedOpportunity.stage,
        },
      }),
      createWorkspaceActivityRecord({
        id: `lifecycle-follow-up-task-suggested-${opportunity.id}`,
        workspaceId,
        recordId: opportunity.id,
        recordType: 'task',
        action: 'created',
        title: 'Follow-up task suggested',
        description: `A follow-up task was suggested for ${opportunity.name}.`,
        timestamp,
        metadata: {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId ?? opportunity.sourceLeadId ?? null,
          sourceLeadId: opportunity.sourceLeadId ?? opportunity.leadId ?? null,
          clientId: opportunity.clientId ?? null,
          companyName: opportunity.company ?? opportunity.client,
          clientName: opportunity.client,
        },
      }),
    ],
  }
}
