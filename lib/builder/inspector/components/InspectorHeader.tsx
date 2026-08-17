'use client'

import { Badge } from '@/components/ui/Badge'
import React from 'react'
import { createPortal } from 'react-dom'

import type { InspectorWorkMode } from '@/lib/inspector/workModes'

export type InspectorOptionsMenuPosition = {
  top: number
  left: number
  width: number
}

export function computeInspectorOptionsMenuPosition({
  triggerRect,
  viewportWidth,
  viewportHeight,
  menuWidth = 288,
  menuHeight = 336,
  margin = 12,
  gap = 8,
}: {
  triggerRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
  viewportWidth: number
  viewportHeight: number
  menuWidth?: number
  menuHeight?: number
  margin?: number
  gap?: number
}): InspectorOptionsMenuPosition {
  const safeWidth = Math.min(
    Math.max(menuWidth, 256),
    Math.max(256, viewportWidth - margin * 2),
  )
  const opensLeft = triggerRect.right + safeWidth + margin > viewportWidth
  const rawLeft = opensLeft ? triggerRect.right - safeWidth : triggerRect.left
  const left = Math.min(
    Math.max(margin, rawLeft),
    Math.max(margin, viewportWidth - safeWidth - margin),
  )
  const opensUp =
    triggerRect.bottom + gap + menuHeight + margin > viewportHeight
  const rawTop = opensUp
    ? triggerRect.top - menuHeight - gap
    : triggerRect.bottom + gap
  const top = Math.min(
    Math.max(margin, rawTop),
    Math.max(margin, viewportHeight - menuHeight - margin),
  )

  return { top, left, width: safeWidth }
}

type Props = {
  meta: {
    label: string
    category?: string
    description?: string
    icon?: string
    planLabel?: string
    canBeTrigger?: boolean
    canBeAction?: boolean
  }
  planLabel: string
  hasErrors: boolean
  hasWarnings?: boolean
  warningCount?: number
  layoutBadge?: string
  layoutVariant: string
  showLayoutBadge?: boolean
  workMode: InspectorWorkMode
  onWorkModeChange: (mode: InspectorWorkMode) => void
  settings: Record<string, boolean>
  onToggleSetting: (key: string, next: boolean) => void
  followsSelection?: boolean
  onToggleFollowsSelection?: () => void
  onPreset?: (size: number) => void
  widthPreset?: 'compact' | 'standard' | 'wide'
  onTogglePin?: () => void
  pinned?: boolean
  onClose?: () => void
}

function InspectorHeaderComponent({
  meta,
  planLabel,
  hasErrors,
  hasWarnings = false,
  warningCount = 0,
  layoutBadge,
  layoutVariant,
  showLayoutBadge,
  workMode,
  onWorkModeChange,
  settings,
  onToggleSetting,
  followsSelection,
  onToggleFollowsSelection,
  onPreset,
  widthPreset,
  onTogglePin,
  pinned,
  onClose,
}: Props) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const optionsButtonRef = React.useRef<HTMLButtonElement>(null)
  const optionsMenuRef = React.useRef<HTMLDivElement>(null)
  const [compactHeader, setCompactHeader] = React.useState(false)
  const [optionsOpen, setOptionsOpen] = React.useState(false)
  const [optionsPosition, setOptionsPosition] =
    React.useState<InspectorOptionsMenuPosition | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const settingLabels: Record<string, string> = {
    enableInspectorAI: 'AI suggestions',
    enableSuggestions: 'Helpful tips',
    enableAutoFix: 'Suggested fixes',
    enableWalkthroughs: 'Guided walkthroughs',
    enableTelemetry: 'Usage insights',
  }

  React.useEffect(() => {
    const node = rootRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width < 380
      setCompactHeader((current) => (current === next ? current : next))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const updateOptionsPosition = React.useCallback(() => {
    const trigger = optionsButtonRef.current
    if (!trigger || typeof window === 'undefined') return
    const menuHeight = optionsMenuRef.current?.offsetHeight ?? 336
    setOptionsPosition(
      computeInspectorOptionsMenuPosition({
        triggerRect: trigger.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        menuHeight,
      }),
    )
  }, [])

  React.useLayoutEffect(() => {
    if (!optionsOpen) return
    updateOptionsPosition()
  }, [optionsOpen, updateOptionsPosition])

  React.useEffect(() => {
    if (!optionsOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        target &&
        (optionsMenuRef.current?.contains(target) ||
          optionsButtonRef.current?.contains(target))
      ) {
        return
      }
      setOptionsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOptionsOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updateOptionsPosition)
    window.addEventListener('scroll', updateOptionsPosition, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updateOptionsPosition)
      window.removeEventListener('scroll', updateOptionsPosition, true)
    }
  }, [optionsOpen, updateOptionsPosition])

  const metadataBadges = (
    <>
      {meta.category && (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
          {meta.category}
        </span>
      )}
      {meta.canBeTrigger && (
        <Badge size="xs" variant="default">
          Trigger
        </Badge>
      )}
      {meta.canBeAction && (
        <Badge size="xs" variant="default">
          Action
        </Badge>
      )}
      {meta.planLabel && (
        <Badge
          size="xs"
          variant={meta.planLabel === 'Elite' ? 'purple' : 'blue'}
        >
          {meta.planLabel}
        </Badge>
      )}
      {hasErrors && (
        <Badge size="xs" variant="red">
          Needs attention
        </Badge>
      )}
      {!hasErrors && hasWarnings && (
        <Badge size="xs" variant="yellow">
          Needs review
        </Badge>
      )}
      {showLayoutBadge && layoutVariant !== 'standard' && (
        <Badge
          size="xs"
          variant="default"
          title={
            layoutBadge
              ? `Layout: ${layoutBadge}`
              : `Layout variant: ${layoutVariant}`
          }
        >
          {layoutBadge ?? layoutVariant}
        </Badge>
      )}
    </>
  )

  const nodeTitle = (
    <span className="flex min-w-0 items-center gap-1 text-xs font-medium text-slate-100">
      {meta.icon ? (
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-800 bg-slate-900 text-[9px] text-slate-400"
          title={meta.icon}
          aria-hidden
        >
          ◆
        </span>
      ) : null}
      <span className="min-w-0 truncate">{meta.label}</span>
    </span>
  )

  const optionsMenu = (
    <div
      ref={optionsMenuRef}
      data-testid="inspector-options-menu"
      className="fixed z-[120] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-slate-800/80 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-2xl shadow-black/50"
      style={{
        top: optionsPosition?.top ?? -9999,
        left: optionsPosition?.left ?? -9999,
        width: optionsPosition?.width ?? 288,
      }}
    >
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium text-slate-300">Mode</span>
          <select
            id="inspector-work-mode"
            data-testid="inspector-mode-select"
            className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
            value={workMode}
            onChange={(e) =>
              onWorkModeChange(e.target.value as InspectorWorkMode)
            }
          >
            <option value="build">Build</option>
            <option value="debug">Debug</option>
            <option value="review">Review</option>
            <option value="expert">Expert</option>
          </select>
        </label>

        {onPreset && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-300">Density</span>
            <select
              className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
              value={widthPreset ?? 'standard'}
              onChange={(e) => {
                const value = e.target.value
                onPreset(
                  value === 'compact' ? 320 : value === 'wide' ? 460 : 380,
                )
              }}
              data-testid="inspector-density-select"
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="wide">Wide</option>
            </select>
          </label>
        )}

        {onToggleFollowsSelection && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-300">
              Follow selected step
            </span>
            <input
              type="checkbox"
              checked={!!followsSelection}
              onChange={onToggleFollowsSelection}
              data-testid="inspector-follow-toggle"
            />
          </label>
        )}

        <div className="border-t border-slate-800/70 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            AI & Privacy
          </p>
          {[
            'enableInspectorAI',
            'enableSuggestions',
            'enableAutoFix',
            'enableWalkthroughs',
            'enableTelemetry',
          ].map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-2 py-1"
            >
              <span className="text-slate-300">
                {settingLabels[key] ?? key}
              </span>
              <input
                data-testid={`inspector-setting-${key}`}
                type="checkbox"
                checked={(settings as any)[key]}
                onChange={(e) => onToggleSetting(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  const actions = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Badge size="xs" variant="blue">
        {planLabel}
      </Badge>
      <button
        ref={optionsButtonRef}
        type="button"
        className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
        onClick={() => setOptionsOpen((open) => !open)}
        aria-expanded={optionsOpen}
        aria-haspopup="menu"
      >
        Options
      </button>
      {mounted && optionsOpen ? createPortal(optionsMenu, document.body) : null}
      {onTogglePin && (
        <button
          className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          onClick={onTogglePin}
          data-testid="inspector-pin-toggle"
          title="Pin inspector"
        >
          {pinned ? 'Unpin' : 'Pin'}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[12px] leading-none text-slate-300 hover:border-slate-700 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          onClick={onClose}
          aria-label="Close step settings"
          title="Close step settings"
        >
          ×
        </button>
      )}
    </div>
  )

  return (
    <div ref={rootRef} className="border-b border-slate-800/80 px-4 py-3">
      {compactHeader ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Step Settings
            </p>
            {actions}
          </div>
          <div>{nodeTitle}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {metadataBadges}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Step Settings
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              {nodeTitle}
              {metadataBadges}
            </div>
          </div>
          {actions}
        </div>
      )}

      {meta.description && (
        <p className="mt-2 text-[11px] text-slate-500">{meta.description}</p>
      )}
    </div>
  )
}

export const InspectorHeader = React.memo(InspectorHeaderComponent)
