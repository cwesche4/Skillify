'use client'

import type { ReactNode } from 'react'
import { Handle, Position } from 'reactflow'
import { cn } from '@/lib/utils'
import { getWorkflowNodeIcon } from '@/lib/workflows/nodeIcons'

type NodeTone = 'core' | 'ai' | 'integration' | 'logic' | 'group' | 'warning'

interface ToneStyle {
  border: string
  shadow: string
  pillBg: string
  pillText: string
  title: string
  ring: string
}

const TONE_STYLES: Record<NodeTone, ToneStyle> = {
  core: {
    border: 'border-emerald-500/40',
    shadow: 'shadow-emerald-900/30',
    pillBg: 'bg-emerald-500/10',
    pillText: 'text-emerald-300',
    title: 'text-emerald-200',
    ring: 'ring-emerald-400',
  },
  ai: {
    border: 'border-purple-500/40',
    shadow: 'shadow-purple-900/30',
    pillBg: 'bg-purple-500/10',
    pillText: 'text-purple-300',
    title: 'text-purple-200',
    ring: 'ring-purple-400',
  },
  integration: {
    border: 'border-sky-500/40',
    shadow: 'shadow-sky-900/30',
    pillBg: 'bg-sky-500/10',
    pillText: 'text-sky-300',
    title: 'text-sky-200',
    ring: 'ring-sky-400',
  },
  logic: {
    border: 'border-amber-500/40',
    shadow: 'shadow-amber-900/30',
    pillBg: 'bg-amber-500/10',
    pillText: 'text-amber-300',
    title: 'text-amber-200',
    ring: 'ring-amber-400',
  },
  warning: {
    border: 'border-amber-500/40',
    shadow: 'shadow-amber-900/30',
    pillBg: 'bg-amber-500/10',
    pillText: 'text-amber-300',
    title: 'text-amber-200',
    ring: 'ring-amber-400',
  },
  group: {
    border: 'border-indigo-500/40',
    shadow: 'shadow-indigo-900/30',
    pillBg: 'bg-indigo-500/10',
    pillText: 'text-indigo-300',
    title: 'text-indigo-200',
    ring: 'ring-indigo-400',
  },
}

interface NodeBaseProps {
  title: string
  category?: string
  iconKey?: string
  tone?: NodeTone
  isActive?: boolean // live / replaying
  isHot?: boolean // heatmap / failure hotspot
  showDefaultHandles?: boolean
  children?: ReactNode
}

export default function NodeBase({
  title,
  category = 'Node',
  iconKey,
  tone = 'core',
  isActive = false,
  isHot = false,
  showDefaultHandles = true,
  children,
}: NodeBaseProps) {
  const toneStyle = TONE_STYLES[tone]
  const Icon = getWorkflowNodeIcon(iconKey)
  const handleClass = cn(
    '!h-7 !w-7 !border-0 !bg-transparent',
    'cursor-crosshair rounded-full transition',
    'after:absolute after:left-1/2 after:top-1/2 after:h-2.5 after:w-2.5 after:-translate-x-1/2 after:-translate-y-1/2',
    'after:rounded-full after:border after:border-sky-300/60 after:bg-slate-950 after:shadow-[0_0_0_2px_rgba(15,23,42,0.8)] after:transition',
    'hover:after:border-sky-200 hover:after:bg-sky-400 hover:after:shadow-[0_0_0_4px_rgba(56,189,248,0.16)]',
  )

  return (
    <div
      className={cn(
        'group relative min-w-[220px] select-none rounded-xl border bg-slate-950/95 p-3.5 text-xs text-slate-100',
        'shadow-md backdrop-blur-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-slate-900/60',
        toneStyle.border,
        toneStyle.shadow,
        isActive && [
          'animate-pulse',
          'ring-2 ring-offset-2 ring-offset-slate-950',
          toneStyle.ring,
        ],
        isHot && 'border-rose-500/70 shadow-[0_0_25px_rgba(248,113,113,0.55)]',
      )}
    >
      {/* HEADER */}
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-slate-950/80',
              toneStyle.border,
              toneStyle.title,
            )}
            aria-hidden="true"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <div
              className={cn(
                'line-clamp-2 text-sm font-semibold leading-tight',
                toneStyle.title,
              )}
            >
              {title}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              {category}
            </div>
          </div>
        </div>

        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
            toneStyle.pillBg,
            toneStyle.pillText,
          )}
        >
          {category}
        </span>
      </div>

      {/* BODY */}
      <div className="space-y-2 text-[11px] leading-relaxed text-slate-300/95">
        {children}
      </div>

      {showDefaultHandles ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={handleClass}
            style={{ left: -10 }}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={handleClass}
            style={{ right: -10 }}
          />
        </>
      ) : null}
    </div>
  )
}
