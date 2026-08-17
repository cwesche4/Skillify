import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import type {
  IntegrationProvider,
  IntegrationWebhookPayload,
} from '@/lib/integrations/types'
import { processWebhookPayload } from '@/lib/integrations/webhookProcessor'
import {
  normalizeObjectType,
  normalizeProvider,
  normalizeEvent,
} from '@/lib/integrations/normalize'

ensureIntegrationAdapters()

export async function POST(
  req: Request,
  { params }: { params: { provider: string } },
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 },
    )
  }

  const provider = normalizeProvider(
    params.provider,
  ) as IntegrationProvider | null
  if (!provider)
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })

  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req
    .json()
    .catch(() => ({}))) as Partial<IntegrationWebhookPayload> & {
    workspaceId?: string
  }
  const workspaceId = body.workspaceId
  if (!workspaceId)
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // Permission: OWNER/ADMIN only
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
  })
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const objectType = normalizeObjectType(body.objectType as string | undefined)
  const event = normalizeEvent(body.event as string | undefined)
  const externalId = body.externalId
  if (!objectType || !event || !externalId) {
    return NextResponse.json(
      { error: 'objectType, event, and externalId required' },
      { status: 400 },
    )
  }

  const payload: IntegrationWebhookPayload = {
    provider,
    objectType,
    event: event as any,
    externalId: String(externalId),
    payload: body.payload ?? (body as any).raw ?? {},
    occurredAt: body.occurredAt ?? Date.now(),
    workspaceId,
    integrationId: undefined,
  }

  const result = await processWebhookPayload(provider, payload, { workspaceId })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, triggered: result.triggered })
}
