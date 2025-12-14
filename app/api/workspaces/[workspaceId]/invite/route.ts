import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'
import crypto from 'crypto'

function isManager(role: WorkspaceMemberRole) {
  return (
    role === WorkspaceMemberRole.OWNER || role === WorkspaceMemberRole.ADMIN
  )
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex')
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

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token, // keep for now; later you can omit once emailing is live
      expiresAt: i.expiresAt,
      acceptedAt: i.acceptedAt,
      createdAt: i.createdAt,
    })),
  })
}

export async function POST(
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
    email: string
    role?: WorkspaceMemberRole
    resendToken?: string
  }
  const email = body.email?.trim().toLowerCase()
  if (!email)
    return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const role = body.role ?? WorkspaceMemberRole.MEMBER

  // If user already a member (by matching UserProfile.email), block
  const existingUser = await prisma.userProfile.findFirst({ where: { email } })
  if (existingUser) {
    const already = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: existingUser.id,
          workspaceId: params.workspaceId,
        },
      },
    })
    if (already)
      return NextResponse.json(
        { error: 'User already a member' },
        { status: 409 },
      )
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Resend if pending invite exists
  const existingInvite = await prisma.workspaceInvite.findFirst({
    where: {
      workspaceId: params.workspaceId,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existingInvite) {
    const updated = await prisma.workspaceInvite.update({
      where: { id: existingInvite.id },
      data: {
        role,
        token: makeToken(),
        expiresAt,
      },
    })

    await logAudit({
      workspaceId: params.workspaceId,
      actorId: profile.id,
      action: 'INVITE_SENT',
      targetType: 'WorkspaceInvite',
      targetId: updated.id,
      meta: { email, role, action: 'resent' },
    })

    return NextResponse.json({ ok: true, invite: updated, action: 'resent' })
  }

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: params.workspaceId,
      email,
      role,
      token: makeToken(),
      expiresAt,
    },
  })

  await logAudit({
    workspaceId: params.workspaceId,
    actorId: profile.id,
    action: 'INVITE_SENT',
    targetType: 'WorkspaceInvite',
    targetId: invite.id,
    meta: { email, role, action: 'created' },
  })

  // NOTE: email sending can be added later (Resend/Postmark/etc). For now return token.
  return NextResponse.json({ ok: true, invite, action: 'created' })
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
      { error: 'Invite already accepted' },
      { status: 409 },
    )
  }

  await prisma.workspaceInvite.delete({ where: { id: inviteId } })
  return NextResponse.json({ ok: true })
}
