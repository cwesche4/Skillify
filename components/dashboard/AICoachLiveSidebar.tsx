'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { askAiCoach, type AiCoachMode } from '@/lib/ai/coach-client'

export function AICoachLiveSidebar({ workspaceId }: { workspaceId: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [mode, setMode] = useState<AiCoachMode>('insights')

  async function run() {
    if (!input.trim()) return
    setLoading(true)

    try {
      const res = await askAiCoach({
        workspaceId,
        question: input,
        mode,
      })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="hidden w-[360px] border-l border-neutral-border px-4 py-6 lg:block">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-brand-primary" />
        AI Coach
      </h2>

      {/* MODE SELECTOR */}
      <div className="mb-4 flex gap-2">
        {(['insights', 'optimize', 'explain'] as AiCoachMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-xs capitalize ${
              m === mode
                ? 'bg-brand-primary text-white'
                : 'bg-neutral-card-dark text-neutral-text-secondary border border-neutral-border'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* INPUT */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask something about performance, trends, or optimization…"
        className="bg-neutral-card-dark h-24 w-full rounded-md border border-neutral-border p-2 text-sm outline-none"
      />

      <button
        onClick={run}
        disabled={loading}
        className="mt-3 w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white"
      >
        {loading ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          'Ask AI Coach'
        )}
      </button>

      {/* RESULTS */}
      {result && (
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Answer</h3>
            <p className="text-neutral-text-secondary whitespace-pre-line text-sm">
              {result.answer}
            </p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Suggestions</h3>
            <ul className="text-neutral-text-secondary list-inside list-disc text-sm">
              {result.suggestions.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </aside>
  )
}
