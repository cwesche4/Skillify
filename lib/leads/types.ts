import type { LeadStage as LeadStageValue } from '@/lib/prisma/enums'

export type ConvertedCustomerSummary = {
  id: string
  displayName: string
  companyName: string | null
  email: string | null
  phone: string | null
  archivedAt: Date | null
}

export type LeadRecord = {
  id: string
  workspaceId: string
  displayName: string
  companyName: string | null
  email: string | null
  phone: string | null
  stage: LeadStageValue
  source: string | null
  estimatedValueCents: number | null
  currency: string
  nextStep: string | null
  followUpAt: Date | null
  assignedMemberId: string | null
  notes: string | null
  convertedCustomerId: string | null
  convertedAt: Date | null
  convertedCustomer: ConvertedCustomerSummary | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type CreateLeadData = Omit<
  LeadRecord,
  | 'id'
  | 'convertedCustomerId'
  | 'convertedAt'
  | 'convertedCustomer'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
>

export type CreateLeadResult = {
  lead: LeadRecord
  eventId: string
  followUpEventId: string | null
}

export type UpdateLeadResult = {
  lead: LeadRecord
  followUpEventId: string | null
}

export type UpdateLeadData = Partial<
  Pick<
    LeadRecord,
    | 'displayName'
    | 'companyName'
    | 'email'
    | 'phone'
    | 'stage'
    | 'source'
    | 'estimatedValueCents'
    | 'currency'
    | 'nextStep'
    | 'followUpAt'
    | 'assignedMemberId'
    | 'notes'
  >
>

export type LeadDuplicateCandidate = ConvertedCustomerSummary

export type LeadConversionResult =
  | {
      status: 'SUCCESS' | 'ALREADY_CONVERTED'
      lead: LeadRecord
      customer: ConvertedCustomerSummary
    }
  | {
      status: 'DUPLICATE_WARNING'
      lead: LeadRecord
      candidates: LeadDuplicateCandidate[]
    }
