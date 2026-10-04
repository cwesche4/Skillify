import type { EstimateBillingBasis, EstimateStatus } from '@/lib/prisma/enums'

export type EstimateLineItemInput = {
  title: string
  description?: string | null
  billingBasis: EstimateBillingBasis
  amountCents: number
}

export type EstimateLineItemRecord = EstimateLineItemInput & {
  id: string
  workspaceId: string
  estimateId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type EstimatePartySummary = {
  id: string
  displayName: string
  archivedAt: Date | null
}

export type EstimateActorSummary = {
  id: string
  fullName: string | null
  email: string | null
}

export type EstimateRecord = {
  id: string
  workspaceId: string
  referenceNumber: string
  revisionNumber: number
  previousRevisionId: string | null
  leadId: string | null
  customerId: string | null
  title: string
  scopeDescription: string | null
  contactNameSnapshot: string | null
  contactEmailSnapshot: string | null
  contactPhoneSnapshot: string | null
  serviceAddressLine1Snapshot: string | null
  serviceAddressLine2Snapshot: string | null
  serviceAddressCitySnapshot: string | null
  serviceAddressRegionSnapshot: string | null
  serviceAddressPostalCodeSnapshot: string | null
  serviceAddressCountrySnapshot: string | null
  currency: string
  oneTimeSubtotalCents: number
  recurringPerVisitSubtotalCents: number
  status: EstimateStatus
  expiresOn: string | null
  version: number
  createdByUserId: string
  presentedByUserId: string | null
  acceptedByUserId: string | null
  declinedByUserId: string | null
  voidedByUserId: string | null
  presentedAt: Date | null
  acceptedAt: Date | null
  declinedAt: Date | null
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  lineItems: EstimateLineItemRecord[]
  lead: EstimatePartySummary | null
  customer: EstimatePartySummary | null
  createdBy: EstimateActorSummary
  presentedBy: EstimateActorSummary | null
  acceptedBy: EstimateActorSummary | null
  declinedBy: EstimateActorSummary | null
  voidedBy: EstimateActorSummary | null
}

export type EstimateRevisionSummary = Pick<
  EstimateRecord,
  | 'id'
  | 'referenceNumber'
  | 'revisionNumber'
  | 'status'
  | 'version'
  | 'presentedAt'
  | 'acceptedAt'
  | 'declinedAt'
  | 'voidedAt'
  | 'archivedAt'
  | 'createdAt'
  | 'updatedAt'
>

export type EstimateListRecord = Pick<
  EstimateRecord,
  | 'id'
  | 'workspaceId'
  | 'referenceNumber'
  | 'revisionNumber'
  | 'previousRevisionId'
  | 'leadId'
  | 'customerId'
  | 'title'
  | 'currency'
  | 'oneTimeSubtotalCents'
  | 'recurringPerVisitSubtotalCents'
  | 'status'
  | 'expiresOn'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
  | 'lead'
  | 'customer'
> & {
  attention?: import('@/lib/estimates/attention').EstimateAttentionSignal
}

export type EstimateListView =
  | 'ALL'
  | 'DRAFT'
  | 'PRESENTED'
  | 'AWAITING_DECISION'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'DELIVERY_FAILED'
  | 'READY_TO_CREATE_WORK'
  | 'WORK_CREATED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'VOIDED'
  | 'ARCHIVED'

export type EstimateListResult = {
  estimates: EstimateListRecord[]
  nextCursor: string | null
  workspaceDateKey: string
}

export type EstimateDetailResult = {
  estimate: EstimateRecord
  revisions: EstimateRevisionSummary[]
  revisionHistoryTruncated: boolean
  workspaceDateKey: string
  operationalization?: EstimateOperationalizationSummary | null
  operationalCustomer?: EstimateOperationalCustomer | null
}

export type EstimateOperationalizationSummary = {
  id: string
  customerId: string
  operationalizedAt: Date
  jobId: string | null
  recurringServiceIds: string[]
  mappings: Array<{
    estimateLineItemId: string
    targetKind: 'JOB' | 'RECURRING_SERVICE'
    jobId: string | null
    jobStepId: string | null
    recurringServiceId: string | null
  }>
}

export type EstimateOperationalCustomer = {
  id: string
  displayName: string
  contactName: string | null
  email: string | null
  phone: string | null
  serviceAddressLine1: string | null
  serviceAddressLine2: string | null
  serviceAddressCity: string | null
  serviceAddressRegion: string | null
  serviceAddressPostalCode: string | null
  serviceAddressCountry: string | null
}

export type EstimateActor = {
  workspaceId: string
  userProfileId: string
}
