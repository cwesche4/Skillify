// app/api/automations/route.ts
import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { createAutomationSchema } from '@/lib/validations/automation'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const user = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!user) return fail('User not found', 404)

  const automations = await prisma.automation.findMany({
    where: {
      workspace: {
        members: { some: { userId: user.id } },
      },
      simpleAutomationInstallation: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(automations)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const user = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!user) return fail('User not found', 404)

  const parsed = createAutomationSchema.safeParse(
    await req.json().catch(() => null),
  )
  if (!parsed.success) return fail('Invalid automation data', 400)

  const { name, workspaceId, description } = parsed.data
  const access = await authorizeWorkspaceAccess({
    workspaceId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const automation = await prisma.automation.create({
    data: {
      name,
      userId: access.userProfileId,
      workspaceId,
      description: description ?? null,
      status: 'INACTIVE',
    },
  })

  await logAudit({
    workspaceId,
    actorId: access.userProfileId,
    action: 'AUTOMATION_CREATED',
    targetType: 'Automation',
    targetId: automation.id,
    meta: { name },
  })

  return ok(automation)
}
