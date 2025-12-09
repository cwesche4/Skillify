// lib/analytics/liveCoach.ts
import { prisma } from '@/lib/db'

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7

export type LiveCoachSnapshot = {
  successRate: number
  trend: number
  avgDurationMs: number
  failedRuns: number

  monthlyCostUsd: number
  topExpensive: { automation: string; monthlyCostUsd: number }[]

  slowNodes: { node: string; avgDurationMs: number }[]

  anomalies: {
    id: string
    severity: 'low' | 'medium' | 'high'
    message: string
    time: string
  }[]
}

export async function getLiveCoachSnapshot(
  workspaceId: string,
): Promise<LiveCoachSnapshot> {
  const now = Date.now()
  const window30 = new Date(now - THIRTY_DAYS)
  const window7 = new Date(now - SEVEN_DAYS)

  const runsLast30 = await prisma.automationRun.findMany({
    where: {
      workspaceId,
      startedAt: { gte: window30 },
    },
    select: {
      id: true,
      automationId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  })

  if (!runsLast30.length) {
    return {
      successRate: 0,
      trend: 0,
      avgDurationMs: 0,
      failedRuns: 0,
      monthlyCostUsd: 0,
      topExpensive: [],
      slowNodes: [],
      anomalies: [],
    }
  }

  // ✅ Fix implicit any in map()
  const withDurations = runsLast30.map((r: (typeof runsLast30)[number]) => {
    const durationMs =
      r.startedAt && r.finishedAt
        ? r.finishedAt.getTime() - r.startedAt.getTime()
        : 0
    return { ...r, durationMs }
  })

  const total = withDurations.length

  // ✅ Fix implicit any in filter()
  const successes = withDurations.filter(
    (r: (typeof withDurations)[number]) => r.status === 'SUCCESS',
  ).length

  const failed = total - successes

  const successRate = total > 0 ? (successes / total) * 100 : 0

  // ✅ Fix implicit any in filter()
  const last7 = withDurations.filter(
    (r: (typeof withDurations)[number]) => r.startedAt >= window7,
  )

  const prev7 = withDurations.filter((r: (typeof withDurations)[number]) => {
    return (
      r.startedAt < window7 && r.startedAt >= new Date(now - 2 * SEVEN_DAYS)
    )
  })

  const last7Rate = last7.length
    ? (last7.filter((r: (typeof last7)[number]) => r.status === 'SUCCESS')
      .length /
      last7.length) *
    100
    : successRate

  const prev7Rate = prev7.length
    ? (prev7.filter((r: (typeof prev7)[number]) => r.status === 'SUCCESS')
      .length /
      prev7.length) *
    100
    : successRate

  const trend = last7Rate - prev7Rate

  // ✅ Fix reduce implicit any
  const avgDurationMs = Math.round(
    withDurations.reduce(
      (sum: number, r: (typeof withDurations)[number]) =>
        sum + (r.durationMs ?? 0),
      0,
    ) / total,
  )

  const totalCostUsd = 0
  const topExpensive: { automation: string; monthlyCostUsd: number }[] = []
  const slowNodes: { node: string; avgDurationMs: number }[] = []

  const anomalies: LiveCoachSnapshot['anomalies'] = []

  // ---------- Anomaly rules ----------
  if (trend < -10) {
    anomalies.push({
      id: 'trend_drop',
      severity: 'medium',
      message: 'Success rate sharply decreased this week.',
      time: new Date().toISOString(),
    })
  }

  if (avgDurationMs > 3000) {
    anomalies.push({
      id: 'slow_average',
      severity: 'medium',
      message: 'Average run duration is high (>3s).',
      time: new Date().toISOString(),
    })
  }

  if (failed > successes) {
    anomalies.push({
      id: 'fail_domination',
      severity: 'high',
      message: 'More failures than successes in the last 30 days.',
      time: new Date().toISOString(),
    })
  }

  return {
    successRate,
    trend,
    avgDurationMs,
    failedRuns: failed,
    monthlyCostUsd: totalCostUsd,
    topExpensive,
    slowNodes,
    anomalies,
  }
}
