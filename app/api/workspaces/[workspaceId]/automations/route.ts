import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, description, flow } = body as {
    name?: string
    description?: string
    flow?: unknown
  }

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: params.workspaceId,
      user: { clerkId: userId },
    },
    include: { user: true },
  })

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cleanedName = (name ?? '').trim()
  if (!cleanedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  try {
    const automation = await prisma.automation.create({
      data: {
        workspaceId: params.workspaceId,
        userId: member.userId,
        name: cleanedName,
        description: description ?? null,
        status: 'INACTIVE',
        flow: flow ?? {},
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
