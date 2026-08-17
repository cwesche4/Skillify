'use client'

'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AiClassifierNode({ data }: NodeProps) {
  const categories: Array<string | { key: string; description?: string }> =
    data?.categories ?? []
  const fallback = data?.fallback ?? 'fallback'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="AI • Classifier"
      category="AI"
      iconKey={data?.__iconKey ?? 'tags'}
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">Categories</div>
      <div className="mt-1 space-y-1">
        {categories.map((c) => {
          const key = typeof c === 'string' ? c : (c?.key ?? '')
          const description =
            typeof c === 'string' ? '' : (c?.description ?? '')
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
            >
              <div className="flex flex-col">
                <span className="text-slate-100">{key || 'Category'}</span>
                {description ? (
                  <span className="text-[10px] text-slate-500">
                    {description}
                  </span>
                ) : null}
              </div>
              <span className="text-slate-500">{key}</span>
            </div>
          )
        })}
        {categories.length === 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            No categories configured. Add predefined categories to enable
            routing.
          </div>
        )}
      </div>
      <div className="mt-2 text-[10px] text-slate-500">
        <span className="text-slate-300">Fallback:</span> {fallback}
      </div>
    </NodeBase>
  )
}
