'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AITransformNode({ data }: NodeProps) {
  const label = data?.label ?? 'AI Transform'
  const fields: { key: string; type: string }[] = data?.schema ?? []
  const note =
    data?.note ??
    'Transforms JSON input into validated, schema-bound JSON output.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="AI"
      iconKey={data?.__iconKey ?? 'wand'}
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">Schema (expected)</div>
      <div className="mt-1 space-y-1">
        {fields.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <span className="text-slate-100">{f.key}</span>
            <span className="text-slate-500">{f.type}</span>
          </div>
        ))}
        {fields.length === 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            No fields defined. Add a schema to enable validation.
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] text-slate-400">{note}</p>
    </NodeBase>
  )
}
