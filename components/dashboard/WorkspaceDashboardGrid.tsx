// components/dashboard/WorkspaceDashboardGrid.tsx
'use client'

import { useEffect, useState } from 'react'
import { WIDGETS, type WidgetId } from '@/components/dashboard/widgets'
import { Sparkles, SlidersHorizontal } from 'lucide-react'
import { ProtectedFeature } from '@/components/permissions/ProtectedFeature'
import type { Plan } from '@/lib/subscriptions/features'

type LayoutState = Record<
  WidgetId,
  {
    visible: boolean
    order: number
  }
>

interface Props {
  workspaceId: string
  workspaceSlug: string
  initialLayout: LayoutState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export default function WorkspaceDashboardGrid({
  workspaceId,
  workspaceSlug,
  initialLayout,
  data,
}: Props) {
  const [layout, setLayout] = useState<LayoutState>(initialLayout)
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan>('Free')

  //
  // Fetch subscription plan (client-side, same as layout)
  //
  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch('/api/auth/plan')
        if (!res.ok) return
        const json = await res.json()
        if (json?.plan) {
          setPlan(json.plan as Plan)
        }
      } catch {
        // swallow — default "Free"
      }
    }

    void fetchPlan()
  }, [])

  //
  // Save layout to API (debounced via explicit button)
  //
  async function saveLayout(next: LayoutState) {
    setSaving(true)
    try {
      await fetch('/api/dashboard/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          layout: { widgets: next },
        }),
      })
    } catch {
      // ignore for now — you could show a toast
    } finally {
      setSaving(false)
    }
  }

  //
  // Drag & Drop
  //
  function handleDragStart(id: WidgetId) {
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function handleDrop(targetId: WidgetId) {
    if (!draggingId || draggingId === targetId) return

    const entries = Object.entries(layout) as [
      WidgetId,
      { visible: boolean; order: number },
    ][]
    entries.sort((a, b) => a[1].order - b[1].order)

    const fromIndex = entries.findIndex(([id]) => id === draggingId)
    const toIndex = entries.findIndex(([id]) => id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null)
      return
    }

    const reordered = [...entries]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    const next: LayoutState = reordered.reduce((acc, [id, cfg], idx) => {
      acc[id] = { ...cfg, order: idx + 1 }
      return acc
    }, {} as LayoutState)

    setLayout(next)
    void saveLayout(next)
    setDraggingId(null)
  }

  //
  // Visibility toggle
  //
  function toggleVisibility(id: WidgetId) {
    const next: LayoutState = {
      ...layout,
      [id]: {
        ...layout[id],
        visible: !layout[id].visible,
      },
    }
    setLayout(next)
    void saveLayout(next)
  }

  //
  // AI “Smart Layout” suggestion
  //
  async function applySmartLayout() {
    try {
      setAiStatus('Asking AI Coach…')

      // Call AI Coach (for explanation text, not real layout parsing yet)
      await fetch('/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          question:
            'Suggest an ideal dashboard layout for my Skillify workspace: success, members, recent runs, and AI insights.',
          mode: 'optimize',
        }),
      }).catch(() => { })

      // Simple deterministic “smart order”:
      // 1) AI Coach, 2) Success, 3) Recent Runs, 4) Members
      const order: WidgetId[] = [
        'aiCoachInsights',
        'successRate',
        'recentRuns',
        'members',
      ]

      const next: LayoutState = { ...layout }
      order.forEach((id, idx) => {
        if (!next[id]) return
        next[id] = { ...next[id], order: idx + 1, visible: true }
      })

      setLayout(next)
      void saveLayout(next)
      setAiStatus('Smart layout applied.')
      setTimeout(() => setAiStatus(null), 2500)
    } catch {
      setAiStatus('Could not apply smart layout.')
      setTimeout(() => setAiStatus(null), 2500)
    }
  }

  //
  // Derived visible widgets sorted by order
  //
  const visibleEntries = Object.entries(layout)
    .filter(([_, cfg]) => cfg.visible)
    .sort((a, b) => a[1].order - b[1].order) as [
      WidgetId,
      { visible: boolean; order: number },
    ][]

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-neutral-text-secondary text-xs">
          Drag cards to reorder. Customize what you see.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="hover:bg-neutral-card-light/60 flex items-center gap-1 rounded-lg border border-neutral-border px-2.5 py-1.5 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Customize
          </button>

          <button
            type="button"
            onClick={applySmartLayout}
            className="hover:bg-brand-primary/90 flex items-center gap-1 rounded-lg bg-brand-primary px-2.5 py-1.5 text-xs font-medium text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Smart layout
          </button>
        </div>
      </div>

      {aiStatus && (
        <div className="bg-neutral-card-light text-neutral-text-secondary border-brand-primary/40 dark:bg-neutral-card-dark rounded-lg border border-dashed px-3 py-2 text-xs">
          {aiStatus}
        </div>
      )}

      {showCustomize && (
        <div className="bg-neutral-card-light dark:bg-neutral-card-dark mb-2 rounded-lg border border-neutral-border p-3">
          <p className="mb-2 text-xs font-medium">Visible widgets</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(WIDGETS).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleVisibility(w.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${layout[w.id]?.visible
                    ? 'border-brand-primary/70 bg-brand-primary/10 text-brand-primary'
                    : 'text-neutral-text-secondary border-neutral-border'
                  }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <p className="text-neutral-text-secondary mt-2 text-[10px]">
            Changes are saved automatically for this workspace.
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visibleEntries.map(([id]) => {
          const widget = WIDGETS[id]
          if (!widget) return null

          const Component = widget.component

          // Build widget-specific data bundle
          const widgetData =
            id === 'successRate'
              ? { health: data.health, successRate: data.successRate }
              : id === 'members'
                ? { totalMembers: data.totalMembers }
                : id === 'recentRuns'
                  ? { runs: data.recentRuns }
                  : data // AI Coach doesn't need structured data yet

          return (
            <div
              key={id}
              draggable
              onDragStart={() => handleDragStart(id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(id)}
              className="cursor-move"
            >
              <ProtectedFeature
                plan={plan}
                feature={widget.featureKey}
                workspaceSlug={workspaceSlug}
                lockMessage={
                  id === 'aiCoachInsights'
                    ? 'AI Coach Insights is a Pro feature. Upgrade to unlock live AI workspace analysis.'
                    : undefined
                }
              >
                <Component workspaceId={workspaceId} data={widgetData} />
              </ProtectedFeature>
            </div>
          )
        })}
      </div>

      {saving && (
        <div className="text-neutral-text-secondary mt-1 text-[11px]">
          Saving layout…
        </div>
      )}
    </div>
  )
}
