import type { Connection, Edge, Node } from 'reactflow'

import { validateWorkflowConnection } from '@/lib/workflows/connectionRules'
import { hasPathBetweenNodes } from '@/lib/workflows/triggerRepair'

export type NodeBodyConnectionResult =
  | { valid: true; connection: Connection }
  | { valid: false; reason: string }

export function resolveNodeBodyConnection({
  nodes,
  edges,
  sourceId,
  targetId,
  sourceHandle = null,
  explicitTargetHandle,
  compatibleTargetHandles,
}: {
  nodes: Node[]
  edges: Edge[]
  sourceId?: string | null
  targetId?: string | null
  sourceHandle?: string | null
  explicitTargetHandle?: string | null
  compatibleTargetHandles?: Array<string | null>
}): NodeBodyConnectionResult {
  if (!sourceId || !targetId) {
    return {
      valid: false,
      reason: 'This node does not accept this connection.',
    }
  }
  if (sourceId === targetId) {
    return { valid: false, reason: 'A node cannot connect to itself.' }
  }
  if (
    edges.some((edge) => edge.source === sourceId && edge.target === targetId)
  ) {
    return { valid: false, reason: 'These steps are already connected.' }
  }
  if (hasPathBetweenNodes({ edges, sourceId: targetId, targetId: sourceId })) {
    return { valid: false, reason: 'This connection would create a loop.' }
  }

  const targetHandles = compatibleTargetHandles ?? [null]
  const targetHandle =
    explicitTargetHandle !== undefined
      ? explicitTargetHandle
      : targetHandles.length === 1
        ? targetHandles[0]
        : undefined

  if (targetHandle === undefined) {
    return {
      valid: false,
      reason: 'Choose the specific input handle for this step.',
    }
  }

  const source = nodes.find((node) => node.id === sourceId)
  const target = nodes.find((node) => node.id === targetId)
  const compatibility = validateWorkflowConnection({
    source,
    target,
    edges,
    sourceHandle,
    targetHandle,
  })
  if (!compatibility.valid) {
    return {
      valid: false,
      reason:
        compatibility.reason ?? 'This node does not accept this connection.',
    }
  }

  return {
    valid: true,
    connection: {
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
    },
  }
}
