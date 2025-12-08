import { useEffect, useRef } from 'react'
import { useFlowStore } from './useFlowStore'

export function useAutosave(automationId: string) {
  const { nodes, edges } = useFlowStore()
  const prev = useRef({ nodes, edges })

  useEffect(() => {
    const changed =
      JSON.stringify(prev.current.nodes) !== JSON.stringify(nodes) ||
      JSON.stringify(prev.current.edges) !== JSON.stringify(edges)

    if (!changed) return
    prev.current = { nodes, edges }

    const save = async () => {
      await fetch(`/api/automations/${automationId}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      })
    }

    const timeout = setTimeout(save, 800)
    return () => clearTimeout(timeout)
  }, [nodes, edges, automationId])
}
