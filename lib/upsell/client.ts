// lib/upsell/client.ts

export type MicroUpsellPayload = {
  workspaceId: string
  feature: string
  description: string
  automationId?: string
}

export type EnterpriseConsultPayload = {
  workspaceId: string
  name: string
  email: string
  phone?: string
  companySize?: string
  projectGoal?: string
  description: string
}

export type BuildRequestPayload = {
  name: string
  email: string
  projectSummary: string
  workspaceId?: string
  size?: string
  phone?: string
  company?: string
  website?: string
  projectType?: string
  automationCount?: number
  budgetRange?: string
  timeline?: string
}

async function handleJsonResponse(res: Response) {
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.error ?? 'Request failed')
  }

  return data
}

export async function requestMicroUpsell(payload: MicroUpsellPayload) {
  const res = await fetch('/api/upsell/request-micro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleJsonResponse(res)
}

export async function requestEnterpriseConsult(
  payload: EnterpriseConsultPayload,
) {
  const res = await fetch('/api/enterprise/request-consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleJsonResponse(res)
}

export async function requestBuildUpsell(payload: BuildRequestPayload) {
  const res = await fetch('/api/upsell/request-build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleJsonResponse(res)
}
