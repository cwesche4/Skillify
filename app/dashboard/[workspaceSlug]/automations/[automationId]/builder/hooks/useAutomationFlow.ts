'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow'
import { WORKFLOW_LAYOUT_SPACING } from '@/lib/workflows/previewDrafts'

interface UseAutomationFlowOptions {
  automationId: string
  autosaveEnabled?: boolean
}

type AutomationMetadata = {
  id: string
  name: string
  status?: string | null
}

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return nodes

  const horizontalGap = WORKFLOW_LAYOUT_SPACING.horizontalGap
  const verticalGap = WORKFLOW_LAYOUT_SPACING.verticalGap
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
          x: layer * horizontalGap,
          y:
            index * verticalGap +
            (layer > 0 && index % 2 === 1
              ? WORKFLOW_LAYOUT_SPACING.branchOffset
              : 0),
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

export function useAutomationFlow({
  automationId,
  autosaveEnabled = true,
}: UseAutomationFlowOptions) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savingStatus, setSavingStatus] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  >('idle')
  const [automation, setAutomation] = useState<AutomationMetadata | null>(null)

  // Load flow on mount / automationId change
  useEffect(() => {
    let cancelled = false

    async function loadFlow({ syncCanvas }: { syncCanvas: boolean }) {
      try {
        const res = await fetch(`/api/automations/${automationId}/flow`)
        if (!res.ok) return
        const json = await res.json()
        let flow = json.flow ?? json

        // Support legacy stringified flow payloads
        if (typeof flow === 'string') {
          try {
            flow = JSON.parse(flow)
          } catch {
            flow = {}
          }
        }

        if (cancelled) return

        setAutomation({
          id: String(json.id ?? automationId),
          name: typeof json.name === 'string' ? json.name : '',
          status: typeof json.status === 'string' ? json.status : null,
        })

        if (!syncCanvas) return

        const loadedNodes = Array.isArray(flow?.nodes)
          ? (flow.nodes as Node[])
          : []
        const loadedEdges = Array.isArray(flow?.edges)
          ? (flow.edges as Edge[])
          : []
        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setSavingStatus('saved')
      } catch (err) {
        console.error('Failed to load flow', err)
      }
    }

    loadFlow({ syncCanvas: true })

    const refreshMetadata = () => {
      if (document.visibilityState === 'visible') {
        void loadFlow({ syncCanvas: false })
      }
    }
    window.addEventListener('focus', refreshMetadata)
    document.addEventListener('visibilitychange', refreshMetadata)

    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshMetadata)
      document.removeEventListener('visibilitychange', refreshMetadata)
    }
  }, [automationId, setEdges, setNodes])

  // Autosave on nodes/edges changes (debounced)
  const saveNow = useCallback(async () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
      saveTimeout.current = null
    }
    setSavingStatus('saving')
    try {
      const res = await fetch(`/api/automations/${automationId}/flow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setSavingStatus('saved')
    } catch (err) {
      console.error('Failed to save flow', err)
      setSavingStatus('error')
    }
  }, [automationId, edges, nodes])

  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
      saveTimeout.current = null
    }

    setSavingStatus((prev) => (prev === 'saving' ? prev : 'dirty'))

    if (!autosaveEnabled) return

    saveTimeout.current = setTimeout(() => {
      setSavingStatus('saving')
      fetch(`/api/automations/${automationId}/flow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('save failed')
          setSavingStatus('saved')
        })
        .catch((err) => {
          console.error('Failed to save flow', err)
          setSavingStatus('error')
        })
    }, 900)

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current)
      }
    }
  }, [automationId, autosaveEnabled, nodes, edges])

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
    savingStatus,
    saveNow,
    automation,
  }
}
