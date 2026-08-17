'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'

type AiCoachMode = 'insights' | 'optimize' | 'explain'

type AiCoachResponse = {
  answer: string
  mode: AiCoachMode
  suggestions: string[]
}

const starterPrompts = [
  'What should I automate first?',
  'How can I organize my clients better?',
  'What reports should I review weekly?',
  'How can I save time this week?',
  'What workflows should this business build next?',
]

export function WorkspaceAiCoachChat({ workspaceId }: { workspaceId: string }) {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<AiCoachResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function askCoach(nextQuestion = question) {
    const trimmed = nextQuestion.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          question: trimmed,
          mode: 'optimize',
        }),
      })

      if (!res.ok) {
        throw new Error('AI Coach request failed')
      }

      const json = (await res.json()) as AiCoachResponse
      setResponse(json)
      setQuestion(trimmed)
    } catch {
      setError('AI Coach is unavailable right now. Try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="ai-coach-question"
          className="text-sm font-semibold text-neutral-100"
        >
          Ask your AI Coach
        </label>
        <textarea
          id="ai-coach-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask your AI Coach how to improve this workspace..."
          rows={5}
          className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-3 w-full resize-none rounded-xl border border-neutral-border bg-slate-950/50 p-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void askCoach()}
          loading={loading}
          disabled={!question.trim()}
        >
          Ask Coach
        </Button>
        <span className="text-neutral-text-secondary text-[11px]">
          Uses workspace-scoped context only.
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Starter prompts
        </p>
        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setQuestion(prompt)
                void askCoach(prompt)
              }}
              className="text-neutral-text-secondary hover:border-brand-primary/50 rounded-full border border-neutral-border bg-white/[0.03] px-3 py-1.5 text-xs transition hover:text-neutral-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-border bg-slate-950/40 p-4">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Coach response
        </p>

        {error ? (
          <p className="mt-3 text-sm text-rose-200">{error}</p>
        ) : response ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm leading-6 text-neutral-100">
              {response.answer}
            </p>
            {response.suggestions.length > 0 ? (
              <ul className="text-neutral-text-secondary space-y-2 text-sm">
                {response.suggestions.map((suggestion) => (
                  <li key={suggestion} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-neutral-text-secondary mt-3 text-sm">
            Ask a question to generate workspace-specific guidance.
          </p>
        )}
      </div>
    </div>
  )
}
