// app/api/automations/[automationId]/heatmap/route.ts
import { fail, ok } from '@/lib/api/responses'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { automationId } = params
  const access = await authorizeAutomationAccess({
    automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const events = await prisma.automationRunEvent.groupBy({
    by: ['nodeId'],
    where: {
      run: {
        automationId,
        workspaceId: access.automation.workspaceId,
      },
    },
    _count: {
      nodeId: true,
    },
  })

  const map: Record<string, number> = {}
  events.forEach((e: any) => {
    map[e.nodeId] = e._count.nodeId
  })

  return ok({ heatmap: map })
}
