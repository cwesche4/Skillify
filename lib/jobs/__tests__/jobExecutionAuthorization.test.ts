import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  jobFindFirst: vi.fn(),
  jobFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    job: { findFirst: mocks.jobFindFirst, findMany: mocks.jobFindMany },
  },
}))

import {
  canWorkspaceMemberExecuteJob,
  jobExecutionEligibilityWhere,
  listWorkspaceMemberExecutableJobIds,
  lockAndValidateRecurringJobExecution,
} from '@/lib/jobs/jobExecutionAuthorization'

describe('central Job execution authorization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes manual compatibility and normalized MEMBER/TEAM authorization to the Job workspace', () => {
    expect(
      jobExecutionEligibilityWhere({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        workspaceMemberId: 'member-a',
      }),
    ).toEqual({
      id: 'job-a',
      workspaceId: 'workspace-a',
      archivedAt: null,
      OR: [
        {
          schedulingEventId: null,
          assigneeMemberId: 'member-a',
        },
        {
          schedulingEventId: { not: null },
          status: {
            in: ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_ON_CLIENT'],
          },
          assignments: {
            some: {
              workspaceId: 'workspace-a',
              OR: [
                {
                  assignmentType: 'MEMBER',
                  workspaceMemberId: 'member-a',
                  teamId: null,
                },
                {
                  assignmentType: 'TEAM',
                  workspaceMemberId: null,
                  team: {
                    is: {
                      workspaceId: 'workspace-a',
                      isActive: true,
                      archivedAt: null,
                      members: {
                        some: {
                          workspaceId: 'workspace-a',
                          workspaceMemberId: 'member-a',
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
          schedulingEvent: {
            is: {
              workspaceId: 'workspace-a',
              deletedAt: null,
              status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
              occurrenceState: {
                notIn: ['CANCELED', 'COMPLETED', 'DELETED', 'SUPERSEDED'],
              },
            },
          },
        },
      ],
    })
  })

  it('rechecks current Team membership on every decision without trusting client identity', async () => {
    mocks.jobFindFirst
      .mockResolvedValueOnce({ id: 'job-a' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'job-a' })

    const input = {
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      workspaceMemberId: 'server-resolved-member',
    }
    await expect(canWorkspaceMemberExecuteJob(input)).resolves.toBe(true)
    await expect(canWorkspaceMemberExecuteJob(input)).resolves.toBe(false)
    await expect(canWorkspaceMemberExecuteJob(input)).resolves.toBe(true)

    expect(mocks.jobFindFirst).toHaveBeenCalledTimes(3)
    expect(mocks.jobFindFirst).toHaveBeenLastCalledWith({
      where: jobExecutionEligibilityWhere(input),
      select: { id: true },
    })
  })

  it('fails closed for a cross-workspace or unrelated member when no scoped Job matches', async () => {
    mocks.jobFindFirst.mockResolvedValue(null)

    await expect(
      canWorkspaceMemberExecuteJob({
        workspaceId: 'workspace-b',
        jobId: 'job-a',
        workspaceMemberId: 'member-a',
      }),
    ).resolves.toBe(false)
  })

  it('returns only server-authorized direct or active-Team Jobs for list presentation', async () => {
    mocks.jobFindMany.mockResolvedValue([
      { id: 'job-direct' },
      { id: 'job-team' },
    ])

    await expect(
      listWorkspaceMemberExecutableJobIds({
        workspaceId: 'workspace-a',
        jobIds: ['job-direct', 'job-team', 'job-unrelated'],
        workspaceMemberId: 'member-a',
      }),
    ).resolves.toEqual(new Set(['job-direct', 'job-team']))

    expect(mocks.jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-a',
          id: { in: ['job-direct', 'job-team', 'job-unrelated'] },
          archivedAt: null,
        }),
        select: { id: true },
      }),
    )
  })

  it('locks and revalidates the authoritative occurrence assignment before a recurring field write', async () => {
    const tx = {
      job: {
        findFirst: vi.fn(async () => ({
          schedulingEventId: 'occurrence-a',
        })),
      },
      $queryRaw: vi.fn(async () => [{ id: 'occurrence-a' }]),
      schedulingEvent: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            assignments: [
              {
                assignmentType: 'MEMBER',
                workspaceMemberId: 'member-a',
                teamId: null,
              },
            ],
          })
          .mockResolvedValueOnce({
            assignments: [
              {
                assignmentType: 'MEMBER',
                workspaceMemberId: 'member-b',
                teamId: null,
              },
            ],
          }),
      },
      workspaceTeam: { findFirst: vi.fn(async () => null) },
    } as unknown as Prisma.TransactionClient

    const input = {
      tx,
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      workspaceMemberId: 'member-a',
    }
    await expect(lockAndValidateRecurringJobExecution(input)).resolves.toBe(
      true,
    )
    await expect(lockAndValidateRecurringJobExecution(input)).resolves.toBe(
      false,
    )
  })
})
