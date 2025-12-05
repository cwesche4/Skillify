// app/api/workspaces/[workspaceId]/activity/route.ts
import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

export async function GET(_: Request, { params }: any) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const { workspaceId } = params

  // TODO: optionally enforce membership, but for now assume dashboard routes are protected
  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    include: {
      automation: true,
      userProfile: true,
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return ok(runs)
}
