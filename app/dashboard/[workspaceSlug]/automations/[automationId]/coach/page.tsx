'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface CoachResponse {
  summary: string
  stats: {
    totalRuns?: number
    failedRuns?: number
    successRuns?: number
    hotNodes?: { nodeId: string; count: number }[]
  }
  suggestions: string[]
}

export default function AutomationCoachPage() {
  const params = useParams<{ automationId: string }>()

  const [data, setData] = useState<CoachResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/ai/coach/automation/${params.automationId}/summary`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error ?? 'Unable to load AI Coach.')
          return
        }
        setData(json.data)
      })
      .catch(() => setError('Unable to load AI Coach.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h2">AI Coach</h1>
          <p className="text-sm text-slate-400">
            Performance insights and optimization suggestions for this
            automation.
          </p>
        </div>
        <Button variant="subtle" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <p className="text-sm text-slate-400">Analyzing…</p>}

      {data && (
        <>
          <div className="card">
            <p className="text-sm text-slate-200">{data.summary}</p>
          </div>

          <div className="grid-3">
            <div className="card-stat">
              <span className="text-xs text-slate-400">Total runs</span>
              <span className="text-2xl font-semibold">
                {data.stats.totalRuns ?? 0}
              </span>
            </div>
            <div className="card-stat">
              <span className="text-xs text-slate-400">Success</span>
              <span className="text-2xl font-semibold text-green-400">
                {data.stats.successRuns ?? 0}
              </span>
            </div>
            <div className="card-stat">
              <span className="text-xs text-slate-400">Failed</span>
              <span className="text-2xl font-semibold text-red-400">
                {data.stats.failedRuns ?? 0}
              </span>
            </div>
          </div>

          {data.stats.hotNodes && data.stats.hotNodes.length > 0 && (
            <div className="card">
              <h2 className="h4 mb-2">Failure hotspots</h2>
              <div className="flex flex-wrap gap-2">
                {data.stats.hotNodes.map((n) => (
                  <Badge key={n.nodeId} size="sm" variant="red">
                    {n.nodeId} • {n.count} failures
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.suggestions.length > 0 && (
            <div className="card">
              <h2 className="h4 mb-2">Suggestions</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {data.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
