import { prisma } from '@/lib/db'

//
// 1 — RUNS OVER TIME (30 days)
//
export async function getRunsOverTime(workspaceId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  // FIX: createdAt → startedAt
  const runs = await prisma.automationRun.groupBy({
    by: ['startedAt'],
    where: {
      workspaceId,
      startedAt: { gte: since },
    },
    _count: true,
  })

  const daily: Record<string, number> = {}

  // Build 30-day empty map
  for (let i = 0; i < 30; i++) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    daily[day.toISOString().slice(0, 10)] = 0
  }

  // Assign counts
  runs.forEach((run: { startedAt: Date; _count: number }) => {
    const date = run.startedAt.toISOString().slice(0, 10)
    if (daily[date] !== undefined) {
      daily[date] = run._count
    }
  })

  return Object.entries(daily)
    .map(([date, count]: [string, number]) => ({ date, runs: count }))
    .reverse()
}

//
// 2 — SUCCESS / FAIL BARCHART
//
export async function getSuccessFailBreakdown(workspaceId: string) {
  const stats = await prisma.automationRun.groupBy({
    by: ['status'],
    where: { workspaceId },
    _count: true,
  })

  return [
    {
      name: 'Runs',
      success:
        stats.find(
          (s: { status: string; _count: number }) => s.status === 'SUCCESS',
        )?._count ?? 0,
      failed:
        stats.find(
          (s: { status: string; _count: number }) => s.status === 'FAILED',
        )?._count ?? 0,
    },
  ]
}

//
// 3 — RELIABILITY HEATMAP MATRIX (10x10)
//
export async function getReliabilityHeatmap(workspaceId: string) {
  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    select: { startedAt: true, finishedAt: true },
    orderBy: { startedAt: 'desc' },
    take: 100,
  })

  // Compute durations
  const processed = runs.map(
    (run: { startedAt: Date; finishedAt: Date | null }) => ({
      durationMs:
        run.startedAt && run.finishedAt
          ? run.finishedAt.getTime() - run.startedAt.getTime()
          : 0,
    }),
  )

  const matrix = Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => 0),
  )

  processed.forEach((run: { durationMs: number }, i: number) => {
    const row = Math.floor(i / 10)
    const col = i % 10

    const normalized = Math.min(run.durationMs / 3000, 1)
    matrix[row][col] = normalized
  })

  return matrix
}
