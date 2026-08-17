'use client'

import type { BuilderNodeType, NodeData } from '@/lib/builder/node-types'

export type InspectorExplainerContext = {
  layout: string
  tab: string
  pinned?: boolean
  dock?: 'left' | 'right' | 'overlay'
  widthPreset?: 'compact' | 'standard' | 'wide'
  followSelection?: boolean
}

type ExplainerFn = (data: NodeData, ctx: InspectorExplainerContext) => string

const defaultExplainer: ExplainerFn = (data, ctx) => {
  const tone =
    ctx.widthPreset === 'compact'
      ? 'Concise guidance'
      : ctx.widthPreset === 'wide'
        ? 'Detailed reasoning'
        : 'Summary guidance'
  const follow = ctx.followSelection ? 'Inspector follows selection.' : ''
  return `${tone}. Label: ${data.label ?? 'N/A'}. ${follow}`.trim()
}

export const INSPECTOR_AI_EXPLAINERS: Partial<
  Record<BuilderNodeType | 'unknown', Partial<Record<string, ExplainerFn>>>
> = {
  trigger: {
    config: (data) =>
      `This trigger listens for ${data.event ?? 'an event'} from ${data.source ?? 'a source'}.`,
    logs: () => 'Logs show recent trigger executions.',
  },
  delay: {
    config: (data) =>
      `Delay is set to ${data.ms ?? 'unknown'} ${data.unit ?? 'ms'}. Adjust timing to control throughput.`,
  },
  webhook: {
    config: (data) =>
      `Webhook will call ${data.url ?? 'an endpoint'} using ${data.method ?? 'POST'}.`,
  },
  'ai-llm': {
    ai: (data) =>
      `AI node prompt: ${data.prompt ? data.prompt.slice(0, 80) : 'empty'}. Model: ${data.model ?? 'unknown'}.`,
  },
  unknown: {
    data: () =>
      'This node type is not recognized; add schema + layout to unlock insights.',
  },
}

export function explainInspector(
  type: BuilderNodeType | 'unknown',
  tab: string,
  data: NodeData,
  ctx: InspectorExplainerContext,
) {
  const byType = INSPECTOR_AI_EXPLAINERS[type]
  const explainer = byType?.[tab] ?? defaultExplainer
  return explainer(data, ctx)
}
