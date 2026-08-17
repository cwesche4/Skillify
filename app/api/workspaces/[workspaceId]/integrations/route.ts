import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'
import { listIntegrationProviderAvailability } from '@/lib/integrations/providerRegistry'
import {
  disconnectWorkspaceIntegrationConnection,
  listWorkspaceIntegrationConnections,
} from '@/lib/integrations/workspaceConnections'

function isManager(role: WorkspaceMemberRole) {
  return role === 'OWNER' || role === 'ADMIN'
}

async function requireMembership(workspaceId: string, clerkId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile) return { profile: null, membership: null }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId,
      },
    },
  })

  return { profile, membership }
}

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { membership } = await requireMembership(params.workspaceId, clerkId)
  if (!membership || !isManager(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const integrations = await prisma.integration.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  const connections = await listWorkspaceIntegrationConnections({
    workspaceId: params.workspaceId,
  })
  const providers = listIntegrationProviderAvailability({
    workspaceId: params.workspaceId,
  })

  return NextResponse.json({ integrations, connections, providers })
}

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { membership, profile } = await requireMembership(
    params.workspaceId,
    clerkId,
  )
  if (!membership || !isManager(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? ((await req.json().catch(() => ({}))) as {
        integrationId?: string
        connectionId?: string
      })
    : Object.fromEntries((await req.formData()).entries())
  const integrationId =
    typeof body.integrationId === 'string' ? body.integrationId : undefined
  const connectionId =
    typeof body.connectionId === 'string' ? body.connectionId : undefined
  if (!integrationId) {
    if (connectionId) {
      const connection = await disconnectWorkspaceIntegrationConnection({
        workspaceId: params.workspaceId,
        connectionId,
      })
      if (!connection) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, connection })
    }
    return NextResponse.json(
      { error: 'integrationId or connectionId required' },
      { status: 400 },
    )
  }

  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, workspaceId: params.workspaceId },
  })
  if (!integration)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.integrationCredential.deleteMany({
    where: { integrationId: integration.id },
  })
  await prisma.integration.update({
    where: { id: integration.id },
    data: { status: 'disconnected' },
  })

  await logAudit({
    workspaceId: params.workspaceId,
    actorId: profile?.id,
    action: 'CRM_DISCONNECTED',
    targetType: 'Integration',
    targetId: integration.id,
    meta: { provider: integration.provider, event: 'disconnect' },
  })

  return NextResponse.json({ ok: true })
}

export async function POST(
  req: Request,
  ctx: { params: { workspaceId: string } },
) {
  return DELETE(req, ctx)
}
