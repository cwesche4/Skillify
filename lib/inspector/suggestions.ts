import type { Node } from 'reactflow'
import type { NodeData } from '@/lib/builder/node-types'

export type AISuggestion = {
  id: string
  category: 'clarity' | 'completeness' | 'safety' | 'performance'
  severity: 'info' | 'warn'
  dismissible?: boolean
  text: string
}

export function buildBasicSuggestions(node: Node<NodeData> | null) {
  if (!node) return [] as AISuggestion[]
  const data = (node.data as any) || {}
  const suggestions: AISuggestion[] = []
  if (!data.label) {
    suggestions.push({
      id: 'add-label',
      category: 'clarity',
      severity: 'warn',
      text: 'Add a clear label so this step is easy to identify.',
      dismissible: true,
    })
  }
  if (!data.description) {
    suggestions.push({
      id: 'add-description',
      category: 'completeness',
      severity: 'info',
      text: 'Describe what this node does for future reviewers.',
      dismissible: true,
    })
  }
  return suggestions
}
