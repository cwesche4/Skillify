'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function GroupNode({ data }: NodeProps) {
  const label = data?.label ?? 'Group'
  const count = data?.count ?? 0
  const note =
    data?.note ??
    'Use groups to visually organize related steps in complex flows.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="Organization"
      tone="group"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Nodes in group</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {count}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">{note}</p>
    </NodeBase>
  )
}
