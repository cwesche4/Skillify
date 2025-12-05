// app/dashboard/workspaces/[workspaceId]/activity/page.tsx
"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/Badge"
import { formatDate } from "@/lib/formatting/dates"

export default function WorkspaceActivityPage({ params }: any) {
  const { workspaceId } = params
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/activity`)
      .then((res) => res.json())
      .then((data) => setRuns(data.data))
      .finally(() => setLoading(false))
  }, [workspaceId])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h1 className="h2 mb-4">Workspace Activity</h1>
      <div className="card">
        {runs.length === 0 && <p>No recent activity.</p>}

        {runs.map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between border-b border-slate-800 py-3 last:border-none"
          >
            <div>
              <div className="font-medium">
                Automation{" "}
                <span className="text-brand-primary">{run.automation.name}</span>
              </div>
              <div className="text-neutral-text-secondary text-sm">
                Status: {run.status} · Started: {formatDate(run.startedAt)}
              </div>
            </div>
            <Badge>{run.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
