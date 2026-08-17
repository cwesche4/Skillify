import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    revenueTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import {
  createWorkspaceRevenueTransaction,
  listWorkspaceRevenueTransactions,
  voidWorkspaceRevenueTransaction,
} from '@/lib/revenue/revenueRepository'

const revenueTransaction = (
  prisma as unknown as {
    revenueTransaction: {
      findMany: ReturnType<typeof vi.fn>
      findFirst: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
  }
).revenueTransaction

const row = {
  id: 'revenue-1',
  workspaceId: 'workspace-1',
  clientId: 'client-1',
  customerId: null,
  amountCents: 12500,
  currency: 'USD',
  occurredAt: new Date('2026-08-12T12:00:00.000Z'),
  description: 'Manual revenue',
  sourceType: 'MANUAL',
  sourceId: null,
  status: 'ACTIVE',
  createdByUserId: 'user-1',
  createdByWorkspaceMemberId: 'member-1',
  voidedAt: null,
  voidedByUserId: null,
  createdAt: new Date('2026-08-12T12:00:00.000Z'),
  updatedAt: new Date('2026-08-12T12:00:00.000Z'),
}

describe('revenueRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists workspace revenue transactions as resolver-compatible records', async () => {
    revenueTransaction.findMany.mockResolvedValue([row])

    await expect(
      listWorkspaceRevenueTransactions('workspace-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'revenue-1',
        workspaceId: 'workspace-1',
        clientId: 'client-1',
        amountCents: 12500,
        sourceType: 'MANUAL',
        status: 'recognized',
      }),
    ])
    expect(revenueTransaction.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      orderBy: { occurredAt: 'desc' },
    })
  })

  it('persists manual revenue with integer cents', async () => {
    revenueTransaction.create.mockResolvedValue(row)
    revenueTransaction.findFirst.mockResolvedValue(row)

    const saved = await createWorkspaceRevenueTransaction({
      workspaceId: 'workspace-1',
      clientId: 'client-1',
      amountCents: 12500,
      occurredAt: new Date('2026-08-12T12:00:00.000Z'),
      description: 'Manual revenue',
      createdByUserId: 'user-1',
      createdByWorkspaceMemberId: 'member-1',
    })

    expect(saved.amountCents).toBe(12500)
    expect(saved.status).toBe('recognized')
    expect(revenueTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        clientId: 'client-1',
        amountCents: 12500,
        sourceType: 'MANUAL',
        status: 'ACTIVE',
      }),
    })
    expect(revenueTransaction.findFirst).toHaveBeenCalledWith({
      where: { id: 'revenue-1', workspaceId: 'workspace-1' },
    })
  })

  it('voids revenue without hard deleting it', async () => {
    revenueTransaction.findFirst.mockResolvedValue(row)
    revenueTransaction.update.mockResolvedValue({
      ...row,
      status: 'VOIDED',
      voidedAt: new Date('2026-08-13T12:00:00.000Z'),
    })

    const updated = await voidWorkspaceRevenueTransaction({
      workspaceId: 'workspace-1',
      transactionId: 'revenue-1',
      voidedByUserId: 'user-1',
    })

    expect(updated?.status).toBe('void')
    expect(revenueTransaction.update).toHaveBeenCalledWith({
      where: { id: 'revenue-1' },
      data: expect.objectContaining({
        status: 'VOIDED',
        voidedByUserId: 'user-1',
      }),
    })
  })
})
