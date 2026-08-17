'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'

export default function WebhookNode({ data }: NodeProps) {
  const definition =
    typeof data?.__registryNodeId === 'string'
      ? getWorkflowNodeDefinition(data.__registryNodeId)
      : undefined
  const method = data?.method ?? 'POST'
  const url = data?.url ?? ''
  const title = data?.label ?? definition?.label ?? 'Webhook'
  const category = definition?.category ?? 'Integrations'
  const description =
    definition?.id === 'send.email'
      ? 'Prepares an email message for future delivery.'
      : definition?.id === 'send.sms'
        ? 'Prepares an SMS message for future delivery.'
        : (definition?.description ??
          'Receives data from another app or website.')
  const detail =
    definition?.id === 'send.email'
      ? `To ${data?.recipient || 'recipient not set'}`
      : definition?.id === 'send.sms'
        ? `To ${data?.phone || 'phone not set'}`
        : url || 'Webhook URL not set'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={title}
      category={category}
      iconKey={data?.__iconKey ?? definition?.iconKey ?? 'webhook'}
      tone="integration"
      isActive={isActive}
      isHot={isHot}
    >
      <p className="line-clamp-2 text-[11px] text-slate-300">{description}</p>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-slate-200">
          {method}
        </span>
        <span className="line-clamp-1">{detail}</span>
      </div>
    </NodeBase>
  )
}
