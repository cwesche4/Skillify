'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AiClassifierNode({ data }: NodeProps) {
  const categories: string[] = data?.categories ?? []
  const fallback = data?.fallback ?? 'fallback'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="AI • Classifier"
      category="AI"
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">
        Categories:{' '}
        {categories.length > 0
          ? categories.join(', ')
          : 'No categories configured.'}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Fallback</span>
        <span className="text-slate-300">{fallback}</span>
      </div>
    </NodeBase>
  )
}
