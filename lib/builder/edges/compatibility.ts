import type { BuilderNodeType } from '@/lib/builder/node-types'

// Static, human-readable compatibility map. No inference.
export const COMPATIBLE_NEXT: Record<BuilderNodeType, BuilderNodeType[]> = {
  trigger: ['webhook', 'ai-llm', 'ai-transform', 'delay'],
  delay: ['webhook', 'ai-llm', 'ai-transform'],
  webhook: ['webhook', 'ai-llm', 'ai-transform', 'delay'],
  'ai-llm': ['webhook', 'ai-decision', 'ai-transform', 'delay'],
  'ai-classifier': ['webhook', 'ai-decision', 'ai-transform'],
  'ai-decision': ['webhook', 'ai-llm', 'ai-transform', 'delay'],
  'ai-transform': ['webhook', 'ai-llm', 'ai-decision', 'delay'],
  'ai-splitter': ['webhook', 'ai-llm', 'ai-transform'],
  'or-path': ['webhook', 'ai-llm', 'ai-transform'],
  group: ['trigger', 'webhook', 'ai-llm', 'ai-transform', 'delay'],
  'crm-trigger': ['crm-action', 'ai-llm', 'ai-transform'],
  'crm-action': ['webhook', 'ai-llm', 'ai-transform', 'delay'],
  unknown: [],
}

export function getCompatibleNext(type: BuilderNodeType): BuilderNodeType[] {
  return COMPATIBLE_NEXT[type] ?? []
}
