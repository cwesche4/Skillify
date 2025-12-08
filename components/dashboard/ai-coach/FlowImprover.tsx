// components/dashboard/ai-coach/FlowImprover.tsx
'use client'

import { Workflow, Wand2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface FlowImproverProps {
  slowNodes: { node: string; duration: string }[]
  suggestions: string[]
}

export function FlowImprover({ slowNodes, suggestions }: FlowImproverProps) {
  return (
    <Card className="card-analytics">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg text-white">
          AI Coach – Flow Improver
        </h3>
        <Badge variant="green">Live Analysis</Badge>
      </div>

      <p className="text-neutral-text-secondary mb-2 text-xs">
        Slowest nodes in your flow:
      </p>
      <div className="mb-4 space-y-2">
        {slowNodes.map((n) => (
          <div
            key={n.node}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
          >
            <span className="text-sm text-white">{n.node}</span>
            <span className="text-neutral-text-secondary text-xs">
              {n.duration}
            </span>
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
            <Wand2 className="mt-0.5 h-4 w-4 text-indigo-400" />
            <p className="text-neutral-text-secondary text-xs">{s}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
