// app/dashboard/automations/[automationId]/page.tsx
"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"

export default function AutomationDetailPage({ params }: any) {
  const { automationId } = params
  const [automation, setAutomation] = useState<any | null>(null)

  const fetchAutomation = () => {
    fetch(`/api/automations/${automationId}`)
      .then((res) => res.json())
      .then((data) => setAutomation(data.data))
  }

  useEffect(() => {
    fetchAutomation()
  }, [automationId])

  const runNow = () => {
    fetch(`/api/automations/${automationId}/run`, { method: "POST" }).then(
      fetchAutomation,
    )
  }

  if (!automation) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h2">{automation.name}</h1>
          <p className="body">Status: {automation.status}</p>
        </div>
        <Button onClick={runNow}>Run now</Button>
      </div>

      <div className="card">
        <h2 className="h3 mb-4">Recent Runs</h2>
        {automation.runs.length === 0 && <p>No runs yet.</p>}

        {automation.runs.map((run: any) => (
          <div
            key={run.id}
            className="flex items-center justify-between border-b border-slate-800 py-3 last:border-none"
          >
            <div>
              <div className="font-medium">
                Run started: {new Date(run.startedAt).toLocaleString()}
              </div>
              {run.log && (
                <div className="text-neutral-text-secondary mt-1 text-sm">{run.log}</div>
              )}
            </div>
            <Badge>{run.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
