// lib/integrations/hubspot.ts

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

type HubSpotContactProps = {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  website?: string
  notes?: string
}

type HubSpotDealProps = {
  amount?: number | null
  dealName: string
  pipelineId?: string
  stageId?: string
  associatedContactEmail?: string
  additionalProperties?: Record<string, string | number | boolean | null>
}

function getHubSpotHeaders() {
  const token = process.env.HUBSPOT_API_KEY
  if (!token) {
    throw new Error('HUBSPOT_API_KEY is not set')
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function createOrUpdateHubSpotContact(props: HubSpotContactProps) {
  if (!process.env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] HUBSPOT_API_KEY missing – skipping contact sync.')
    return null
  }

  const { email, firstName, lastName, phone, company, website, notes } = props

  const body = {
    properties: {
      email,
      firstname: firstName ?? '',
      lastname: lastName ?? '',
      phone: phone ?? '',
      company: company ?? '',
      website: website ?? '',
      notes: notes ?? '',
    },
  }

  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: getHubSpotHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[HubSpot] Contact error:', text)
    throw new Error('Failed to sync contact to HubSpot')
  }

  return res.json()
}

export async function createHubSpotDeal(props: HubSpotDealProps) {
  if (!process.env.HUBSPOT_API_KEY) {
    console.warn('[HubSpot] HUBSPOT_API_KEY missing – skipping deal sync.')
    return null
  }

  const {
    amount,
    dealName,
    pipelineId = process.env.HUBSPOT_PIPELINE_ID ?? '',
    stageId = process.env.HUBSPOT_DEAL_STAGE_ID ?? '',
    associatedContactEmail,
    additionalProperties = {},
  } = props

  const baseProps: Record<string, any> = {
    dealname: dealName,
    amount: amount ?? undefined,
    pipeline: pipelineId || undefined,
    dealstage: stageId || undefined,
    ...additionalProperties,
  }

  const body: any = { properties: baseProps }

  if (associatedContactEmail) {
    body.associations = [
      {
        types: [
          { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 },
        ],
        // 3 = "deal to contact" in HubSpot default mapping
      },
    ]
  }

  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: getHubSpotHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[HubSpot] Deal error:', text)
    throw new Error('Failed to create HubSpot deal')
  }

  return res.json()
}
