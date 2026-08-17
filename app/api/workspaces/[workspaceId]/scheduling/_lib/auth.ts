import { auth } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { schedulingApiError } from '@/lib/scheduling/apiResponses'
import { SchedulingRepositoryError } from '@/lib/scheduling/repository'
import type { SchedulingMutationActor } from '@/lib/scheduling/services/schedulingService'
import { SchedulingServiceError } from '@/lib/scheduling/services/schedulingService'

export async function getSchedulingActor(
  workspaceId: string,
): Promise<SchedulingMutationActor | Response> {
  const { userId } = auth()
  if (!userId) {
    return schedulingApiError({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Sign in to schedule events in this workspace.',
    })
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
    select: {
      id: true,
      userId: true,
      role: true,
    },
  })
  if (!membership) {
    return schedulingApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have access to scheduling in this workspace.',
    })
  }

  const role = String(membership.role).toLowerCase()
  return {
    workspaceId,
    actorUserId: membership.userId,
    workspaceMemberId: membership.id,
    canManageScheduling: role === 'owner' || role === 'admin',
  }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

export async function canManageCalendarConnection(
  workspaceId: string,
  connectionId: string,
  actor: SchedulingMutationActor,
) {
  if (actor.canManageScheduling) return true
  const connection = await prisma.calendarConnection.findFirst({
    where: {
      id: connectionId,
      workspaceId,
      ownershipType: 'MEMBER',
      workspaceMemberId: actor.workspaceMemberId,
      disconnectedAt: null,
    },
    select: { id: true },
  })
  return Boolean(connection)
}

export async function canManageConnectedCalendar(
  workspaceId: string,
  calendarId: string,
  actor: SchedulingMutationActor,
) {
  if (actor.canManageScheduling) return true
  const calendar = await prisma.connectedCalendar.findFirst({
    where: {
      id: calendarId,
      workspaceId,
      connection: {
        ownershipType: 'MEMBER',
        workspaceMemberId: actor.workspaceMemberId,
        disconnectedAt: null,
      },
    },
    select: { id: true },
  })
  return Boolean(calendar)
}

export function schedulingErrorResponse(error: unknown) {
  const requestId = `scheduling-${crypto.randomUUID()}`
  if (error instanceof SchedulingServiceError) {
    return schedulingApiError({
      status: error.status,
      code:
        error.status === 403
          ? 'FORBIDDEN'
          : error.status === 404
            ? 'NOT_FOUND'
            : 'VALIDATION_ERROR',
      message: error.message,
      fieldErrors: error.fieldErrors,
      requestId,
      metadata: { failedStage: 'service-validation' },
    })
  }
  if (error instanceof SchedulingRepositoryError) {
    const recurrenceConflicts = {
      version_conflict: {
        status: 409,
        code: 'RECURRENCE_VERSION_CONFLICT',
      },
      idempotency_conflict: {
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      },
      mutation_busy: {
        status: 423,
        code: 'RECURRENCE_MUTATION_BUSY',
      },
      retry_exhausted: {
        status: 503,
        code: 'RECURRENCE_RETRY_EXHAUSTED',
      },
    } as const
    if (error.code in recurrenceConflicts) {
      const response =
        recurrenceConflicts[error.code as keyof typeof recurrenceConflicts]
      return schedulingApiError({
        status: response.status,
        code: response.code,
        message: error.message,
        metadata: error.metadata,
        requestId,
      })
    }
    return schedulingApiError({
      status:
        error.code === 'forbidden'
          ? 403
          : error.code === 'not_found'
            ? 404
            : 400,
      code:
        error.code === 'forbidden'
          ? 'FORBIDDEN'
          : error.code === 'not_found'
            ? 'NOT_FOUND'
            : 'VALIDATION_ERROR',
      message: error.message,
      requestId,
      metadata: { failedStage: 'repository' },
    })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const missingTableCodes = new Set(['P2021', 'P2022'])
    return schedulingApiError({
      status: missingTableCodes.has(error.code) ? 503 : 500,
      code: missingTableCodes.has(error.code)
        ? 'DATABASE_NOT_READY'
        : 'SCHEDULING_REQUEST_FAILED',
      message: missingTableCodes.has(error.code)
        ? 'The scheduling database is not ready. Apply the latest migrations and try again.'
        : 'The scheduling request could not be completed. Try again.',
      requestId,
      metadata: {
        failedStage: 'database',
        errorCategory: missingTableCodes.has(error.code)
          ? 'database-not-ready'
          : 'database-request-failed',
      },
    })
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return schedulingApiError({
      status: 503,
      code: 'DATABASE_NOT_READY',
      message:
        'Skillify could not reach the scheduling database. Check the database connection and try again.',
      requestId,
      metadata: { failedStage: 'database-connection' },
    })
  }
  return schedulingApiError({
    status: 500,
    code: 'SCHEDULING_REQUEST_FAILED',
    message: 'The scheduling request could not be completed. Try again.',
    requestId,
    metadata: { failedStage: 'unknown' },
  })
}
