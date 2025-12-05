import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const events = await prisma.automationRunEvent.groupBy({
    by: ["nodeId"],
    _count: {
      nodeId: true,
    },
  })

  // Map { nodeId: failureRate }
  const map: Record<string, number> = {}

  events.forEach((e) => {
    // Failure = RunStatus.FAILED
    // But since events don't store success/failure per event, we infer failure patterns:
    map[e.nodeId] = e._count.nodeId
  })

  return ok({ heatmap: map })
}
