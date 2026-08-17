'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Clipboard,
  Edit3,
  Eye,
  Layers,
  Plus,
  Scissors,
  Trash2,
  X,
  Workflow,
  Focus,
} from 'lucide-react'

type Target = 'pane' | 'node'

export type CanvasContextMenuState = {
  open: boolean
  x: number
  y: number
  target: Target
  nodeId?: string
}

export type CanvasContextMenuAction =
  | { id: 'rename'; label: string }
  | { id: 'duplicate'; label: string }
  | { id: 'copy'; label: string }
  | { id: 'cut'; label: string }
  | { id: 'paste'; label: string }
  | { id: 'delete'; label: string }
  | { id: 'group'; label: string }
  | { id: 'fit'; label: string }
  | { id: 'auto-layout'; label: string }
  | { id: 'add'; label: string }
  | { id: 'select-all'; label: string }
  | { id: 'open-settings'; label: string }
  | { id: 'save-template'; label: string }
  | { id: 'toggle-enabled'; label: string }

export default function CanvasContextMenu({
  state,
  onClose,
  selectedCount,
  canGroup,
  nodeLabel,
  onAction,
  hasClipboard = false,
}: {
  state: CanvasContextMenuState
  onClose: () => void
  selectedCount: number
  canGroup: boolean
  nodeLabel?: string
  onAction: (action: CanvasContextMenuAction) => void
  hasClipboard?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: state.x, y: state.y })

  // Close on outside click
  useEffect(() => {
    if (!state.open) return
    const onDown = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      if (!el.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown, { passive: true })
    return () => window.removeEventListener('mousedown', onDown as any)
  }, [state.open, onClose])

  // Close on ESC
  useEffect(() => {
    if (!state.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open, onClose])

  const items = useMemo(() => {
    const isNode = state.target === 'node'

    const base: Array<{
      key: string
      icon: any
      label: string
      disabled?: boolean
      run: () => void
    }> = []

    if (isNode) {
      base.push({
        key: 'add',
        icon: Plus,
        label: 'Add Step',
        run: () => onAction({ id: 'add', label: 'Add Step' }),
      })
      base.push({
        key: 'rename',
        icon: Edit3,
        label: 'Rename',
        run: () => onAction({ id: 'rename', label: 'Rename' }),
      })
      base.push({
        key: 'open-settings',
        icon: Eye,
        label: 'Open settings',
        run: () => onAction({ id: 'open-settings', label: 'Open settings' }),
      })
      base.push({
        key: 'fit',
        icon: Focus,
        label: 'Fit view',
        run: () => onAction({ id: 'fit', label: 'Fit view' }),
      })
      base.push({
        key: 'duplicate',
        icon: Copy,
        label: selectedCount > 1 ? `Duplicate (${selectedCount})` : 'Duplicate',
        disabled: selectedCount === 0,
        run: () => onAction({ id: 'duplicate', label: 'Duplicate' }),
      })
      base.push({
        key: 'copy',
        icon: Copy,
        label: selectedCount > 1 ? `Copy (${selectedCount})` : 'Copy',
        disabled: selectedCount === 0,
        run: () => onAction({ id: 'copy', label: 'Copy' }),
      })
      base.push({
        key: 'cut',
        icon: Scissors,
        label: selectedCount > 1 ? `Cut (${selectedCount})` : 'Cut',
        disabled: selectedCount === 0,
        run: () => onAction({ id: 'cut', label: 'Cut' }),
      })
      base.push({
        key: 'delete',
        icon: Trash2,
        label: selectedCount > 1 ? `Delete (${selectedCount})` : 'Delete',
        disabled: selectedCount === 0,
        run: () => onAction({ id: 'delete', label: 'Delete' }),
      })
      base.push({
        key: 'toggle-enabled',
        icon: Workflow,
        label: 'Disable step',
        run: () => onAction({ id: 'toggle-enabled', label: 'Disable step' }),
      })
      base.push({
        key: 'save-template',
        icon: Workflow,
        label: 'Save as template',
        run: () => onAction({ id: 'save-template', label: 'Save as template' }),
      })
      return base
    }

    base.push({
      key: 'add',
      icon: Plus,
      label: 'Add Step',
      run: () => onAction({ id: 'add', label: 'Add Step' }),
    })
    base.push({
      key: 'fit',
      icon: Focus,
      label: 'Fit view',
      run: () => onAction({ id: 'fit', label: 'Fit view' }),
    })
    base.push({
      key: 'auto-layout',
      icon: Workflow,
      label: 'Auto Layout',
      run: () => onAction({ id: 'auto-layout', label: 'Auto Layout' }),
    })
    base.push({
      key: 'duplicate',
      icon: Copy,
      label: selectedCount > 1 ? `Duplicate (${selectedCount})` : 'Duplicate',
      disabled: selectedCount === 0,
      run: () => onAction({ id: 'duplicate', label: 'Duplicate' }),
    })
    base.push({
      key: 'copy',
      icon: Copy,
      label: selectedCount > 1 ? `Copy (${selectedCount})` : 'Copy',
      disabled: selectedCount === 0,
      run: () => onAction({ id: 'copy', label: 'Copy' }),
    })
    base.push({
      key: 'cut',
      icon: Scissors,
      label: selectedCount > 1 ? `Cut (${selectedCount})` : 'Cut',
      disabled: selectedCount === 0,
      run: () => onAction({ id: 'cut', label: 'Cut' }),
    })
    base.push({
      key: 'paste',
      icon: Clipboard,
      label: 'Paste',
      disabled: !hasClipboard,
      run: () => onAction({ id: 'paste', label: 'Paste' }),
    })
    base.push({
      key: 'delete',
      icon: Trash2,
      label: selectedCount > 1 ? `Delete (${selectedCount})` : 'Delete',
      disabled: selectedCount === 0,
      run: () => onAction({ id: 'delete', label: 'Delete' }),
    })
    base.push({
      key: 'select-all',
      icon: Layers,
      label: 'Select All',
      run: () => onAction({ id: 'select-all', label: 'Select All' }),
    })
    return base
  }, [state.target, selectedCount, onAction, hasClipboard])

  useLayoutEffect(() => {
    if (!state.open) return

    const menu = ref.current
    const width = menu?.offsetWidth ?? 280
    const height = menu?.offsetHeight ?? 420
    const margin = 12
    const maxX = window.innerWidth - width - margin
    const maxY =
      window.innerHeight -
      Math.min(height, window.innerHeight - margin * 2) -
      margin

    setPosition({
      x: Math.max(margin, Math.min(state.x, maxX)),
      y: Math.max(margin, Math.min(state.y, maxY)),
    })
  }, [state.open, state.x, state.y])

  if (!state.open) return null

  return (
    <div
      className="fixed inset-0 z-[95]"
      onContextMenu={(e) => {
        // prevent the browser menu while ours is open
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div
        ref={ref}
        className="max-h-[calc(100dvh-24px)] min-w-[260px] overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/95 shadow-2xl backdrop-blur"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Workflow className="h-4 w-4 text-slate-300" />
              {state.target === 'node'
                ? nodeLabel
                  ? `Step: ${nodeLabel}`
                  : 'Step'
                : 'Canvas'}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              aria-label="Close context menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            {selectedCount > 0 ? `${selectedCount} selected` : 'No selection'}
          </div>
        </div>

        <div className="max-h-[calc(100dvh-96px)] overflow-y-auto p-2">
          <div className="space-y-1">
            {items.map((it) => {
              const Icon = it.icon
              return (
                <button
                  key={it.key}
                  disabled={it.disabled}
                  onClick={it.run}
                  className={[
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left',
                    'text-slate-200 hover:bg-slate-800/40',
                    it.disabled ? 'opacity-40 hover:bg-transparent' : '',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-300" />
                    <span className="text-sm">{it.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
