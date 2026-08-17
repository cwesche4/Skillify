import type { Edge, Node } from 'reactflow'

export type PreviewNode = {
  id: string
  type: string
  label?: string
  disabled?: boolean
  willExecute: boolean
  reason?: string
}

export type PreviewBranch = {
  from: string
  to: string
  taken: boolean
}

export interface RunPreview {
  nodes: PreviewNode[]
  branches: PreviewBranch[]
  notes: string[]
}

/**
 * Static preview: determines which nodes/edges are part of the execution path.
 * - No side effects; purely read-only.
 * - Branches are marked as "taken" if connected; no runtime evaluation of conditions.
 */
export function computeRunPreview(nodes: Node[], edges: Edge[]): RunPreview {
  const nodeMap = new Map<string, Node>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  const connected = new Set<string>()
  edges.forEach((e) => {
    if (e.source) connected.add(e.source)
    if (e.target) connected.add(e.target)
  })

  const previewNodes: PreviewNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'unknown',
    label: (n.data as any)?.label,
    disabled: Boolean((n.data as any)?.disabled),
    willExecute: connected.has(n.id) && !(n.data as any)?.disabled,
    reason: !(n.data as any)?.disabled
      ? undefined
      : 'Node is disabled and will be skipped.',
  }))

  const previewBranches: PreviewBranch[] = edges.map((e) => ({
    from: e.source,
    to: e.target,
    taken: Boolean(e.source && e.target),
  }))

  const notes: string[] = []
  if (previewNodes.some((n) => n.disabled)) {
    notes.push('Disabled nodes will be skipped.')
  }
  if (nodes.length === 0) {
    notes.push('No nodes present.')
  }

  return {
    nodes: previewNodes,
    branches: previewBranches,
    notes,
  }
}
