import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: { automationId: string; runId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const url = new URL(req.url)
  const cursor = url.searchParams.get("cursor")
  const cursorDate = cursor ? new Date(cursor) : null

  const events = await prisma.automationRunEvent.findMany({
    where: {
      runId: params.runId,
      createdAt: cursorDate ? { gt: cursorDate } : undefined,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  })

  const nextCursor =
    events.length > 0 ? events[events.length - 1]?.createdAt.toISOString() : cursor

  return ok({ events, nextCursor })
}
