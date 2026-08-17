'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

export default function RenameWorkspace({
  workspaceId,
  currentName,
}: {
  workspaceId: string
  currentName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const cleaned = name.trim()
    if (!cleaned) {
      setError('Name is required')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleaned }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to rename')
      setLoading(false)
      return
    }
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
        Rename workspace
      </Button>
      {open && (
        <div className="bg-neutral-card-dark/60 space-y-2 rounded-lg border border-neutral-border p-3 text-xs">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-neutral-border bg-transparent px-3 py-2"
            disabled={loading}
          />
          {error && <p className="text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
