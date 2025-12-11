'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

interface Props {
  workspaceId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export default function AiCoachInsightsWidget({ workspaceId }: Props) {
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)

  async function askCoach() {
    try {
      setLoading(true)
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          question: 'Give me insights into my Skillify workspace performance.',
          mode: 'insights',
        }),
      })

      if (!res.ok) {
        setAnswer('AI Coach is unavailable right now.')
        setLoading(false)
        return
      }

      const json = await res.json()
      setAnswer(
        json.answer ?? 'AI Coach responded, but no answer text was returned.',
      )
    } catch {
      setAnswer('Failed to reach AI Coach.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-sm font-medium">AI Coach Insights</h3>
      <p className="text-neutral-text-secondary text-xs">
        Ask AI Coach for a quick performance summary of this workspace.
      </p>

      <button
        type="button"
        className="hover:bg-brand-primary/90 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white"
        onClick={askCoach}
        disabled={loading}
      >
        {loading ? 'Thinking…' : 'Ask AI Coach'}
      </button>

      {answer && (
        <p className="text-neutral-text-secondary whitespace-pre-wrap text-xs leading-relaxed">
          {answer}
        </p>
      )}
    </Card>
  )
}
