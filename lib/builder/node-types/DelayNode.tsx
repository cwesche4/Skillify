'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function DelayNode({ data }: NodeProps) {
  const ms = data?.ms ?? 1000
  const unit = data?.unit ?? 'ms'
  const description =
    data?.description ??
    'Pause execution between steps to control timing and rate limits.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="Delay"
      category="Core"
      tone="core"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Duration</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {ms} {unit}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
        {description}
      </p>
    </NodeBase>
  )
}
