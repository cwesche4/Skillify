'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from '@/lib/builder/node-types/NodeBase'
import type { DecisionCategory } from '@/lib/ai/nodes/decision/types'

export default function AiDecisionNode({ data }: NodeProps) {
  const label = data?.label ?? 'AI Decision'
  const categories: DecisionCategory[] = data?.categories ?? []
  const prompt: string = data?.prompt ?? ''
  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={label}
      category="AI"
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="text-[11px] text-slate-300">Categories</div>
      <div className="mt-1 space-y-1">
        {categories.map((c) => (
          <div
            key={c.key}
            className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <div className="flex flex-col">
              <span className="text-slate-100">{c.label || c.key}</span>
              {c.description ? (
                <span className="text-[10px] text-slate-500">
                  {c.description}
                </span>
              ) : null}
            </div>
            <span className="text-slate-500">{c.key}</span>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            No categories defined. Add predefined categories to enable routing.
          </div>
        )}
      </div>
      {prompt ? (
        <div className="mt-2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
          Prompt (static): {prompt}
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-slate-400">
          No prompt configured. Decision must still use predefined categories
          only.
        </div>
      )}
    </NodeBase>
  )
}
