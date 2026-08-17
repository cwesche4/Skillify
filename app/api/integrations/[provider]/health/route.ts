import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider } from '@/lib/integrations/types'
import { classifyCRMError } from '@/lib/integrations/failureCategory'

ensureIntegrationAdapters()

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const provider = params.provider as IntegrationProvider
  const adapter = getIntegrationAdapter(provider)
  if (!adapter)
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId)
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
  })
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const integration = await prisma.integration.findFirst({
    where: { workspaceId, provider },
  })

  if (!integration)
    return NextResponse.json(
      { error: 'Integration not found' },
      { status: 404 },
    )

  const meta = (integration.metadata as any) || {}

  return NextResponse.json({
    status: integration.status,
    lastSuccessfulActionAt: meta.lastSuccessfulActionAt ?? null,
    lastWebhookAt: meta.lastWebhookAt ?? null,
    lastError: meta.lastError ?? null,
    lastFailureCategory: meta.lastError
      ? classifyCRMError(String(meta.lastError))
      : 'unknown',
    breakerOpen: !!meta.breakerOpen,
    failures: Array.isArray(meta.failures) ? meta.failures.length : 0,
    disabled: !!meta.disabled,
    killSwitches: {
      CRM_DISABLE_ALL: process.env.CRM_DISABLE_ALL === 'true',
      CRM_DISABLE_INBOUND: process.env.CRM_DISABLE_INBOUND === 'true',
      CRM_DISABLE_ACTIONS: process.env.CRM_DISABLE_ACTIONS === 'true',
    },
  })
}
