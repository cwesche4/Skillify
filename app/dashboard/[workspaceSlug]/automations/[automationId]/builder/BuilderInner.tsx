'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  useReactFlow,
  ConnectionLineType,
  type Edge,
  type Node,
} from 'reactflow'

import HeatmapLegend from './components/HeatmapLegend'
import InspectorPanel from './components/InspectorPanel'
import NodePalette, { type PaletteItem } from './components/NodePalette'

import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { UpsellDFYModal } from '@/components/upsell/UpsellDFYModal'

import { useAutomationFlow } from './hooks/useAutomationFlow'
import { useHeatmapOverlay } from './hooks/useHeatmapOverlay'
import { useNodeSelection } from './hooks/useNodeSelection'
import { usePermissions } from './hooks/usePermissions'

import {
  nodeTypes,
  NODE_DEFINITIONS,
  type BuilderNodeType,
  type NodeData,
} from '@/lib/builder/node-types'
import { getBuilderCRMTemplates } from '@/lib/integrations/templates/builder'
import type { CRMTemplate } from '@/lib/integrations/templates'

import { cn } from '@/lib/utils'
import TemplateSetupModal from './components/TemplateSetupModal'

interface BuilderInnerProps {
  automationId: string
  workspaceId: string
}

/* -------------------------------------------------
   Undo/Redo History Stack
-------------------------------------------------- */
class HistoryStack {
  private stack: { nodes: Node[]; edges: Edge[] }[] = []
  private pointer = -1

  push(state: { nodes: Node[]; edges: Edge[] }) {
    this.stack = this.stack.slice(0, this.pointer + 1)
    this.stack.push(JSON.parse(JSON.stringify(state)))
    this.pointer = this.stack.length - 1
  }

  undo() {
    if (this.pointer <= 0) return null
    this.pointer -= 1
    return JSON.parse(JSON.stringify(this.stack[this.pointer]))
  }

  redo() {
    if (this.pointer >= this.stack.length - 1) return null
    this.pointer += 1
    return JSON.parse(JSON.stringify(this.stack[this.pointer]))
  }

  canUndo() {
    return this.pointer > 0
  }

  canRedo() {
    return this.pointer < this.stack.length - 1
  }
}

/* -------------------------------------------------
   MAIN BUILDER COMPONENT
-------------------------------------------------- */
export default function BuilderInner({
  automationId,
  workspaceId,
}: BuilderInnerProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const [showDFYModal, setShowDFYModal] = useState(false)

  // Subscription feature gating
  const { planLabel, plan, canUseFeature } = usePermissions()

  // Flow state (nodes, edges, mutations)
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

  // Node selection + inspector mutation
  const {
    selectedNode,
    selectedNodeId,
    selectedIds,
    onNodeClick,
    onSelectionChange,
    deleteSelected,
    updateSelectedNodeData,
  } = useNodeSelection(nodes, setNodes, setEdges)

  // Heatmap system
  const { getIntensity } = useHeatmapOverlay(automationId)

  const reactFlow = useReactFlow()
  const history = useMemo(() => new HistoryStack(), [])
  const [pendingTemplate, setPendingTemplate] = useState<CRMTemplate | null>(null)
  const [templateConfig, setTemplateConfig] = useState<Record<string, any>>({})

  /* -------------------------------------------------
     PUSH STATE TO HISTORY
  -------------------------------------------------- */
  useEffect(() => {
    history.push({ nodes, edges })
  }, [nodes, edges, history])

  const undo = useCallback(() => {
    const state = history.undo()
    if (!state) return
    setNodes(state.nodes)
    setEdges(state.edges)
  }, [history, setNodes, setEdges])

  const redo = useCallback(() => {
    const state = history.redo()
    if (!state) return
    setNodes(state.nodes)
    setEdges(state.edges)
  }, [history, setNodes, setEdges])

  /* -------------------------------------------------
     KEYBOARD SHORTCUTS
  -------------------------------------------------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Delete') {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, deleteSelected])

  /* -------------------------------------------------
     GROUP NODES (Pro/Elite)
  -------------------------------------------------- */
  const handleGroupNodes = useCallback(() => {
    if (selectedIds.length < 2) return
    if (!canUseFeature('groupNodes')) return

    const id = `group-${crypto.randomUUID()}`
    setNodes((nodes) => [
      ...nodes,
      {
        id,
        type: 'group',
        position: { x: 240, y: 240 },
        data: {
          label: 'Group',
          count: selectedIds.length,
        } as NodeData,
      },
    ])
  }, [selectedIds, canUseFeature, setNodes])

  /* -------------------------------------------------
     AI Improve Node
  -------------------------------------------------- */
  const handleAIImproveNode = useCallback(async () => {
    if (!selectedNode || !canUseFeature('aiCoach')) return

    const res = await fetch('/api/ai/node-improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: selectedNode.data }),
    })
    if (!res.ok) return
    const improved = await res.json()

    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, ...improved } }
          : n,
      ),
    )
  }, [selectedNode, canUseFeature, setNodes])

  /* -------------------------------------------------
     PALETTE ITEMS
  -------------------------------------------------- */
  /* -------------------------------------------------
   PALETTE ITEMS
-------------------------------------------------- */
  const paletteItems = useMemo<PaletteItem[]>(() => {
    return Object.values(NODE_DEFINITIONS).map((def) => {
      const locked =
        (def.proFeature && plan === 'basic') ||
        (def.enterpriseFeature && plan !== 'elite')

      return {
        id: def.type, // ✅ required
        type: def.type,
        label: def.label,
        category: def.category,
        locked,
        lockReason: locked
          ? def.enterpriseFeature
            ? 'Elite only'
            : 'Pro & Elite'
          : undefined,
      } satisfies PaletteItem
    })
  }, [plan])

  const templates = useMemo(() => getBuilderCRMTemplates(), [])

  const handleApplyTemplate = useCallback(
    (tpl: CRMTemplate, config: Record<string, any>) => {
      const requiresElite = tpl.requiredPlan.toLowerCase() === 'elite'
      const requiresPro = tpl.requiredPlan.toLowerCase() === 'pro'
      if (requiresElite && plan !== 'elite') return
      if (requiresPro && plan === 'basic') return

      const idMap = new Map<string, string>()
      const newNodes: Node[] = (tpl.nodes ?? []).map((n, idx) => {
        const newId = crypto.randomUUID()
        idMap.set(n.id, newId)
        const data: any = { ...(n.data ?? {}) }

        // Apply template-specific configuration
        if (tpl.id === 'hubspot-sync-contacts') {
          data.integrationId = config.integrationId ?? data.integrationId
          if (data?.payload?.properties) {
            data.payload.properties.lifecycle_stage =
              config.lifecycleStage ?? data.payload.properties.lifecycle_stage
          }
        }
        if (tpl.id === 'hubspot-update-deal-on-success') {
          data.integrationId = config.integrationId ?? data.integrationId
          if (data?.payload) {
            if (config.dealId) data.payload.externalId = config.dealId
            if (data.payload.properties) {
              data.payload.properties.dealstage =
                config.targetStage ?? data.payload.properties.dealstage
            }
          }
        }

        return {
          id: newId,
          type: n.type as BuilderNodeType,
          position: {
            x: 200 + idx * 80,
            y: 160 + idx * 40,
          },
          data,
        }
      })

      const newEdges: Edge[] = (tpl.edges ?? []).map((e) => ({
        id: crypto.randomUUID(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
        type: 'smoothstep',
      }))

      setNodes((prev) => [...prev, ...newNodes])
      setEdges((prev) => [...prev, ...newEdges])
    },
    [plan, setNodes, setEdges],
  )

  /* -------------------------------------------------
     DRAG TO ADD NODE
  -------------------------------------------------- */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(
        'application/reactflow',
      ) as BuilderNodeType
      if (!type) return

      const def = NODE_DEFINITIONS[type]

      if (def.proFeature && plan === 'basic') return
      if (def.enterpriseFeature && plan !== 'elite') return

      const bounds = (
        event.currentTarget as HTMLElement
      ).getBoundingClientRect()
      const pos = reactFlow.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      setNodes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type,
          position: pos,
          data: {
            label: def.label,
            ...(def.defaultData ?? {}),
          } as NodeData,
        },
      ])
    },
    [plan, reactFlow, setNodes],
  )

  /* -------------------------------------------------
     EDGE STYLING
  -------------------------------------------------- */
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep' as const,
      animated: false,
      style: {
        stroke: '#4b5563',
        strokeWidth: 1.5,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
    }),
    [],
  )

  /* -------------------------------------------------
     HEATMAP + REPLAY
  -------------------------------------------------- */
  const styledNodes = useMemo(() => {
    return nodes.map((node) => {
      const intensity = getIntensity(node.id)
      const base = node.style ?? {}
      let shadow = base.boxShadow ?? ''

      if (intensity > 0) {
        const col =
          intensity < 1 ? 'rgba(234,179,8,0.32)' : 'rgba(248,113,113,0.45)'
        shadow += `, 0 0 ${14 + intensity * 10}px ${col}`
      }

      if ((node.data as NodeData | undefined)?.__replayActive) {
        shadow += `, 0 0 22px rgba(56,189,248,0.55)`
      }

      return {
        ...node,
        style: {
          ...base,
          borderRadius: 12,
          boxShadow: shadow,
        },
      }
    })
  }, [nodes, getIntensity])

  /* -------------------------------------------------
     AI TEMPLATE GENERATOR
  -------------------------------------------------- */
  const handleGenerateTemplate = useCallback(async () => {
    const res = await fetch('/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationId }),
    })

    if (!res.ok) return
    const { template } = await res.json()
    if (template?.nodes && template?.edges) {
      setNodes(template.nodes)
      setEdges(template.edges)
    }
  }, [automationId, setNodes, setEdges])

  /* -------------------------------------------------
     RENDER
  -------------------------------------------------- */
  return (
    <div
      className={cn(
        'flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50 transition-all duration-300',
        fullscreen && 'fixed inset-0 z-[9999] h-screen w-screen',
      )}
    >
      {/* PALETTE */}
      <NodePalette
        items={paletteItems}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        onAutoLayout={applyAutoLayout}
        onGroupSelected={handleGroupNodes}
        onUndo={undo}
        onRedo={redo}
        canGroup={canUseFeature('groupNodes') && selectedIds.length >= 2}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        planLabel={planLabel}
        onGenerateTemplate={handleGenerateTemplate}
        templates={templates.map((tpl) => {
          const requiresElite = tpl.requiredPlan.toLowerCase() === 'elite'
          const requiresPro = tpl.requiredPlan.toLowerCase() === 'pro'
          const blocked =
            (requiresElite && plan !== 'elite') || (requiresPro && plan === 'basic')
          const blockReason = requiresElite
            ? 'Elite required for inbound webhooks'
            : requiresPro
              ? 'Pro or Elite required'
              : undefined
          return {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            requiredPlan: tpl.requiredPlan === 'Elite' ? 'Elite' : 'Pro',
            blocked,
            blockReason,
            onSelect: () => setPendingTemplate(tpl),
          }
        })}
      />

      {/* UPSIZE CARD */}
      <div className="px-3 py-2">
        <UpsellMicroCard
          workspaceId={workspaceId}
          automationId={automationId}
          feature="builder-help"
          title="Need help finishing this flow?"
          description="Describe what you're stuck on and our team will build it for you."
        />
      </div>

      {/* CANVAS */}
      <div
        className="relative flex-1"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
      >
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect as any}
          onNodeClick={onNodeClick}
          onSelectionChange={onSelectionChange as any}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          connectionLineType={ConnectionLineType.SmoothStep}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={16} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              const i = getIntensity(node.id)
              if (i === 0) return '#22c55e'
              if (i < 1) return '#eab308'
              return '#ef4444'
            }}
          />
          <Controls />
        </ReactFlow>

        <HeatmapLegend enabled={canUseFeature('heatmaps')} />
      </div>

      {/* INSPECTOR PANEL */}
      <InspectorPanel
        node={selectedNode ?? null}
        onChangeNode={(nodeId, data) => updateSelectedNodeData(nodeId, data)}
        onAiImprove={handleAIImproveNode}
        planLabel={planLabel}
        workspaceId={workspaceId}
        automationId={automationId}
      />

      {/* DFY MODAL */}
      <UpsellDFYModal
        open={showDFYModal}
        onClose={() => setShowDFYModal(false)}
        workspaceId={workspaceId}
        automationId={automationId}
        feature="builder-dfy"
      />

      <TemplateSetupModal
        open={!!pendingTemplate}
        template={pendingTemplate}
        workspaceId={workspaceId}
        plan={plan}
        onCancel={() => {
          setPendingTemplate(null)
          setTemplateConfig({})
        }}
        onConfirm={(config) => {
          if (pendingTemplate) {
            setTemplateConfig(config)
            handleApplyTemplate(pendingTemplate, config)
          }
          setPendingTemplate(null)
          setTemplateConfig({})
        }}
      />
    </div>
  )
}
