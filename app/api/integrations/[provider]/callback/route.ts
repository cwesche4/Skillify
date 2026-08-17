import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider } from '@/lib/integrations/types'
import { exchangeHubSpotCode } from '@/lib/integrations/hubspot/auth'
import { encryptToken } from '@/lib/integrations/crypto'
import { logAudit } from '@/lib/audit/log'
import { ensureIntegrationEnv } from '@/lib/integrations/env'

ensureIntegrationAdapters()

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as IntegrationProvider
  const adapter = getIntegrationAdapter(provider)
  if (!adapter)
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  if (provider === 'hubspot') {
    ensureIntegrationEnv()
  }

  const url = new URL(req.url)
  const stateParam = url.searchParams.get('state')
  const workspaceId = url.searchParams.get('workspaceId')
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  let parsedState: { workspaceId?: string; state?: string } | null = null
  if (stateParam) {
    try {
      parsedState = JSON.parse(stateParam)
    } catch {
      return NextResponse.json(
        { error: 'Invalid state payload' },
        { status: 400 },
      )
    }
  }

  const resolvedWorkspaceId = parsedState?.workspaceId ?? workspaceId
  if (!resolvedWorkspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }

  const integration = await prisma.integration.findFirst({
    where: { workspaceId: resolvedWorkspaceId, provider },
  })
  if (!integration) {
    return NextResponse.json(
      { error: 'Integration not initialized' },
      { status: 400 },
    )
  }

  const storedState = (integration.metadata as any)?.state
  const incomingState = parsedState?.state
  if (!storedState || !incomingState || storedState !== incomingState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  let tokens: {
    accessToken: string
    refreshToken: string | null
    expiresAt: Date | null
  }
  if (provider === 'hubspot') {
    tokens = await exchangeHubSpotCode(code)
  } else {
    tokens = {
      accessToken: encryptToken(code),
      refreshToken: null,
      expiresAt: null,
    }
  }

  const existingCred = await prisma.integrationCredential.findFirst({
    where: { integrationId: integration.id },
  })

  if (existingCred) {
    await prisma.integrationCredential.update({
      where: { id: existingCred.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
        expiresAt: tokens.expiresAt ?? undefined,
      },
    })
  } else {
    await prisma.integrationCredential.create({
      data: {
        integrationId: integration.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt ?? undefined,
      },
    })
  }

  const metadata = integration.metadata as any
  const hubId =
    provider === 'hubspot' && (tokens as any)?.hubId
      ? (tokens as any).hubId
      : metadata?.hubId

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: 'connected',
      metadata: {
        ...(metadata ?? {}),
        hubId,
        state: null,
        stateCreatedAt: null,
      },
    },
  })

  await logAudit({
    workspaceId: resolvedWorkspaceId,
    action: 'CRM_CONNECTED',
    targetType: 'Integration',
    targetId: integration.id,
    meta: { provider, event: 'callback' },
  })

  return NextResponse.json({ ok: true, status: 'connected' })
}
