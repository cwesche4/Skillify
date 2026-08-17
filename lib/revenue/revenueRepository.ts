import { prisma } from '@/lib/db'
import {
  DEFAULT_REVENUE_CURRENCY,
  normalizeAmountCents,
} from '@/lib/revenue/money'
import type {
  RevenueTransactionSourceType,
  WorkspaceRevenueTransaction,
} from '@/lib/revenue/types'

const revenueSourceTypes = new Set<RevenueTransactionSourceType>([
  'MANUAL',
  'JOB',
  'ORDER',
  'INVOICE',
  'PAYMENT',
  'REFUND',
  'ADJUSTMENT',
])

type RevenueTransactionRow = {
  id: string
  workspaceId: string
  clientId: string | null
  customerId: string | null
  amountCents: number
  currency: string
  occurredAt: Date
  description: string
  sourceType: string
  sourceId: string | null
  status: string
  createdByUserId: string | null
  createdByWorkspaceMemberId: string | null
  voidedAt: Date | null
  voidedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export type CreateRevenueTransactionInput = {
  workspaceId: string
  clientId?: string | null
  customerId?: string | null
  amountCents: number
  currency?: string | null
  occurredAt: Date
  description?: string | null
  sourceType?: RevenueTransactionSourceType | null
  sourceId?: string | null
  createdByUserId?: string | null
  createdByWorkspaceMemberId?: string | null
}

function normalizeSourceType(
  value: RevenueTransactionSourceType | string | null | undefined,
): RevenueTransactionSourceType {
  return revenueSourceTypes.has(value as RevenueTransactionSourceType)
    ? (value as RevenueTransactionSourceType)
    : 'MANUAL'
}

function toWorkspaceRevenueTransaction(
  row: RevenueTransactionRow,
): WorkspaceRevenueTransaction {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    clientId: row.clientId,
    customerId: row.customerId,
    amountCents: normalizeAmountCents(row.amountCents),
    currency: row.currency || DEFAULT_REVENUE_CURRENCY,
    occurredAt: row.occurredAt.toISOString(),
    description: row.description,
    sourceType: normalizeSourceType(row.sourceType),
    sourceId: row.sourceId,
    status: row.status === 'VOIDED' ? 'void' : 'recognized',
    createdBy: row.createdByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function revenueDelegate() {
  return (
    prisma as unknown as {
      revenueTransaction: {
        findMany: (args: unknown) => Promise<RevenueTransactionRow[]>
        findFirst: (args: unknown) => Promise<RevenueTransactionRow | null>
        create: (args: unknown) => Promise<RevenueTransactionRow>
        update: (args: unknown) => Promise<RevenueTransactionRow>
      }
    }
  ).revenueTransaction
}

export async function listWorkspaceRevenueTransactions(workspaceId: string) {
  const rows = await revenueDelegate().findMany({
    where: { workspaceId },
    orderBy: { occurredAt: 'desc' },
  })
  return rows.map(toWorkspaceRevenueTransaction)
}

export async function createWorkspaceRevenueTransaction(
  input: CreateRevenueTransactionInput,
) {
  const amountCents = normalizeAmountCents(input.amountCents)
  if (amountCents <= 0) {
    throw new Error('Revenue amount must be greater than zero.')
  }

  const row = await revenueDelegate().create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId ?? null,
      customerId: input.customerId ?? null,
      amountCents,
      currency: input.currency || DEFAULT_REVENUE_CURRENCY,
      occurredAt: input.occurredAt,
      description: input.description?.trim() || 'Revenue recorded',
      sourceType: normalizeSourceType(input.sourceType),
      sourceId: input.sourceId ?? null,
      status: 'ACTIVE',
      createdByUserId: input.createdByUserId ?? null,
      createdByWorkspaceMemberId: input.createdByWorkspaceMemberId ?? null,
    },
  })

  const persisted = await revenueDelegate().findFirst({
    where: { id: row.id, workspaceId: input.workspaceId },
  })
  if (!persisted) {
    throw new Error('Revenue transaction was not persisted.')
  }

  return toWorkspaceRevenueTransaction(persisted)
}

export async function voidWorkspaceRevenueTransaction({
  workspaceId,
  transactionId,
  voidedByUserId,
}: {
  workspaceId: string
  transactionId: string
  voidedByUserId?: string | null
}) {
  const existing = await revenueDelegate().findFirst({
    where: { id: transactionId, workspaceId },
  })
  if (!existing) return null

  const row = await revenueDelegate().update({
    where: { id: transactionId },
    data: {
      status: 'VOIDED',
      voidedAt: new Date(),
      voidedByUserId: voidedByUserId ?? null,
    },
  })
  return toWorkspaceRevenueTransaction(row)
}
