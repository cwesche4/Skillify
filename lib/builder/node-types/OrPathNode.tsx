'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function OrPathNode({ data }: NodeProps) {
  const conditions: any[] = data?.conditions ?? []
  const count = conditions.length
  const description =
    data?.description ?? 'Route runs into paths based on conditions and rules.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="OR Path"
      category="Logic"
      tone="logic"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Conditions</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {count || 'None'}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
        {description}
      </p>
    </NodeBase>
  )
}
