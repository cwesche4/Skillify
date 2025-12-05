// components/dashboard/ai-coach/CostOptimizer.tsx
"use client"

import { DollarSign, ArrowDownCircle } from "lucide-react"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"

interface CostOptimizerProps {
  monthlyCost: string
  topExpensive: { automation: string; cost: string }[]
  suggestions: string[]
}

export function CostOptimizer({
  monthlyCost,
  topExpensive,
  suggestions,
}: CostOptimizerProps) {
  return (
    <Card className="card-analytics">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg text-white">AI Coach – Cost Optimizer</h3>
        <Badge variant="blue">Monthly: {monthlyCost}</Badge>
      </div>

      <p className="text-neutral-text-secondary mb-3 text-xs">
        Automations with the highest token spend:
      </p>

      <div className="mb-4 space-y-2">
        {topExpensive.map((item) => (
          <div
            key={item.automation}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 p-2"
          >
            <span className="text-sm text-white">{item.automation}</span>
            <span className="text-neutral-text-secondary text-xs">{item.cost}</span>
          </div>
        ))}
      </div>

      <p className="text-neutral-text-secondary mb-2 text-xs font-medium">
        AI Suggestions
      </p>

      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3"
          >
            <ArrowDownCircle className="mt-0.5 h-4 w-4 text-sky-400" />
            <p className="text-neutral-text-secondary text-xs">{s}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
