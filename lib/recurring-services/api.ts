import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { RecurringServiceServiceError } from '@/lib/recurring-services/service'

export function authorizeRecurringServiceRequest(
  workspaceId: string,
  access: 'view' | 'manage' = 'manage',
) {
  return authorizeWorkspaceAccess({ workspaceId, access })
}

export async function readRecurringServiceJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new RecurringServiceServiceError(
      'The Recurring Service request body must be valid JSON.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export function recurringServiceApiError(error: unknown) {
  if (error instanceof RecurringServiceServiceError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        fieldErrors: error.fieldErrors,
      },
      { status: error.status },
    )
  }
  if (error instanceof Error && error.name === 'SchedulingServiceError') {
    const schedulingError = error as Error & {
      status: number
      fieldErrors?: Record<string, string>
    }
    return NextResponse.json(
      {
        ok: false,
        code:
          schedulingError.status === 403
            ? 'FORBIDDEN'
            : schedulingError.status === 404
              ? 'NOT_FOUND'
              : 'VALIDATION_ERROR',
        message: schedulingError.message,
        fieldErrors: schedulingError.fieldErrors,
      },
      { status: schedulingError.status },
    )
  }
  if (error instanceof Error && error.name === 'SchedulingRepositoryError') {
    const schedulingError = error as Error & { code: string }
    const conflict =
      schedulingError.code === 'version_conflict' ||
      schedulingError.code === 'idempotency_conflict'
    return NextResponse.json(
      {
        ok: false,
        code: conflict
          ? 'CONFLICT'
          : schedulingError.code === 'not_found'
            ? 'NOT_FOUND'
            : 'VALIDATION_ERROR',
        message: schedulingError.message,
      },
      {
        status: conflict
          ? 409
          : schedulingError.code === 'not_found'
            ? 404
            : 400,
      },
    )
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: 'DATABASE_NOT_READY',
        message: 'The Recurring Service database is not ready.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: 'RECURRING_SERVICE_REQUEST_FAILED',
      message: 'The Recurring Service request could not be completed.',
    },
    { status: 500 },
  )
}

export function recurringServiceAuthorizationError(result: {
  allowed: false
  status: number
  message: string
}) {
  return NextResponse.json(
    {
      ok: false,
      code: result.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'FORBIDDEN',
      message: result.message,
    },
    { status: result.status },
  )
}
