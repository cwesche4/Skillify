'use client'

import type { NodeTypes } from 'reactflow'

import TriggerNode from './TriggerNode'
import DelayNode from './DelayNode'
import WebhookNode from './WebhookNode'
import AiLLMNode from './AiLLMNode'
import AiClassifierNode from './AiClassifierNode'
import AiSplitterNode from './AiSplitterNode'
import OrPathNode from './OrPathNode'
import GroupNode from './GroupNode'

export type BuilderNodeType =
  | 'trigger'
  | 'delay'
  | 'webhook'
  | 'ai-llm'
  | 'ai-classifier'
  | 'ai-splitter'
  | 'or-path'
  | 'group'

export type PlanId = 'basic' | 'pro' | 'elite'

export interface NodeData {
  // Shared
  label?: string
  description?: string
  status?: 'idle' | 'running' | 'success' | 'failed'
  __active?: boolean
  __hot?: boolean
  __replayActive?: boolean

  // Trigger
  event?: string
  source?: string

  // Delay
  ms?: number
  unit?: 'ms' | 's' | 'm' | 'h'

  // Webhook
  url?: string
  method?: string
  auth?: string

  // AI LLM
  model?: string
  temperature?: number
  prompt?: string

  // AI Classifier
  categories?: string[]
  fallback?: string

  // AI Splitter
  mode?: string
  schemaHint?: string

  // Group
  count?: number
  note?: string

  // Logic / OR path
  conditions?: any[]

  // Anything else
  [key: string]: any
}

export interface NodeDefinition {
  type: BuilderNodeType
  label: string
  category: string
  description?: string
  aiHints?: string[]
  proFeature?: boolean
  enterpriseFeature?: boolean
  defaultData?: Partial<NodeData>
}

export const NODE_DEFINITIONS: Record<BuilderNodeType, NodeDefinition> = {
  trigger: {
    type: 'trigger',
    label: 'Trigger',
    category: 'Core',
    description: 'Starts this automation when the trigger event fires.',
    defaultData: {
      event: 'manual',
      source: 'Internal',
    },
  },
  delay: {
    type: 'delay',
    label: 'Delay',
    category: 'Core',
    description:
      'Pause execution between steps to control timing and rate limits.',
    defaultData: {
      ms: 1000,
      unit: 'ms',
    },
  },
  webhook: {
    type: 'webhook',
    label: 'Webhook',
    category: 'Integrations',
    description: 'Send or receive data via HTTP to integrate external tools.',
    defaultData: {
      method: 'POST',
      url: '',
      auth: 'none',
    },
  },
  'ai-llm': {
    type: 'ai-llm',
    label: 'AI • LLM',
    category: 'AI',
    description: 'Call an LLM to generate or transform text using a prompt.',
    aiHints: [
      'Describe the expected output format clearly.',
      'Reference inputs with tokens like {{ customer_name }}.',
    ],
    proFeature: true,
    defaultData: {
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      prompt: '',
    },
  },
  'ai-classifier': {
    type: 'ai-classifier',
    label: 'AI • Classifier',
    category: 'AI',
    description: 'Classify events or messages into categories.',
    aiHints: ['List 3–8 clear, mutually exclusive categories.'],
    proFeature: true,
    defaultData: {
      categories: ['lead', 'customer', 'spam'],
      fallback: 'fallback',
    },
  },
  'ai-splitter': {
    type: 'ai-splitter',
    label: 'AI • Splitter',
    category: 'AI',
    description:
      'Extract structured fields (JSON / schema) from unstructured text.',
    aiHints: ['Define a clear JSON schema with types and examples.'],
    proFeature: true,
    defaultData: {
      mode: 'json',
      schemaHint:
        '{ "name": "string", "email": "string", "message": "string" }',
    },
  },
  'or-path': {
    type: 'or-path',
    label: 'OR Path',
    category: 'Logic',
    description: 'Route runs into different branches based on conditions.',
    defaultData: {
      conditions: [],
    },
  },
  group: {
    type: 'group',
    label: 'Group',
    category: 'Organization',
    description: 'Visually group related nodes in complex flows.',
    defaultData: {
      count: 0,
      note: 'Use groups to visually organize related steps in complex flows.',
    },
  },
}

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  delay: DelayNode,
  webhook: WebhookNode,
  'ai-llm': AiLLMNode,
  'ai-classifier': AiClassifierNode,
  'ai-splitter': AiSplitterNode,
  'or-path': OrPathNode,
  group: GroupNode,
}
