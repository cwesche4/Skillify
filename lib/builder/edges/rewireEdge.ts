import type { Edge } from 'reactflow'
import type { BuilderNodeType } from '@/lib/builder/node-types'
import { getCompatibleNext } from './compatibility'

// Explicit edge rewiring.
// No inference or execution mutation.
export function rewireEdge(
  edge: Edge,
  targetNodeType: BuilderNodeType,
  targetNodeId: string,
): Edge | null {
  const compat = getCompatibleNext(edge.source as BuilderNodeType)
  if (!compat.includes(targetNodeType)) return null
  return {
    ...edge,
    target: targetNodeId,
  }
}
