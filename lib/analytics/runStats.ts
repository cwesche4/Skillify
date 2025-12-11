// lib/analytics/runStats.ts
import { prisma } from '@/lib/db'
import type {
  AutomationRunSummary,
  BasicRunStats,
  FailureCluster,
} from './types'

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function computeDurationMs(start: Date, end: Date | null): number | null {
  if (!end) return null
  return end.getTime() - start.getTime()
}

/* ------------------------------------------------------------
   1. Workspace Run Stats
------------------------------------------------------------ */

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

  type Run = (typeof runs)[number]

  const total = runs.length

  const success = runs.filter((r: Run) => r.status === 'SUCCESS').length
  const failed = runs.filter((r: Run) => r.status === 'FAILED').length
  const running = runs.filter((r: Run) => r.status === 'RUNNING').length
  const pending = runs.filter((r: Run) => r.status === 'PENDING').length

  const durations = runs
    .map((r: Run) => computeDurationMs(r.startedAt, r.finishedAt))
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

/* ------------------------------------------------------------
   2. Failure Clusters
------------------------------------------------------------ */

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

  type Failure = (typeof failures)[number]

  const buckets = new Map<string, number>()

  failures.forEach((f: Failure) => {
    const reason = f.log ?? 'Unknown Error'
    buckets.set(reason, (buckets.get(reason) ?? 0) + 1)
  })

  return [...buckets.entries()].map(
    ([reason, count]: [string, number]): FailureCluster => ({
      reason,
      count,
    }),
  )
}

/* ------------------------------------------------------------
   3. Automation Performance Grid
------------------------------------------------------------ */

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

  type Automation = (typeof automations)[number]
  type Run = Automation['runs'][number]

  return automations.map((a: Automation): AutomationRunSummary => {
    const totalRuns = a.runs.length

    const successCount = a.runs.filter(
      (r: Run) => r.status === 'SUCCESS',
    ).length

    const durations = a.runs
      .map((r: Run) => computeDurationMs(r.startedAt, r.finishedAt))
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
