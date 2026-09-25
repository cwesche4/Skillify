import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit/log'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import {
  configureSimpleAutomationInstallation,
  removeSimpleAutomationInstallation,
} from '@/lib/automations/simpleAutomationInstallations'
import { getSimpleAutomationReadiness } from '@/lib/automations/simpleAutomationReadiness'

export const dynamic = 'force-dynamic'

const configureRequestSchema = z.object({ config: z.unknown() }).strict()

type RouteContext = {
  params: { workspaceId: string; definitionKey: string }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await authorizeWorkspaceAccess({
    workspaceId: params.workspaceId,
    access: 'manage',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const body = configureRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!body.success) {
    return NextResponse.json(
      { error: 'Request must contain only a configuration object.' },
      { status: 400 },
    )
  }

  try {
    const result = await configureSimpleAutomationInstallation({
      workspaceId: params.workspaceId,
      userProfileId: access.userProfileId,
      definitionKey: params.definitionKey,
      config: body.data.config,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, issues: result.issues },
        { status: result.status },
      )
    }

    await logAudit({
      workspaceId: params.workspaceId,
      actorId: access.userProfileId,
      action: 'SIMPLE_AUTOMATION_CONFIGURED',
      targetType: 'SimpleAutomationInstallation',
      targetId: result.installation.id,
      meta: {
        definitionKey: result.installation.definitionKey,
        definitionVersion: result.installation.definitionVersion,
        automationId: result.installation.automationId,
      },
    })

    const readiness = await getSimpleAutomationReadiness({
      workspaceId: params.workspaceId,
      definitionKey: result.installation.definitionKey,
      definitionVersion: result.installation.definitionVersion,
      config: result.installation.config,
    })

    return NextResponse.json({ installation: result.installation, readiness })
  } catch (error) {
    console.error('Configure Simple Automation failed', error)
    return NextResponse.json(
      { error: 'Configuration could not be saved.' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const access = await authorizeWorkspaceAccess({
    workspaceId: params.workspaceId,
    access: 'manage',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  try {
    const result = await removeSimpleAutomationInstallation({
      workspaceId: params.workspaceId,
      definitionKey: params.definitionKey,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      )
    }

    await logAudit({
      workspaceId: params.workspaceId,
      actorId: access.userProfileId,
      action: 'SIMPLE_AUTOMATION_SETUP_REMOVED',
      targetType: 'SimpleAutomationInstallation',
      meta: { definitionKey: params.definitionKey },
    })

    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error('Remove Simple Automation setup failed', error)
    return NextResponse.json(
      { error: 'Configuration could not be removed.' },
      { status: 500 },
    )
  }
}
