import type {
  EstimateClientListRecord,
  EstimateClientOperationalCustomer,
  EstimateClientOperationalization,
  EstimateClientRecord,
  EstimateClientRevision,
  EstimateCreateInput,
  EstimateUpdateInput,
} from '@/lib/estimates/clientTypes'
import type { EstimateListView } from '@/lib/estimates/types'

type ErrorBody = {
  code?: string
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export class EstimatesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[] | undefined>,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'EstimatesApiError'
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => null)) as ErrorBody | null
  if (!response.ok) {
    throw new EstimatesApiError(
      body?.message || 'The Estimate request could not be completed.',
      response.status,
      body?.fieldErrors,
      body?.code,
    )
  }
  return body as T
}

function path(workspaceId: string, estimateId?: string, action?: string) {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/estimates`
  if (!estimateId) return base
  const detail = `${base}/${encodeURIComponent(estimateId)}`
  return action ? `${detail}/${action}` : detail
}

export async function listEstimates(
  workspaceId: string,
  input: {
    view?: EstimateListView
    cursor?: string
    pageSize?: number
    leadId?: string
    customerId?: string
  } = {},
) {
  const query = new URLSearchParams()
  if (input.view) query.set('view', input.view)
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.pageSize) query.set('pageSize', String(input.pageSize))
  if (input.leadId) query.set('leadId', input.leadId)
  if (input.customerId) query.set('customerId', input.customerId)
  return requestJson<{
    estimates: EstimateClientListRecord[]
    nextCursor: string | null
    workspaceDateKey: string
  }>(`${path(workspaceId)}?${query.toString()}`)
}

export async function getEstimate(workspaceId: string, estimateId: string) {
  return requestJson<{
    estimate: EstimateClientRecord
    revisions: EstimateClientRevision[]
    revisionHistoryTruncated: boolean
    workspaceDateKey: string
    operationalization: EstimateClientOperationalization | null
    operationalCustomer: EstimateClientOperationalCustomer | null
  }>(path(workspaceId, estimateId))
}

export type EstimateOperationalizationRequest = {
  expectedVersion: number
  idempotencyKey: string
  oneTime?: {
    title?: string
    notes?: string | null
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    scheduledStartAt?: string
    scheduledEndAt?: string
    assignments: Array<
      | { assignmentType: 'MEMBER'; workspaceMemberId: string }
      | { assignmentType: 'TEAM'; teamId: string }
    >
    lineItems: Array<{
      estimateLineItemId: string
      createJobStep: boolean
      stepTitle?: string
      stepDescription?: string | null
    }>
  }
  recurring: Array<{
    estimateLineItemId: string
    serviceInstructions?: string | null
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    stepTemplates: Array<{ title: string; description?: string | null }>
    schedule: {
      startsAt: string
      endsAt: string
      timezone: string
      recurrenceRule: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
        interval: number
        daysOfWeek?: number[]
        endType: 'never' | 'onDate' | 'afterOccurrences'
        endDate?: string
        occurrenceCount?: number
      }
      locationType: 'customerLocation' | 'physicalAddress' | 'toBeDetermined'
      locationLabel?: string | null
      locationAddress?: string | null
      assignments: Array<
        | { assignmentType: 'MEMBER'; workspaceMemberId: string }
        | { assignmentType: 'TEAM'; teamId: string }
      >
    }
  }>
}

export async function operationalizeEstimate(
  workspaceId: string,
  estimateId: string,
  input: EstimateOperationalizationRequest,
) {
  return requestJson<{
    operationalizationId: string
    estimateId: string
    referenceNumber: string
    customerId: string
    jobId: string | null
    recurringServiceIds: string[]
    mappings: EstimateClientOperationalization['mappings']
    operationalizedAt: string
    replayed: boolean
  }>(path(workspaceId, estimateId, 'operationalize'), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createEstimate(
  workspaceId: string,
  input: EstimateCreateInput,
) {
  const body = await requestJson<{ estimate: EstimateClientRecord }>(
    path(workspaceId),
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.estimate
}

export async function updateEstimate(
  workspaceId: string,
  estimateId: string,
  expectedVersion: number,
  input: EstimateUpdateInput,
) {
  const body = await requestJson<{ estimate: EstimateClientRecord }>(
    path(workspaceId, estimateId),
    {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, ...input }),
    },
  )
  return body.estimate
}

export async function estimateAction(
  workspaceId: string,
  estimateId: string,
  action: 'present' | 'accept' | 'decline' | 'void' | 'revise',
  expectedVersion: number,
) {
  const body = await requestJson<{ estimate: EstimateClientRecord }>(
    path(workspaceId, estimateId, action),
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  )
  return body.estimate
}

export async function archiveEstimate(
  workspaceId: string,
  estimateId: string,
  expectedVersion: number,
) {
  const body = await requestJson<{ estimate: EstimateClientRecord }>(
    path(workspaceId, estimateId),
    { method: 'DELETE', body: JSON.stringify({ expectedVersion }) },
  )
  return body.estimate
}
