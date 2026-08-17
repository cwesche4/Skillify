'use client'

import type { NodeTypes } from 'reactflow'

import TriggerNode from './TriggerNode'
import DelayNode from './DelayNode'
import WebhookNode from './WebhookNode'
import AiLLMNode from './AiLLMNode'
import AiClassifierNode from './AiClassifierNode'
import AIDecisionNode from './AIDecisionNode'
import AITransformNode from './AITransformNode'
import AiSplitterNode from './AiSplitterNode'
import OrPathNode from './OrPathNode'
import GroupNode from './GroupNode'
import CRMNode from './CRMNode'
import UnknownNode from './UnknownNode'

export type BuilderNodeType =
  | 'trigger'
  | 'delay'
  | 'webhook'
  | 'ai-llm'
  | 'ai-classifier'
  | 'ai-decision'
  | 'ai-transform'
  | 'ai-splitter'
  | 'or-path'
  | 'group'
  | 'crm-trigger'
  | 'crm-action'
  | 'unknown'

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
  duration?: number
  unit?: 'seconds' | 'minutes' | 'hours' | 'days'

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
  // AI Decision
  branches?: { key: string; label?: string }[]
  confidenceThreshold?: number
  fallbackKey?: string
  // AI Transform
  schema?: { key: string; type: string }[]

  // AI Splitter
  mode?: string
  schemaHint?: string

  // Group
  count?: number
  note?: string
  collapsed?: boolean

  // Logic / OR path
  conditions?: any[]

  // CRM
  provider?: string
  integrationId?: string
  objectType?: string
  action?: string
  payload?: Record<string, any>

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
      duration: 30,
      unit: 'minutes',
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
  'crm-trigger': {
    type: 'crm-trigger',
    label: 'CRM Trigger',
    category: 'Integrations',
    description:
      'Start automations from CRM events (contact created, deal stage changed).',
    proFeature: true,
    defaultData: {
      provider: 'hubspot',
      objectType: 'contact',
      event: 'contact.created',
      integrationId: '',
    },
  },
  'crm-action': {
    type: 'crm-action',
    label: 'CRM Action',
    category: 'Integrations',
    description:
      'Create/update CRM records, log notes, or change deal stages from automations.',
    enterpriseFeature: true,
    defaultData: {
      provider: 'hubspot',
      objectType: 'contact',
      action: 'contact.update',
      integrationId: '',
      payload: {},
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
  'ai-decision': {
    type: 'ai-decision',
    label: 'AI • Decision',
    category: 'AI',
    description:
      'Deterministic AI branching across predefined options with fallback.',
    aiHints: ['List explicit branches and define a confidence threshold.'],
    enterpriseFeature: true,
    defaultData: {
      branches: [
        { key: 'option_a', label: 'Option A' },
        { key: 'option_b', label: 'Option B' },
      ],
      confidenceThreshold: 0.5,
      fallbackKey: 'option_a',
      note: 'Deterministic AI decision across predefined branches.',
    },
  },
  'ai-transform': {
    type: 'ai-transform',
    label: 'AI • Transform',
    category: 'AI',
    description:
      'Transform JSON with schema-bound output; fails on schema mismatch.',
    aiHints: ['Define explicit fields with types; no free-form output.'],
    enterpriseFeature: true,
    defaultData: {
      schema: [{ key: 'field', type: 'string' }],
      note: 'Transforms JSON into schema-bound JSON; fails on mismatch.',
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
      collapsed: false,
    },
  },
  unknown: {
    type: 'unknown',
    label: 'Unknown',
    category: 'Unknown',
    description: 'Experimental or missing node type',
    defaultData: {},
  },
}

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  delay: DelayNode,
  webhook: WebhookNode,
  'crm-trigger': CRMNode,
  'crm-action': CRMNode,
  'ai-llm': AiLLMNode,
  'ai-classifier': AiClassifierNode,
  'ai-splitter': AiSplitterNode,
  'ai-decision': AIDecisionNode,
  'ai-transform': AITransformNode,
  'or-path': OrPathNode,
  group: GroupNode,
  unknown: UnknownNode,
}
