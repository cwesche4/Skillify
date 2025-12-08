// components/command-center/useAiCoach.ts
'use client'

import { useState } from 'react'

type AiCoachMode = 'explain' | 'optimize' | 'insights'

interface AiCoachContextSummary {
  workspaceId: string
  workspaceName: string
  automationCount: number
  recentRunCount: number
  successRate: number | null
}

interface AiCoachResponseBody {
  answer: string
  context: AiCoachContextSummary
  suggestions: string[]
}

export function useAiCoach(workspaceId: string | null) {
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<AiCoachContextSummary | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  async function ask(question: string, mode: AiCoachMode = 'explain') {
    if (!workspaceId) {
      setError('No active workspace selected.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, question, mode }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed with status ${res.status}`)
      }

      const data = (await res.json()) as AiCoachResponseBody
      setAnswer(data.answer)
      setContext(data.context)
      setSuggestions(data.suggestions)
    } catch (err) {
      console.error(err)
      setError('Something went wrong asking AI Coach.')
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    answer,
    error,
    context,
    suggestions,
    ask,
  }
}
