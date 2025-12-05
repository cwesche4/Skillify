import { notFound, unauthorized } from "@/lib/api/responses"
import { getAuthUser } from "@/lib/auth/currentUser"
import { prisma } from "@/lib/db"

export async function requireWorkspace(workspaceId: string) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  })

  if (!membership) return notFound("Workspace not found.")

  return membership
}
