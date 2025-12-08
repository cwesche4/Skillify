'use client'

import type { ReactNode } from 'react'
import { Handle, Position } from 'reactflow'
import { cn } from '@/lib/utils'

type NodeTone = 'core' | 'ai' | 'integration' | 'logic' | 'group'

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
  tone?: NodeTone
  isActive?: boolean // live / replaying
  isHot?: boolean // heatmap / failure hotspot
  children?: ReactNode
}

export default function NodeBase({
  title,
  category = 'Node',
  tone = 'core',
  isActive = false,
  isHot = false,
  children,
}: NodeBaseProps) {
  const toneStyle = TONE_STYLES[tone]

  return (
    <div
      className={cn(
        'group rounded-xl border bg-slate-950/90 p-3 text-xs text-slate-100',
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
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className={cn('text-xs font-semibold', toneStyle.title)}>
            {title}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {category}
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
      <div className="space-y-1.5 text-[11px] text-slate-200/90">
        {children}
      </div>

      {/* Default handles */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
