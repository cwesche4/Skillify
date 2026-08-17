'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function DeleteAutomationButton({
  workspaceId,
  automationId,
}: {
  workspaceId: string
  automationId: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(
      `/api/workspaces/${workspaceId}/automations/${automationId}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to delete automation')
      setLoading(false)
      return
    }
    // Refresh the page to reflect deletion
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="text-rose-400"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      {open && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">Delete automation?</p>
              <p className="text-[11px]">
                This will remove the automation and its runs.
              </p>
            </div>
          </div>
          {error && <p className="mt-1 text-rose-300">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={confirmDelete}
              disabled={loading}
            >
              {loading ? 'Deleting…' : 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
