// lib/analytics/trends.ts
import { prisma } from '@/lib/db'

/**
 * Unified trend type used across analytics.
 */
export interface RunTrendPoint {
  date: string // "2025-01-01"
  total: number // total runs that day
  success: number
  failed: number
  successRate: number // success percentage
}

/**
 * Compute daily trend points for analytics.
 */
export async function getRunTrendPoints(
  workspaceId: string,
): Promise<RunTrendPoint[]> {
  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    select: {
      status: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'asc' },
  })

  const buckets = new Map<
    string,
    { total: number; success: number; failed: number }
  >()

  for (const run of runs) {
    const date = run.startedAt.toISOString().split('T')[0]

    if (!buckets.has(date)) {
      buckets.set(date, { total: 0, success: 0, failed: 0 })
    }

    const bucket = buckets.get(date)!
    bucket.total++

    if (run.status === 'SUCCESS') bucket.success++
    else if (run.status === 'FAILED') bucket.failed++
  }

  const result: RunTrendPoint[] = []

  for (const [date, bucket] of buckets.entries()) {
    const successRate =
      bucket.total > 0 ? (bucket.success / bucket.total) * 100 : 0

    result.push({
      date,
      total: bucket.total,
      success: bucket.success,
      failed: bucket.failed,
      successRate,
    })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

// Alias export to match older imports
export { getRunTrendPoints as getTrendData }
