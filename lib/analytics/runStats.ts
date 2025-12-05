// lib/analytics/runStats.ts

import { prisma } from "@/lib/db"
import type { AutomationRunSummary, BasicRunStats, FailureCluster } from "./types"

// Safely compute duration if finishedAt exists
function computeDurationMs(start: Date, end: Date | null): number | null {
  if (!end) return null
  return end.getTime() - start.getTime()
}

export async function getWorkspaceRunStats(workspaceId: string): Promise<BasicRunStats> {
  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    select: {
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  })

  const total = runs.length
  const success = runs.filter((r) => r.status === "SUCCESS").length
  const failed = runs.filter((r) => r.status === "FAILED").length
  const running = runs.filter((r) => r.status === "RUNNING").length
  const pending = runs.filter((r) => r.status === "PENDING").length

  const durations = runs
    .map((r) => computeDurationMs(r.startedAt, r.finishedAt))
    .filter((x): x is number => x !== null)

  const avgDurationMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

  const successRate = total > 0 ? (success / total) * 100 : 0

  return {
    total,
    success,
    failed,
    pending,
    running,
    successRate,
    avgDurationMs,
  }
}

export async function getFailureClusters(workspaceId: string): Promise<FailureCluster[]> {
  // Your schema does NOT include errorMessage, so we cannot select it.
  // Instead, we fallback to grouping by FAILED logs.
  const failures = await prisma.automationRun.findMany({
    where: {
      workspaceId,
      status: "FAILED",
    },
    select: {
      log: true, // This is what your schema has
    },
  })

  const buckets = new Map<string, number>()

  for (const f of failures) {
    const reason = f.log ?? "Unknown Error"
    buckets.set(reason, (buckets.get(reason) ?? 0) + 1)
  }

  return [...buckets.entries()].map(([reason, count]) => ({
    reason,
    count,
  }))
}

export async function getAutomationPerformanceGrid(
  workspaceId: string,
): Promise<AutomationRunSummary[]> {
  const automations = await prisma.automation.findMany({
    where: { workspaceId },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 50,
      },
    },
  })

  return automations.map((a) => {
    const totalRuns = a.runs.length
    const successCount = a.runs.filter((r) => r.status === "SUCCESS").length

    const durations = a.runs
      .map((r) => computeDurationMs(r.startedAt, r.finishedAt))
      .filter((x): x is number => x !== null)

    const avgDuration =
      durations.length > 0
        ? durations.reduce((acc, x) => acc + x, 0) / durations.length
        : 0

    return {
      automationId: a.id,
      automationName: a.name,
      totalRuns,
      successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
      avgDurationMs: avgDuration,
      lastRunAt: a.runs[0]?.startedAt ?? null,
    }
  })
}
