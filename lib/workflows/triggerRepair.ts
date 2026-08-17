import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { WorkflowConnectionRole } from '@/lib/workflows/types'

export type MissingTriggerRepairContext = {
  type: 'missing-trigger'
  targetNodeId: string
  insertion: 'before'
  preferredNodeIds?: string[]
}

export type TriggerRepairContext = MissingTriggerRepairContext

export type TriggerRepairTargetResult =
  | { status: 'insert'; targetNodeId: string }
  | { status: 'already-triggered'; targetNodeId: string }
  | { status: 'missing-target'; targetNodeId: string }
  | { status: 'ambiguous-root'; targetNodeId: string }
  | { status: 'cycle-detected'; targetNodeId: string }

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

export function getWorkflowConnectionRoleForNode(
  node: Node | undefined,
): WorkflowConnectionRole | null {
  if (!node) return null
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  return (
    definition?.connectionRole ??
    (definition?.canBeTrigger ? 'trigger' : 'action')
  )
}

export function isWorkflowTriggerNode(node: Node | undefined) {
  return getWorkflowConnectionRoleForNode(node) === 'trigger'
}

export function hasPathBetweenNodes({
  edges,
  sourceId,
  targetId,
}: {
  edges: Edge[]
  sourceId: string
  targetId: string
}) {
  if (sourceId === targetId) return true
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const next = outgoing.get(edge.source) ?? []
    next.push(edge.target)
    outgoing.set(edge.source, next)
  }

  const visited = new Set<string>()
  const queue = [sourceId]
  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    for (const next of outgoing.get(current) ?? []) {
      if (next === targetId) return true
      queue.push(next)
    }
  }
  return false
}

export function resolveMissingTriggerRepairTarget({
  nodes,
  edges,
  targetNodeId,
}: {
  nodes: Node[]
  edges: Edge[]
  targetNodeId: string
}): TriggerRepairTargetResult {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const originalTarget = nodeMap.get(targetNodeId)
  if (!originalTarget) {
    return { status: 'missing-target', targetNodeId }
  }

  let current = originalTarget
  const visited = new Set<string>([current.id])

  while (true) {
    const incomingEdges = edges.filter((edge) => edge.target === current.id)
    if (incomingEdges.length === 0) {
      return { status: 'insert', targetNodeId: current.id }
    }

    const incomingNodes = incomingEdges
      .map((edge) => nodeMap.get(edge.source))
      .filter((node): node is Node => Boolean(node))

    if (incomingNodes.some(isWorkflowTriggerNode)) {
      return { status: 'already-triggered', targetNodeId: current.id }
    }

    if (incomingNodes.length !== 1) {
      return { status: 'ambiguous-root', targetNodeId: originalTarget.id }
    }

    const [sourceNode] = incomingNodes
    if (!sourceNode || visited.has(sourceNode.id)) {
      return { status: 'cycle-detected', targetNodeId: originalTarget.id }
    }

    visited.add(sourceNode.id)
    current = sourceNode
  }
}

export function canCreateTriggerRepairEdge({
  nodes,
  edges,
  sourceNodeId,
  targetNodeId,
}: {
  nodes: Node[]
  edges: Edge[]
  sourceNodeId: string
  targetNodeId: string
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const sourceNode = nodeMap.get(sourceNodeId)
  const targetNode = nodeMap.get(targetNodeId)
  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'The repair target is no longer available.' }
  }
  if (!isWorkflowTriggerNode(sourceNode)) {
    return { valid: false, reason: 'Choose a trigger to start this workflow.' }
  }
  if (isWorkflowTriggerNode(targetNode)) {
    return {
      valid: false,
      reason: 'Triggers cannot connect to another Trigger.',
    }
  }
  if (
    edges.some(
      (edge) => edge.source === sourceNodeId && edge.target === targetNodeId,
    )
  ) {
    return { valid: false, reason: 'This trigger is already connected.' }
  }
  if (
    hasPathBetweenNodes({
      edges,
      sourceId: targetNodeId,
      targetId: sourceNodeId,
    })
  ) {
    return { valid: false, reason: 'This repair would create a loop.' }
  }
  return { valid: true }
}
