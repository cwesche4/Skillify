import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  getWorkspaceCapabilities,
  type WorkspaceCapabilitiesSource,
} from '@/lib/workspaces/getWorkspaceCapabilities'

export type WorkspaceAIFieldDefinition = {
  label: string
  helper: string
  placeholder: string
}

export type WorkspaceAIFormDefinition = {
  businessOverview: WorkspaceAIFieldDefinition
  productsOrServices: WorkspaceAIFieldDefinition
  operatingGuidelines: WorkspaceAIFieldDefinition
  brandVoice: WorkspaceAIFieldDefinition
  customerPolicies: WorkspaceAIFieldDefinition
}

const CONSULTATIVE: WorkspaceAIFormDefinition = {
  businessOverview: {
    label: 'Business overview',
    helper:
      'What the business does, who it serves, and what makes it different.',
    placeholder:
      'We help commercial property owners plan, scope, and complete complex installation projects. Discovery calls and site assessments help us create accurate proposals.',
  },
  productsOrServices: {
    label: 'Products and services',
    helper: 'One item per line.',
    placeholder:
      'Strategy consulting\nSite assessments\nCustom proposals\nCommercial installations\nOngoing support',
  },
  operatingGuidelines: {
    label: 'Operating guidelines',
    helper: 'Add short business rules Skillify should respect.',
    placeholder:
      'Discovery calls are required before proposals.\nCommercial projects require a site visit.\nProposals over $25,000 require owner approval.\nFollow up three business days after sending a proposal.',
  },
  brandVoice: {
    label: 'Brand voice',
    helper: 'One item per line.',
    placeholder:
      'Professional\nConfident\nClear\nConsultative\nHelpful\nAvoid overly technical explanations unless requested',
  },
  customerPolicies: {
    label: 'Customer policies',
    helper: 'Add customer-facing rules in plain language.',
    placeholder:
      'Deposits are required before work begins.\nProposal revisions require manager approval.\nCancellations must be submitted in writing.\nFinal pricing is confirmed after scope approval.',
  },
}

const DIRECT: WorkspaceAIFormDefinition = {
  businessOverview: {
    label: 'Business overview',
    helper:
      'What the business does, who it serves, and what makes it different.',
    placeholder:
      'We provide residential and commercial service appointments, repairs, maintenance, and installations. Fast response times and clear customer communication are our priorities.',
  },
  productsOrServices: {
    label: 'Products and services',
    helper: 'One item per line.',
    placeholder:
      'Emergency repairs\nMaintenance plans\nNew installations\nRoutine service calls\nSame-day appointments',
  },
  operatingGuidelines: {
    label: 'Operating guidelines',
    helper: 'Add short business rules Skillify should respect.',
    placeholder:
      'Urgent requests should create a high-priority task.\nAssign new leads to the next available team member.\nConfirm appointments by text and email.\nNotify the owner when a quote exceeds $5,000.',
  },
  brandVoice: {
    label: 'Brand voice',
    helper: 'One item per line.',
    placeholder:
      'Friendly\nProfessional\nClear\nReassuring\nHelpful\nAvoid unnecessary jargon',
  },
  customerPolicies: {
    label: 'Customer policies',
    helper: 'Add customer-facing rules in plain language.',
    placeholder:
      'Refunds require owner approval.\nWarranty claims must include photos.\nSame-day cancellations may incur a fee.\nEstimates are valid for 30 days.',
  },
}

const COMMERCE: WorkspaceAIFormDefinition = {
  businessOverview: {
    label: 'Business overview',
    helper:
      'What the business sells, who it serves, and what makes it different.',
    placeholder:
      'We sell consumer products online and through wholesale accounts. The brand focuses on fast fulfillment, repeat purchases, and clear order communication.',
  },
  productsOrServices: {
    label: 'Products',
    helper: 'One item per line.',
    placeholder:
      'Energy drinks\nApparel\nSubscription boxes\nWholesale cases\nLimited-edition products',
  },
  operatingGuidelines: {
    label: 'Order and fulfillment guidelines',
    helper: 'Add short order rules Skillify should respect.',
    placeholder:
      'Orders placed before 2 PM ship the same business day.\nHigh-value orders require manual review.\nFlag fulfillment delays longer than two business days.\nWholesale orders should notify the account manager.',
  },
  brandVoice: {
    label: 'Brand voice',
    helper: 'One item per line.',
    placeholder:
      'Bold\nEnergetic\nFriendly\nClear\nProduct-focused\nAvoid overly formal language',
  },
  customerPolicies: {
    label: 'Customer and order policies',
    helper: 'Add customer-facing rules in plain language.',
    placeholder:
      'Refunds are accepted within 30 days.\nDamaged-order claims require photos.\nWholesale orders require a minimum quantity.\nSubscription cancellations apply to the next billing cycle.',
  },
}

export function getWorkspaceAIFormDefinition(
  workspace: WorkspaceCapabilitiesSource,
): WorkspaceAIFormDefinition {
  const capabilities = getWorkspaceCapabilities(workspace)
  if (capabilities.businessModel === WorkspaceBusinessModel.PRODUCT_COMMERCE) {
    return COMMERCE
  }
  if (
    capabilities.businessModel === WorkspaceBusinessModel.CONSULTATIVE_SALES
  ) {
    return CONSULTATIVE
  }
  return DIRECT
}
