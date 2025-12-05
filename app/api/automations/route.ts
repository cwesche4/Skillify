// app/api/automations/route.ts
import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { prisma } from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const user = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!user) return fail("User not found", 404)

  const automations = await prisma.automation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  return ok(automations)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const user = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!user) return fail("User not found", 404)

  const body = await req.json()
  const { name, workspaceId } = body as { name: string; workspaceId: string }

  if (!name || !workspaceId) return fail("Missing fields", 400)

  const automation = await prisma.automation.create({
    data: {
      name,
      userId: user.id,
      workspaceId,
      status: "INACTIVE",
    },
  })

  return ok(automation)
}
