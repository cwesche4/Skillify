import type { EstimateBillingBasis, EstimateStatus } from '@/lib/prisma/enums'

export type EstimateClientLineItem = {
  id: string
  title: string
  description: string | null
  billingBasis: EstimateBillingBasis
  amountCents: number
  sortOrder: number
}

export type EstimateClientActor = {
  id: string
  fullName: string | null
  email: string | null
}

export type EstimateClientRecord = {
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
  presentedAt: string | null
  acceptedAt: string | null
  declinedAt: string | null
  voidedAt: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  lineItems: EstimateClientLineItem[]
  lead: { id: string; displayName: string; archivedAt: string | null } | null
  customer: {
    id: string
    displayName: string
    archivedAt: string | null
  } | null
  createdBy: EstimateClientActor
  presentedBy: EstimateClientActor | null
  acceptedBy: EstimateClientActor | null
  declinedBy: EstimateClientActor | null
  voidedBy: EstimateClientActor | null
}

export type EstimateClientRevision = Pick<
  EstimateClientRecord,
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

export type EstimateClientListRecord = Pick<
  EstimateClientRecord,
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
>

export type EstimateClientOperationalization = {
  id: string
  customerId: string
  operationalizedAt: string
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

export type EstimateClientOperationalCustomer = {
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

export type EstimateClientCustomerExperience = {
  share: {
    id: string
    state: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
    expiresAt: string
    revokedAt: string | null
    createdAt: string
    signedUrl: string | null
  } | null
  deliveries: Array<{
    id: string
    channel: 'EMAIL'
    recipientEmail: string
    status:
      | 'PENDING'
      | 'PROCESSING'
      | 'SENT'
      | 'FAILED'
      | 'PERMANENTLY_FAILED'
      | 'CANCELED'
    attempts: number
    provider: string | null
    providerMessageId: string | null
    lastErrorCode: string | null
    lastErrorMessage: string | null
    requestedAt: string
    sentAt: string | null
    failedAt: string | null
  }>
  deliveryHistoryTruncated: boolean
  decision: {
    decision: 'ACCEPTED' | 'DECLINED'
    source: 'MANAGEMENT' | 'CUSTOMER_LINK'
    acknowledgmentNameSnapshot: string | null
    declineReason: string | null
    declineNote: string | null
    occurredAt: string
    managementActor: EstimateClientActor | null
  } | null
}

export type EstimateDraftInput = {
  leadId?: string | null
  customerId?: string | null
  title: string
  scopeDescription?: string | null
  contactNameSnapshot?: string | null
  contactEmailSnapshot?: string | null
  contactPhoneSnapshot?: string | null
  serviceAddressLine1Snapshot?: string | null
  serviceAddressLine2Snapshot?: string | null
  serviceAddressCitySnapshot?: string | null
  serviceAddressRegionSnapshot?: string | null
  serviceAddressPostalCodeSnapshot?: string | null
  serviceAddressCountrySnapshot?: string | null
  currency: string
  expiresOn?: string | null
  lineItems: Array<{
    title: string
    description?: string | null
    billingBasis: EstimateBillingBasis
    amountCents: number
  }>
}

export type EstimateCreateInput = Pick<
  EstimateDraftInput,
  | 'leadId'
  | 'customerId'
  | 'title'
  | 'scopeDescription'
  | 'currency'
  | 'expiresOn'
  | 'lineItems'
>

export type EstimateUpdateInput = Omit<
  EstimateDraftInput,
  'leadId' | 'customerId'
>
