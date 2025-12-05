"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Edge,
  type Node,
  type Connection,
  type OnSelectionChangeParams,
} from "reactflow"

import HeatmapLegend from "./components/HeatmapLegend"
import InspectorPanel from "./components/InspectorPanel"
import NodePalette, { type PaletteItem } from "./components/NodePalette"
import { useAutomationFlow } from "./hooks/useAutomationFlow"
import { useHeatmapOverlay } from "./hooks/useHeatmapOverlay"
import { useNodeSelection } from "./hooks/useNodeSelection"
import { usePermissions } from "./hooks/usePermissions"
import { nodeTypes, type BuilderNodeType, type NodeData } from "./node-types"

import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface BuilderInnerProps {
  automationId: string
}

// Simple history stack for undo/redo
class HistoryStack {
  private stack: { nodes: Node[]; edges: Edge[] }[] = []
  private pointer = -1

  push(state: { nodes: Node[]; edges: Edge[] }) {
    this.stack = this.stack.slice(0, this.pointer + 1)
    this.stack.push(
      JSON.parse(JSON.stringify(state)) as {
        nodes: Node[]
        edges: Edge[]
      },
    )
    this.pointer = this.stack.length - 1
  }

  undo(): { nodes: Node[]; edges: Edge[] } | null {
    if (this.pointer > 0) {
      this.pointer -= 1
      return JSON.parse(JSON.stringify(this.stack[this.pointer])) as {
        nodes: Node[]
        edges: Edge[]
      }
    }
    return null
  }

  redo(): { nodes: Node[]; edges: Edge[] } | null {
    if (this.pointer < this.stack.length - 1) {
      this.pointer += 1
      return JSON.parse(JSON.stringify(this.stack[this.pointer])) as {
        nodes: Node[]
        edges: Edge[]
      }
    }
    return null
  }

  canUndo() {
    return this.pointer > 0
  }

  canRedo() {
    return this.pointer < this.stack.length - 1
  }
}

export default function BuilderInner({ automationId }: BuilderInnerProps) {
  const [fullscreen, setFullscreen] = useState(false)

  const { plan, planLabel, canUseFeature } = usePermissions()

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    applyAutoLayout,
  } = useAutomationFlow({ automationId })

  const {
    selectedNode,
    selectedNodeId,
    selectedIds,
    onNodeClick,
    onSelectionChange,
    deleteSelected,
    updateSelectedNodeData,
  } = useNodeSelection(nodes, setNodes, setEdges)

  const { heatmap, getIntensity } = useHeatmapOverlay(automationId)

  const reactFlowInstance = useReactFlow()

  const history = useMemo(() => new HistoryStack(), [])

  // Push changes into history
  useEffect(() => {
    history.push({ nodes, edges })
  }, [nodes, edges, history])

  const undo = useCallback(() => {
    const state = history.undo()
    if (!state) return
    setNodes(state.nodes)
    setEdges(state.edges)
  }, [history, setEdges, setNodes])

  const redo = useCallback(() => {
    const state = history.redo()
    if (!state) return
    setNodes(state.nodes)
    setEdges(state.edges)
  }, [history, setEdges, setNodes])

  // Keyboard shortcuts: delete, undo, redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === "Delete") {
        e.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [deleteSelected, redo, undo])

  // Group selected nodes into a "group" node (Pro/Elite only)
  const handleGroupNodes = useCallback(() => {
    if (selectedIds.length < 2) return
    if (!canUseFeature("groupNodes")) return

    const groupId = `group-${crypto.randomUUID()}`
    setNodes((nds) => [
      ...nds,
      {
        id: groupId,
        type: "group",
        position: { x: 100, y: 100 },
        data: {
          label: "Group",
          count: selectedIds.length,
        } as NodeData,
      } as Node,
    ])
  }, [canUseFeature, selectedIds, setNodes])

  const handleAIImproveNode = useCallback(async () => {
    if (!selectedNode) return
    if (!canUseFeature("aiCoach")) return

    try {
      const res = await fetch("/api/ai/node-improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: selectedNode.data ?? {},
        }),
      })
      if (!res.ok) return
      const improved = await res.json()

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...(n.data ?? {}),
                  ...improved,
                },
              }
            : n,
        ),
      )
    } catch (err) {
      console.error("AI improve failed", err)
    }
  }, [canUseFeature, selectedNode, setNodes])

  // Palette items with gating
  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      { type: "trigger", label: "Trigger" },
      { type: "delay", label: "Delay" },
      { type: "webhook", label: "Webhook" },
      { type: "ai-llm", label: "AI • LLM" },
      { type: "ai-classifier", label: "AI • Classifier" },
      { type: "ai-splitter", label: "AI • Splitter" },
      { type: "or-path", label: "OR Path" },
      { type: "group", label: "Group" },
    ]

    return items.map((item) => {
      let locked = false
      let lockReason: string | undefined

      const isAi =
        item.type === "ai-llm" ||
        item.type === "ai-classifier" ||
        item.type === "ai-splitter" ||
        item.type === "or-path"

      if (isAi && !canUseFeature("aiNodes")) {
        locked = true
        lockReason = "AI nodes available on Pro & Elite."
      }

      if (item.type === "webhook" && plan === "basic") {
        locked = true
        lockReason = "Webhooks available on Pro & Elite."
      }

      if (item.type === "group" && !canUseFeature("groupNodes")) {
        locked = true
        lockReason = "Grouping available on Pro & Elite."
      }

      return { ...item, locked, lockReason }
    })
  }, [canUseFeature, plan])

  // Drag & drop node creation
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const rawType = event.dataTransfer.getData("application/reactflow") as string

      if (!rawType) return
      const type = rawType as BuilderNodeType

      const isAi =
        type === "ai-llm" ||
        type === "ai-classifier" ||
        type === "ai-splitter" ||
        type === "or-path"

      if (isAi && !canUseFeature("aiNodes")) return
      if (type === "webhook" && plan === "basic") return
      if (type === "group" && !canUseFeature("groupNodes")) return

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const id = crypto.randomUUID()

      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position,
          data: {
            label: paletteItems.find((p) => p.type === type)?.label ?? type,
          } as NodeData,
        } as Node,
      ])
    },
    [canUseFeature, paletteItems, plan, reactFlowInstance, setNodes],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const containerClass = cn(
    "flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50 transition-all duration-300",
    fullscreen && "fixed inset-0 z-[9999] h-screen w-screen bg-slate-950",
  )

  const canGroup = canUseFeature("groupNodes") && selectedIds.length >= 2

  return (
    <div className={containerClass}>
      {/* LEFT: Palette */}
      <NodePalette
        items={paletteItems}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        onAutoLayout={applyAutoLayout}
        onGroupSelected={handleGroupNodes}
        onUndo={undo}
        onRedo={redo}
        canGroup={canGroup}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        planLabel={planLabel}
      />

      {/* CENTER: Canvas */}
      <div className="relative flex-1" onDrop={handleDrop} onDragOver={handleDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect as (c: Connection) => void}
          onNodeClick={onNodeClick}
          onSelectionChange={
            onSelectionChange as (params: OnSelectionChangeParams) => void
          }
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          proOptions={{ hideAttribution: true }}
          fitViewOptions={{ padding: 0.3 }}
        >
          <Background color="#1e293b" gap={16} />
          <MiniMap
            nodeColor={(node) => {
              const intensity = getIntensity(node.id)
              if (intensity === 0) return "#22c55e" // green
              if (intensity < 1) return "#eab308" // amber
              return "#ef4444" // red
            }}
            zoomable
            pannable
          />
          <Controls />
        </ReactFlow>

        <HeatmapLegend enabled={canUseFeature("heatmaps")} />

        {/* Small save hint */}
        <div className="absolute right-4 top-3 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-500">
          Autosaves every change
        </div>
      </div>

      {/* RIGHT: Inspector */}
      <InspectorPanel
        selectedNode={selectedNode}
        onChangeData={updateSelectedNodeData}
        onAiImprove={handleAIImproveNode}
        canAiImprove={canUseFeature("aiCoach")}
      />
    </div>
  )
}
