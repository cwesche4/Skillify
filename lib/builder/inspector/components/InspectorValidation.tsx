'use client'

import React, { useMemo } from 'react'
import { type ValidationGraph } from '@/lib/inspector/analytics/validationGraph'

type Props = {
  validationGraph: ValidationGraph | null | undefined
}

function InspectorValidationComponent({ validationGraph }: Props) {
  const { hasError, messages } = useMemo(() => {
    if (!validationGraph || !validationGraph.nodes.length) {
      return { hasError: false, messages: [] as string[] }
    }

    const hasIssue = validationGraph.nodes.some(
      (n) => n.state === 'error' || n.state === 'warn',
    )

    const allMessages = validationGraph.nodes.flatMap((n) => n.messages || [])

    return { hasError: hasIssue, messages: allMessages }
  }, [validationGraph])

  if (!validationGraph || !validationGraph.nodes.length) return null

  return (
    <div
      className={`rounded-lg border bg-slate-950/70 text-[11px] text-slate-200 shadow-sm ${
        hasError
          ? 'space-y-2 border-rose-500/40 p-3 ring-1 ring-rose-500/20'
          : 'border-emerald-500/20 px-3 py-2'
      }`}
    >
      {!hasError ? (
        <div className="flex items-center gap-2 text-emerald-200">
          <span className="text-[11px] font-semibold">Ready</span>
          <span className="text-[11px] text-emerald-200/80">
            No setup issues
          </span>
        </div>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">
            Setup issues
          </p>
          <ul className="space-y-1 rounded border border-rose-500/30 bg-rose-500/5 px-2 py-2 text-rose-300">
            {messages.map((msg) => (
              <li key={msg}>• {msg}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export const InspectorValidationSection = React.memo(
  InspectorValidationComponent,
)
