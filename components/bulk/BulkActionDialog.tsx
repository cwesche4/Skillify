'use client'

import React from 'react'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import type { BulkActionResult } from '@/lib/bulk/bulkActions'

export function BulkActionDialog({
  title,
  description,
  confirmLabel,
  destructive,
  disabled,
  result,
  children,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  result?: BulkActionResult | null
  children?: React.ReactNode
  onConfirm: () => void
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousActive?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">{title}</h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          {children}
          {result ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
              <p className="text-sm font-semibold text-neutral-100">
                {result.summary}
              </p>
              {result.failed || result.skipped ? (
                <div className="text-neutral-text-secondary mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                  {result.items
                    .filter((item) => item.status !== 'success')
                    .slice(0, 8)
                    .map((item) => (
                      <p key={`${item.id}-${item.status}`}>
                        {item.id}: {item.message ?? item.status}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result ? (
            <Button
              type="button"
              variant={destructive ? 'danger' : 'primary'}
              disabled={disabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
