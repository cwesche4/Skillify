// components/dashboard/AiCoachLivePanel.tsx
"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { analyzeTrends } from "@/lib/analytics/aiAnnotations"

import { AnomalyDetector } from "@/components/dashboard/ai-coach/AnomalyDetector"
import { CostOptimizer } from "@/components/dashboard/ai-coach/CostOptimizer"
import { FlowImprover } from "@/components/dashboard/ai-coach/FlowImprover"
import { PerformanceSummary } from "@/components/dashboard/ai-coach/PerformanceSummary"

type Anomaly = {
  id: string
  severity: "low" | "medium" | "high"
  message: string
  time: string
}

type CoachSnapshot = {
  successRate: number
  trend: number
  avgDurationMs: number
  failedRuns: number
  monthlyCostUsd: number
  topExpensive: { automation: string; monthlyCostUsd: number }[]
  slowNodes: { node: string; avgDurationMs: number }[]
  anomalies: Anomaly[]
}

interface AiCoachLivePanelProps {
  workspaceId: string
  initialSuccessRate: number
  initialIssues: number
}

export function AiCoachLivePanel({
  workspaceId,
  initialSuccessRate,
  initialIssues,
}: AiCoachLivePanelProps) {
  const [loading, setLoading] = useState(true)

  const [successRate, setSuccessRate] = useState(initialSuccessRate)
  const [trend, setTrend] = useState(0)
  const [issues, setIssues] = useState(initialIssues)

  const [avgDuration, setAvgDuration] = useState<string>("—")
  const [monthlyCost, setMonthlyCost] = useState<string>("—")

  const [topExpensive, setTopExpensive] = useState<
    { automation: string; cost: string }[]
  >([])

  const [slowNodes, setSlowNodes] = useState<{ node: string; duration: string }[]>([])

  const [anomalies, setAnomalies] = useState<Anomaly[]>([])

  // Derived AI text insights
  const insights = useMemo(
    () =>
      analyzeTrends({
        successRate,
        trend,
      }),
    [successRate, trend],
  )

  useEffect(() => {
    let active = true

    async function loadSnapshot() {
      try {
        // You can later replace this with your real endpoint
        const res = await fetch(`/api/workspaces/${workspaceId}/coach/live`, {
          cache: "no-store",
        })

        if (!res.ok) {
          setLoading(false)
          return
        }

        const data: CoachSnapshot = await res.json()

        if (!active) return

        setSuccessRate(data.successRate)
        setTrend(data.trend)
        setIssues(data.failedRuns)

        setAvgDuration(`${Math.round(data.avgDurationMs)} ms`)
        setMonthlyCost(`$${data.monthlyCostUsd.toFixed(2)}/mo`)

        setTopExpensive(
          (data.topExpensive ?? []).map((item) => ({
            automation: item.automation,
            cost: `$${item.monthlyCostUsd.toFixed(2)}/mo`,
          })),
        )

        setSlowNodes(
          (data.slowNodes ?? []).map((n) => ({
            node: n.node,
            duration: `${Math.round(n.avgDurationMs)} ms`,
          })),
        )

        setAnomalies(data.anomalies ?? [])
      } catch (err) {
        // For now we just swallow; you can log to Sentry later
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    // Initial load + 15s polling
    loadSnapshot()
    const id = window.setInterval(loadSnapshot, 15_000)

    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [workspaceId])

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-neutral-text-primary text-lg font-semibold">
            AI Coach Live
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Real-time health, cost, and anomaly analysis for this workspace.
          </p>
        </div>

        <Badge variant="blue">{loading ? "Syncing…" : "Live"}</Badge>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1.8fr,1.2fr]">
        <div className="space-y-4">
          <PerformanceSummary
            healthScore={Math.round(successRate)}
            successRate={`${successRate.toFixed(1)}%`}
            avgDuration={avgDuration}
            issues={issues}
            recommendations={insights}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <CostOptimizer
              monthlyCost={monthlyCost}
              topExpensive={topExpensive}
              suggestions={[
                "Reduce frequency for non-critical flows.",
                "Batch low-priority jobs during off-peak hours.",
                "Consolidate duplicate AI calls into shared utilities.",
              ]}
            />
            <FlowImprover
              slowNodes={slowNodes}
              suggestions={[
                "Move slow nodes later in the flow where possible.",
                "Cache heavy AI responses that are reused frequently.",
                "Split long-running branches into separate background flows.",
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <AnomalyDetector anomalies={anomalies} />

          <Card className="card-analytics p-4">
            <p className="text-neutral-text-secondary text-xs font-medium uppercase tracking-wide">
              Coach Summary
            </p>
            <ul className="text-neutral-text-secondary mt-2 space-y-1.5 text-xs">
              {insights.map((insight, idx) => (
                <li key={idx}>• {insight}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}
