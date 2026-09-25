import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { OperationsServiceError } from '@/lib/jobs/service'

export async function authorizeOperationsRequest(
  workspaceId: string,
  access: 'view' | 'manage',
) {
  return authorizeWorkspaceAccess({ workspaceId, access })
}

export async function readOperationsJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new OperationsServiceError(
      'The operations request body must be valid JSON.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export function operationsApiError(error: unknown) {
  if (error instanceof OperationsServiceError) {
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
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: 'DATABASE_NOT_READY',
        message: 'The operations database is not ready.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: 'OPERATIONS_REQUEST_FAILED',
      message: 'The operations request could not be completed.',
    },
    { status: 500 },
  )
}

export function operationsAuthorizationError(result: {
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
