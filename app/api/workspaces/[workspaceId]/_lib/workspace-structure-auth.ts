import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { classifyWorkspaceStructureError } from '@/lib/workspaceStructure/apiErrors'
import type { WorkspaceStructureActor } from '@/lib/workspaceStructure/teams'

export async function getWorkspaceStructureActor(
  workspaceId: string,
): Promise<WorkspaceStructureActor | NextResponse> {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json(
      {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Sign in to manage workspace Teams and Locations.',
      },
      { status: 401 },
    )
  }

  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile) {
    return NextResponse.json(
      {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Profile not found.',
      },
      { status: 404 },
    )
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId,
      },
    },
    select: { role: true },
  })
  if (!membership) {
    return NextResponse.json(
      {
        ok: false,
        code: 'FORBIDDEN',
        message:
          'You do not have permission to manage workspace Teams or Locations.',
      },
      { status: 403 },
    )
  }

  return {
    workspaceId,
    actorUserId: profile.id,
    canManageWorkspace:
      membership.role === 'OWNER' || membership.role === 'ADMIN',
  }
}

export function isWorkspaceStructureResponse(
  value: WorkspaceStructureActor | NextResponse,
): value is NextResponse {
  return value instanceof Response
}

export function workspaceStructureErrorResponse(error: unknown) {
  const result = classifyWorkspaceStructureError(error)
  if (result.logCode) {
    console.error('[workspace-structure]', {
      code: result.logCode,
      status: result.status,
    })
  }
  return NextResponse.json(result.payload, { status: result.status })
}
