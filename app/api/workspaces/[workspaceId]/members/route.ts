// app/api/workspaces/[workspaceId]/members/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'
import {
  removeWorkspaceMemberSafely,
  updateWorkspaceMemberRoleSafely,
  WorkspaceMemberMutationError,
} from '@/lib/workspaces/memberMutations'
import {
  canManageOperations,
  normalizeWorkspaceRole,
} from '@/lib/workspaces/workspaceRoles'

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

  if (!canManageOperations(membership.role)) {
    const member = await prisma.workspaceMember.findUnique({
      where: { id: membership.id },
      select: { id: true, user: { select: { fullName: true } } },
    })
    return NextResponse.json({
      members: member
        ? [{ id: member.id, fullName: member.user.fullName }]
        : [],
    })
  }

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

  const body = (await req.json().catch(() => ({}))) as {
    memberId?: string
    role?: WorkspaceMemberRole
  }
  if (typeof body.memberId !== 'string' || !body.memberId.trim()) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  }
  const requestedRole = normalizeWorkspaceRole(body.role)
  if (!requestedRole) {
    return NextResponse.json(
      { error: `Unsupported workspace role: ${String(body.role)}` },
      { status: 400 },
    )
  }

  let updated
  try {
    ;({ member: updated } = await updateWorkspaceMemberRoleSafely({
      workspaceId: params.workspaceId,
      actorUserId: profile.id,
      targetMemberId: body.memberId,
      requestedRole,
    }))
  } catch (error) {
    if (error instanceof WorkspaceMemberMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }
    throw error
  }

  await logAudit({
    workspaceId: params.workspaceId,
    actorId: profile.id,
    action: 'MEMBER_ROLE_CHANGED',
    targetType: 'WorkspaceMember',
    targetId: body.memberId,
    meta: { role: requestedRole },
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

  const url = new URL(req.url)
  const memberId = url.searchParams.get('memberId')
  if (!memberId)
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  let target
  try {
    ;({ target } = await removeWorkspaceMemberSafely({
      workspaceId: params.workspaceId,
      actorUserId: profile.id,
      targetMemberId: memberId,
    }))
  } catch (error) {
    if (error instanceof WorkspaceMemberMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }
    throw error
  }
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
