import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { testWorkspaceIntegrationConnection } from '@/lib/integrations/connectionTesting'
import type { IntegrationProviderId } from '@/lib/integrations/providerRegistry'

type RouteContext = {
  params: { workspaceId: string; providerId: string }
}

async function canManageIntegrations(workspaceId: string) {
  const { userId: clerkId } = auth()
  if (!clerkId) return false
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { role: true },
  })
  return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!(await canManageIntegrations(params.workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? ((await request.json().catch(() => ({}))) as { connectionId?: string })
    : Object.fromEntries((await request.formData()).entries())
  if (!body.connectionId) {
    return NextResponse.json(
      { error: 'connectionId required' },
      { status: 400 },
    )
  }

  const result = await testWorkspaceIntegrationConnection({
    workspaceId: params.workspaceId,
    providerId: params.providerId as IntegrationProviderId,
    connectionId: String(body.connectionId),
  })
  return NextResponse.json({ ok: true, result })
}
