import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit/log'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { transitionSimpleAutomationLifecycle } from '@/lib/automations/simpleAutomationLifecycle'

export const dynamic = 'force-dynamic'

const lifecycleActionSchema = z.enum(['activate', 'pause', 'resume'])

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: { workspaceId: string; definitionKey: string; action: string }
  },
) {
  const action = lifecycleActionSchema.safeParse(params.action)
  if (!action.success) {
    return NextResponse.json(
      { error: 'Unsupported lifecycle action.' },
      { status: 400 },
    )
  }

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
    const result = await transitionSimpleAutomationLifecycle({
      workspaceId: params.workspaceId,
      definitionKey: params.definitionKey,
      action: action.data,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, requirements: result.requirements },
        { status: result.status },
      )
    }

    await logAudit({
      workspaceId: params.workspaceId,
      actorId: access.userProfileId,
      action: `SIMPLE_AUTOMATION_${action.data.toUpperCase()}`,
      targetType: 'SimpleAutomationInstallation',
      targetId: result.installationId,
      meta: {
        definitionKey: params.definitionKey,
        automationId: result.automationId,
        automationStatus: result.automationStatus,
      },
    })

    return NextResponse.json({
      automationStatus: result.automationStatus,
      readiness: result.readiness,
    })
  } catch (error) {
    console.error('Simple Automation lifecycle update failed', error)
    return NextResponse.json(
      { error: 'Automation status could not be changed.' },
      { status: 500 },
    )
  }
}
