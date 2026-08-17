'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function RenameAutomationButton({
  workspaceId,
  automationId,
  currentName,
}: {
  workspaceId: string
  automationId: string
  currentName: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const cleaned = name.trim()
    if (!cleaned) {
      setError('Name is required')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch(
      `/api/workspaces/${workspaceId}/automations/${automationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleaned }),
      },
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to rename')
      setLoading(false)
      return
    }
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        Rename
      </Button>
      {open && (
        <div className="bg-neutral-card-dark/60 rounded-lg border border-neutral-border p-3 text-xs">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-neutral-border bg-transparent px-2 py-1"
              disabled={loading}
            />
            <Button size="sm" onClick={save} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {error && <p className="mt-1 text-rose-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
