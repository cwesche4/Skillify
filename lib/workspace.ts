// lib/workspace.ts
import { auth } from "@clerk/nextjs/server"

import { notFound } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

/**
 * Resolve the current workspace from:
 * - URL search param (?workspace=slug)
 * - User's primary workspace fallback
 */
export async function getActiveWorkspace(req: Request) {
  const { userId } = await auth()
  if (!userId) return null

  const url = new URL(req.url)
  const slug = url.searchParams.get("workspace")

  // --- CASE 1: URL contains slug ----
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

    if (!membership) return null

    return ws
  }

  // --- CASE 2: fallback to primary workspace ---
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      memberships: {
        include: {
          workspace: true,
        },
        orderBy: { createdAt: "asc" }, // first workspace
      },
    },
  })

  return profile?.memberships?.[0]?.workspace ?? null
}

/**
 * Get all workspaces a user belongs to.
 */
export async function getUserWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { user: { clerkId: userId } },
    include: {
      workspace: true,
    },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Get a workspace and check if user is a member.
 */
export async function getWorkspaceIfMember(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
    include: {
      workspace: true,
    },
  })

  return membership?.workspace ?? null
}

/**
 * Authorization helper
 */
export function assertWorkspaceExists(ws: any) {
  if (!ws) throw notFound("Workspace not found.")
  return ws
}
