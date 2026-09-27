import type {
  RecurringServiceClientRecord,
  RecurringServiceMutation,
  RecurringServiceScheduleMutation,
} from '@/lib/recurring-services/clientTypes'
import type { SchedulingEvent } from '@/lib/scheduling/types'

export class RecurringServicesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RecurringServicesApiError'
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  if (!response.ok) {
    throw new RecurringServicesApiError(
      body?.message || 'The Recurring Service request could not be completed.',
      response.status,
    )
  }
  return body as T
}

function base(workspaceId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}`
}

export async function listRecurringServices(workspaceId: string) {
  const body = await requestJson<{
    recurringServices: RecurringServiceClientRecord[]
  }>(`${base(workspaceId)}/recurring-services`)
  return body.recurringServices
}

export async function createRecurringService(
  workspaceId: string,
  input: RecurringServiceMutation & {
    customerId: string
    recurrenceSeriesId: string
  },
) {
  const body = await requestJson<{
    recurringService: RecurringServiceClientRecord
  }>(`${base(workspaceId)}/recurring-services`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return body.recurringService
}

export async function updateRecurringService(
  workspaceId: string,
  recurringServiceId: string,
  input: Partial<RecurringServiceMutation>,
) {
  const body = await requestJson<{
    recurringService: RecurringServiceClientRecord
  }>(
    `${base(workspaceId)}/recurring-services/${encodeURIComponent(recurringServiceId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return body.recurringService
}

export async function changeRecurringServiceLifecycle(
  workspaceId: string,
  recurringServiceId: string,
  action: 'pause' | 'resume' | 'end',
  expectedVersion?: number,
) {
  const body = await requestJson<{
    recurringService: RecurringServiceClientRecord
  }>(
    `${base(workspaceId)}/recurring-services/${encodeURIComponent(recurringServiceId)}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion,
        idempotencyKey: `${action}:${recurringServiceId}:${expectedVersion ?? 'current'}`,
      }),
    },
  )
  return body.recurringService
}

export async function createRecurringServiceSchedule(
  workspaceId: string,
  input: RecurringServiceScheduleMutation,
) {
  const body = await requestJson<{ event: SchedulingEvent }>(
    `${base(workspaceId)}/scheduling/events`,
    {
      method: 'POST',
      body: JSON.stringify({
        event: {
          ...input,
          type: 'recurringServiceVisit',
          status: 'scheduled',
          allDay: false,
          reminderPolicy: { mode: 'workspaceDefault' },
        },
      }),
    },
  )
  return body.event
}

export async function updateRecurringServiceSchedule(
  workspaceId: string,
  masterEventId: string,
  input: RecurringServiceScheduleMutation,
  expectedVersion?: number,
) {
  const body = await requestJson<{ event: SchedulingEvent }>(
    `${base(workspaceId)}/scheduling/events/${encodeURIComponent(masterEventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        event: input,
        scope: 'entireSeries',
        expectedVersion,
        idempotencyKey: `edit-service:${masterEventId}:${expectedVersion ?? 'current'}`,
      }),
    },
  )
  return body.event
}

export async function deleteRecurringServiceSchedule(
  workspaceId: string,
  eventId: string,
) {
  await requestJson(
    `${base(workspaceId)}/scheduling/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ scope: 'entireSeries' }),
    },
  )
}

export async function createRecurringServiceWorkflow({
  workspaceId,
  customerId,
  serviceInput,
  scheduleInput,
}: {
  workspaceId: string
  customerId: string
  serviceInput: RecurringServiceMutation
  scheduleInput: RecurringServiceScheduleMutation
}) {
  const schedule = await createRecurringServiceSchedule(
    workspaceId,
    scheduleInput,
  )
  if (!schedule.recurrenceSeriesId) {
    await deleteRecurringServiceSchedule(workspaceId, schedule.id).catch(
      () => undefined,
    )
    throw new Error('Scheduling did not return a recurring service schedule.')
  }
  try {
    return await createRecurringService(workspaceId, {
      ...serviceInput,
      customerId,
      recurrenceSeriesId: schedule.recurrenceSeriesId,
    })
  } catch (error) {
    let cleanedUp = true
    try {
      await deleteRecurringServiceSchedule(workspaceId, schedule.id)
    } catch {
      cleanedUp = false
    }
    const message =
      error instanceof Error
        ? error.message
        : 'The Recurring Service could not be created.'
    throw new Error(
      cleanedUp
        ? `${message} The incomplete schedule was removed.`
        : `${message} The schedule could not be removed automatically; contact support before trying again.`,
    )
  }
}
