// app/api/ai-coach/performance/route.ts
import { RunStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  const where = workspaceId ? { workspaceId } : {}

  const [totalRuns, successfulRuns, failedRuns, recentRuns] = await prisma.$transaction([
    prisma.automationRun.count({ where }),
    prisma.automationRun.count({
      where: { ...where, status: RunStatus.SUCCESS },
    }),
    prisma.automationRun.count({
      where: { ...where, status: RunStatus.FAILED },
    }),
    prisma.automationRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 50,
      select: { startedAt: true, finishedAt: true },
    }),
  ])

  const successRate = totalRuns === 0 ? 0 : (successfulRuns / totalRuns) * 100

  const durations = recentRuns
    .map((r) => (r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null))
    .filter((v): v is number => v !== null)

  const avgDurationMs =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)

  const healthScore = Math.max(
    0,
    Math.min(100, Math.round(successRate - failedRuns * 0.5)),
  )

  return NextResponse.json({
    healthScore,
    successRate,
    avgDurationMs,
    totalRuns,
    failedRuns,
  })
}
