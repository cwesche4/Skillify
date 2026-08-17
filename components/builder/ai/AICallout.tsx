'use client'

import type { AICallout as Callout } from '@/lib/ai/coach/types'

interface AICalloutProps {
  callout: Callout
}

const KIND_STYLES: Record<Callout['kind'], string> = {
  bottleneck: 'border-amber-400/60 bg-amber-500/10 text-amber-50',
  failure: 'border-rose-400/60 bg-rose-500/10 text-rose-50',
  optimization: 'border-cyan-400/60 bg-cyan-500/10 text-cyan-50',
}

export default function AICallout({ callout }: AICalloutProps) {
  return (
    <div
      className="pointer-events-none absolute -translate-y-4 translate-x-3"
      style={{ left: callout.position.x, top: callout.position.y }}
    >
      <div
        className={`pointer-events-auto min-w-[160px] max-w-[260px] rounded-lg border px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur ${KIND_STYLES[callout.kind]}`}
      >
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-100/80">
          <span>AI Coach</span>
          <span className="text-[9px] text-slate-200/70">
            {labelFor(callout.kind)}
          </span>
        </div>
        <div>{callout.message}</div>
      </div>
    </div>
  )
}

function labelFor(kind: Callout['kind']) {
  if (kind === 'bottleneck') return 'Bottleneck'
  if (kind === 'failure') return 'Failure cause'
  return 'Optimization'
}
