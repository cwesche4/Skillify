import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member'
type RoleInput = WorkspaceRole | Uppercase<WorkspaceRole>

function normalizeRole(role: RoleInput) {
  return role.toLowerCase() as WorkspaceRole
}

// RBAC.
// Server-authoritative permissions.
// UI never grants access.
export async function requireWorkspaceRole(
  workspaceIdOrUserId: string,
  workspaceIdOrAllowed: string | RoleInput[],
  maybeAllowed?: RoleInput[],
) {
  const { userId } = auth()
  if (!userId) return { allowed: false, status: 401 }

  const workspaceId =
    typeof workspaceIdOrAllowed === 'string'
      ? workspaceIdOrAllowed
      : workspaceIdOrUserId
  const allowed =
    typeof workspaceIdOrAllowed === 'string'
      ? (maybeAllowed ?? [])
      : workspaceIdOrAllowed

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
    select: { role: true },
  })

  const role = membership?.role?.toLowerCase() as WorkspaceRole | undefined
  const allowedSet = new Set(allowed.map(normalizeRole))
  if (!role || !allowedSet.has(role)) {
    return { allowed: false, status: 403 }
  }

  return { allowed: true, role, userId }
}
