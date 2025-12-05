import { prisma } from "@/lib/db"

export async function getUserPlan(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  })

  return sub?.plan ?? "basic"
}
