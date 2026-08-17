import { getLocalTimestamp } from '@/lib/formatting/dates'
import {
  DEFAULT_REVENUE_CURRENCY,
  normalizeAmountCents,
} from '@/lib/revenue/money'
import type {
  RevenueTransactionSourceType,
  WorkspaceRevenueTransaction,
} from '@/lib/revenue/types'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

const STORAGE_PREFIX = 'skillify-preview-revenue-transactions'

export function getPreviewRevenueStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}:v1`
}

function normalizeRevenueTransaction(
  transaction: Partial<WorkspaceRevenueTransaction>,
  workspaceId: string,
): WorkspaceRevenueTransaction | null {
  const amountCents = normalizeAmountCents(transaction.amountCents)
  if (amountCents <= 0) return null
  const now = getLocalTimestamp()
  const id =
    typeof transaction.id === 'string' && transaction.id.trim()
      ? transaction.id.trim()
      : `revenue-${workspaceId}-${Date.now()}`
  const sourceType = normalizeSourceType(transaction.sourceType)

  return {
    id,
    workspaceId,
    clientId: transaction.clientId ?? null,
    customerId: transaction.customerId ?? null,
    amountCents,
    currency: transaction.currency || DEFAULT_REVENUE_CURRENCY,
    occurredAt: transaction.occurredAt || now,
    description: transaction.description?.trim() || 'Revenue recorded',
    sourceType,
    sourceId: transaction.sourceId ?? null,
    status: transaction.status === 'void' ? 'void' : 'recognized',
    createdBy: transaction.createdBy,
    createdAt: transaction.createdAt || now,
    updatedAt: transaction.updatedAt || now,
  }
}

function normalizeSourceType(
  value: RevenueTransactionSourceType | string | undefined,
): RevenueTransactionSourceType {
  if (
    value === 'JOB' ||
    value === 'ORDER' ||
    value === 'INVOICE' ||
    value === 'PAYMENT'
  ) {
    return value
  }
  return 'MANUAL'
}

export function readPreviewRevenueTransactions(
  workspaceId: string,
): WorkspaceRevenueTransaction[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.sessionStorage.getItem(
      getPreviewRevenueStorageKey(workspaceId),
    )
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((transaction) =>
        normalizeRevenueTransaction(transaction, workspaceId),
      )
      .filter((transaction): transaction is WorkspaceRevenueTransaction =>
        Boolean(transaction),
      )
  } catch {
    return []
  }
}

export function writePreviewRevenueTransactions(
  workspaceId: string,
  transactions: WorkspaceRevenueTransaction[],
) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewRevenueStorageKey(workspaceId),
    JSON.stringify(
      transactions
        .map((transaction) =>
          normalizeRevenueTransaction(transaction, workspaceId),
        )
        .filter((transaction): transaction is WorkspaceRevenueTransaction =>
          Boolean(transaction),
        ),
    ),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'clients')
}

export function createPreviewRevenueTransaction({
  workspaceId,
  transaction,
}: {
  workspaceId: string
  transaction: Partial<WorkspaceRevenueTransaction>
}) {
  const normalized = normalizeRevenueTransaction(
    {
      ...transaction,
      id: transaction.id || `revenue-${workspaceId}-${Date.now()}`,
    },
    workspaceId,
  )
  if (!normalized) {
    throw new Error('Revenue amount must be greater than zero.')
  }
  const nextTransactions = [
    normalized,
    ...readPreviewRevenueTransactions(workspaceId),
  ]
  writePreviewRevenueTransactions(workspaceId, nextTransactions)
  return normalized
}

export function updatePreviewRevenueTransaction({
  workspaceId,
  transactionId,
  updates,
}: {
  workspaceId: string
  transactionId: string
  updates: Partial<WorkspaceRevenueTransaction>
}) {
  let updated: WorkspaceRevenueTransaction | null = null
  const nextTransactions = readPreviewRevenueTransactions(workspaceId)
    .map((transaction) => {
      if (transaction.id !== transactionId) return transaction
      updated = normalizeRevenueTransaction(
        {
          ...transaction,
          ...updates,
          updatedAt: getLocalTimestamp(),
        },
        workspaceId,
      )
      return updated
    })
    .filter((transaction): transaction is WorkspaceRevenueTransaction =>
      Boolean(transaction),
    )
  writePreviewRevenueTransactions(workspaceId, nextTransactions)
  return updated
}
