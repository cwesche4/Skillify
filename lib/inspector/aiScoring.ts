import type { Node } from 'reactflow'
import type { BuilderNodeType, NodeData } from '@/lib/builder/node-types'

export type NodeScore = {
  score: number
  reasons: string[]
  codes?: string[]
  confidence?: 'low' | 'medium' | 'high'
  severity?: 'ok' | 'warn' | 'risk'
}

export function scoreNodeConfiguration(node: Node<NodeData> | null): NodeScore {
  if (!node) return { score: 0, reasons: ['No node selected'] }
  const data = (node.data as any) || {}
  let score = 50
  const reasons: string[] = []
  const codes: string[] = []

  if (data.label) score += 10
  else {
    reasons.push('Label missing')
    codes.push('missing_label')
  }

  if (data.description) score += 5
  else {
    reasons.push('Description missing')
    codes.push('empty_core_field')
  }

  if (data.url || data.prompt || data.event) score += 10
  else {
    reasons.push('Key field is empty')
    codes.push('empty_core_field')
  }

  if (node.type === ('trigger' as BuilderNodeType) && data.event) score += 5
  if (node.type === ('delay' as BuilderNodeType) && data.ms) score += 5

  score = Math.min(100, Math.max(0, score))
  if (reasons.length === 0) {
    reasons.push('Configuration looks healthy')
    codes.push('ok')
  }
  const confidence: 'low' | 'medium' | 'high' =
    score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low'
  const severity: 'ok' | 'warn' | 'risk' =
    score >= 75 ? 'ok' : score >= 45 ? 'warn' : 'risk'

  return { score, reasons, codes, confidence, severity }
}
