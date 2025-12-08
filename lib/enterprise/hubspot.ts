// lib/enterprise/hubspot.ts

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN
const HUBSPOT_PIPELINE_ID = process.env.HUBSPOT_PIPELINE_ID
const HUBSPOT_DEAL_STAGE_NEW = process.env.HUBSPOT_DEAL_STAGE_NEW

if (!HUBSPOT_TOKEN) {
  console.warn(
    '[HubSpot] HUBSPOT_PRIVATE_APP_TOKEN is not set. HubSpot sync will be skipped.',
  )
}

async function hubspotFetch<T = any>(
  path: string,
  init: RequestInit,
): Promise<T | null> {
  if (!HUBSPOT_TOKEN) return null

  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[HubSpot] Error', res.status, text)
    return null
  }

  return res.json()
}

async function findContactByEmail(email: string) {
  return hubspotFetch<{
    results: { id: string; properties: Record<string, any> }[]
  }>('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
        },
      ],
      properties: ['email', 'firstname', 'lastname'],
      limit: 1,
    }),
  })
}

export async function syncHubSpotContact(args: {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  lifecycleStage?: string
  properties?: Record<string, any>
}) {
  const {
    email,
    firstName,
    lastName,
    phone,
    company,
    lifecycleStage,
    properties,
  } = args
  if (!HUBSPOT_TOKEN) return null

  const existingSearch = await findContactByEmail(email)
  const existing = existingSearch?.results?.[0]

  const baseProps: Record<string, any> = {
    email,
    firstname: firstName,
    lastname: lastName,
    phone,
    company,
    lifecyclestage: lifecycleStage ?? 'marketingqualifiedlead',
    ...properties,
  }

  if (existing) {
    // Update existing
    const id = existing.id
    const updated = await hubspotFetch(`/crm/v3/objects/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: baseProps }),
    })
    return { ...(updated as any), id }
  }

  // Create new
  const created = await hubspotFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties: baseProps }),
  })

  return created
}

export async function createHubSpotDeal(args: {
  title: string
  amount?: number
  pipelineId?: string
  stageId?: string
  contactId?: string
  properties?: Record<string, any>
}) {
  if (!HUBSPOT_TOKEN) return null

  const pipeline = args.pipelineId ?? HUBSPOT_PIPELINE_ID
  const stage = args.stageId ?? HUBSPOT_DEAL_STAGE_NEW

  const payload: any = {
    properties: {
      dealname: args.title,
      amount: args.amount,
      pipeline: pipeline,
      dealstage: stage,
      ...args.properties,
    },
  }

  const deal = await hubspotFetch<{ id: string }>('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (deal && args.contactId) {
    await hubspotFetch('/crm/v4/associations/deal/contact/batch/create', {
      method: 'POST',
      body: JSON.stringify({
        inputs: [
          {
            from: { id: deal.id },
            to: { id: args.contactId },
            type: 'deal_to_contact',
          },
        ],
      }),
    })
  }

  return deal
}
