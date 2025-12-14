// app/api/workspaces/[workspaceId]/members/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'

function isManager(role: WorkspaceMemberRole) {
  return (
    role === WorkspaceMemberRole.OWNER || role === WorkspaceMemberRole.ADMIN
  )
}

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: params.workspaceId,
      },
    },
  })
  if (!membership)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: params.workspaceId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      createdAt: m.createdAt,
    })),
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const actor = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: params.workspaceId,
      },
    },
  })
  if (!actor || !isManager(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as {
    memberId: string
    role: WorkspaceMemberRole
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { id: body.memberId },
  })
  if (!target || target.workspaceId !== params.workspaceId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Only OWNER can change an OWNER
  if (
    target.role === WorkspaceMemberRole.OWNER &&
    actor.role !== WorkspaceMemberRole.OWNER
  ) {
    return NextResponse.json(
      { error: 'Only OWNER can change OWNER role' },
      { status: 403 },
    )
  }

  // Prevent removing last OWNER by accidental demotion
  if (
    target.role === WorkspaceMemberRole.OWNER &&
    body.role !== WorkspaceMemberRole.OWNER
  ) {
    const owners = await prisma.workspaceMember.count({
      where: {
        workspaceId: params.workspaceId,
        role: WorkspaceMemberRole.OWNER,
      },
    })
    if (owners <= 1) {
      return NextResponse.json(
        { error: 'Workspace must have at least one OWNER' },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: body.memberId },
    data: { role: body.role },
  })

  await logAudit({
    workspaceId: params.workspaceId,
    actorId: profile.id,
    action: 'MEMBER_ROLE_CHANGED',
    targetType: 'WorkspaceMember',
    targetId: body.memberId,
    meta: { role: body.role },
  })

  return NextResponse.json({ ok: true, member: updated })
}

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const actor = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: params.workspaceId,
      },
    },
  })
  if (!actor || !isManager(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const memberId = url.searchParams.get('memberId')
  if (!memberId)
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  })
  if (!target || target.workspaceId !== params.workspaceId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Only OWNER can remove an OWNER
  if (
    target.role === WorkspaceMemberRole.OWNER &&
    actor.role !== WorkspaceMemberRole.OWNER
  ) {
    return NextResponse.json(
      { error: 'Only OWNER can remove OWNER' },
      { status: 403 },
    )
  }

  // Prevent removing last OWNER
  if (target.role === WorkspaceMemberRole.OWNER) {
    const owners = await prisma.workspaceMember.count({
      where: {
        workspaceId: params.workspaceId,
        role: WorkspaceMemberRole.OWNER,
      },
    })
    if (owners <= 1) {
      return NextResponse.json(
        { error: 'Workspace must have at least one OWNER' },
        { status: 400 },
      )
    }
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } })
  await logAudit({
    workspaceId: params.workspaceId,
    actorId: profile.id,
    action: 'MEMBER_REMOVED',
    targetType: 'WorkspaceMember',
    targetId: memberId,
    meta: { role: target.role },
  })

  return NextResponse.json({ ok: true })
}
