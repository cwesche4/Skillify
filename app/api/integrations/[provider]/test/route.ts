import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider } from '@/lib/integrations/types'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { decryptToken } from '@/lib/integrations/crypto'
import { logAudit } from '@/lib/audit/log'
import { ensureIntegrationEnv } from '@/lib/integrations/env'

ensureIntegrationAdapters()

export async function POST(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as IntegrationProvider
  const adapter = getIntegrationAdapter(provider)
  if (!adapter || !adapter.testConnection) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 404 })
  }
  ensureIntegrationEnv()

  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string
    integrationId?: string
  }
  const workspaceId = body.workspaceId
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  // membership check
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId },
    },
  })
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const plan = await getWorkspacePlan(workspaceId)
  if (plan !== 'Pro' && plan !== 'Elite') {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
  }

  const integrationId = body.integrationId
  const integration = integrationId
    ? await prisma.integration.findFirst({
        where: { id: integrationId, workspaceId },
        include: { credentials: true },
      })
    : await prisma.integration.findFirst({
        where: { workspaceId, provider },
        include: { credentials: true },
      })

  if (!integration)
    return NextResponse.json(
      { error: 'Integration not found' },
      { status: 404 },
    )

  const cred = integration.credentials[0]
  const ctx = {
    workspaceId,
    integrationId: integration.id,
    provider,
    credentials: cred
      ? {
          accessToken: cred.accessToken
            ? decryptToken(cred.accessToken)
            : undefined,
          refreshToken: cred.refreshToken
            ? decryptToken(cred.refreshToken)
            : undefined,
          expiresAt: cred.expiresAt ?? undefined,
        }
      : undefined,
  }

  try {
    // Lightweight check via HubSpot access token introspection
    const token = ctx.credentials?.accessToken
    if (!token) throw new Error('Missing access token')
    const res = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token)}`,
    )
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`HubSpot test failed (${res.status}): ${detail}`)
    }
    const json = (await res.json()) as any
    const hubId = json.hub_id ?? json.hubId ?? null

    if (hubId) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: {
            ...(integration.metadata as any),
            hubId,
            lastSuccessfulActionAt: new Date().toISOString(),
            lastError: null,
          },
        },
      })
    }

    await logAudit({
      workspaceId,
      action: 'CRM_TEST_CONNECTION',
      targetType: 'Integration',
      targetId: integration.id,
      meta: { provider, ok: true, hubId },
    })
    return NextResponse.json({ ok: true, hubId, user: json.user_id ?? null })
  } catch (err: any) {
    await logAudit({
      workspaceId,
      action: 'CRM_TEST_CONNECTION',
      targetType: 'Integration',
      targetId: integration.id,
      meta: { provider, ok: false, error: err?.message },
    })
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Test connection failed' },
      { status: 500 },
    )
  }
}
