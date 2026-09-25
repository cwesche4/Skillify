import { NextResponse } from 'next/server'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { getWorkspaceAutomationCapabilities } from '@/lib/automations/capabilities'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { workspaceId: string } },
) {
  const access = await authorizeWorkspaceAccess({
    workspaceId: params.workspaceId,
    access: 'view',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const capabilities = await getWorkspaceAutomationCapabilities(
    params.workspaceId,
  )
  if (!capabilities.canUseStarterAutomations) {
    return NextResponse.json(
      { error: 'Simple Automations are not available on this workspace plan.' },
      { status: 403 },
    )
  }

  const installations = await prisma.simpleAutomationInstallation.findMany({
    where: { workspaceId: params.workspaceId, removedAt: null },
    select: {
      id: true,
      definitionKey: true,
      definitionVersion: true,
      automationId: true,
      config: true,
      createdAt: true,
      updatedAt: true,
      automation: { select: { status: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    installations: installations.map(({ automation, ...installation }) => ({
      ...installation,
      automationStatus: automation.status,
    })),
  })
}
