'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function CreateAutomationForm({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    const cleaned = name.trim()
    if (!cleaned) {
      setError('Please enter a name')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleaned }),
      })
      const data = await res.json()
      if (!res.ok || !data.automationId) {
        throw new Error(data.error || 'Failed to create automation')
      }
      window.location.href = `/dashboard/${workspaceSlug}/automations/${data.automationId}/builder`
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create automation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Automation name"
        className="w-full flex-1 rounded-md border border-neutral-border bg-transparent px-3 py-2 text-sm"
        disabled={loading}
      />
      <Button size="sm" onClick={create} disabled={loading}>
        {loading ? 'Creating…' : 'Create Automation'}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
