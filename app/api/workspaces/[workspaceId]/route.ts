import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { deleteWorkspaceCascade } from '@/lib/workspaces/deleteWorkspace'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'

async function getDeletionContext(workspaceId: string, clerkId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      members: {
        where: { userId: profile.id },
        select: { id: true, role: true, userId: true },
        take: 1,
      },
    },
  })
  if (!workspace) return { profile, workspace: null, membership: null }
  return {
    profile,
    workspace,
    membership: workspace.members[0] ?? null,
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getDeletionContext(params.workspaceId, userId)
  if (!context?.profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  if (!context.workspace) {
    return NextResponse.json(
      {
        error: 'workspaceNotFound',
        message: 'Workspace was not found.',
      },
      { status: 404 },
    )
  }

  if (
    typeof body.confirmation !== 'string' ||
    body.confirmation.trim() !== context.workspace.name
  ) {
    return NextResponse.json(
      {
        error: 'confirmationMismatch',
        message: `Type ${context.workspace.name} to confirm workspace deletion.`,
      },
      { status: 400 },
    )
  }

  if (
    !context.membership ||
    context.membership.role !== WorkspaceMemberRole.OWNER ||
    context.workspace.ownerId !== context.profile.id
  ) {
    return NextResponse.json(
      {
        error: 'ownerRequired',
        message:
          'Only the workspace Owner can permanently delete this workspace.',
      },
      { status: 403 },
    )
  }

  try {
    await logAudit({
      workspaceId: params.workspaceId,
      actorId: context.profile.id,
      action: 'WORKSPACE_DELETE_REQUESTED',
      targetType: 'Workspace',
      targetId: params.workspaceId,
      meta: { name: context.workspace.name, slug: context.workspace.slug },
    })

    await prisma.$transaction(async (tx) => {
      await deleteWorkspaceCascade(tx as any, params.workspaceId)
    })

    const nextMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: context.profile.id,
        workspaceId: { not: params.workspaceId },
        workspace: { archivedAt: null },
      },
      select: { workspace: { select: { slug: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      ok: true,
      redirectTo: nextMembership?.workspace?.slug
        ? `/dashboard/${nextMembership.workspace.slug}`
        : '/onboarding/create-workspace',
    })
  } catch (err) {
    console.error('Workspace delete failed', {
      workspaceId: params.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      {
        error: 'workspaceDeleteFailed',
        message: 'Workspace could not be deleted. No local card was removed.',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: params.workspaceId, user: { clerkId: userId } },
    select: { role: true, userId: true },
  })

  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { id: true, name: true, archivedAt: true },
    })
    if (!existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }
      data.name = name
    }
    if (typeof body.businessName === 'string') {
      data.businessName = body.businessName.trim() || null
    }
    if (typeof body.industry === 'string') {
      data.industry = body.industry.trim() || null
    }
    if (body.action === 'archive') {
      if (!existingWorkspace.archivedAt) {
        data.archivedAt = new Date()
      }
    }
    if (body.action === 'restore') {
      if (existingWorkspace.archivedAt) {
        data.archivedAt = null
      }
    }

    if (Object.keys(data).length === 0) {
      if (body.action === 'archive' || body.action === 'restore') {
        const workspace = await (prisma.workspace as any).findUnique({
          where: { id: params.workspaceId },
        })
        return NextResponse.json({ ok: true, workspace, idempotent: true })
      }
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 },
      )
    }

    const workspace = await (prisma.workspace as any).update({
      where: { id: params.workspaceId },
      data,
    })
    await logAudit({
      workspaceId: params.workspaceId,
      actorId: membership.userId,
      action:
        body.action === 'archive'
          ? 'WORKSPACE_ARCHIVED'
          : body.action === 'restore'
            ? 'WORKSPACE_RESTORED'
            : 'WORKSPACE_UPDATED',
      targetType: 'Workspace',
      targetId: params.workspaceId,
      meta: { name: workspace.name },
    })
    let redirectTo: string | null = null
    if (body.action === 'archive') {
      const nextMembership = await prisma.workspaceMember.findFirst({
        where: {
          userId: membership.userId,
          workspaceId: { not: params.workspaceId },
          workspace: { archivedAt: null },
        },
        select: { workspace: { select: { slug: true } } },
        orderBy: { createdAt: 'asc' },
      })
      redirectTo = nextMembership?.workspace?.slug
        ? `/dashboard/${nextMembership.workspace.slug}`
        : '/onboarding/create-workspace'
    }
    return NextResponse.json({ ok: true, workspace, redirectTo })
  } catch (err) {
    console.error('Workspace update failed', err)
    return NextResponse.json(
      { error: 'Failed to update workspace' },
      { status: 500 },
    )
  }
}
