'use server'

import { NextResponse } from 'next/server'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: { workspaceId: string; automationId: string; versionId: string }
  },
) {
  const access = await authorizeAutomationAccess({
    workspaceId: params.workspaceId,
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const version = await prisma.automationVersion.findFirst({
    where: {
      id: params.versionId,
      automationId: params.automationId,
      workspaceId: params.workspaceId,
    },
    select: {
      snapshots: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          flowJson: true,
          schemaVersion: true,
          nodeCount: true,
          edgeCount: true,
          checksum: true,
          createdAt: true,
        },
      },
    },
  })
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  const snapshot = version.snapshots[0] ?? null
  return NextResponse.json({ snapshot })
}
