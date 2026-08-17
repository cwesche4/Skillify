'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import {
  formatDelayUnit,
  normalizeDelayUnit,
} from '@/lib/workflows/delayConfig'

export default function DelayNode({ data }: NodeProps) {
  const definition =
    typeof data?.__registryNodeId === 'string'
      ? getWorkflowNodeDefinition(data.__registryNodeId)
      : undefined
  const duration = data?.duration ?? data?.ms ?? 30
  const unit = normalizeDelayUnit(data?.unit) ?? 'minutes'
  const waitAmount = Number(duration)
  const waitLabel = `${Number.isFinite(waitAmount) ? waitAmount : 30} ${formatDelayUnit(
    unit,
    Number.isFinite(waitAmount) ? waitAmount : 30,
  ).toLowerCase()}`
  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={data?.label ?? definition?.label ?? 'Delay'}
      category={definition?.category ?? 'Core'}
      iconKey={data?.__iconKey ?? definition?.iconKey ?? 'clock'}
      tone="core"
      isActive={isActive}
      isHot={isHot}
    >
      <p className="line-clamp-2 text-[11px] text-slate-300">
        Waits before continuing to the next step.
      </p>
      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
        <span>Wait</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {waitLabel}
        </span>
      </div>
    </NodeBase>
  )
}
