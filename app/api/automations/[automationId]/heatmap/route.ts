// app/api/automations/[automationId]/heatmap/route.ts
import { fail, ok } from '@/lib/api/responses'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

async function getRequestContext() {
  const [{ auth }, { prisma }] = await Promise.all([
    import('@clerk/nextjs/server'),
    import('@/lib/db'),
  ])
  const { userId } = await auth()
  return { userId, prisma }
}

export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId, prisma } = await getRequestContext()
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
  events.forEach((e: any) => {
    map[e.nodeId] = e._count.nodeId
  })

  return ok({ heatmap: map })
}
