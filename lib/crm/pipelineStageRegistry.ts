import type {
  LeadRecord,
  LeadStage,
  LeadStatus,
  OpportunityStage,
} from '@/lib/sales/demoSalesRecords'
import {
  WorkspaceBusinessModel,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'
import type { SaleStage, SaleStatus } from '@/lib/sales/previewSaleStorage'

export const leadStageOptions = [
  'New',
  'Contacted',
  'Nurture',
  'Qualified',
  'Disqualified',
] as const

export const simpleServiceLeadStageOptions = [
  'New',
  'Contacted',
  'Estimate / Visit',
  'Follow-Up',
  'Won',
  'Lost',
] as const

export function getLeadStageOptionsForBusinessModel(
  businessModel: WorkspaceBusinessModelValue,
): readonly LeadStage[] {
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) {
    return simpleServiceLeadStageOptions
  }
  return leadStageOptions
}

export const opportunityStageOptions = [
  'Discovery',
  'Needs Analysis',
  'Site Visit',
  'Scoping',
  'Proposal Preparation',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
] as const

export const saleStageOptions = [
  'New',
  'Quote Preparation',
  'Quote Sent',
  'Negotiation',
  'Accepted',
  'Payment Pending',
  'Closed-Won',
  'Closed-Lost',
] as const

export const clientLifecycleStageOptions = [
  'New',
  'Onboarding',
  'Active',
  'At Risk',
  'Inactive',
  'Offboarded',
] as const

export type LeadLifecycleState = 'ACTIVE' | 'CONVERTED' | 'ARCHIVED'

export function normalizeLeadStage(
  stage?: string,
  converted = false,
): LeadStage {
  if (stage === 'Converted') return 'Converted'
  if (stage === 'New Lead' || stage === 'New') return 'New'
  if (stage === 'Estimate / Visit') return 'Estimate / Visit'
  if (stage === 'Follow-Up') return 'Follow-Up'
  if (stage === 'Won') return 'Won'
  if (stage === 'Lost') return 'Lost'
  if (stage === 'Disqualified') return 'Disqualified'
  if (stage === 'Contacted') return 'Contacted'
  if (stage === 'Qualified') return 'Qualified'
  if (stage === 'Nurture') return 'Nurture'
  return 'New'
}

export function getLeadLifecycleState(
  lead: Pick<LeadRecord, 'converted' | 'stage' | 'status'>,
): LeadLifecycleState {
  if (
    lead.converted ||
    lead.stage === 'Converted' ||
    lead.status === 'Converted'
  ) {
    return 'CONVERTED'
  }
  if (
    lead.status === 'Disqualified' ||
    lead.stage === 'Disqualified' ||
    lead.stage === 'Lost'
  ) {
    return 'ARCHIVED'
  }
  return 'ACTIVE'
}

export function normalizeLeadStatus(
  status?: string,
  stage?: string,
  converted = false,
): LeadStatus {
  if (converted || stage === 'Converted' || status === 'Converted')
    return 'Converted'
  if (
    status === 'Disqualified' ||
    stage === 'Lost' ||
    stage === 'Disqualified'
  ) {
    return 'Disqualified'
  }
  if (stage === 'Won') return 'Qualified'
  if (stage === 'Estimate / Visit' || stage === 'Follow-Up') return 'Contacted'
  if (status === 'Contacted' || stage === 'Contacted') return 'Contacted'
  if (status === 'Qualified' || stage === 'Qualified') return 'Qualified'
  if (status === 'Nurture' || stage === 'Nurture') return 'Nurture'
  return 'New'
}

export function normalizeLeadRecord(lead: LeadRecord): LeadRecord {
  const stage =
    lead.converted && lead.stage === 'Converted'
      ? normalizeLeadStage(lead.status)
      : normalizeLeadStage(lead.stage, lead.converted)
  const status = normalizeLeadStatus(lead.status, stage, lead.converted)
  return {
    ...lead,
    stage,
    status,
    nextStep: lead.converted ? 'None - converted' : lead.nextStep,
    followUpDue: lead.converted ? undefined : lead.followUpDue,
  }
}

export function normalizeOpportunityStage(stage?: string): OpportunityStage {
  if (stage === 'Discovery Scheduled' || stage === 'Discovery')
    return 'Discovery'
  if (stage === 'Qualified' || stage === 'Needs Analysis')
    return 'Needs Analysis'
  if (stage === 'Site Visit') return 'Site Visit'
  if (stage === 'Scoping') return 'Scoping'
  if (stage === 'Proposal Preparation') return 'Proposal Preparation'
  if (stage === 'Proposal Sent') return 'Proposal Sent'
  if (stage === 'Negotiation') return 'Negotiation'
  if (stage === 'Closed-Won' || stage === 'Won') return 'Won'
  if (stage === 'Closed-Lost' || stage === 'Lost') return 'Lost'
  return 'Discovery'
}

export function normalizeSaleStage(stage?: string, status?: string): SaleStage {
  if (stage === 'Closed-Won' || stage === 'Won') return 'Closed-Won'
  if (stage === 'Closed-Lost' || stage === 'Lost') return 'Closed-Lost'
  if (stage === 'Completed') {
    return status === 'Closed-Won' ? 'Closed-Won' : 'Payment Pending'
  }
  if (
    stage === 'New Lead' ||
    stage === 'Discovery Scheduled' ||
    stage === 'Qualified' ||
    stage === 'New'
  ) {
    return 'New'
  }
  if (stage === 'Proposal Sent' || stage === 'Quote Sent') return 'Quote Sent'
  if (stage === 'Quote Preparation') return 'Quote Preparation'
  if (stage === 'Negotiation') return 'Negotiation'
  if (stage === 'Accepted') return 'Accepted'
  if (stage === 'Payment Pending' || stage === 'Onboarding')
    return 'Payment Pending'
  return 'New'
}

export function getSaleStatusForStage(
  stage: SaleStage,
  fallback: SaleStatus = 'Active',
): SaleStatus {
  if (stage === 'Closed-Won') return 'Closed-Won'
  if (stage === 'Closed-Lost') return 'Closed-Lost'
  return fallback === 'Closed-Won' || fallback === 'Closed-Lost'
    ? 'Active'
    : fallback
}
