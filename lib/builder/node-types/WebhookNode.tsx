'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function WebhookNode({ data }: NodeProps) {
  const method = data?.method ?? 'POST'
  const url = data?.url ?? 'Not configured'
  const auth = data?.auth ?? 'none'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="Webhook"
      category="Integrations"
      tone="integration"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Method</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {method}
        </span>
      </div>
      <div className="mt-1 line-clamp-1 text-[10px] text-slate-400">{url}</div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Auth</span>
        <span className="uppercase text-slate-300">{auth}</span>
      </div>
    </NodeBase>
  )
}
