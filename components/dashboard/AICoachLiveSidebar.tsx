"use client"

import { Badge } from "@/components/ui/Badge"
import { useEffect, useState } from "react"

type Insight = {
  id: string
  message: string
  severity: "info" | "warning" | "critical"
}

export function AICoachLiveSidebar() {
  const [insights, setInsights] = useState<Insight[]>([])

  // Polling or WebSocket connection
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/coach/live")
      const data = await res.json()
      setInsights(data.insights || [])
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="bg-neutral-card-light/40 dark:bg-neutral-card-dark/20 hidden w-80 flex-col space-y-5 border-l border-neutral-border p-5 backdrop-blur-xl xl:flex">
      <h2 className="text-neutral-text-primary text-lg font-semibold">AI Coach Live</h2>

      {insights.length === 0 && (
        <p className="text-neutral-text-secondary text-sm">No active insights.</p>
      )}

      {insights.map((insight) => (
        <div
          key={insight.id}
          className="bg-neutral-card-dark/30 rounded-xl border border-neutral-border p-4"
        >
          <Badge
            variant={
              insight.severity === "info"
                ? "blue"
                : insight.severity === "warning"
                  ? "default"
                  : "red"
            }
            className="mb-2"
          >
            {insight.severity.toUpperCase()}
          </Badge>

          <p className="text-neutral-text-primary text-sm">{insight.message}</p>
        </div>
      ))}
    </aside>
  )
}
