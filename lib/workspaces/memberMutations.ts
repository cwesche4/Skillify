import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { handleWorkspaceMemberCalendarConnectionLifecycle } from '@/lib/scheduling/providers/calendarGovernance'
import { canManageWorkspaceMembers } from '@/lib/workspaces/workspaceRoles'

const MAX_SERIALIZATION_ATTEMPTS = 3

type MutationErrorCode =
  | 'FORBIDDEN'
  | 'MEMBER_NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'OWNER_TRANSFER_REQUIRED'
  | 'LAST_OWNER'
  | 'CONCURRENT_MODIFICATION'

export class WorkspaceMemberMutationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: MutationErrorCode,
  ) {
    super(message)
    this.name = 'WorkspaceMemberMutationError'
  }
}

function isSerializationConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

async function runOwnerSafeMutation<T>(
  mutation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(mutation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isSerializationConflict(error)) throw error
      if (attempt === MAX_SERIALIZATION_ATTEMPTS) {
        throw new WorkspaceMemberMutationError(
          'Workspace membership changed concurrently. Please retry.',
          409,
          'CONCURRENT_MODIFICATION',
        )
      }
    }
  }
  throw new Error('Unreachable workspace member transaction state')
}

export async function updateWorkspaceMemberRoleSafely(input: {
  workspaceId: string
  actorUserId: string
  targetMemberId: string
  requestedRole: WorkspaceMemberRole
}) {
  return runOwnerSafeMutation(async (tx) => {
    const actor = await tx.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: input.actorUserId,
          workspaceId: input.workspaceId,
        },
      },
    })
    if (!actor || !canManageWorkspaceMembers(actor.role)) {
      throw new WorkspaceMemberMutationError('Forbidden', 403, 'FORBIDDEN')
    }

    const target = await tx.workspaceMember.findUnique({
      where: {
        id_workspaceId: {
          id: input.targetMemberId,
          workspaceId: input.workspaceId,
        },
      },
    })
    if (!target) {
      throw new WorkspaceMemberMutationError(
        'Member not found',
        404,
        'MEMBER_NOT_FOUND',
      )
    }
    if (
      input.requestedRole === WorkspaceMemberRole.OWNER &&
      target.role !== WorkspaceMemberRole.OWNER
    ) {
      throw new WorkspaceMemberMutationError(
        'Owner changes require ownership transfer.',
        400,
        'OWNER_TRANSFER_REQUIRED',
      )
    }
    if (
      target.role === WorkspaceMemberRole.OWNER &&
      actor.role !== WorkspaceMemberRole.OWNER
    ) {
      throw new WorkspaceMemberMutationError(
        'Only OWNER can change OWNER role',
        403,
        'FORBIDDEN',
      )
    }
    if (
      target.role === WorkspaceMemberRole.OWNER &&
      input.requestedRole !== WorkspaceMemberRole.OWNER
    ) {
      const ownerCount = await tx.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
          role: WorkspaceMemberRole.OWNER,
        },
      })
      if (ownerCount <= 1) {
        throw new WorkspaceMemberMutationError(
          'Workspace must have at least one OWNER',
          400,
          'LAST_OWNER',
        )
      }
    }

    const member = await tx.workspaceMember.update({
      where: {
        id_workspaceId: {
          id: input.targetMemberId,
          workspaceId: input.workspaceId,
        },
      },
      data: { role: input.requestedRole },
    })
    return { actor, target, member }
  })
}

export async function removeWorkspaceMemberSafely(input: {
  workspaceId: string
  actorUserId: string
  targetMemberId: string
}) {
  return runOwnerSafeMutation(async (tx) => {
    const actor = await tx.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: input.actorUserId,
          workspaceId: input.workspaceId,
        },
      },
    })
    if (!actor || !canManageWorkspaceMembers(actor.role)) {
      throw new WorkspaceMemberMutationError('Forbidden', 403, 'FORBIDDEN')
    }
    const target = await tx.workspaceMember.findUnique({
      where: {
        id_workspaceId: {
          id: input.targetMemberId,
          workspaceId: input.workspaceId,
        },
      },
    })
    if (!target) {
      throw new WorkspaceMemberMutationError(
        'Member not found',
        404,
        'MEMBER_NOT_FOUND',
      )
    }
    if (
      target.role === WorkspaceMemberRole.OWNER &&
      actor.role !== WorkspaceMemberRole.OWNER
    ) {
      throw new WorkspaceMemberMutationError(
        'Only OWNER can remove OWNER',
        403,
        'FORBIDDEN',
      )
    }
    if (target.role === WorkspaceMemberRole.OWNER) {
      const ownerCount = await tx.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
          role: WorkspaceMemberRole.OWNER,
        },
      })
      if (ownerCount <= 1) {
        throw new WorkspaceMemberMutationError(
          'Workspace must have at least one OWNER',
          400,
          'LAST_OWNER',
        )
      }
    }

    await handleWorkspaceMemberCalendarConnectionLifecycle({
      workspaceId: input.workspaceId,
      workspaceMemberId: target.id,
      transition: 'removed',
      actor: { workspaceMemberId: actor.id, userId: input.actorUserId },
      db: tx,
    })
    await tx.workspaceMember.delete({
      where: {
        id_workspaceId: {
          id: target.id,
          workspaceId: input.workspaceId,
        },
      },
    })
    return { actor, target }
  })
}

export async function leaveWorkspaceSafely(input: {
  workspaceId: string
  userId: string
}) {
  return runOwnerSafeMutation(async (tx) => {
    const membership = await tx.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: input.userId,
          workspaceId: input.workspaceId,
        },
      },
    })
    if (!membership) {
      throw new WorkspaceMemberMutationError(
        'Not a member',
        400,
        'NOT_A_MEMBER',
      )
    }
    if (membership.role === WorkspaceMemberRole.OWNER) {
      const ownerCount = await tx.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
          role: WorkspaceMemberRole.OWNER,
        },
      })
      if (ownerCount <= 1) {
        throw new WorkspaceMemberMutationError(
          'Owner must transfer ownership before leaving',
          400,
          'LAST_OWNER',
        )
      }
    }
    await handleWorkspaceMemberCalendarConnectionLifecycle({
      workspaceId: input.workspaceId,
      workspaceMemberId: membership.id,
      transition: 'removed',
      actor: { workspaceMemberId: membership.id, userId: input.userId },
      db: tx,
    })
    await tx.workspaceMember.delete({
      where: {
        id_workspaceId: {
          id: membership.id,
          workspaceId: input.workspaceId,
        },
      },
    })
    return { membership }
  })
}
