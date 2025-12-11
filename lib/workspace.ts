// lib/workspace.ts
import { auth } from '@clerk/nextjs/server'
import { prisma } from './db'
import { notFound } from '@/lib/api/responses'

/**
 * Resolve the active workspace for the current request.
 * - First checks ?workspace=slug
 * - Falls back to user's first workspace
 */
export async function getActiveWorkspace(req: Request) {
  const { userId } = auth()
  if (!userId) return null

  const url = new URL(req.url)
  const slug = url.searchParams.get('workspace')

  // CASE 1 — URL includes ?workspace=slug
  if (slug) {
    const ws = await prisma.workspace.findUnique({
      where: { slug },
    })

    if (!ws) return null

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: ws.id,
        user: { clerkId: userId },
      },
    })

    return membership ? ws : null
  }

  // CASE 2 — fallback to user's first workspace
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return profile?.memberships?.[0]?.workspace ?? null
}

/**
 * Get all workspaces a user belongs to
 */
export async function getUserWorkspaces(clerkId: string) {
  return prisma.workspaceMember.findMany({
    where: { user: { clerkId } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Get a workspace only if the user is a valid member
 */
export async function getWorkspaceIfMember(
  workspaceId: string,
  clerkId: string,
) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId },
    },
    include: { workspace: true },
  })

  return membership?.workspace ?? null
}

/**
 * Ensure workspace exists, throw API 404 otherwise
 */
export function assertWorkspaceExists(ws: any) {
  if (!ws) throw notFound('Workspace not found.')
  return ws
}

/**
 * Workspace Stats:
 * - membersCount
 * - automationsCount
 * - recentRuns (last 20)
 */
export async function getWorkspaceStats(slug: string) {
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      members: true,
      automations: {
        include: { runs: true },
      },
    },
  })

  if (!ws) return null

  return {
    membersCount: ws.members.length,
    automationsCount: ws.automations.length,
    recentRuns: ws.automations.flatMap((a: any) => a.runs).slice(0, 20),
  }
}
