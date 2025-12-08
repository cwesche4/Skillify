'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow'

interface UseAutomationFlowOptions {
  automationId: string
}

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return nodes

  const spacing = 180
  const nodeMap = new Map<string, Node>()
  const incoming = new Map<string, number>()

  nodes.forEach((n) => {
    nodeMap.set(n.id, n)
    incoming.set(n.id, 0)
  })

  edges.forEach((e) => {
    const prev = incoming.get(e.target) ?? 0
    incoming.set(e.target, prev + 1)
  })

  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0)
  let queue = [...roots]
  let layer = 0

  while (queue.length) {
    const next: Node[] = []
    queue.forEach((node, index) => {
      const updated: Node = {
        ...node,
        position: {
          x: layer * spacing,
          y: index * spacing,
        },
      }
      nodeMap.set(node.id, updated)

      edges
        .filter((e) => e.source === node.id)
        .forEach((e) => {
          const targetNode = nodeMap.get(e.target)
          if (targetNode) next.push(targetNode)
        })
    })

    queue = next
    layer += 1
  }

  return Array.from(nodeMap.values())
}

export function useAutomationFlow({ automationId }: UseAutomationFlowOptions) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load flow on mount / automationId change
  useEffect(() => {
    let cancelled = false

    async function loadFlow() {
      try {
        const res = await fetch(`/api/automations/${automationId}/flow`)
        if (!res.ok) return
        const json = await res.json()
        const flow = json.flow ?? json

        if (cancelled) return

        const loadedNodes = (flow.nodes ?? []) as Node[]
        const loadedEdges = (flow.edges ?? []) as Edge[]
        setNodes(loadedNodes)
        setEdges(loadedEdges)
      } catch (err) {
        console.error('Failed to load flow', err)
      }
    }

    loadFlow()
    return () => {
      cancelled = true
    }
  }, [automationId, setEdges, setNodes])

  // Autosave on nodes/edges changes (500ms debounce)
  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
    }

    saveTimeout.current = setTimeout(() => {
      fetch(`/api/automations/${automationId}/flow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
        }),
      }).catch((err) => console.error('Failed to save flow', err))
    }, 500)

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current)
      }
    }
  }, [automationId, nodes, edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges],
  )

  const applyAutoLayout = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges))
  }, [edges, setNodes])

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    applyAutoLayout,
  }
}
