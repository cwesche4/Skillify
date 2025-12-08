// app/api/automations/[automationId]/heatmap/route.ts
import { auth } from '@clerk/nextjs/server'
import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const { automationId } = params

  const events = await prisma.automationRunEvent.groupBy({
    by: ['nodeId'],
    where: {
      run: {
        automationId,
      },
    },
    _count: {
      nodeId: true,
    },
  })

  const map: Record<string, number> = {}
  events.forEach((e) => {
    map[e.nodeId] = e._count.nodeId
  })

  return ok({ heatmap: map })
}
