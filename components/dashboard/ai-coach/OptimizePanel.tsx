// components/dashboard/ai-coach/OptimizePanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface OptimizeProps {
  workspaceId: string
  automationId?: string | null
}

export function OptimizePanel({ workspaceId, automationId }: OptimizeProps) {
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!automationId) return
    setLoading(true)

    void (async () => {
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mode: 'optimize',
          automationId,
          question: 'How can I improve this automation?',
        }),
      })

      const json = await res.json()
      setAnswer(json.answer)
      setLoading(false)
    })()
  }, [workspaceId, automationId])

  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-semibold">Optimization Suggestions</h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Evaluating flow…
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed">{answer}</p>
      )}
    </div>
  )
}
