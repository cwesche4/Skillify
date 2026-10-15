// app/api/workspaces/invites/accept/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

const ACCEPTABLE_INVITE_ROLES = new Set(['ADMIN', 'MANAGER', 'MEMBER'])

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as { token?: unknown }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token)
    return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // If invite email doesn't match profile email, we still allow acceptance (some users differ)
  // You can tighten this later if you want.

  const acceptedAt = new Date()
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const invite = await tx.workspaceInvite.findUnique({ where: { token } })
      if (!invite) return { status: 'not_found' as const }
      if (invite.acceptedAt) return { status: 'accepted' as const }
      if (invite.expiresAt <= acceptedAt) return { status: 'expired' as const }
      if (!ACCEPTABLE_INVITE_ROLES.has(invite.role)) {
        return { status: 'invalid_role' as const }
      }

      const existingMembership = await tx.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: profile.id,
            workspaceId: invite.workspaceId,
          },
        },
      })
      if (existingMembership) {
        return { status: 'already_member' as const }
      }

      const claim = await tx.workspaceInvite.updateMany({
        where: {
          id: invite.id,
          workspaceId: invite.workspaceId,
          token,
          role: invite.role,
          acceptedAt: null,
          expiresAt: { gt: acceptedAt },
        },
        data: { acceptedAt },
      })
      if (claim.count !== 1) return { status: 'stale' as const }

      await tx.workspaceMember.create({
        data: {
          userId: profile.id,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
      })
      return { status: 'accepted_now' as const, invite }
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Already a workspace member' },
        { status: 409 },
      )
    }
    throw error
  }

  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (result.status === 'accepted') {
    return NextResponse.json(
      { error: 'Invite already accepted' },
      { status: 409 },
    )
  }
  if (result.status === 'expired') {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }
  if (result.status === 'invalid_role') {
    return NextResponse.json(
      { error: 'Invitation role is no longer supported' },
      { status: 409 },
    )
  }
  if (result.status === 'already_member') {
    return NextResponse.json(
      { error: 'Already a workspace member' },
      { status: 409 },
    )
  }
  if (result.status === 'stale') {
    return NextResponse.json(
      { error: 'Invite is no longer available' },
      { status: 409 },
    )
  }
  const { invite } = result

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
