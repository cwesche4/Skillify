'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from '@/lib/builder/node-types/NodeBase'

export default function AiTransformNode({ data }: NodeProps) {
  const label = data?.label ?? 'AI Transform'
  const schema: { key: string; type: string }[] = data?.schema ?? []
  const note =
    data?.note ??
    'Transforms structured input into schema-bound output; fails on mismatch.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="AI"
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">Output Schema</div>
      <div className="mt-1 space-y-1">
        {schema.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <span className="text-slate-100">{f.key}</span>
            <span className="text-slate-500">{f.type}</span>
          </div>
        ))}
        {schema.length === 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            No output schema defined. Add fields to enable validation.
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{note}</p>
      <div className="mt-1 text-[10px] text-slate-500">
        No branching or execution control; node fails if output mismatches
        schema.
      </div>
    </NodeBase>
  )
}
