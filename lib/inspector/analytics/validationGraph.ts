import type { BuilderNodeType, NodeData } from '@/lib/builder/node-types'
import { validateNodeData } from '@/lib/builder/node-schemas'

export type ValidationGraphNode = {
  id: string
  state: 'ok' | 'warn' | 'error'
  messages: string[]
}

export type ValidationGraph = {
  nodes: ValidationGraphNode[]
}

// Pure, deterministic helper to derive validation graph data from existing validation logic.
export function buildValidationGraph(
  nodeType: BuilderNodeType | undefined,
  data: NodeData | undefined,
): ValidationGraph {
  if (!nodeType || !data) return { nodes: [] }
  const validated = validateNodeData(nodeType, { ...data })
  if (!validated.ok) {
    return {
      nodes: [
        {
          id: 'root',
          state: 'error',
          messages: validated.errors ?? [],
        },
      ],
    }
  }
  return { nodes: [{ id: 'root', state: 'ok', messages: [] }] }
}
