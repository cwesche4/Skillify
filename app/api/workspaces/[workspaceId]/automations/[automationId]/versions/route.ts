'use server'

import { NextResponse } from 'next/server'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
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

  const records = await prisma.automationVersion.findMany({
    where: {
      workspaceId: params.workspaceId,
      automationId: params.automationId,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      automationId: true,
      createdAt: true,
      createdByUserId: true,
      label: true,
      message: true,
      status: true,
      snapshots: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      },
    },
  })
  const versions = records.map((version) => ({
    id: version.id,
    automationId: version.automationId,
    createdAt: version.createdAt,
    createdById: version.createdByUserId,
    tag: version.label ?? undefined,
    note: version.message ?? undefined,
    isActive: version.status === 'PUBLISHED',
    snapshotId: version.snapshots[0]?.id,
  }))
  return NextResponse.json({ versions })
}
