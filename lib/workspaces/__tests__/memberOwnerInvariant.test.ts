import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  calendarCleanup: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))
vi.mock('@/lib/scheduling/providers/calendarGovernance', () => ({
  handleWorkspaceMemberCalendarConnectionLifecycle: mocks.calendarCleanup,
}))

import {
  leaveWorkspaceSafely,
  removeWorkspaceMemberSafely,
  updateWorkspaceMemberRoleSafely,
  WorkspaceMemberMutationError,
} from '@/lib/workspaces/memberMutations'

type Member = {
  id: string
  userId: string
  workspaceId: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
}

function createStore(initial: Member[]) {
  const members = initial.map((member) => ({ ...member }))
  const tx = {
    workspaceMember: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.userId_workspaceId) {
          const key = where.userId_workspaceId
          return (
            members.find(
              (member) =>
                member.userId === key.userId &&
                member.workspaceId === key.workspaceId,
            ) ?? null
          )
        }
        const key = where.id_workspaceId
        return (
          members.find(
            (member) =>
              member.id === key.id && member.workspaceId === key.workspaceId,
          ) ?? null
        )
      }),
      count: vi.fn(
        async ({ where }) =>
          members.filter(
            (member) =>
              member.workspaceId === where.workspaceId &&
              member.role === where.role,
          ).length,
      ),
      update: vi.fn(async ({ where, data }) => {
        const index = members.findIndex(
          (member) =>
            member.id === where.id_workspaceId.id &&
            member.workspaceId === where.id_workspaceId.workspaceId,
        )
        members[index] = { ...members[index], ...data }
        return members[index]
      }),
      delete: vi.fn(async ({ where }) => {
        const key = where.id_workspaceId
        const index = members.findIndex(
          (member) =>
            member.id === key.id && member.workspaceId === key.workspaceId,
        )
        return members.splice(index, 1)[0]
      }),
    },
  }
  return { members, tx }
}

function owner(id: string): Member {
  return { id, userId: `user-${id}`, workspaceId: 'workspace-a', role: 'OWNER' }
}

describe('workspace last-owner transaction invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.calendarCleanup.mockResolvedValue({ affected: 0 })
  })

  it('prevents the only Owner from leaving or being demoted', async () => {
    const store = createStore([owner('owner-a')])
    mocks.transaction.mockImplementation((callback) => callback(store.tx))

    await expect(
      leaveWorkspaceSafely({
        workspaceId: 'workspace-a',
        userId: 'user-owner-a',
      }),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' })
    await expect(
      updateWorkspaceMemberRoleSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-a',
        targetMemberId: 'owner-a',
        requestedRole: 'ADMIN',
      }),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' })
    expect(store.members).toEqual([owner('owner-a')])
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
  })

  it('serializes concurrent Owner removals so exactly one Owner remains', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    let tail = Promise.resolve()
    mocks.transaction.mockImplementation(async (callback) => {
      const previous = tail
      let release!: () => void
      tail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        return await callback(store.tx)
      } finally {
        release()
      }
    })

    const results = await Promise.allSettled([
      removeWorkspaceMemberSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-a',
        targetMemberId: 'owner-b',
      }),
      leaveWorkspaceSafely({
        workspaceId: 'workspace-a',
        userId: 'user-owner-a',
      }),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    expect(
      store.members.filter((member) => member.role === 'OWNER'),
    ).toHaveLength(1)
  })

  it('allows the first sequential Owner removal and rejects the second', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    mocks.transaction.mockImplementation((callback) => callback(store.tx))

    await removeWorkspaceMemberSafely({
      workspaceId: 'workspace-a',
      actorUserId: 'user-owner-a',
      targetMemberId: 'owner-b',
    })
    await expect(
      leaveWorkspaceSafely({
        workspaceId: 'workspace-a',
        userId: 'user-owner-a',
      }),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' })
    expect(store.members).toEqual([owner('owner-a')])
  })

  it('serializes concurrent demotions so exactly one Owner remains', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    let tail = Promise.resolve()
    mocks.transaction.mockImplementation(async (callback) => {
      const previous = tail
      let release!: () => void
      tail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        return await callback(store.tx)
      } finally {
        release()
      }
    })

    const results = await Promise.allSettled([
      updateWorkspaceMemberRoleSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-a',
        targetMemberId: 'owner-a',
        requestedRole: 'ADMIN',
      }),
      updateWorkspaceMemberRoleSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-b',
        targetMemberId: 'owner-b',
        requestedRole: 'ADMIN',
      }),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      store.members.filter((member) => member.role === 'OWNER'),
    ).toHaveLength(1)
  })

  it('retries P2034 conflicts only, bounds retries, and keeps effects inside the transaction', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    mocks.transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((callback) => callback(store.tx))

    await removeWorkspaceMemberSafely({
      workspaceId: 'workspace-a',
      actorUserId: 'user-owner-a',
      targetMemberId: 'owner-b',
    })

    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.calendarCleanup).toHaveBeenCalledTimes(1)
    expect(store.members.map((member) => member.id)).toEqual(['owner-a'])

    vi.clearAllMocks()
    mocks.transaction.mockRejectedValue({ code: 'P2034' })
    await expect(
      removeWorkspaceMemberSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-a',
        targetMemberId: 'owner-a',
      }),
    ).rejects.toMatchObject({
      code: 'CONCURRENT_MODIFICATION',
      status: 409,
    })
    expect(mocks.transaction).toHaveBeenCalledTimes(3)
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
  })

  it('does not retry non-serialization failures or alter the prior state', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    mocks.transaction.mockRejectedValue(new Error('database unavailable'))

    await expect(
      removeWorkspaceMemberSafely({
        workspaceId: 'workspace-a',
        actorUserId: 'user-owner-a',
        targetMemberId: 'owner-b',
      }),
    ).rejects.toThrow('database unavailable')
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(store.members).toEqual([owner('owner-a'), owner('owner-b')])
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
  })

  it('uses Serializable isolation for every owner-capable mutation path', async () => {
    const store = createStore([owner('owner-a'), owner('owner-b')])
    mocks.transaction.mockImplementation((callback) => callback(store.tx))

    await updateWorkspaceMemberRoleSafely({
      workspaceId: 'workspace-a',
      actorUserId: 'user-owner-a',
      targetMemberId: 'owner-b',
      requestedRole: 'ADMIN',
    })
    expect(mocks.transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    )
  })

  it('uses typed errors for deterministic HTTP translation', () => {
    expect(
      new WorkspaceMemberMutationError('Forbidden', 403, 'FORBIDDEN'),
    ).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })
})
