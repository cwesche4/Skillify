// app/dashboard/analytics/page.tsx

import AutomationPerformanceGrid from "@/components/dashboard/analytics/AutomationPerformanceGrid"
import FailureBreakdown from "@/components/dashboard/analytics/FailureBreakdown"
import InsightsSummary from "@/components/dashboard/analytics/InsightsSummary"

import { DashboardShell } from "@/components/dashboard/DashboardShell"

import { prisma } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"

import {
  getAutomationPerformanceGrid,
  getFailureClusters,
  getWorkspaceRunStats,
} from "@/lib/analytics/runStats"

import { getRunTrendPoints } from "@/lib/analytics/trends"
import type { WorkspaceAnalyticsBundle } from "@/lib/analytics/types"

import { LineChart } from "@/components/charts/LineChart"
import { Sparkline } from "@/components/charts/Sparkline"

type AnalyticsPageProps = {
  searchParams: { workspace?: string }
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const workspaceSlug = searchParams.workspace

  if (!workspaceSlug) {
    return (
      <DashboardShell>
        <h1 className="h2 mb-2">Analytics</h1>
        <p className="text-neutral-text-secondary text-sm">
          Select a workspace to view analytics.
        </p>
      </DashboardShell>
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace Not Found</h1>
      </DashboardShell>
    )
  }

  // =====================================================
  // FETCH ANALYTICS
  // =====================================================
  const [stats, failures, grid, trends] = await Promise.all([
    getWorkspaceRunStats(workspace.id),
    getFailureClusters(workspace.id),
    getAutomationPerformanceGrid(workspace.id),
    getRunTrendPoints(workspace.id),
  ])

  const bundle: WorkspaceAnalyticsBundle = {
    stats,
    failures,
    grid,
    trends,
  }

  // Convert RunTrendPoint → chart formats
  const lineData = bundle.trends.map((t) => ({
    label: t.date,
    value: t.successRate,
  }))

  const sparkData = bundle.trends.map((t) => ({
    label: t.date,
    value: t.total,
  }))

  // =====================================================
  // RENDER PAGE
  // =====================================================
  return (
    <DashboardShell>
      <section className="mb-8 space-y-1">
        <h1 className="text-neutral-text-primary text-3xl font-semibold">Analytics</h1>
        <p className="text-neutral-text-secondary text-sm">
          Workspace: <span className="font-medium">{workspace.name}</span>
        </p>
      </section>

      <InsightsSummary stats={bundle.stats} />

      {/* =========================== */}
      {/* RUN TRENDS */}
      {/* =========================== */}
      <section className="mt-12">
        <h2 className="text-neutral-text-primary mb-3 text-lg font-semibold">
          Run Trends Over Time
        </h2>

        <div className="bg-neutral-card-light dark:bg-neutral-card-dark rounded-xl border border-neutral-border p-5">
          <LineChart data={lineData} label="Success Rate (%)" />
        </div>

        <div className="bg-neutral-card-light dark:bg-neutral-card-dark mt-6 rounded-xl border border-neutral-border p-5">
          <h3 className="text-neutral-text-secondary mb-2 text-sm font-medium">
            Total Runs (Sparkline)
          </h3>

          <Sparkline data={sparkData} />
        </div>
      </section>

      {/* FAILURES */}
      <section className="mt-12">
        <FailureBreakdown failures={bundle.failures} />
      </section>

      {/* PERFORMANCE GRID */}
      <section className="mt-12">
        <AutomationPerformanceGrid items={bundle.grid} />
      </section>
    </DashboardShell>
  )
}
