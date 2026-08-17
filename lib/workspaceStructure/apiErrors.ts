import { Prisma } from '@prisma/client'

export type WorkspaceStructureErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'WORKSPACE_STRUCTURE_SCHEMA_NOT_READY'
  | 'DATABASE_UNAVAILABLE'
  | 'WORKSPACE_STRUCTURE_REQUEST_FAILED'

export type WorkspaceStructureErrorPayload = {
  ok: false
  code: WorkspaceStructureErrorCode
  message: string
  fieldErrors?: Record<string, string>
}

export type WorkspaceStructureErrorResult = {
  status: number
  payload: WorkspaceStructureErrorPayload
  logCode?: string
}

const databaseUnavailableCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1017',
])

const missingSchemaCodes = new Set(['P2021', 'P2022'])

function hasStatus(error: unknown): error is Error & {
  status: number
  fieldErrors?: Record<string, string>
} {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  )
}

function getPrismaCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code
  }
  return null
}

function isPrismaInitializationError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error && error.name === 'PrismaClientInitializationError')
  )
}

export function classifyWorkspaceStructureError(
  error: unknown,
): WorkspaceStructureErrorResult {
  if (hasStatus(error)) {
    const status =
      error.status === 403 ? 403 : error.status === 404 ? 404 : error.status
    return {
      status,
      payload: {
        ok: false,
        code:
          status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : 'VALIDATION_ERROR',
        message:
          status === 403
            ? 'You do not have permission to manage workspace Teams or Locations.'
            : status === 404
              ? error.message
              : 'Review the highlighted fields.',
        fieldErrors: error.fieldErrors,
      },
    }
  }

  const prismaCode = getPrismaCode(error)
  if (prismaCode && missingSchemaCodes.has(prismaCode)) {
    return {
      status: 503,
      logCode: prismaCode,
      payload: {
        ok: false,
        code: 'WORKSPACE_STRUCTURE_SCHEMA_NOT_READY',
        message:
          'Workspace Teams and Locations are not available because the latest database migration has not been applied.',
      },
    }
  }

  if (
    isPrismaInitializationError(error) ||
    (prismaCode && databaseUnavailableCodes.has(prismaCode))
  ) {
    return {
      status: 503,
      logCode: prismaCode ?? 'PrismaClientInitializationError',
      payload: {
        ok: false,
        code: 'DATABASE_UNAVAILABLE',
        message:
          'Skillify could not connect to the database. Check the local database service and try again.',
      },
    }
  }

  return {
    status: 500,
    logCode: prismaCode ?? (error instanceof Error ? error.name : undefined),
    payload: {
      ok: false,
      code: 'WORKSPACE_STRUCTURE_REQUEST_FAILED',
      message: 'Workspace structure request failed.',
    },
  }
}
