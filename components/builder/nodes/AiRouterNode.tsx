'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from '@/lib/builder/node-types/NodeBase'
import type { RouterLabel } from '@/lib/ai/nodes/router/types'

export default function AiRouterNode({ data }: NodeProps) {
  const label = data?.label ?? 'AI Router'
  const allowed: RouterLabel[] = data?.allowedLabels ?? []
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
      <div className="text-[11px] text-slate-300">Allowed Labels</div>
      <div className="mt-1 space-y-1">
        {allowed.map((l) => (
          <div
            key={l.key}
            className="flex items-center justify-between rounded border border-slate-800/70 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <div className="flex flex-col">
              <span className="text-slate-100">{l.label || l.key}</span>
              {l.description ? (
                <span className="text-[10px] text-slate-500">
                  {l.description}
                </span>
              ) : null}
            </div>
            <span className="text-slate-500">{l.key}</span>
          </div>
        ))}
        {allowed.length === 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            No labels defined. Add predefined labels to enable routing.
          </div>
        )}
      </div>
      {prompt ? (
        <div className="mt-2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
          Prompt (static): {prompt}
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-slate-400">
          No prompt configured. Routing must still use predefined labels only.
        </div>
      )}
      <div className="mt-1 text-[10px] text-slate-500">
        Multiple branches may activate; each match is logged.
      </div>
    </NodeBase>
  )
}
