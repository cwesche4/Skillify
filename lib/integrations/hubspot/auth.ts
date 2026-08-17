import { encryptToken } from '../crypto'
import { loadIntegrationEnv } from '../env'

const HUBSPOT_OAUTH = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_AUTH = 'https://app.hubspot.com/oauth/authorize'

export function buildHubSpotAuthUrl({
  workspaceId,
  state,
}: {
  workspaceId: string
  state: string
}) {
  const env = loadIntegrationEnv()
  const clientId = env.HUBSPOT_CLIENT_ID
  const redirectUri = env.HUBSPOT_REDIRECT_URI
  const scopes = encodeURIComponent(
    [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.schemas.companies.read',
      'crm.objects.owners.read',
    ].join(' '),
  )

  const stateParam = encodeURIComponent(JSON.stringify({ workspaceId, state }))

  return `${HUBSPOT_AUTH}?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=${scopes}&state=${stateParam}&response_type=code`
}

export async function exchangeHubSpotCode(code: string) {
  const env = loadIntegrationEnv()
  const clientId = env.HUBSPOT_CLIENT_ID
  const clientSecret = env.HUBSPOT_CLIENT_SECRET
  const redirectUri = env.HUBSPOT_REDIRECT_URI

  const res = await fetch(HUBSPOT_OAUTH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    throw new Error(`HubSpot token exchange failed (${res.status})`)
  }

  const json = (await res.json()) as any
  const expiresIn = json.expires_in ? Number(json.expires_in) * 1000 : null
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null

  return {
    accessToken: encryptToken(json.access_token),
    refreshToken: json.refresh_token ? encryptToken(json.refresh_token) : null,
    expiresAt,
    hubId: json.hub_id ?? json.portal_id ?? null,
  }
}
