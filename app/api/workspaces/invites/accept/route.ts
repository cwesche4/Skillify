// app/api/workspaces/invites/accept/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = (await req.json()) as { token: string }
  if (!body.token)
    return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token: body.token },
  })

  if (!invite)
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.acceptedAt)
    return NextResponse.json(
      { error: 'Invite already accepted' },
      { status: 409 },
    )
  if (invite.expiresAt <= new Date())
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // If invite email doesn't match profile email, we still allow acceptance (some users differ)
  // You can tighten this later if you want.

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: invite.workspaceId,
      },
    },
    update: { role: invite.role },
    create: {
      userId: profile.id,
      workspaceId: invite.workspaceId,
      role: invite.role,
    },
  })

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  })

  const workspace = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
  })

  await logAudit({
    workspaceId: invite.workspaceId,
    actorId: profile.id,
    action: 'INVITE_ACCEPTED',
    targetType: 'WorkspaceInvite',
    targetId: invite.id,
    meta: { email: invite.email, role: invite.role },
  })

  return NextResponse.json({
    ok: true,
    workspace: workspace
      ? { id: workspace.id, slug: workspace.slug, name: workspace.name }
      : null,
  })
}
