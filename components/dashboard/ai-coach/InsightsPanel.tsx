// components/dashboard/ai-coach/InsightsPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface InsightsProps {
  workspaceId: string
}

export function InsightsPanel({ workspaceId }: InsightsProps) {
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    setLoading(true)
    void (async () => {
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mode: 'insights',
          question:
            'Give me performance insights and trend anomalies for this workspace.',
        }),
      })

      const json = await res.json()
      setAnswer(json.answer)
      setLoading(false)
    })()
  }, [workspaceId])

  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Workspace Insights</h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gathering insights…
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm">{answer}</p>
      )}
    </div>
  )
}
