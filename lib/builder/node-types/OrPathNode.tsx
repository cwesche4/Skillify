'use client'

import type { NodeProps } from 'reactflow'
import { Handle, Position } from 'reactflow'
import NodeBase from './NodeBase'
import { cn } from '@/lib/utils'

export default function OrPathNode({ data }: NodeProps) {
  const title =
    data?.label ??
    (data?.__registryNodeId === 'condition.branch'
      ? 'Condition / Branch'
      : 'OR Path')
  const conditionText =
    typeof data?.condition === 'string' ? data.condition.trim() : ''
  const conditions: any[] = data?.conditions ?? []
  const count = conditionText ? 1 : conditions.length
  const description =
    data?.description ?? 'Route runs into paths based on conditions and rules.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true
  const isConditionBranch = data?.__registryNodeId === 'condition.branch'
  const branchPaths = Array.isArray(data?.__lastPreviewOutput?.__branchPaths)
    ? (data.__lastPreviewOutput.__branchPaths as Array<{
        pathKey: string
        pathLabel: string
        status: string
      }>)
    : []
  const branchExplanation =
    typeof data?.__lastPreviewOutput?.__branchExplanation === 'string'
      ? data.__lastPreviewOutput.__branchExplanation
      : ''
  const handleClass = cn(
    '!h-7 !w-7 !border-0 !bg-transparent',
    'cursor-crosshair rounded-full transition',
    'after:absolute after:left-1/2 after:top-1/2 after:h-2.5 after:w-2.5 after:-translate-x-1/2 after:-translate-y-1/2',
    'after:rounded-full after:border after:border-sky-300/70 after:bg-slate-950 after:shadow-[0_0_0_2px_rgba(15,23,42,0.9)] after:transition',
    'hover:after:border-sky-100 hover:after:bg-sky-400 hover:after:shadow-[0_0_0_4px_rgba(56,189,248,0.16)]',
  )

  return (
    <NodeBase
      title={title}
      category="Logic"
      iconKey={data?.__iconKey ?? 'branch'}
      tone="logic"
      isActive={isActive}
      isHot={isHot}
      showDefaultHandles={!isConditionBranch}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Conditions</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {count || 'None'}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
        {description}
      </p>
      {isConditionBranch && branchExplanation ? (
        <div className="mt-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100">
          {branchExplanation.includes('Result: Matched')
            ? `Matched: ${conditionText || 'condition matched'}`
            : 'Otherwise selected'}
        </div>
      ) : null}
      {isConditionBranch ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={handleClass}
            style={{ left: -10 }}
          />
          {[
            { id: 'match', label: 'Matches', top: '44%' },
            { id: 'fallback', label: 'Otherwise', top: '72%' },
          ].map((handle) => (
            <div key={handle.id}>
              <div
                className="pointer-events-none absolute -right-[102px] z-10 flex -translate-y-1/2 items-center gap-1.5"
                style={{ top: handle.top }}
              >
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-lg shadow-black/30',
                    branchPaths.find((path) => path.pathKey === handle.id)
                      ?.status === 'selected'
                      ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                      : branchPaths.find((path) => path.pathKey === handle.id)
                            ?.status === 'skipped'
                        ? 'border-slate-800/80 bg-slate-950/80 text-slate-500'
                        : 'border-slate-700/80 bg-slate-950/95 text-slate-200',
                  )}
                >
                  <span className="mr-1 text-sky-300">○</span>
                  {handle.label}
                </span>
                <span className="h-px w-8 bg-sky-300/45" />
              </div>
              <Handle
                id={handle.id}
                type="source"
                position={Position.Right}
                className={handleClass}
                style={{
                  right: -10,
                  top: handle.top,
                }}
              />
            </div>
          ))}
        </>
      ) : null}
    </NodeBase>
  )
}
