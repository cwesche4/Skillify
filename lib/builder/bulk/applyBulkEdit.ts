import type { Node } from 'reactflow'

export type BulkOverrides = {
  labelPrefix?: string
  retryCount?: number
  timeoutMs?: number
  requiresApproval?: boolean
}

// Bulk edits.
// Explicit user action only.
// No inference or execution mutation.
export function applyBulkEdit(
  nodes: Node[],
  selectedIds: string[],
  overrides: BulkOverrides,
): Node[] {
  if (selectedIds.length === 0) return nodes
  const selectedSet = new Set(selectedIds)
  return nodes.map((node) => {
    if (!selectedSet.has(node.id)) return node
    const nextData: any = { ...(node.data || {}) }
    if (overrides.labelPrefix !== undefined) {
      nextData.label = `${overrides.labelPrefix}${node.data?.label ?? ''}`
    }
    if (overrides.retryCount !== undefined)
      nextData.retryCount = overrides.retryCount
    if (overrides.timeoutMs !== undefined)
      nextData.timeoutMs = overrides.timeoutMs
    if (overrides.requiresApproval !== undefined) {
      nextData.requiresApproval = overrides.requiresApproval
    }
    return { ...node, data: nextData }
  })
}
