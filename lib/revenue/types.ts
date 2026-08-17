export type RevenueTransactionSourceType =
  | 'MANUAL'
  | 'JOB'
  | 'ORDER'
  | 'INVOICE'
  | 'PAYMENT'
  | 'REFUND'
  | 'ADJUSTMENT'

export type RevenueTransactionStatus = 'recognized' | 'void'

export type WorkspaceRevenueTransaction = {
  id: string
  workspaceId: string
  clientId?: string | null
  customerId?: string | null
  amountCents: number
  currency: string
  occurredAt: string
  description: string
  sourceType: RevenueTransactionSourceType
  sourceId?: string | null
  status: RevenueTransactionStatus
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type RecognizedRevenueSource =
  | 'manualTransaction'
  | 'jobFallback'
  | 'commerceOrder'

export type RecognizedRevenueEntry = {
  id: string
  workspaceId: string
  amountCents: number
  currency: string
  occurredAt: string
  description: string
  source: RecognizedRevenueSource
  sourceType: RevenueTransactionSourceType
  sourceId?: string | null
  clientId?: string | null
  customerId?: string | null
}
