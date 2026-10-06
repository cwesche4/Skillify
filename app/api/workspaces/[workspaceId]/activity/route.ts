// app/api/workspaces/[workspaceId]/activity/route.ts
import { fail, ok } from '@/lib/api/responses'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: any) {
  const { workspaceId } = params
  const access = await authorizeWorkspaceAccess({
    workspaceId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    include: {
      automation: true,
      userProfile: true,
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  return ok(runs)
}
