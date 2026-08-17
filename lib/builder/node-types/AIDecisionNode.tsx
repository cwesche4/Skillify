'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AIDecisionNode({ data }: NodeProps) {
  const label = data?.label ?? 'AI Decision'
  const branches: { key: string; label?: string }[] = data?.branches ?? []
  const threshold = data?.confidenceThreshold ?? 0.5
  const note =
    data?.note ??
    'Deterministic AI decision across predefined branches with fallback.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="AI"
      iconKey={data?.__iconKey ?? 'brain-circuit'}
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>Threshold</span>
        <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-emerald-100">
          {threshold}
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {branches.map((b) => (
          <div
            key={b.key}
            className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <span className="text-slate-100">{b.label || b.key}</span>
            <span className="text-slate-500">{b.key}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] text-slate-400">{note}</p>
    </NodeBase>
  )
}
