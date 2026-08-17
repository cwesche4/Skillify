import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import { WorkspaceMemberRole } from '@prisma/client'

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string; memberId: string } },
) {
  const { role } = await req.json()

  await requireWorkspaceRole(params.workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])

  if (role === WorkspaceMemberRole.OWNER) {
    throw new Error('Cannot promote to OWNER')
  }

  await prisma.workspaceMember.update({
    where: { id: params.memberId },
    data: { role },
  })

  return NextResponse.json({ success: true })
}
