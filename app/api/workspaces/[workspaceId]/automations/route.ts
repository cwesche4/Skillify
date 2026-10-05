import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { createWorkspaceAutomationSchema } from '@/lib/validations/automation'
import { getAdvancedAutomationLaunchRestrictionError } from '@/lib/automations/policy'

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
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
  const launchError = getAdvancedAutomationLaunchRestrictionError()
  if (launchError) {
    return NextResponse.json({ error: launchError }, { status: 409 })
  }

  const parsed = createWorkspaceAutomationSchema.safeParse(
    await req.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Unsupported or invalid automation fields' },
      { status: 400 },
    )
  }

  const { name, description, flow } = parsed.data

  try {
    const automation = await prisma.automation.create({
      data: {
        workspaceId: params.workspaceId,
        userId: access.userProfileId,
        name,
        description: description ?? null,
        status: 'INACTIVE',
        flow: (flow ?? {}) as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ ok: true, automationId: automation.id })
  } catch (err) {
    console.error('Create automation failed', err)
    return NextResponse.json(
      { error: 'Failed to create automation' },
      { status: 500 },
    )
  }
}
