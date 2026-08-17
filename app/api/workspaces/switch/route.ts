import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

function safeError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

export async function GET() {
  const { userId } = auth()
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: profile.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    workspaces: workspaces.map((m) => ({
      id: m.workspace.id,
      slug: m.workspace.slug,
      name: m.workspace.name,
      role: m.role,
    })),
  })
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return safeError('Unauthorized', 401, 'UNAUTHORIZED')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return safeError('Choose a workspace to continue.', 400, 'INVALID_REQUEST')
  }

  const workspaceId =
    typeof (body as any)?.workspaceId === 'string'
      ? (body as any).workspaceId.trim()
      : ''
  const workspaceSlug =
    typeof (body as any)?.workspaceSlug === 'string'
      ? (body as any).workspaceSlug.trim()
      : typeof (body as any)?.slug === 'string'
        ? (body as any).slug.trim()
        : ''

  if (!workspaceId && !workspaceSlug) {
    return safeError(
      'Choose a workspace to continue.',
      400,
      'WORKSPACE_REQUIRED',
    )
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      user: { clerkId: userId },
      workspace: {
        ...(workspaceId ? { id: workspaceId } : {}),
        ...(workspaceSlug ? { slug: workspaceSlug } : {}),
      },
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          archivedAt: true,
        },
      },
    },
  })

  if (!membership?.workspace) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Skillify][workspace-switch] denied', {
        condition: 'WORKSPACE_MEMBERSHIP_NOT_FOUND',
        workspaceId: workspaceId || null,
        workspaceSlug: workspaceSlug || null,
      })
    }
    return safeError(
      'You do not have access to that workspace.',
      403,
      'WORKSPACE_ACCESS_DENIED',
    )
  }

  if (membership.workspace.archivedAt) {
    return safeError(
      'That workspace is archived and cannot be opened.',
      409,
      'WORKSPACE_ARCHIVED',
    )
  }

  return NextResponse.json({
    ok: true,
    redirectTo: `/dashboard/${membership.workspace.slug}`,
    workspace: {
      id: membership.workspace.id,
      slug: membership.workspace.slug,
      name: membership.workspace.name,
      role: membership.role,
    },
  })
}
