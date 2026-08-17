'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'

type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

type Action = {
  plan: Plan
  label: string
  tone: 'primary' | 'secondary'
  kind: 'upgrade' | 'downgrade'
  disabled?: boolean
  note?: string
}

function buildActions(currentPlan: Plan): Action[] {
  switch (currentPlan) {
    case 'Elite':
      return [
        {
          plan: 'Pro',
          label: 'Downgrade to Pro',
          tone: 'secondary',
          kind: 'downgrade',
        },
        {
          plan: 'Basic',
          label: 'Downgrade to Basic',
          tone: 'secondary',
          kind: 'downgrade',
        },
      ]
    case 'Pro':
      return [
        {
          plan: 'Elite',
          label: 'Upgrade to Elite',
          tone: 'primary',
          kind: 'upgrade',
        },
        {
          plan: 'Basic',
          label: 'Downgrade to Basic',
          tone: 'secondary',
          kind: 'downgrade',
        },
      ]
    case 'Basic':
      return [
        {
          plan: 'Pro',
          label: 'Upgrade to Pro',
          tone: 'primary',
          kind: 'upgrade',
        },
        {
          plan: 'Elite',
          label: 'Upgrade to Elite',
          tone: 'secondary',
          kind: 'upgrade',
        },
        {
          plan: 'Free',
          label: 'Downgrade to Free (coming soon)',
          tone: 'secondary',
          kind: 'downgrade',
          disabled: true,
          note: 'Free downgrades are not supported yet.',
        },
      ]
    case 'Free':
    default:
      return [
        {
          plan: 'Basic',
          label: 'Upgrade to Basic',
          tone: 'primary',
          kind: 'upgrade',
        },
        {
          plan: 'Pro',
          label: 'Upgrade to Pro',
          tone: 'secondary',
          kind: 'upgrade',
        },
        {
          plan: 'Elite',
          label: 'Upgrade to Elite',
          tone: 'secondary',
          kind: 'upgrade',
        },
      ]
  }
}

export function PlanUpgradeControls({
  workspaceId,
  currentPlan,
  canManage,
}: {
  workspaceId: string
  currentPlan: Plan
  canManage: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = buildActions(currentPlan)

  const changePlan = async (plan: Plan, kind: 'upgrade' | 'downgrade') => {
    if (kind === 'downgrade') {
      const confirmed = window.confirm(
        'Are you sure you want to downgrade? Some features may become unavailable.',
      )
      if (!confirmed) return
    }

    setLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, workspaceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Plan change failed')
      }
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Plan change failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-neutral-text-secondary text-xs font-semibold">
        Current plan: <span className="text-neutral-50">{currentPlan}</span>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.plan}
            size="sm"
            variant={action.tone === 'primary' ? 'primary' : 'secondary'}
            disabled={!canManage || action.disabled || loading === action.plan}
            onClick={() => changePlan(action.plan, action.kind)}
          >
            {loading === action.plan ? 'Updating…' : action.label}
          </Button>
        ))}
      </div>

      {actions.some((a) => a.note) && (
        <div className="text-neutral-text-secondary text-xs">
          {actions
            .filter((a) => a.note)
            .map((a) => (
              <div key={a.plan}>{a.note}</div>
            ))}
        </div>
      )}

      {!canManage && (
        <p className="text-neutral-text-secondary text-xs">
          Only workspace owners can change plans.
        </p>
      )}
    </div>
  )
}
