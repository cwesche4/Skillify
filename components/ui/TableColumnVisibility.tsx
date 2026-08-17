'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Columns3, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TableColumnConfig = {
  id: string
  label: string
  required?: boolean
  // Future-ready table architecture:
  // - order: drag-and-drop column ordering
  // - pinned: left/right pinned columns
  // - savedViewIds: named workspace/user table views
  // Keep V1 focused on show/hide so existing table layouts remain stable.
}

type TableColumnsButtonProps = {
  columns: TableColumnConfig[]
  visibleColumns: Record<string, boolean>
  onToggle: (columnId: string) => void
  onReset: () => void
}

export function useTableColumnVisibility(
  pageId: string,
  columns: TableColumnConfig[],
) {
  const storageKey = useMemo(() => {
    if (typeof window === 'undefined') return `skillify:columns:${pageId}`
    return `skillify:columns:${window.location.pathname}:${pageId}`
  }, [pageId])

  const defaultVisibility = useMemo(
    () =>
      columns.reduce<Record<string, boolean>>((acc, column) => {
        acc[column.id] = true
        return acc
      }, {}),
    [columns],
  )

  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(defaultVisibility)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (!saved) {
        setVisibleColumns(defaultVisibility)
        return
      }

      const parsed = JSON.parse(saved) as Record<string, boolean>
      setVisibleColumns(
        columns.reduce<Record<string, boolean>>((acc, column) => {
          acc[column.id] = column.required ? true : (parsed[column.id] ?? true)
          return acc
        }, {}),
      )
    } catch {
      setVisibleColumns(defaultVisibility)
    }
  }, [columns, defaultVisibility, storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visibleColumns))
    } catch {
      // Local table preferences are optional; ignore storage failures.
    }
  }, [storageKey, visibleColumns])

  const toggleColumn = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId)
    if (!column || column.required) return

    setVisibleColumns((current) => ({
      ...current,
      [columnId]: !(current[columnId] ?? true),
    }))
  }

  const resetColumns = () => {
    setVisibleColumns(defaultVisibility)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Local table preferences are optional; ignore storage failures.
    }
  }

  return {
    visibleColumns,
    isColumnVisible: (columnId: string) => visibleColumns[columnId] ?? true,
    toggleColumn,
    resetColumns,
  }
}

export function TableColumnsButton({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: TableColumnsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/45 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
        Columns
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[80] mt-2 w-64 rounded-xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-xs font-semibold text-neutral-100">
              Table columns
            </p>
            <p className="text-neutral-text-secondary mt-0.5 text-[11px]">
              Show or hide optional columns.
            </p>
          </div>
          <div className="space-y-1">
            {columns.map((column) => {
              const isVisible = visibleColumns[column.id] ?? true
              return (
                <button
                  key={column.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  disabled={column.required}
                  onClick={() => onToggle(column.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                    column.required
                      ? 'cursor-not-allowed text-slate-500'
                      : 'text-slate-200 hover:bg-white/[0.06] hover:text-cyan-100',
                  )}
                >
                  <span>
                    {column.label}
                    {column.required ? (
                      <span className="text-slate-500"> · required</span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded border',
                      isVisible
                        ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                        : 'border-slate-700 text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              )
            })}
          </div>
          {/* TODO: Add drag-and-drop ordering, pinned columns, and saved views after table preferences are persisted server-side. */}
          <div className="mt-2 border-t border-slate-800 pt-2">
            <button
              type="button"
              onClick={onReset}
              className="text-neutral-text-secondary inline-flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/[0.06] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset columns
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
