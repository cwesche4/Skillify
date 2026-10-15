import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { handleWorkspaceMemberCalendarConnectionLifecycle } from '@/lib/scheduling/providers/calendarGovernance'

describe('calendar member lifecycle transaction participation', () => {
  it('writes calendar disabling and outbox records through the supplied transaction', async () => {
    const tx = {
      calendarConnection: {
        findMany: vi.fn().mockResolvedValue([{ id: 'connection-a' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      calendarWatchChannel: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      domainOutboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'outbox-a' }),
      },
    } as unknown as Prisma.TransactionClient

    const result = await handleWorkspaceMemberCalendarConnectionLifecycle({
      workspaceId: 'workspace-a',
      workspaceMemberId: 'member-a',
      transition: 'removed',
      actor: { workspaceMemberId: 'owner-a', userId: 'profile-a' },
      db: tx,
    })

    expect(result).toEqual({ affected: 1 })
    expect(tx.calendarWatchChannel.updateMany).toHaveBeenCalledOnce()
    expect(tx.calendarConnection.updateMany).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-a',
        topic: 'scheduling.calendar_connection.owner_inactive',
        aggregateId: 'connection-a',
      }),
    })
  })
})
