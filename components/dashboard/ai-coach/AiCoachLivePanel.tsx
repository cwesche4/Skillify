// components/dashboard/ai-coach/AiCoachLivePanel.tsx
"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import type { LiveCoachSnapshot } from "@/lib/analytics/liveCoach"
import { useEffect, useState } from "react"

type AiCoachLivePanelProps = {
  workspaceId: string
}

export function AiCoachLivePanel({ workspaceId }: AiCoachLivePanelProps) {
  const [data, setData] = useState<LiveCoachSnapshot | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    const url = `/api/workspaces/${workspaceId}/coach/live/stream`
    const es = new EventSource(url)

    es.addEventListener("snapshot", (event) => {
      const message = event as MessageEvent
      try {
        const parsed: LiveCoachSnapshot = JSON.parse(message.data)
        setData(parsed)
        setConnected(true)
      } catch (error) {
        console.error("AI Coach SSE parse error", error)
      }
    })

    es.addEventListener("error", () => {
      setConnected(false)
      // Let browser retry; if you want manual backoff, you can close & reopen here.
    })

    return () => {
      es.close()
    }
  }, [workspaceId])

  if (!data) {
    return (
      <Card className="text-neutral-text-secondary p-4 text-xs">
        Connecting to AI Coach Live…
      </Card>
    )
  }

  const {
    successRate,
    trend,
    avgDurationMs,
    failedRuns,
    monthlyCostUsd,
    topExpensive,
    slowNodes,
    anomalies,
  } = data

  const trendTone =
    trend > 5 ? "text-emerald-300" : trend < -5 ? "text-rose-300" : "text-slate-300"

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-neutral-text-primary text-sm font-semibold">
            AI Coach – Live Overview
          </h2>
          <p className="text-neutral-text-secondary text-[11px]">
            Streaming live metrics from your last 30 days of runs.
          </p>
        </div>
        <Badge variant={connected ? "green" : "red"}>
          {connected ? "Live" : "Disconnected"}
        </Badge>
      </div>

      {/* Top line metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-neutral-text-secondary mb-1 text-[11px]">Success rate</p>
          <p className="text-neutral-text-primary text-xl font-semibold">
            {successRate.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-neutral-text-secondary mb-1 text-[11px]">
            Trend (vs last week)
          </p>
          <p className={`text-xl font-semibold ${trendTone}`}>
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-neutral-text-secondary mb-1 text-[11px]">Avg. duration</p>
          <p className="text-neutral-text-primary text-xl font-semibold">
            {(avgDurationMs / 1000).toFixed(2)}s
          </p>
        </div>

        <div>
          <p className="text-neutral-text-secondary mb-1 text-[11px]">
            Failed runs (30d)
          </p>
          <p className="text-xl font-semibold text-rose-300">{failedRuns}</p>
        </div>
      </div>

      {/* Cost + expensive automations */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-neutral-text-primary text-xs font-medium">
              Estimated monthly AI cost
            </p>
          </div>
          <p className="text-neutral-text-primary text-2xl font-semibold">
            ${monthlyCostUsd.toFixed(2)}
          </p>
          <p className="text-neutral-text-secondary mt-1 text-[11px]">
            Based on token/call cost stored on each run.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-neutral-text-primary mb-2 text-xs font-medium">
            Top expensive automations
          </p>
          {topExpensive.length === 0 && (
            <p className="text-neutral-text-secondary text-[11px]">No cost data yet.</p>
          )}
          <ul className="space-y-1 text-[11px] text-slate-200">
            {topExpensive.map((item) => (
              <li key={item.automation} className="flex items-center justify-between">
                <span className="truncate pr-2">{item.automation}</span>
                <span className="text-slate-300">${item.monthlyCostUsd.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Slow nodes + anomalies */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-neutral-text-primary mb-2 text-xs font-medium">
            Slowest nodes
          </p>
          {slowNodes.length === 0 && (
            <p className="text-neutral-text-secondary text-[11px]">
              No node-level timing data yet.
            </p>
          )}
          <ul className="space-y-1 text-[11px] text-slate-200">
            {slowNodes.map((node) => (
              <li key={node.node} className="flex items-center justify-between">
                <span className="truncate pr-2">{node.node}</span>
                <span className="text-slate-300">
                  {(node.avgDurationMs / 1000).toFixed(2)}s
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-neutral-text-primary mb-2 text-xs font-medium">
            Detected anomalies
          </p>
          {anomalies.length === 0 && (
            <p className="text-neutral-text-secondary text-[11px]">
              No anomalies detected. You’re in the green.
            </p>
          )}
          <ul className="space-y-1 text-[11px] text-slate-200">
            {anomalies.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5">
                <span
                  className={
                    a.severity === "high"
                      ? "text-rose-300"
                      : a.severity === "medium"
                        ? "text-amber-300"
                        : "text-slate-200"
                  }
                >
                  {a.message}
                </span>
                <span className="text-neutral-text-secondary text-[10px]">
                  {new Date(a.time).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
