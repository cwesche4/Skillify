'use client'

import React, {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  disabled?: boolean
  onConfirm: () => void | Promise<void>
  onOpenChange?: (open: boolean) => void
  onCancel?: () => void
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  disabled = false,
  onConfirm,
  onOpenChange,
  onCancel,
}: ConfirmDialogProps) {
  const [portalReady, setPortalReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const busy = loading || submitting

  useEffect(() => setPortalReady(true), [])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const frame = window.requestAnimationFrame(() => {
      cancelRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  const close = () => {
    if (busy) return
    onCancel?.()
    onOpenChange?.(false)
  }

  const handleConfirm = async () => {
    if (busy || disabled) return
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => element.offsetParent !== null)
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!portalReady || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={
          description ? 'confirm-dialog-description' : undefined
        }
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            onClick={close}
            disabled={busy}
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {description ? (
          <div
            id="confirm-dialog-description"
            className="text-neutral-text-secondary px-5 py-4 text-sm leading-6"
          >
            {description}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={close}
            disabled={busy}
            className="text-neutral-text-primary focus-visible:ring-brand-primary/70 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-transparent px-3.5 text-sm font-medium transition-colors hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={busy}
            disabled={disabled}
            className={cn(destructive && 'shadow-rose-950/20')}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
