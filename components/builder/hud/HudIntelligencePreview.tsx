import { useMemo, useState } from 'react'
import type { HudAiBadge, HudAiHint } from '@/lib/hud/intelligence/aiBridge'

type HudIntelligencePreviewProps = {
  enabled: boolean
}

const mockHints: (HudAiHint & {
  score: number
  category: 'Reliability' | 'Performance' | 'Layout'
  basis?: string
})[] = [
  {
    id: 'layout-balance',
    title: 'Tighten layout spacing',
    description: 'Try auto-layout on the current selection to reduce overlaps.',
    badges: [{ id: 'layout', label: 'Layout', kind: 'info' } as HudAiBadge],
    score: 0.82,
    category: 'Layout',
    basis: 'Based on layout heuristics',
  },
  {
    id: 'navigation-focus',
    title: 'Focus canvas',
    description: 'You are zoomed out; refocus to regain detail.',
    badges: [{ id: 'nav', label: 'Navigation', kind: 'info' } as HudAiBadge],
    score: 0.68,
    category: 'Performance',
    basis: 'Based on navigation activity',
  },
  {
    id: 'ai-coach-stability',
    title: 'AI Coach: node stability',
    description:
      'Recent runs show retries on “Webhook #3”. Consider adding backoff.',
    badges: [
      { id: 'ai', label: 'AI Coach', kind: 'warning' } as HudAiBadge,
      { id: 'reliability', label: 'Reliability', kind: 'info' } as HudAiBadge,
    ],
    score: 0.61,
    category: 'Reliability',
    basis: 'Based on recent failures',
  },
  {
    id: 'docking',
    title: 'Dock HUD',
    description: 'Fullscreen detected—docking keeps controls stable.',
    badges: [{ id: 'docking', label: 'Docking', kind: 'info' } as HudAiBadge],
    score: 0.54,
    category: 'Layout',
    basis: 'Based on display mode',
  },
]

export default function HudIntelligencePreview({
  enabled,
}: HudIntelligencePreviewProps) {
  const sorted = useMemo(() => {
    return [...mockHints].sort((a, b) => b.score - a.score)
  }, [])

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  if (!enabled) return null

  const visible = sorted.filter((h) => !dismissed.has(h.id))
  if (!visible.length) return null

  return (
    <div className="min-h-[120px] w-full space-y-2 rounded-lg border border-dashed border-slate-800/70 bg-slate-950/80 p-3 text-xs text-slate-200 shadow-lg backdrop-blur">
      <div className="text-[11px] text-slate-400">
        HUD intelligence updates as we observe activity; suggestions will appear
        by category.
      </div>
      <div className="text-[10px] text-slate-500">
        AI actions supported for this node
      </div>
      <div className="rounded-md border border-slate-800/70 bg-slate-900/70 px-2 py-2 text-[11px] text-slate-400">
        AI actions are disabled for this workspace. Contact an admin to
        re-enable.
      </div>
      {(['Reliability', 'Performance', 'Layout'] as const).map((group) => {
        const groupHints = visible.filter((hint) => hint.category === group)
        if (!groupHints.length) return null
        return (
          <div key={group} className="space-y-2">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {group}
            </div>
            <div className="space-y-2">
              {groupHints.map((hint) => (
                <div
                  key={hint.id}
                  className="rounded-md border border-slate-800/70 bg-slate-900/70 p-3 transition hover:border-slate-700 hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[12px] font-semibold text-slate-100">
                        {hint.title}
                      </div>
                      {hint.description && (
                        <div className="text-[11px] text-slate-400">
                          {hint.description}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        Confidence: Medium confidence
                      </div>
                      {hint.badges && hint.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {hint.badges.map((b) => (
                            <span
                              key={b.id}
                              className="rounded-full border border-slate-800/60 bg-slate-800/60 px-2 py-[2px] text-[10px] text-slate-200"
                              aria-label={`${b.label} badge`}
                            >
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {'basis' in hint && hint.basis && (
                        <div className="text-[10px] text-slate-500">
                          {hint.basis}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Suggested action available
                      </div>
                    </div>
                    <button
                      className="rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-400 transition hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700"
                      onClick={() =>
                        setDismissed((prev) => {
                          const next = new Set(prev)
                          next.add(hint.id)
                          return next
                        })
                      }
                      aria-label={`Dismiss hint ${hint.title}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
