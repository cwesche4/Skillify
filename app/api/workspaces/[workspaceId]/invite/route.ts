import crypto from 'crypto'

import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/lib/permissions/workspace'
import { inviteUserSchema } from '@/lib/validations/workspace'

// Create a Workspace Invite
export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { workspaceId } = params

  // Validate body
  const body = await req.json()
  const parsed = inviteUserSchema.safeParse(body)
  if (!parsed.success) return fail('Invalid invite data', 400)

  const email = parsed.data.email.toLowerCase().trim()
  const role = parsed.data.role

  // 1. Ensure requester is a member
  const requesterMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { clerkId: userId },
    },
    include: {
      user: true,
    },
  })

  if (!requesterMembership)
    return fail('Workspace not found or unauthorized', 403)

  // 2. Ensure requester has permission to invite users
  if (!canManageWorkspace(requesterMembership.role)) {
    return fail('Only workspace OWNER or ADMIN can invite members', 403)
  }

  // 3. Ensure user is not already a member
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: email } },
  })

  if (existingMember) {
    return fail('User is already a member of this workspace', 400)
  }

  // 4. Ensure invite does not already exist
  const existingInvite = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, email },
  })

  if (existingInvite && !existingInvite.acceptedAt) {
    return fail('An active invite already exists for this email', 400)
  }

  // 5. Create a secure invite token
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2) // 2 days

  const invite = await prisma.workspaceInvite.create({
    data: {
      email,
      role,
      workspaceId,
      token,
      expiresAt,
    },
  })

  return ok({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    token: invite.token,
  })
}
