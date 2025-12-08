'use client'

import { CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface PerformanceSummaryProps {
  healthScore: number
  successRate: string
  avgDuration: string
  issues: number
  recommendations: string[]
}

export function PerformanceSummary({
  healthScore,
  successRate,
  avgDuration,
  issues,
  recommendations,
}: PerformanceSummaryProps) {
  const srNumber = Number(successRate.replace('%', ''))

  return (
    <Card className="card-analytics p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-heading text-lg text-white">
          AI Coach – Performance Summary
        </h3>
        <Badge
          variant={
            healthScore > 80 ? 'green' : healthScore > 50 ? 'blue' : 'red'
          }
        >
          {healthScore}% Health
        </Badge>
      </div>

      {/* METRICS GRID */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {/* SUCCESS RATE UPDATED BLOCK */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-neutral-text-secondary mb-1 text-xs">
            Success Rate
          </p>

          <div className="flex items-end justify-between">
            <p className="font-heading text-2xl text-white">{successRate}</p>

            {/* Color Dot */}
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                srNumber >= 85
                  ? 'bg-emerald-400'
                  : srNumber >= 60
                    ? 'bg-amber-400'
                    : 'bg-rose-400',
              )}
            />
          </div>

          {/* Bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: successRate }}
            />
          </div>
        </div>

        {/* AVG DURATION */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-neutral-text-secondary mb-1 text-xs">
            Avg. Duration
          </p>
          <p className="font-heading text-2xl text-white">{avgDuration}</p>
        </div>

        {/* ISSUES */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-neutral-text-secondary mb-1 text-xs">
            Issues Detected
          </p>
          <p className="font-heading text-2xl text-white">{issues}</p>
        </div>
      </div>

      {/* RECOMMENDATIONS */}
      <div className="space-y-2">
        <p className="text-neutral-text-primary text-sm font-medium">
          AI Recommendations
        </p>

        {recommendations.map((rec, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
            <p className="text-neutral-text-secondary">{rec}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
