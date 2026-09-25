import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { renameAutomationSchema } from '@/lib/validations/automation'
import { getAdvancedAutomationMutationError } from '@/lib/automations/policy'

export async function DELETE(
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
  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) {
    return NextResponse.json({ error: ownershipError }, { status: 409 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.automationRun.deleteMany({
        where: {
          automationId: params.automationId,
          workspaceId: params.workspaceId,
        },
      })
      const deleted = await tx.automation.deleteMany({
        where: { id: params.automationId, workspaceId: params.workspaceId },
      })
      if (deleted.count !== 1) throw new Error('Automation not found')
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete automation failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
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
  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) {
    return NextResponse.json({ error: ownershipError }, { status: 409 })
  }

  const parsed = renameAutomationSchema.safeParse(
    await req.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Only a valid name may be updated here' },
      { status: 400 },
    )
  }

  try {
    const updated = await prisma.automation.updateMany({
      where: { id: params.automationId, workspaceId: params.workspaceId },
      data: { name: parsed.data.name },
    })
    if (updated.count !== 1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Rename automation failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
