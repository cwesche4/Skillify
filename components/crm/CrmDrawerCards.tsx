'use client'

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { RecordTimeline } from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { cn } from '@/lib/utils'

export type CrmTimelineEvent = {
  id: string
  title: string
  description: string
  timestamp: string
  category: string
}

type NotesCardProps = {
  title: string
  description: string
  value?: string | null
  placeholder?: string
  onSave: (value: string) => void | Promise<void>
  disabled?: boolean
  onDirtyChange?: (dirty: boolean) => void
}

export function NotesCard({
  title,
  description,
  value,
  placeholder = 'Click to add notes.',
  onSave,
  disabled = false,
  onDirtyChange,
}: NotesCardProps) {
  const savedValue = value ?? ''
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(savedValue)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isEditing) return
    setDraft(savedValue)
    setError(null)
  }, [isEditing, savedValue])

  const isDirty = draft !== savedValue

  useEffect(() => {
    onDirtyChange?.(isEditing && isDirty)
  }, [isDirty, isEditing, onDirtyChange])

  const cancel = () => {
    setDraft(savedValue)
    setError(null)
    setIsEditing(false)
  }

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setIsEditing(false)
    } catch {
      setError('Could not save notes. Your draft is still here.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      className={cn(
        'group rounded-xl border border-slate-800 bg-slate-950/45 p-3 shadow-sm shadow-black/10',
        !disabled && 'cursor-text transition hover:border-slate-700',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <p className="text-neutral-text-secondary mt-0.5 text-xs leading-4">
            {description}
          </p>
        </div>
        {!disabled && !isEditing ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setIsEditing(true)
            }}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 opacity-0 transition hover:bg-white/[0.06] hover:text-white/80 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 group-hover:opacity-100"
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <div
          className="mt-2 space-y-2"
          onClick={(event) => event.stopPropagation()}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Prefers text messages. Do not schedule before 10 AM."
            className="min-h-[76px] w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
          />
          {error ? <p className="text-xs text-red-200">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" size="xs" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={save}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <p
          className={cn(
            'mt-2 whitespace-pre-line rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm leading-5',
            !disabled &&
              'cursor-text transition hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
            savedValue ? 'text-neutral-100' : 'text-neutral-text-secondary',
          )}
          onClick={() => {
            if (!disabled) setIsEditing(true)
          }}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setIsEditing(true)
            }
          }}
          tabIndex={disabled ? undefined : 0}
          role={disabled ? undefined : 'button'}
          aria-label={`Edit ${title} content`}
        >
          {savedValue || placeholder}
        </p>
      )}
    </section>
  )
}

export function CompactActivityTimeline({
  events,
  emptyTitle = 'No activity yet',
}: {
  events: CrmTimelineEvent[]
  emptyTitle?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const sortedEvents = useMemo(
    () =>
      [...events].sort((first, second) =>
        second.timestamp.localeCompare(first.timestamp),
      ),
    [events],
  )
  const visibleEvents = expanded ? sortedEvents : sortedEvents.slice(0, 3)
  const canToggle = sortedEvents.length > 3

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-100">
          Activity Timeline
        </h3>
        {canToggle ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="text-neutral-text-secondary rounded-lg border border-slate-700/80 bg-slate-950/45 px-2.5 py-1 text-xs font-medium transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            aria-label={expanded ? 'Show less activity' : 'View all activity'}
          >
            {expanded ? 'Show less' : 'View all'}
          </button>
        ) : null}
      </div>
      {visibleEvents.length > 0 ? (
        <RecordTimeline events={visibleEvents} />
      ) : (
        <p className="text-neutral-text-secondary text-sm">{emptyTitle}</p>
      )}
    </section>
  )
}
