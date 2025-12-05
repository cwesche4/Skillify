"use client"

import type { NodeProps } from "reactflow"

// Correct named imports — no defaults allowed
import { AiClassifierNode } from "./AiClassifierNode"
import { AiLLMNode } from "./AiLLMNode"
import { AiSplitterNode } from "./AiSplitterNode"
import { DelayNode } from "./DelayNode"
import { GroupNode } from "./GroupNode"
import { OrPathNode } from "./OrPathNode"
import { TriggerNode } from "./TriggerNode"
import { WebhookNode } from "./WebhookNode"

// All supported node types
export type BuilderNodeType =
  | "trigger"
  | "delay"
  | "webhook"
  | "group"
  | "ai-llm"
  | "ai-classifier"
  | "ai-splitter"
  | "or-path"

// ONE shape for all nodes
export interface NodeData {
  label?: string
  prompt?: string
  classes?: string[]
  durationMinutes?: number
  url?: string
  method?: string
  count?: number // group nodes only
}

/**
 * Map of type -> component.
 */
export const nodeTypes = {
  trigger: TriggerNode,
  delay: DelayNode,
  webhook: WebhookNode,
  group: GroupNode,
  "ai-llm": AiLLMNode,
  "ai-classifier": AiClassifierNode,
  "ai-splitter": AiSplitterNode,
  "or-path": OrPathNode,
} as const satisfies Record<BuilderNodeType, any>
