import { useMemo } from 'react'
import type { Edge, Node } from 'reactflow'
import {
  validateFlow,
  type FlowValidationResult,
  type NodeIssue,
} from '@/lib/builder/validation/validateFlow'

export function useFlowValidation(nodes: Node[], edges: Edge[]) {
  return useMemo(() => {
    const result = validateFlow(nodes, edges)
    const issuesByNodeId = new Map<string, NodeIssue[]>()
    for (const issue of result.nodeIssues) {
      const list = issuesByNodeId.get(issue.nodeId) ?? []
      list.push(issue)
      issuesByNodeId.set(issue.nodeId, list)
    }
    return {
      ...result,
      issuesByNodeId,
    }
  }, [nodes, edges])
}

export type UseFlowValidationResult = ReturnType<typeof useFlowValidation>
