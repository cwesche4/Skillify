'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'

function DisabledMessage() {
  return (
    <p className="text-neutral-text-secondary text-sm">
      AI actions are currently disabled. Builders will see workspace-level
      controls applied until an admin enables them again.
    </p>
  )
}

type Props = {
  workspaceId: string
  initialEnabled: boolean
  initialError?: boolean
}

export function AiActionsToggle({
  workspaceId,
  initialEnabled,
  initialError,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleToggle(next: boolean) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/settings/ai-actions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiActionsEnabled: next }),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? 'Failed to update AI actions setting')
        return
      }
      setEnabled(Boolean(json?.aiActionsEnabled))
      setSuccess('Saved')
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update AI actions setting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {initialError && (
        <p className="text-xs text-amber-400">
          Could not verify current setting. Using safe default until refreshed.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          disabled={loading}
          onCheckedChange={handleToggle}
        />
        <div className="space-y-0.5">
          <p className="text-neutral-text text-sm font-semibold">
            Enable AI actions
          </p>
          <p className="text-neutral-text-secondary text-xs">
            Apply workspace-wide control for Inspector AI and related actions.
          </p>
        </div>
        {loading && (
          <Badge variant="blue" className="text-[11px]">
            Saving…
          </Badge>
        )}
        {success && !loading && (
          <Badge variant="green" className="text-[11px]">
            {success}
          </Badge>
        )}
      </div>
      {!enabled && <DisabledMessage />}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
