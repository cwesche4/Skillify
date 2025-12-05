"use client"

import { Card } from "@/components/ui/Card"
import type { AutomationRunSummary } from "@/lib/analytics/types"

export default function AutomationPerformanceGrid({
  items,
}: {
  items: AutomationRunSummary[]
}) {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-neutral-text-primary text-lg font-semibold">
        Automation Performance
      </h2>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-text-secondary border-b border-neutral-border text-left">
              <th className="py-2">Automation</th>
              <th>Total Runs</th>
              <th>Success Rate</th>
              <th>Avg Duration</th>
              <th>Last Run</th>
            </tr>
          </thead>

          <tbody>
            {items.map((row) => (
              <tr
                key={row.automationId}
                className="border-neutral-border/60 border-b last:border-none"
              >
                <td className="py-2 font-medium">{row.automationName}</td>
                <td>{row.totalRuns}</td>
                <td
                  className={`${
                    row.successRate >= 95
                      ? "text-emerald-400"
                      : row.successRate >= 80
                        ? "text-sky-400"
                        : "text-rose-400"
                  }`}
                >
                  {row.successRate.toFixed(1)}%
                </td>
                <td>{Math.round(row.avgDurationMs)} ms</td>
                <td>{row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
