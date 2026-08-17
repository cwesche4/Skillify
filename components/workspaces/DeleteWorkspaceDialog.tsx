'use client'

import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Props = {
  open: boolean
  workspaceId: string
  workspaceName: string
  workspaceSlug?: string
  currentWorkspaceSlug?: string
  onOpenChange: (open: boolean) => void
  onDeleted?: (workspaceId: string) => void
}

export function DeleteWorkspaceDialog({
  open,
  workspaceId,
  workspaceName,
  workspaceSlug,
  currentWorkspaceSlug,
  onOpenChange,
  onDeleted,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canDelete = confirmation.trim() === workspaceName && !loading
  const isCurrentWorkspace = workspaceSlug === currentWorkspaceSlug

  const titleId = useMemo(
    () => `delete-workspace-${workspaceId}-title`,
    [workspaceId],
  )

  useEffect(() => {
    if (!open) return
    setConfirmation('')
    setError(null)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [loading, onOpenChange, open])

  if (!open) return null

  async function submit() {
    if (!canDelete) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message ?? data.error ?? 'Failed to delete workspace.')
      setLoading(false)
      return
    }
    onDeleted?.(workspaceId)
    onOpenChange(false)
    if (isCurrentWorkspace) {
      router.push(data.redirectTo ?? '/onboarding/create-workspace')
    }
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onOpenChange(false)
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/35 bg-slate-950 p-5 text-neutral-100 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-2 text-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                Delete {workspaceName}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
                This permanently removes the workspace and related records. This
                action cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-lg border border-slate-800 p-2 text-neutral-400 transition hover:bg-slate-900 hover:text-neutral-100 disabled:opacity-50"
            aria-label="Close delete workspace dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-3 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <Archive className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Archive is safer when you only need to hide a workspace from
              normal switching.
            </p>
          </div>
        </div>

        <label className="mt-4 block space-y-1 text-xs">
          <span className="font-medium text-neutral-200">
            Type{' '}
            <span className="font-semibold text-neutral-50">
              &quot;{workspaceName}&quot;
            </span>{' '}
            to permanently delete this workspace.
          </span>
          <Input
            ref={inputRef}
            value={confirmation}
            disabled={loading}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            aria-label={`Type ${workspaceName} to confirm workspace deletion`}
          />
        </label>

        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!canDelete}
            loading={loading}
            onClick={submit}
          >
            Delete workspace
          </Button>
        </div>
      </div>
    </div>
  )
}
