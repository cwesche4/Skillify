'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function TriggerNode({ data }: NodeProps) {
  const event = data?.event ?? 'Manual trigger'
  const source = data?.source ?? 'Internal'
  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="Trigger"
      category="Core"
      iconKey={data?.__iconKey ?? 'database'}
      tone="core"
      isActive={isActive}
      isHot={isHot}
    >
      <p className="line-clamp-2 text-[11px] text-slate-300">
        Starts this workflow manually or from an event.
      </p>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-slate-200">
          {event}
        </span>
        <span>{source}</span>
      </div>
    </NodeBase>
  )
}
