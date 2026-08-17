'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { planAtLeast, type Plan } from '@/lib/subscriptions/features'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Template = {
  id: string
  name: string
  requiredPlan: Plan
  description: string
  flow: unknown
}

export function TemplatesGrid({
  templates,
  plan,
  workspaceId,
  workspaceSlug,
}: {
  templates: Template[]
  plan: Plan
  workspaceId: string
  workspaceSlug: string
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSelect = async (tpl: Template) => {
    if (!planAtLeast(plan, tpl.requiredPlan)) {
      router.push(
        `/dashboard/${workspaceSlug}/upsell?need=${tpl.requiredPlan}&feature=${encodeURIComponent(tpl.name)}`,
      )
      return
    }

    setLoadingId(tpl.id)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.name,
          description: tpl.description,
          flow: tpl.flow,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.automationId) {
        throw new Error(data.error || 'Failed to create automation')
      }
      router.push(
        `/dashboard/${workspaceSlug}/automations/${data.automationId}/builder`,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-neutral-border/70 bg-neutral-card-dark/70 flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Preset library
          </p>
          <p className="text-neutral-text-secondary text-sm">
            Browse user templates, AI drafts, and shared presets side by side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="xs" variant="gray">
            User
          </Badge>
          <Badge size="xs" variant="purple">
            AI Draft
          </Badge>
          <Badge size="xs" variant="blue">
            Shared
          </Badge>
        </div>
      </Card>

      {templates.length === 0 ? (
        <EmptyState
          title="No presets yet"
          description="Save your own templates, generate AI drafts, or pull in shared presets to see them listed here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((tpl) => {
            const locked = !planAtLeast(plan, tpl.requiredPlan)
            return (
              <Card
                key={tpl.id}
                className={`space-y-3 p-4 ${
                  locked
                    ? 'border-dashed border-amber-500/50 bg-amber-500/5'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{tpl.name}</h3>
                    <p className="text-neutral-text-secondary text-xs">
                      {tpl.description}
                    </p>
                  </div>
                  <Badge
                    size="xs"
                    variant={tpl.requiredPlan === 'Elite' ? 'purple' : 'blue'}
                  >
                    {tpl.requiredPlan}
                  </Badge>
                </div>

                <div className="border-neutral-border/60 bg-neutral-card-dark/60 text-neutral-text-secondary flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Badge size="xs" variant="gray">
                      User
                    </Badge>
                    <Badge size="xs" variant="purple">
                      AI Draft
                    </Badge>
                    <Badge size="xs" variant="blue">
                      Shared
                    </Badge>
                  </span>
                  <button
                    onClick={() => handleSelect(tpl)}
                    disabled={loadingId === tpl.id}
                    className="text-sm font-medium text-brand-primary underline"
                  >
                    {locked ? `Upgrade to ${tpl.requiredPlan}` : 'Use template'}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
