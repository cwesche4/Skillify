"use client"

import { useCallback, useMemo, useState } from "react"
import type { Edge, Node, OnSelectionChangeParams } from "reactflow"

import type { NodeData } from "../node-types"

export function useNodeSelection(
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void,
) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const ids = params.nodes.map((n) => n.id)
    setSelectedIds(ids)
    if (ids.length === 1) {
      setSelectedNodeId(ids[0])
    } else if (ids.length === 0) {
      setSelectedNodeId(null)
    }
  }, [])

  const selectedNode: Node | null = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    )
  }, [selectedNodeId, setEdges, setNodes])

  const updateSelectedNodeData = useCallback(
    (partial: Partial<NodeData>) => {
      if (!selectedNode) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...(n.data ?? {}),
                  ...partial,
                },
              }
            : n,
        ),
      )
    },
    [selectedNode, setNodes],
  )

  return {
    selectedNodeId,
    selectedIds,
    selectedNode,
    onNodeClick,
    onSelectionChange,
    deleteSelected,
    updateSelectedNodeData,
  }
}
