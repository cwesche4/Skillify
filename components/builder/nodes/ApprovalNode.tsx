'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from '@/lib/builder/node-types/NodeBase'

export default function ApprovalNode({ data }: NodeProps) {
  const label = data?.label ?? 'Approval Gate'
  const note =
    data?.note ??
    'Pauses execution for human approval; append-only approval events; no auto-approval.'
  const slaHint = data?.slaHint ?? 'No SLA; approvals are explicit.'
  const reasonRequired = data?.reasonRequired ?? true

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="Control"
      tone="warning"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">
        Approval required: {reasonRequired ? 'Yes' : 'Optional'}
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        {note}
        <br />
        {slaHint}
      </div>
    </NodeBase>
  )
}
