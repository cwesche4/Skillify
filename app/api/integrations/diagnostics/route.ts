import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId)
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { role: true },
  })
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const integrations = await prisma.integration.findMany({
    where: { workspaceId },
    include: { credentials: true },
  })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const auditCount = await prisma.auditLog.count({
    where: {
      workspaceId,
      createdAt: { gte: since },
      action: { startsWith: 'CRM_' },
    },
  })

  return NextResponse.json({
    ok: true,
    killSwitches: {
      CRM_DISABLE_ALL: process.env.CRM_DISABLE_ALL === 'true',
      CRM_DISABLE_INBOUND: process.env.CRM_DISABLE_INBOUND === 'true',
      CRM_DISABLE_ACTIONS: process.env.CRM_DISABLE_ACTIONS === 'true',
    },
    integrations: integrations.map((i) => {
      const meta = (i.metadata as any) || {}
      return {
        id: i.id,
        provider: i.provider,
        status: i.status,
        breakerOpen: !!meta.breakerOpen,
        failures: Array.isArray(meta.failures) ? meta.failures.length : 0,
        lastError: meta.lastError ?? null,
        lastWebhookAt: meta.lastWebhookAt ?? null,
        lastSuccessfulActionAt: meta.lastSuccessfulActionAt ?? null,
        disabled: !!meta.disabled,
      }
    }),
    audit: { last24h: auditCount },
  })
}
