import type { BuilderNodeType } from '@/lib/builder/node-types'

export type NodeCompatibility = {
  from: BuilderNodeType
  allowedNext: BuilderNodeType[]
}

// Explicit, deterministic compatibility map. Update as new node types are added.
export const compatibilityMap: NodeCompatibility[] = [
  {
    from: 'trigger',
    allowedNext: ['webhook', 'ai-decision', 'ai-llm', 'ai-transform', 'delay'],
  },
  {
    from: 'webhook',
    allowedNext: ['webhook', 'ai-decision', 'ai-llm', 'ai-transform', 'delay'],
  },
  {
    from: 'ai-llm',
    allowedNext: ['webhook', 'ai-decision', 'ai-transform', 'delay'],
  },
  {
    from: 'ai-decision',
    allowedNext: [
      'webhook',
      'ai-llm',
      'ai-transform',
      'delay',
    ] as BuilderNodeType[],
  },
  {
    from: 'ai-transform',
    allowedNext: ['webhook', 'ai-decision', 'ai-llm', 'delay'],
  },
]
