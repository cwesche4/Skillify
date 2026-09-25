import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { LeadServiceError } from '@/lib/leads/service'

export function authorizeLeadRequest(workspaceId: string) {
  return authorizeWorkspaceAccess({ workspaceId, access: 'manage' })
}

export async function readLeadJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new LeadServiceError(
      'The Lead request body must be valid JSON.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export function leadApiError(error: unknown) {
  if (error instanceof LeadServiceError) {
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
        message: 'The Lead database is not ready.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: 'LEAD_REQUEST_FAILED',
      message: 'The Lead request could not be completed.',
    },
    { status: 500 },
  )
}

export function leadAuthorizationError(result: {
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
