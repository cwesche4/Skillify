'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Node, Edge, OnSelectionChangeParams } from 'reactflow'
import type { NodeData } from '@/lib/builder/node-types'

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
}

function applyNodeSelection(nodes: Node[], selectedIds: string[]) {
  const selected = new Set(selectedIds)
  let changed = false
  const next = nodes.map((item) => {
    const nextSelected = selected.has(item.id)
    if (item.selected === nextSelected) return item
    changed = true
    return { ...item, selected: nextSelected }
  })
  return changed ? next : nodes
}

export function useNodeSelection(
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void,
) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const suppressSelectionChangeUntilRef = useRef(0)

  const suppressSelectionChangeFor = useCallback((ms = 250) => {
    suppressSelectionChangeUntilRef.current = Math.max(
      suppressSelectionChangeUntilRef.current,
      Date.now() + ms,
    )
  }, [])

  const toggleNodeSelection = useCallback(
    (nodeId: string) => {
      suppressSelectionChangeFor()
      setSelectedIds((currentIds) => {
        const selected = currentIds.includes(nodeId)
          ? currentIds.filter((id) => id !== nodeId)
          : [...currentIds, nodeId]
        const nextSelectedNodeId = selected.length === 1 ? selected[0] : null
        setSelectedNodeId((current) =>
          current === nextSelectedNodeId ? current : nextSelectedNodeId,
        )
        setNodes((nds) => applyNodeSelection(nds, selected))
        return sameIds(currentIds, selected) ? currentIds : selected
      })
    },
    [setNodes, suppressSelectionChangeFor],
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        suppressSelectionChangeFor()
        return
      }
      if (selectedIds.length > 1 && selectedIds.includes(node.id)) {
        suppressSelectionChangeFor(150)
        setSelectedNodeId((current) => (current === null ? current : null))
        setNodes((nds) => applyNodeSelection(nds, selectedIds))
        return
      }
      setSelectedNodeId((current) => (current === node.id ? current : node.id))
      setSelectedIds((current) =>
        sameIds(current, [node.id]) ? current : [node.id],
      )
      setNodes((nds) => applyNodeSelection(nds, [node.id]))
    },
    [selectedIds, setNodes, suppressSelectionChangeFor],
  )

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      if (Date.now() < suppressSelectionChangeUntilRef.current) return
      const ids = params.nodes.map((n) => n.id)
      setSelectedIds((current) => (sameIds(current, ids) ? current : ids))
      setNodes((nds) => applyNodeSelection(nds, ids))

      const nextSelectedNodeId = ids.length === 1 ? ids[0] : null
      if (ids.length === 1) {
        setSelectedNodeId((current) =>
          current === nextSelectedNodeId ? current : nextSelectedNodeId,
        )
      } else if (ids.length === 0 || ids.length > 1) {
        setSelectedNodeId((current) => (current === null ? current : null))
      }
    },
    [setNodes],
  )

  const selectedNode: Node | null = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return

    setNodes((nds) => {
      const groupId = crypto.randomUUID()

      return nds.map((n) =>
        selectedIds.includes(n.id)
          ? { ...n, parentNode: groupId, extent: 'parent' }
          : n,
      )
    })
  }, [selectedIds, setNodes])

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return

    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    )
  }, [selectedNodeId, setEdges, setNodes])

  const updateSelectedNodeData = useCallback(
    (nodeId: string, partial: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
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
    [setNodes],
  )

  const clearSelection = useCallback(() => {
    setSelectedNodeId((current) => (current === null ? current : null))
    setSelectedIds((current) => (current.length === 0 ? current : []))
    setNodes((nds) => applyNodeSelection(nds, []))
  }, [setNodes])

  const selectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId((current) => (current === nodeId ? current : nodeId))
      setSelectedIds((current) =>
        sameIds(current, [nodeId]) ? current : [nodeId],
      )
      setNodes((nds) => applyNodeSelection(nds, [nodeId]))
    },
    [setNodes],
  )

  const selectNodes = useCallback(
    (nodeIds: string[], suppressSelectionChange = false) => {
      if (suppressSelectionChange) {
        suppressSelectionChangeFor()
      }
      const nextSelectedNodeId = nodeIds.length === 1 ? nodeIds[0] : null
      setSelectedIds((current) =>
        sameIds(current, nodeIds) ? current : nodeIds,
      )
      setSelectedNodeId((current) =>
        current === nextSelectedNodeId ? current : nextSelectedNodeId,
      )
      setNodes((nds) => applyNodeSelection(nds, nodeIds))
    },
    [setNodes, suppressSelectionChangeFor],
  )

  return {
    selectedNodeId,
    selectedIds,
    selectedNode,
    onNodeClick,
    onSelectionChange,
    toggleNodeSelection,
    deleteSelected,
    updateSelectedNodeData,
    clearSelection,
    selectNode,
    selectNodes,
    suppressSelectionChangeFor,
    groupSelected,
  }
}
