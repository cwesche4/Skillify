// app/api/workspaces/[workspaceId]/route.ts
import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"
import { canManageWorkspace } from "@/lib/permissions/workspace"

interface Params {
  params: {
    workspaceId: string
  }
}

export async function GET(_: Request, { params }: Params) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
  })

  if (!workspace) return fail("Workspace not found", 404)

  return ok(workspace)
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const { workspaceId } = params
  const body = await req.json()
  const { name } = body as { name?: string }

  if (!name || name.trim().length < 3) {
    return fail("Workspace name must be at least 3 characters.", 400)
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
  })

  if (!membership || !canManageWorkspace(membership.role)) {
    return fail("Only OWNER or ADMIN can update workspace.", 403)
  }

  const slug = name.toLowerCase().trim().replace(/\s+/g, "-")

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: name.trim(),
      slug,
    },
  })

  return ok(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const { workspaceId } = params

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
  })

  if (!membership || membership.role !== "OWNER") {
    return fail("Only the OWNER can delete this workspace.", 403)
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  })

  return ok({ deleted: true })
}
