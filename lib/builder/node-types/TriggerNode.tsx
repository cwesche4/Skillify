'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function TriggerNode({ data }: NodeProps) {
  const event = data?.event ?? 'Manual trigger'
  const source = data?.source ?? 'Internal'
  const description =
    data?.description ?? 'Starts this automation when the trigger event fires.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="Trigger"
      category="Core"
      tone="core"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-300">Event</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {event}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Source</span>
        <span className="text-slate-300">{source}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
        {description}
      </p>
    </NodeBase>
  )
}
