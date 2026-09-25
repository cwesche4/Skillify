import type { LeadStage as LeadStageValue } from '@/lib/prisma/enums'

export type LeadClientRecord = {
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
  followUpAt: string | null
  assignedMemberId: string | null
  notes: string | null
  convertedCustomerId: string | null
  convertedAt: string | null
  convertedCustomer: LeadConvertedCustomer | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type LeadConvertedCustomer = {
  id: string
  displayName: string
  companyName: string | null
  email: string | null
  phone: string | null
  archivedAt: string | null
}

export type LeadConversionResponse =
  | {
      status: 'SUCCESS' | 'ALREADY_CONVERTED'
      lead: LeadClientRecord
      customer: LeadConvertedCustomer
    }
  | {
      status: 'DUPLICATE_WARNING'
      lead: LeadClientRecord
      candidates: LeadConvertedCustomer[]
    }

export type LeadMutationInput = {
  displayName?: string
  companyName?: string | null
  email?: string | null
  phone?: string | null
  stage?: LeadStageValue
  source?: string | null
  estimatedValueCents?: number | null
  currency?: string
  nextStep?: string | null
  followUpAt?: string | null
  assignedMemberId?: string | null
  notes?: string | null
}

export type LeadMemberOption = { id: string; name: string; role: string }
