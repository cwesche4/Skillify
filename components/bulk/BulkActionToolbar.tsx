'use client'

import { MoreHorizontal, X } from 'lucide-react'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import type { ButtonVariant } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type BulkToolbarAction = {
  id: string
  label: string
  icon?: ReactNode
  variant?: ButtonVariant
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}

export function BulkActionToolbar({
  selectedCount,
  recordLabel,
  primaryActions,
  secondaryActions = [],
  allVisibleSelected,
  allMatchingSelected,
  visibleCount,
  matchingCount,
  selectAllMatchingSupported,
  onSelectAllMatching,
  onClear,
  className,
}: {
  selectedCount: number
  recordLabel: string
  primaryActions: BulkToolbarAction[]
  secondaryActions?: BulkToolbarAction[]
  allVisibleSelected?: boolean
  allMatchingSelected?: boolean
  visibleCount?: number
  matchingCount?: number
  selectAllMatchingSupported?: boolean
  onSelectAllMatching?: () => void
  onClear: () => void
  className?: string
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
    placement: 'top' | 'bottom'
  } | null>(null)
  const moreButtonRef = useRef<HTMLButtonElement | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  const closeMoreMenu = useCallback(
    ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      setMoreOpen(false)
      if (restoreFocus) {
        window.requestAnimationFrame(() => moreButtonRef.current?.focus())
      }
    },
    [],
  )

  const updateMoreMenuPosition = useCallback(() => {
    const trigger = moreButtonRef.current
    if (!trigger) return
    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = moreMenuRef.current?.getBoundingClientRect()
    const menuWidth = menuRect?.width || 224
    const menuHeight =
      menuRect?.height || Math.max(44, secondaryActions.length * 40 + 16)
    const viewportPadding = 12
    const gap = 8
    const roomBelow = window.innerHeight - triggerRect.bottom - viewportPadding
    const roomAbove = triggerRect.top - viewportPadding
    const placement =
      roomBelow >= menuHeight || roomBelow >= roomAbove ? 'bottom' : 'top'
    const top =
      placement === 'bottom'
        ? Math.min(
            triggerRect.bottom + gap,
            window.innerHeight - menuHeight - viewportPadding,
          )
        : Math.max(viewportPadding, triggerRect.top - menuHeight - gap)
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    )
    setMenuPosition({ top, left, placement })
  }, [secondaryActions.length])

  useEffect(() => {
    if (!moreOpen) return
    updateMoreMenuPosition()

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (moreButtonRef.current?.contains(target)) return
      if (moreMenuRef.current?.contains(target)) return
      closeMoreMenu({ restoreFocus: false })
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMoreMenu()
      }
    }

    window.addEventListener('resize', updateMoreMenuPosition)
    window.addEventListener('scroll', updateMoreMenuPosition, true)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', updateMoreMenuPosition)
      window.removeEventListener('scroll', updateMoreMenuPosition, true)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMoreMenu, moreOpen, updateMoreMenuPosition])

  useEffect(() => {
    if (!moreOpen) return
    updateMoreMenuPosition()
  }, [moreOpen, menuPosition?.placement, updateMoreMenuPosition])

  if (selectedCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-2 z-20 mb-3 rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-3 shadow-2xl shadow-cyan-950/20 backdrop-blur',
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-50">
            {selectedCount} {recordLabel}
            {selectedCount === 1 ? '' : 's'} selected
          </p>
          {allVisibleSelected &&
          visibleCount &&
          matchingCount &&
          matchingCount > visibleCount ? (
            <div className="text-neutral-text-secondary mt-1 text-xs">
              {allMatchingSelected ? (
                <span>All {matchingCount} matching records are selected.</span>
              ) : (
                <span>
                  All {visibleCount} visible records are selected.
                  {selectAllMatchingSupported && onSelectAllMatching ? (
                    <button
                      type="button"
                      onClick={onSelectAllMatching}
                      className="ml-2 font-medium text-cyan-200 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                    >
                      Select all {matchingCount} matching filters.
                    </button>
                  ) : null}
                </span>
              )}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {primaryActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={
                action.destructive ? 'danger' : (action.variant ?? 'secondary')
              }
              disabled={action.disabled}
              onClick={action.onClick}
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          ))}
          {secondaryActions.length ? (
            <>
              <button
                ref={moreButtonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-controls={moreOpen ? menuId : undefined}
                onClick={() => setMoreOpen((current) => !current)}
                className="text-neutral-text-primary focus-visible:ring-brand-primary/70 inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-700 bg-transparent px-3 text-xs font-medium transition hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2"
              >
                <MoreHorizontal className="h-4 w-4" />
                More
              </button>
              {moreOpen && typeof document !== 'undefined'
                ? createPortal(
                    <div
                      id={menuId}
                      ref={moreMenuRef}
                      role="menu"
                      aria-label="More bulk actions"
                      data-testid="bulk-more-menu"
                      className="fixed z-[90] min-w-56 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl shadow-slate-950/50"
                      style={{
                        top: menuPosition?.top ?? 0,
                        left: menuPosition?.left ?? 0,
                      }}
                    >
                      {secondaryActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          role="menuitem"
                          disabled={action.disabled}
                          onClick={() => {
                            if (action.disabled) return
                            closeMoreMenu({ restoreFocus: false })
                            action.onClick()
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                            action.destructive
                              ? 'text-rose-200 hover:bg-rose-500/10'
                              : 'text-neutral-200 hover:bg-slate-900 hover:text-white',
                            action.disabled && 'cursor-not-allowed opacity-50',
                          )}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            leftIcon={<X className="h-4 w-4" />}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
