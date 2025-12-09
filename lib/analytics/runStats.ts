// lib/analytics/runStats.ts
import { prisma } from '@/lib/db'
import type {
  AutomationRunSummary,
  BasicRunStats,
  FailureCluster,
} from './types'

// Safely compute duration if finishedAt exists
function computeDurationMs(start: Date, end: Date | null): number | null {
  if (!end) return null
  return end.getTime() - start.getTime()
}

export async function getWorkspaceRunStats(
  workspaceId: string,
): Promise<BasicRunStats> {
  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    select: {
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  })

  const total = runs.length

  const success = runs.filter(
    (r: (typeof runs)[number]) => r.status === 'SUCCESS',
  ).length

  const failed = runs.filter(
    (r: (typeof runs)[number]) => r.status === 'FAILED',
  ).length

  const running = runs.filter(
    (r: (typeof runs)[number]) => r.status === 'RUNNING',
  ).length

  const pending = runs.filter(
    (r: (typeof runs)[number]) => r.status === 'PENDING',
  ).length

  const durations = runs
    .map((r: (typeof runs)[number]) =>
      computeDurationMs(r.startedAt, r.finishedAt),
    )
    .filter((x: number | null): x is number => x !== null)

  const avgDurationMs =
    durations.length > 0
      ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
      : 0

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

export async function getFailureClusters(
  workspaceId: string,
): Promise<FailureCluster[]> {
  const failures = await prisma.automationRun.findMany({
    where: {
      workspaceId,
      status: 'FAILED',
    },
    select: {
      log: true,
    },
  })

  const buckets = new Map<string, number>()

  for (const f of failures as { log: string | null }[]) {
    const reason = f.log ?? 'Unknown Error'
    const prev = buckets.get(reason) ?? 0
    buckets.set(reason, prev + 1)
  }

  return [...buckets.entries()].map(
    ([reason, count]: [string, number]): FailureCluster => ({
      reason,
      count,
    }),
  )
}

export async function getAutomationPerformanceGrid(
  workspaceId: string,
): Promise<AutomationRunSummary[]> {
  const automations = await prisma.automation.findMany({
    where: { workspaceId },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 50,
      },
    },
  })

  return automations.map((a): AutomationRunSummary => {
    const totalRuns = a.runs.length

    const successCount = a.runs.filter(
      (r: (typeof a.runs)[number]) => r.status === 'SUCCESS',
    ).length

    const durations = a.runs
      .map((r: (typeof a.runs)[number]) =>
        computeDurationMs(r.startedAt, r.finishedAt),
      )
      .filter((x: number | null): x is number => x !== null)

    const avgDuration =
      durations.length > 0
        ? durations.reduce((acc: number, x: number) => acc + x, 0) /
        durations.length
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
