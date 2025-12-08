'use client'

import { useMemo } from 'react'
import type { Node } from 'reactflow'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { LockedFeatureTooltip } from '@/components/upsell/LockedFeatureTooltip'
import { FeatureLockOverlay } from '@/components/upsell/FeatureLockOverlay'

import {
  NODE_DEFINITIONS,
  type BuilderNodeType,
  type NodeData,
} from '@/lib/builder/node-types'

type PlanLabel = 'Basic' | 'Pro' | 'Elite' | string

export interface InspectorPanelProps {
  node: Node<NodeData> | null
  onChangeNode: (nodeId: string, data: Partial<NodeData>) => void
  onAiImprove: () => Promise<void> | void
  workspaceId: string
  automationId: string
  planLabel: PlanLabel
}

function hasPro(plan: PlanLabel) {
  return plan === 'Pro' || plan === 'Elite'
}

function hasElite(plan: PlanLabel) {
  return plan === 'Elite'
}

export default function InspectorPanel({
  node,
  onChangeNode,
  onAiImprove,
  workspaceId,
  automationId,
  planLabel,
}: InspectorPanelProps) {
  const router = useRouter()

  const meta = useMemo(() => {
    if (!node) return null
    return NODE_DEFINITIONS[node.type as BuilderNodeType] ?? null
  }, [node])

  if (!node || !meta) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-950/95 px-4">
        <p className="text-xs font-medium text-slate-400">No node selected</p>
        <p className="max-w-[220px] text-center text-[11px] text-slate-500">
          Click any node on the canvas to inspect its configuration.
        </p>
      </div>
    )
  }

  const data: NodeData = (node.data as any) || {}

  const proLocked = !!meta.proFeature && !hasPro(planLabel)
  const eliteLocked = !!meta.enterpriseFeature && !hasElite(planLabel)
  const locked = proLocked || eliteLocked

  const lockMessage = eliteLocked
    ? 'This node is available on the Elite plan.'
    : proLocked
      ? 'This node is available on Pro & Elite plans.'
      : undefined

  const handleFieldChange = (key: keyof NodeData, value: any) => {
    onChangeNode(node.id, {
      ...data,
      [key]: value,
    })
  }

  const canAiImprove = hasPro(planLabel)

  return (
    <div className="flex h-full flex-col border-l border-slate-800/80 bg-slate-950/95">
      {/* HEADER */}
      <div className="border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Inspector
            </p>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-100">
                {meta.label}
              </span>

              {meta.category && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                  {meta.category}
                </span>
              )}
            </div>
          </div>

          <Badge size="xs" variant="blue">
            {planLabel}
          </Badge>
        </div>

        {meta.description && (
          <p className="mt-2 text-[11px] text-slate-500">{meta.description}</p>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 space-y-4 overflow-auto px-4 py-3">
        {locked && lockMessage && (
          <LockedFeatureTooltip
            planLabel={planLabel}
            requiredPlan={eliteLocked ? 'Elite' : 'Pro'}
            message={lockMessage}
          />
        )}

        <FeatureLockOverlay
          planLabel={planLabel}
          requiredPlan={eliteLocked ? 'Elite' : proLocked ? 'Pro' : undefined}
          onUpgradeClick={() => router.push('/marketing/pricing')}
          className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3"
        >
          {/* LABEL */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300">
              Label
            </label>
            <Input
              value={data.label ?? meta.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              className="h-8 text-[12px]"
            />
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300">
              Description
            </label>
            <Textarea
              value={data.description ?? ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              className="resize-none text-[12px]"
            />
          </div>

          {/* TRIGGER */}
          {node.type === 'trigger' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">
                Trigger Event
              </label>
              <Input
                value={data.event ?? 'manual'}
                onChange={(e) => handleFieldChange('event', e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>
          )}

          {/* DELAY */}
          {node.type === 'delay' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">
                Delay (ms)
              </label>
              <Input
                type="number"
                value={data.ms ?? 1000}
                onChange={(e) =>
                  handleFieldChange('ms', Number(e.target.value || 0))
                }
                className="h-8 text-[12px]"
              />
            </div>
          )}

          {/* WEBHOOK */}
          {node.type === 'webhook' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  URL
                </label>
                <Input
                  value={data.url ?? ''}
                  onChange={(e) => handleFieldChange('url', e.target.value)}
                  className="h-8 text-[12px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  Method
                </label>
                <Input
                  value={data.method ?? 'POST'}
                  onChange={(e) => handleFieldChange('method', e.target.value)}
                  className="h-8 text-[12px]"
                />
              </div>
            </>
          )}

          {/* AI NODES */}
          {(node.type === 'ai-llm' ||
            node.type === 'ai-classifier' ||
            node.type === 'ai-splitter') && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">
                AI Prompt / Instructions
              </label>
              <Textarea
                value={data.prompt ?? ''}
                onChange={(e) => handleFieldChange('prompt', e.target.value)}
                rows={4}
                className="resize-none text-[12px]"
              />
              <p className="text-[10px] text-slate-500">
                Keep prompts specific. Mention inputs like{' '}
                {'{{ customer_name }}'} and describe expected outputs.
              </p>
            </div>
          )}

          {/* AI IMPROVE BUTTON */}
          {canAiImprove && (
            <button
              onClick={() => onAiImprove()}
              className="btn btn-primary mt-4 w-full"
            >
              Improve with AI
            </button>
          )}
        </FeatureLockOverlay>
      </div>

      {/* FOOTER */}
      <div className="border-t border-slate-800/80 bg-slate-950/95 px-3 py-3">
        <UpsellMicroCard
          workspaceId={workspaceId}
          automationId={automationId}
          feature="inspector-help"
          title="Want us to configure this step?"
          description="We'll tune this node, write prompts, and align it to your workflow."
          priceHint="Quick node setups usually cost $19–$49."
        />
      </div>
    </div>
  )
}
