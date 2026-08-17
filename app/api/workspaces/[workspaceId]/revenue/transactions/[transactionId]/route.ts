import { NextResponse } from 'next/server'

import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import {
  listWorkspaceRevenueTransactions,
  voidWorkspaceRevenueTransaction,
} from '@/lib/revenue/revenueRepository'

type RouteContext = {
  params: {
    workspaceId: string
    transactionId: string
  }
}

function safeError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
    'manager',
  ])
  if (!guard.allowed) {
    return safeError(
      'You cannot update revenue in this workspace.',
      guard.status,
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string
  }
  if (body.status !== 'void') {
    return safeError('Only voiding revenue is supported in this phase.')
  }

  const transaction = await voidWorkspaceRevenueTransaction({
    workspaceId: params.workspaceId,
    transactionId: params.transactionId,
    voidedByUserId: guard.userId,
  })
  if (!transaction) return safeError('Revenue transaction not found.', 404)

  const transactions = await listWorkspaceRevenueTransactions(
    params.workspaceId,
  )
  return NextResponse.json({ ok: true, transaction, transactions })
}
