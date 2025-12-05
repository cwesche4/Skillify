import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const runs = await prisma.automationRun.findMany({
    where: { automationId: params.automationId },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return ok({ runs })
}
