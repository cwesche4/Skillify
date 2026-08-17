import type { SchedulingFormErrorKey } from '@/lib/scheduling/types'

export type SchedulingApiFieldErrors = Partial<
  Record<SchedulingFormErrorKey, string>
>

export type SchedulingApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DATABASE_NOT_READY'
  | 'RECURRENCE_VERSION_CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'RECURRENCE_MUTATION_BUSY'
  | 'RECURRENCE_RETRY_EXHAUSTED'
  | 'SCHEDULING_CREATE_FAILED'
  | 'SCHEDULING_REQUEST_FAILED'
  | 'SCHEDULING_AI_DISABLED'
  | 'SCHEDULING_AI_PROVIDER_UNAVAILABLE'

export type SchedulingApiErrorBody = {
  ok: false
  code: SchedulingApiErrorCode
  message: string
  fieldErrors?: SchedulingApiFieldErrors
  metadata?: Record<string, unknown>
  requestId?: string
}

export type SchedulingApiSuccessBody<T extends Record<string, unknown>> = {
  ok: true
  requestId?: string
} & T

export function schedulingApiSuccess<T extends Record<string, unknown>>(
  payload: T,
  init?: ResponseInit,
) {
  return Response.json({ ok: true, ...payload }, init)
}

export function schedulingApiError({
  status,
  code,
  message,
  fieldErrors,
  metadata,
  requestId,
}: Omit<SchedulingApiErrorBody, 'ok'> & { status: number }) {
  return Response.json(
    {
      ok: false,
      code,
      message,
      fieldErrors,
      metadata,
      requestId,
    },
    { status },
  )
}
