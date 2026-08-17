// app/api/workspaces/[workspaceId]/invites/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { canManageWorkspaceMembers } from '@/lib/workspaces/workspaceRoles'

function isManager(role: WorkspaceMemberRole) {
  return canManageWorkspaceMembers(role)
}

function serializePendingInvite(invite: {
  id: string
  email: string
  role: WorkspaceMemberRole
  expiresAt: Date
  createdAt: Date
}) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.expiresAt <= new Date() ? 'expired' : 'pending',
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  }
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

  const invites = await prisma.workspaceInvite.findMany({
    where: {
      workspaceId: params.workspaceId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invites: invites.map(serializePendingInvite),
  })
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
  const inviteId = url.searchParams.get('inviteId')
  if (!inviteId)
    return NextResponse.json({ error: 'inviteId required' }, { status: 400 })

  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  })
  if (!invite || invite.workspaceId !== params.workspaceId) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.acceptedAt) {
    return NextResponse.json(
      { error: 'Accepted invitations cannot be canceled.' },
      { status: 409 },
    )
  }

  await prisma.workspaceInvite.delete({ where: { id: inviteId } })
  return NextResponse.json({ ok: true })
}
