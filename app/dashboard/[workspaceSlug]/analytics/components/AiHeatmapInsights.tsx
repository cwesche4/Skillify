'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

export default function AiHeatmapInsights({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch('/api/ai/heatmap-insights', {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      })
      const data = await res.json()
      setInsights(data.insights ?? [])
      setLoading(false)
    }
    load()
  }, [workspaceId])

  return (
    <Card className="mb-8 p-5">
      <h3 className="mb-3 text-sm font-semibold">AI Heatmap Insights</h3>

      {loading ? (
        <p className="text-neutral-text-secondary text-xs">
          Loading AI insights…
        </p>
      ) : insights.length === 0 ? (
        <p className="text-neutral-text-secondary text-xs">
          No insights available yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {insights.map((i, idx) => (
            <li key={idx} className="text-sm">
              • {i}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
