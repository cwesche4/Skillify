"use client"

import { Card } from "@/components/ui/Card"
import type { BasicRunStats } from "@/lib/analytics/types"

export default function InsightsSummary({ stats }: { stats: BasicRunStats }) {
  const { total, success, failed, pending, running, successRate, avgDurationMs } = stats

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-neutral-text-primary text-lg font-semibold">Summary</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Total Runs" value={total} />
        <Stat label="Success" value={success} />
        <Stat label="Failed" value={failed} />
        <Stat label="Pending" value={pending} />
        <Stat label="Running" value={running} />

        <Stat
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          color={
            successRate >= 95
              ? "text-emerald-400"
              : successRate >= 80
                ? "text-sky-400"
                : "text-rose-400"
          }
        />

        <Stat
          label="Avg Duration"
          value={`${Math.round(avgDurationMs)} ms`}
          color="text-neutral-text-primary"
        />
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-neutral-text-secondary text-xs">{label}</span>
      <span className={`text-xl font-semibold ${color ?? ""}`}>{value}</span>
    </div>
  )
}
