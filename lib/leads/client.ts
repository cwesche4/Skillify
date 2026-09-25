import type {
  LeadClientRecord,
  LeadConversionResponse,
  LeadMutationInput,
} from '@/lib/leads/clientTypes'
import type { LeadStage as LeadStageValue } from '@/lib/prisma/enums'

type ErrorBody = {
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export class LeadsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'LeadsApiError'
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
    throw new LeadsApiError(
      body?.message || 'The Lead request could not be completed.',
      response.status,
      body?.fieldErrors,
    )
  }
  return body as T
}

function leadPath(workspaceId: string, leadId?: string) {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/leads`
  return leadId ? `${base}/${encodeURIComponent(leadId)}` : base
}

export async function listLeads(
  workspaceId: string,
  filters: { search?: string; stage?: LeadStageValue } = {},
) {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.stage) params.set('stage', filters.stage)
  const query = params.size ? `?${params.toString()}` : ''
  const body = await requestJson<{ leads: LeadClientRecord[] }>(
    `${leadPath(workspaceId)}${query}`,
  )
  return body.leads
}

export async function createLead(
  workspaceId: string,
  input: LeadMutationInput & { displayName: string },
) {
  const body = await requestJson<{ lead: LeadClientRecord }>(
    leadPath(workspaceId),
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.lead
}

export async function updateLead(
  workspaceId: string,
  leadId: string,
  input: LeadMutationInput,
) {
  const body = await requestJson<{ lead: LeadClientRecord }>(
    leadPath(workspaceId, leadId),
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return body.lead
}

export async function archiveLead(workspaceId: string, leadId: string) {
  const body = await requestJson<{ lead: LeadClientRecord }>(
    leadPath(workspaceId, leadId),
    { method: 'DELETE' },
  )
  return body.lead
}

export async function convertLeadToCustomer(
  workspaceId: string,
  leadId: string,
  confirmDuplicate = false,
) {
  return requestJson<LeadConversionResponse>(
    `${leadPath(workspaceId, leadId)}/convert`,
    {
      method: 'POST',
      body: JSON.stringify({ confirmDuplicate }),
    },
  )
}
