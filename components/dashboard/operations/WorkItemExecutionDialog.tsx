'use client'

import React, {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  getAllowedWorkItemStatuses,
  workItemStatusLabels,
} from '@/lib/jobs/presentation'
import type { WorkItemStatus as WorkItemStatusValue } from '@/lib/prisma/enums'

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export type WorkItemExecutionInput = {
  status: WorkItemStatusValue
  notes: string | null
}

export function WorkItemExecutionDialog({
  itemLabel,
  title,
  status: initialStatus,
  notes: initialNotes,
  onClose,
  onSubmit,
}: {
  itemLabel: 'Job Step' | 'To-Do'
  title: string
  status: WorkItemStatusValue
  notes: string | null
  onClose: () => void
  onSubmit: (input: WorkItemExecutionInput) => Promise<void>
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const statusRef = useRef<HTMLSelectElement | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    statusRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.offsetParent !== null)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ status, notes: notes.trim() || null })
    } catch {
      setError(`The ${itemLabel} update could not be saved. Try again.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={`Close ${itemLabel} update`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-execution-title"
        aria-describedby="work-execution-description"
        onKeyDown={keyDown}
        className="border-app bg-app-surface relative z-10 w-full rounded-t-2xl border p-5 shadow-2xl shadow-black/40 sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <h2
          id="work-execution-title"
          className="text-app-primary text-lg font-semibold"
        >
          Update {itemLabel}
        </h2>
        <p
          id="work-execution-description"
          className="text-app-secondary mt-1 text-sm"
        >
          Update your progress and notes for {title}.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-5">
          {error ? (
            <Alert variant="error" role="alert">
              {error}
            </Alert>
          ) : null}
          <div>
            <Label htmlFor="work-execution-status">Status</Label>
            <Select
              ref={statusRef}
              id="work-execution-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as WorkItemStatusValue)
              }
              className="mt-2"
            >
              {getAllowedWorkItemStatuses(initialStatus).map((value) => (
                <option key={value} value={value}>
                  {workItemStatusLabels[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="work-execution-notes">Notes</Label>
            <Textarea
              id="work-execution-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a progress note for your team..."
              maxLength={10_000}
              rows={5}
              className="mt-2"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save Update
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
