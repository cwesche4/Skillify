import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { CustomerServiceError } from '@/lib/customers/service'

export function authorizeCustomerRequest(workspaceId: string) {
  // Every 6A Customer operation is management-only. Relationship-scoped
  // Member reads are intentionally deferred until Jobs have Customer FKs.
  return authorizeWorkspaceAccess({ workspaceId, access: 'manage' })
}

export async function readCustomerJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new CustomerServiceError(
      'The Customer request body must be valid JSON.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export function customerApiError(error: unknown) {
  if (error instanceof CustomerServiceError) {
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
        message: 'The Customer database is not ready.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: 'CUSTOMER_REQUEST_FAILED',
      message: 'The Customer request could not be completed.',
    },
    { status: 500 },
  )
}

export function customerAuthorizationError(result: {
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
