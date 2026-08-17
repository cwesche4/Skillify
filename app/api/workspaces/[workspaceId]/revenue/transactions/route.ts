import { NextResponse } from 'next/server'

import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import { dollarsToCents } from '@/lib/revenue/money'
import {
  createWorkspaceRevenueTransaction,
  listWorkspaceRevenueTransactions,
} from '@/lib/revenue/revenueRepository'
import type { RevenueTransactionSourceType } from '@/lib/revenue/types'

type RouteContext = {
  params: {
    workspaceId: string
  }
}

function safeError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

function parseOccurredAt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return new Date()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseAmountCents(body: Record<string, unknown>) {
  if (typeof body.amountCents === 'number') return Math.round(body.amountCents)
  if (typeof body.amount === 'string') return dollarsToCents(body.amount)
  return 0
}

function parseSourceType(value: unknown): RevenueTransactionSourceType {
  return value === 'JOB' ||
    value === 'ORDER' ||
    value === 'INVOICE' ||
    value === 'PAYMENT' ||
    value === 'REFUND' ||
    value === 'ADJUSTMENT'
    ? value
    : 'MANUAL'
}

export async function GET(_request: Request, { params }: RouteContext) {
  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
    'manager',
    'member',
  ])
  if (!guard.allowed) {
    return safeError('You do not have access to this workspace.', guard.status)
  }

  const transactions = await listWorkspaceRevenueTransactions(
    params.workspaceId,
  )
  return NextResponse.json({ ok: true, transactions })
}

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
    'manager',
  ])
  if (!guard.allowed) {
    return safeError(
      'You cannot record revenue in this workspace.',
      guard.status,
    )
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!body) return safeError('Revenue request is invalid.')

  const amountCents = parseAmountCents(body)
  if (amountCents <= 0) return safeError('Enter an amount greater than $0.')

  const occurredAt = parseOccurredAt(body.occurredAt)
  if (!occurredAt) return safeError('Choose a valid revenue date.')

  const clientId =
    typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : null
  const customerId =
    typeof body.customerId === 'string' && body.customerId.trim()
      ? body.customerId.trim()
      : null
  const sourceType = parseSourceType(body.sourceType)
  const sourceId =
    typeof body.sourceId === 'string' && body.sourceId.trim()
      ? body.sourceId.trim()
      : null
  const transaction = await createWorkspaceRevenueTransaction({
    workspaceId: params.workspaceId,
    clientId,
    customerId,
    amountCents,
    currency:
      typeof body.currency === 'string' && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : 'USD',
    occurredAt,
    description:
      typeof body.description === 'string' ? body.description : undefined,
    sourceType,
    sourceId,
    createdByUserId: guard.userId,
  })

  return NextResponse.json({ ok: true, transaction }, { status: 201 })
}
