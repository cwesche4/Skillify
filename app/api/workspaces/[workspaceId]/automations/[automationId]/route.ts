import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

async function isManager(workspaceId: string, clerkId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId },
    },
    select: { role: true },
  })
  if (!membership) return false
  return membership.role === 'OWNER' || membership.role === 'ADMIN'
}

export async function DELETE(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await isManager(params.workspaceId, userId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const automation = await prisma.automation.findFirst({
    where: { id: params.automationId, workspaceId: params.workspaceId },
    select: { id: true },
  })
  if (!automation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.automationRun.deleteMany({
        where: { automationId: params.automationId },
      })
      await tx.automation.delete({ where: { id: params.automationId } })
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
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await isManager(params.workspaceId, userId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const automation = await prisma.automation.findFirst({
    where: { id: params.automationId, workspaceId: params.workspaceId },
    select: { id: true },
  })
  if (!automation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await prisma.automation.update({
      where: { id: params.automationId },
      data: { name },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Rename automation failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
