// components/dashboard/ai-coach/ExplainPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface ExplainPanelProps {
  workspaceId: string
  question?: string
  runId?: string | null
}

export function ExplainPanel({
  workspaceId,
  question,
  runId,
}: ExplainPanelProps) {
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string>('')

  useEffect(() => {
    if (!question && !runId) return
    setLoading(true)

    void (async () => {
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mode: 'explain',
          runId,
          question: question ?? 'Explain the recent automation behavior.',
        }),
      })

      const json = await res.json()
      setAnswer(json.answer)
      setLoading(false)
    })()
  }, [question, runId, workspaceId])

  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Explain Mode</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing…
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed">{answer}</p>
      )}
    </div>
  )
}
