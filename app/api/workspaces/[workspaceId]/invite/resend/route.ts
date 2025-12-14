import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole } from '@/lib/auth/requireWorkspaceRole'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import crypto from 'crypto'

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({}, { status: 401 })

  await requireWorkspaceRole(userId, params.workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])

  const { email, role } = await req.json()

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: params.workspaceId,
      email,
      role,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  })

  // TODO: send email via Resend / Postmark

  return NextResponse.json(invite)
}
