import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import { resolveSchedulingAssignmentsInTransaction } from '@/lib/scheduling/repository'

function transaction({
  members = [],
  teams = [],
}: {
  members?: Array<{ id: string; userId: string }>
  teams?: Array<{ id: string; name: string }>
}) {
  return {
    workspaceMember: { findMany: vi.fn().mockResolvedValue(members) },
    workspaceTeam: { findMany: vi.fn().mockResolvedValue(teams) },
  } as unknown as Prisma.TransactionClient
}

describe('Scheduling assignment batch resolution', () => {
  it('resolves all recurring targets with one member query and one team query', async () => {
    const tx = transaction({
      members: [{ id: 'member-a', userId: 'user-a' }],
      teams: [{ id: 'team-a', name: 'Crew A' }],
    })

    const result = await resolveSchedulingAssignmentsInTransaction({
      tx,
      workspaceId: 'ws-a',
      inputs: [
        {
          assignedMemberIds: ['user-a'],
          assignments: [
            { assignmentType: 'MEMBER', workspaceMemberId: 'user-a' },
          ],
        },
        {
          assignments: [{ assignmentType: 'TEAM', teamId: 'team-a' }],
        },
      ],
    })

    expect(tx.workspaceMember.findMany).toHaveBeenCalledTimes(1)
    expect(tx.workspaceTeam.findMany).toHaveBeenCalledTimes(1)
    expect(result.memberIdByInput.get('user-a')).toBe('member-a')
    expect(result.teamNameById.get('team-a')).toBe('Crew A')
  })

  it('fails closed for foreign members and inactive or foreign teams', async () => {
    await expect(
      resolveSchedulingAssignmentsInTransaction({
        tx: transaction({}),
        workspaceId: 'ws-a',
        inputs: [
          {
            assignments: [
              { assignmentType: 'MEMBER', workspaceMemberId: 'foreign' },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      resolveSchedulingAssignmentsInTransaction({
        tx: transaction({}),
        workspaceId: 'ws-a',
        inputs: [
          {
            assignments: [{ assignmentType: 'TEAM', teamId: 'inactive' }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})
