import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { EstimateExperienceError } from '@/lib/estimates/customerExperienceError'
import { EstimateServiceError } from '@/lib/estimates/service'

export function authorizeEstimateRequest(workspaceId: string) {
  return authorizeWorkspaceAccess({ workspaceId, access: 'manage' })
}

export async function readEstimateJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new EstimateServiceError(
      'The Estimate request body must be valid JSON.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

export function estimateApiError(error: unknown) {
  if (error instanceof EstimateExperienceError) {
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
  if (error instanceof EstimateServiceError) {
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
        message: 'The Estimate database is not ready.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: 'ESTIMATE_REQUEST_FAILED',
      message: 'The Estimate request could not be completed.',
    },
    { status: 500 },
  )
}

export function estimateAuthorizationError(result: {
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
