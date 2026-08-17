'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  OnConnectEnd,
  OnConnectStart,
  ReactFlowInstance,
} from 'reactflow'
import { useFlowStore } from '@/lib/builder/useFlowStore'
import { useCanvasPerf } from '@/lib/builder/performance/useCanvasPerf'
import { useMemoizedArray } from '@/lib/builder/performance/useMemoizedArray'
import { useVirtualNodes } from '@/lib/builder/performance/useVirtualNodes'
import { useEdgeLOD } from '@/lib/builder/performance/useEdgeLOD'
import { useSectionStore } from '@/lib/builder/sections/sectionStore'
import FlowSection from './sections/FlowSection'
import type { FlowSection as FlowSectionType } from '@/lib/builder/sections/sectionStore'
import SectionNavigator from './sections/SectionNavigator'
import FlowHud from './FlowHud'
import GuardrailHint from './GuardrailHint'
import TemplateBanner from './TemplateBanner'
import PolicyNotice from './PolicyNotice'
import type { ChangeControlPolicies } from '@/lib/workspaces/policies'
import ComplianceModeNotice from './ComplianceModeNotice'
import QuickAddPalette from './QuickAddPalette'
import { getCompatibleNext } from '@/lib/builder/edges/compatibility'
import type { BuilderNodeType } from '@/lib/builder/node-types'
import { insertNodeAt } from '@/lib/builder/edges/insertNodeAt'
import { nanoid } from 'nanoid'
import type { PickerOption } from './QuickAddNode'
import { duplicateSelection } from '@/lib/builder/duplicate/duplicateSelection'
import { centerCanvasOnNode } from '@/lib/builder/canvas/centerOnNode'
import {
  focusOnNode,
  focusOnNodes,
  zoomToSelection,
} from '@/lib/builder/canvas/focusHelpers'
import { getPatterns } from '@/lib/builder/patterns/store'
import { insertPatternAt } from '@/lib/builder/patterns/insertPattern'
import PatternLibrary from './PatternLibrary'
import ExecutionPathOverlay from './ExecutionPathOverlay'
import ExecutionLiveOverlay from './ExecutionLiveOverlay'
import RunStatusIndicator from './RunStatusIndicator'
import DemoFlowBanner from './DemoFlowBanner'
import { demoFlows } from '@/lib/builder/demos/demoFlows'
import type { TimelineItem } from '@/lib/runs/timeline/types'
import {
  deriveLiveExecutionState,
  filterTimelineByRun,
} from '@/lib/runs/timeline/selectors'
import { deriveRunStatus } from '@/lib/runs/timeline/runStatus'
import ExecutionStatusChip from './nodes/ExecutionStatusChip'
import RunSelector from './RunSelector'
import { applyWorkspaceDefaults } from '@/lib/builder/nodes/applyWorkspaceDefaults'
import type { WorkspaceDefaults } from '@/lib/workspaces/defaults'
import { useGroupStore } from '@/lib/builder/groups/groupStore'
import GroupContainer from './groups/GroupContainer'
import BulkEditPanel from './bulk/BulkEditPanel'
import ExecutionFilterBar from './execution/ExecutionFilterBar'
import {
  deriveExecutionFilterSets,
  type ExecutionFilterMode,
} from '@/lib/runs/timeline/filterExecutionState'

type ConnectState = {
  sourceNodeId?: string
  sourceHandleId?: string
  cursor?: { x: number; y: number }
}

type Props = {
  nodeOptions: PickerOption[]
  recentTypes?: BuilderNodeType[]
  timelineItems?: TimelineItem[]
  runs?: { id: string; label: string }[]
  runId?: string
  onRunChange?: (id: string) => void
  demoFlowId?: string
  workspaceDefaults?: WorkspaceDefaults
  templateId?: string
  onDuplicateTemplate?: () => void
  changePolicies?: ChangeControlPolicies
  complianceMode?: boolean
}

export default function BuilderCanvas({
  nodeOptions,
  recentTypes = [],
  timelineItems = [],
  runs = [],
  runId,
  onRunChange,
  demoFlowId,
  workspaceDefaults,
  templateId,
  onDuplicateTemplate,
  changePolicies,
  complianceMode = false,
}: Props) {
  const { nodes, edges, setNodes, setEdges } = useFlowStore()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [connectState, setConnectState] = useState<ConnectState | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Visual-only state. Must never affect execution or persistence.
  const [highlightNodeIds, setHighlightNodeIds] = useState<Set<string>>(
    new Set(),
  )
  // Live execution visualization (read-only, timeline-driven when wired).
  const [liveActiveNodeId, setLiveActiveNodeId] = useState<string | undefined>(
    undefined,
  )
  const [liveCompletedNodeIds, setLiveCompletedNodeIds] = useState<Set<string>>(
    new Set(),
  )
  const [liveSkippedNodeIds, setLiveSkippedNodeIds] = useState<Set<string>>(
    new Set(),
  )
  // Execution visualization only. Must remain timeline-driven and read-only. Never infer, persist, or control execution.
  const [runStatus, setRunStatus] = useState<
    'success' | 'failed' | 'partial' | 'unknown'
  >('unknown')
  const [filterMode, setFilterMode] = useState<ExecutionFilterMode>('none')
  const [approvalNodes, setApprovalNodes] = useState<Set<string>>(new Set())
  const [slaNodes, setSlaNodes] = useState<Set<string>>(new Set())
  const [typeAheadBuffer, setTypeAheadBuffer] = useState<string>('')
  const [patterns] = useState(getPatterns())
  const demoFlow = demoFlowId
    ? demoFlows.find((d) => d.id === demoFlowId)
    : undefined
  const [patternFocus, setPatternFocus] = useState(false)
  const [patternHighlightIndex, setPatternHighlightIndex] = useState(0)
  const { groups, createGroup, toggleGroup } = useGroupStore()
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set())
  const { sections, addSection, updateSection, renameSection, removeSection } =
    useSectionStore()
  const [sectionNavIndex, setSectionNavIndex] = useState<number>(0)
  const [viewport, setViewport] = useState<{
    x: number
    y: number
    zoom: number
    width: number
    height: number
  } | null>(null)

  const centerOnSection = (section: FlowSectionType) => {
    if (!rfInstance) return
    const cx = section.rect.x + section.rect.width / 2
    const cy = section.rect.y + section.rect.height / 2
    rfInstance.setCenter(cx, cy, { zoom: viewport?.zoom ?? 1, duration: 200 })
  }

  const stableNodes = useMemoizedArray(nodes)
  const stableEdges = useMemoizedArray(edges)

  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>()
    groups.forEach((g) => {
      if (g.collapsed) g.nodeIds.forEach((id) => hidden.add(id))
    })
    return hidden
  }, [groups])

  const visibleNodes = useMemo(
    () => stableNodes.filter((n) => !hiddenNodeIds.has(n.id)),
    [stableNodes, hiddenNodeIds],
  )
  const visibleEdges = useMemo(
    () =>
      stableEdges.filter(
        (e) =>
          !hiddenNodeIds.has(e.source as string) &&
          !hiddenNodeIds.has(e.target as string),
      ),
    [stableEdges, hiddenNodeIds],
  )

  const virtualNodes = useVirtualNodes(visibleNodes, viewport)
  const lodEdges = useEdgeLOD(visibleEdges, viewport)
  const perfNodes = useMemoizedArray(virtualNodes)
  const perfEdges = useMemoizedArray(lodEdges)

  const { memoNodes, memoEdges, memoHandlers } = useCanvasPerf(
    perfNodes,
    perfEdges,
    {
      onNodesChange: setNodes as any,
      onEdgesChange: setEdges as any,
    },
  )

  const pickerPosition = connectState?.cursor
  const sourceNode = connectState?.sourceNodeId
    ? nodes.find((n) => n.id === connectState.sourceNodeId)
    : undefined

  const compatibleTypes = sourceNode
    ? getCompatibleNext(sourceNode.type as BuilderNodeType)
    : []

  const handleConnectStart: OnConnectStart = (_, params) => {
    setConnectState({
      sourceNodeId: params.nodeId ?? undefined,
      sourceHandleId: params.handleId ?? undefined,
    })
  }

  const handleConnectEnd: OnConnectEnd = (event) => {
    if (!connectState || !rfInstance) return
    const bounds = (rfInstance as any).wrapper.getBoundingClientRect()
    const point =
      'clientX' in event ? event : (event.touches[0] ?? event.changedTouches[0])
    if (!point) return
    const position = rfInstance.project({
      x: point.clientX - bounds.left,
      y: point.clientY - bounds.top,
    })
    setConnectState((prev) => ({
      ...prev,
      cursor: position,
    }))
    setShowPicker(true)
  }

  const handleSelectType = (type: BuilderNodeType) => {
    if (!connectState?.cursor || !sourceNode) return
    const newId = nanoid()
    const newNode = {
      id: newId,
      type,
      data: applyWorkspaceDefaults({}, workspaceDefaults),
      position: connectState.cursor,
    } as any
    const updatedNodes = insertNodeAt(nodes, newNode, connectState.cursor)
    setNodes(updatedNodes as any)
    setEdges([
      ...edges,
      {
        id: `${sourceNode.id}-${newId}`,
        source: sourceNode.id,
        target: newId,
        sourceHandle: connectState.sourceHandleId,
      } as any,
    ] as any)
    setShowPicker(false)
    setConnectState(null)
    focusOnNode(rfInstance, newId)
  }

  const handleInsertPattern = (patternId: string) => {
    const pattern = patterns.find((p) => p.id === patternId)
    if (!pattern) return
    const position = connectState?.cursor ?? { x: 0, y: 0 }
    // Builder-only micro-pattern insertion.
    // Must not infer behavior, affect execution, or modify non-selected nodes.
    const result = insertPatternAt({ pattern, nodes, edges, position })
    setNodes(result.nodes as any)
    setEdges(result.edges as any)
    setSelectedIds(result.selection)
    setShowPicker(false)
    setConnectState(null)
    setTypeAheadBuffer('')
    focusOnNodes(rfInstance, result.selection)
  }

  const filterKeepSet = useMemo(() => {
    switch (filterMode) {
      case 'failed':
        return failedNodes
      case 'approval':
        return approvalNodes
      case 'active': {
        const set = new Set<string>()
        if (liveActiveNodeId) set.add(liveActiveNodeId)
        liveCompletedNodeIds.forEach((id) => set.add(id))
        return set
      }
      case 'none':
      default:
        return new Set<string>()
    }
  }, [
    filterMode,
    failedNodes,
    approvalNodes,
    liveActiveNodeId,
    liveCompletedNodeIds,
  ])

  const dimmedNodeIds = useMemo(() => {
    const dim = new Set<string>()
    if (highlightNodeIds.size) {
      visibleNodes.forEach((n) => {
        if (!highlightNodeIds.has(n.id)) dim.add(n.id)
      })
    }
    if (filterKeepSet.size) {
      visibleNodes.forEach((n) => {
        if (!filterKeepSet.has(n.id)) dim.add(n.id)
      })
    }
    return dim
  }, [highlightNodeIds, filterKeepSet, visibleNodes])

  const styledNodes = useMemo(
    () =>
      memoNodes.map((node) =>
        dimmedNodeIds.has(node.id)
          ? { ...node, style: { ...(node.style || {}), opacity: 0.35 } }
          : node,
      ),
    [memoNodes, dimmedNodeIds],
  )

  const sectionStates = useMemo(() => {
    return sections.map((section) => {
      const containsRelevant =
        filterKeepSet.size === 0 ||
        visibleNodes.some(
          (n) =>
            n.position.x >= section.rect.x &&
            n.position.x <= section.rect.x + section.rect.width &&
            n.position.y >= section.rect.y &&
            n.position.y <= section.rect.y + section.rect.height &&
            filterKeepSet.has(n.id),
        )
      const pulses = visibleNodes.some(
        (n) =>
          n.position.x >= section.rect.x &&
          n.position.x <= section.rect.x + section.rect.width &&
          n.position.y >= section.rect.y &&
          n.position.y <= section.rect.y + section.rect.height &&
          highlightNodeIds.has(n.id),
      )
      return {
        id: section.id,
        dimmed: filterKeepSet.size > 0 && !containsRelevant,
        pulse: pulses,
      }
    })
  }, [sections, filterKeepSet, visibleNodes, highlightNodeIds])

  const sectionsOverlap = useMemo(() => {
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i].rect
        const b = sections[j].rect
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        if (overlap) return true
      }
    }
    return false
  }, [sections])

  const bulkMixedTypes = useMemo(() => {
    if (selectedIds.length <= 1) return false
    const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id))
    const types = new Set(selectedNodes.map((n) => n.type))
    return types.size > 1
  }, [nodes, selectedIds])

  const rfProps = useMemo(
    () => ({
      nodes: styledNodes,
      edges: memoEdges,
      onNodesChange: templateId ? () => {} : memoHandlers.onNodesChange,
      onEdgesChange: templateId ? () => {} : memoHandlers.onEdgesChange,
    }),
    [styledNodes, memoEdges, memoHandlers, templateId],
  )

  const handleDuplicate = () => {
    // Builder-only duplication.
    // Must not affect execution, persistence, or inference.
    const result = duplicateSelection({
      nodes,
      edges,
      selectedNodeIds: selectedIds,
    })
    if (!result) return
    setNodes(result.nodes as any)
    setEdges(result.edges as any)
    setSelectedIds(result.selection)
    if (result.selection[0]) {
      setHighlightNodeIds(new Set([result.selection[0]]))
      focusOnNodes(rfInstance, result.selection)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const isChar =
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey

    if (event.key.toLowerCase() === 'g' && selectedIds.length >= 2) {
      event.preventDefault()
      const name = window.prompt('Group name (optional)') || undefined
      createGroup(selectedIds, name)
      return
    }

    if (patternFocus) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setPatternHighlightIndex((idx) =>
          Math.min(idx + 1, patterns.length - 1),
        )
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setPatternHighlightIndex((idx) => Math.max(idx - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const pattern = patterns[patternHighlightIndex]
        if (pattern) handleInsertPattern(pattern.id)
        setPatternFocus(false)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setPatternFocus(false)
        return
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      handleDuplicate()
    }
    if (event.key === 'Escape') {
      setHighlightNodeIds(new Set())
      setLiveActiveNodeId(undefined)
      setLiveCompletedNodeIds(new Set())
      setLiveSkippedNodeIds(new Set())
      if (showPicker) {
        setShowPicker(false)
        setConnectState(null)
        setTypeAheadBuffer('')
      }
    }
    if (isChar) {
      // Type-ahead creation.
      // Builder-only UX.
      // No inference or execution mutation.
      if (!showPicker) {
        // Open palette and seed search with typed char
        setShowPicker(true)
        setTypeAheadBuffer(event.key)
      } else {
        setTypeAheadBuffer(event.key)
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '.') {
      event.preventDefault()
      zoomToSelection(rfInstance, selectedIds)
    }
    if (event.key === '/' && patterns.length > 0) {
      event.preventDefault()
      setPatternFocus(true)
      setPatternHighlightIndex(0)
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === 's'
    ) {
      event.preventDefault()
      // Create section at current viewport center
      if (!viewport) return
      const centerX =
        -viewport.x / viewport.zoom + viewport.width / (2 * viewport.zoom)
      const centerY =
        -viewport.y / viewport.zoom + viewport.height / (2 * viewport.zoom)
      addSection('New section', {
        x: centerX - 300,
        y: centerY - 120,
        width: 600,
        height: 240,
      })
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === ']') {
      event.preventDefault()
      if (!sections.length) return
      const next = (sectionNavIndex + 1) % sections.length
      setSectionNavIndex(next)
      centerOnSection(sections[next])
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '[') {
      event.preventDefault()
      if (!sections.length) return
      const prev = (sectionNavIndex - 1 + sections.length) % sections.length
      setSectionNavIndex(prev)
      centerOnSection(sections[prev])
    }
  }

  useEffect(() => {
    // Derive live execution state strictly from timeline events; no inference beyond event order.
    const scopedItems = runId
      ? filterTimelineByRun(timelineItems, runId)
      : timelineItems
    const liveState = deriveLiveExecutionState(scopedItems)
    setLiveActiveNodeId(liveState.activeNodeId)
    setLiveCompletedNodeIds(liveState.completedNodeIds)
    setLiveSkippedNodeIds(liveState.skippedNodeIds)
    setRunStatus(deriveRunStatus(scopedItems))
    const approvals = new Set<string>()
    const slas = new Set<string>()
    scopedItems.forEach((item) => {
      const nodeId =
        (item.details && item.details.nodeId) || (item as any).nodeId
      if (!nodeId) return
      if (item.type === 'approval-requested') approvals.add(nodeId)
      if (item.type === 'sla-breach') slas.add(nodeId)
    })
    setApprovalNodes(approvals)
    setSlaNodes(slas)
    const filters = deriveExecutionFilterSets(scopedItems)
    setFailedNodes(filters.failedNodes)
  }, [timelineItems, runId])

  return (
    <div
      className="relative h-full flex-1"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={wrapperRef}
    >
      {sections.map((section) => (
        <FlowSection
          key={section.id}
          id={section.id}
          name={section.name}
          rect={section.rect}
          onRectChange={(rect) => updateSection(section.id, rect)}
          onNameChange={(name) => renameSection(section.id, name)}
          onRemove={() => removeSection(section.id)}
          onFocus={() => centerOnSection(section)}
          focused={sections[sectionNavIndex]?.id === section.id}
          dimmed={!!sectionStates.find((s) => s.id === section.id)?.dimmed}
          pulse={!!sectionStates.find((s) => s.id === section.id)?.pulse}
        />
      ))}

      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-2">
        <RunStatusIndicator status={runStatus} />
        {templateId ? (
          <div className="pointer-events-auto">
            <TemplateBanner onDuplicate={onDuplicateTemplate} />
          </div>
        ) : null}
        {complianceMode ? (
          <div className="pointer-events-auto">
            <ComplianceModeNotice />
          </div>
        ) : null}
        {changePolicies ? (
          <div className="pointer-events-auto">
            <PolicyNotice policies={changePolicies} />
          </div>
        ) : null}
        <div className="pointer-events-auto">
          <FlowHud
            nodeCount={nodes.length}
            groupCount={groups.length}
            sectionCount={sections.length}
            activeRunLabel={runId && runs.find((r) => r.id === runId)?.label}
            demoLabel={demoFlow ? 'Read-only demo' : undefined}
          />
        </div>
        <div className="pointer-events-auto">
          {/* Execution filters.
             Read-only visualization. Never infer or mutate execution. */}
          <ExecutionFilterBar mode={filterMode} onChange={setFilterMode} />
        </div>
        {runs.length > 0 && runId ? (
          <div className="pointer-events-auto">
            <RunSelector
              runs={runs}
              value={runId}
              onChange={(id) => onRunChange?.(id)}
            />
          </div>
        ) : null}
        {sections.length > 0 ? (
          <div className="pointer-events-auto">
            <GuardrailHint
              message={
                sectionsOverlap
                  ? 'Sections overlap visually. This does not affect execution.'
                  : 'Sections are visual only. Navigation does not affect execution.'
              }
            >
              <SectionNavigator
                sections={sections}
                activeId={sections[sectionNavIndex]?.id}
                onJump={(id) => {
                  const idx = sections.findIndex((s) => s.id === id)
                  if (idx >= 0) setSectionNavIndex(idx)
                  const sec = sections.find((s) => s.id === id)
                  if (sec) centerOnSection(sec)
                }}
              />
            </GuardrailHint>
          </div>
        ) : null}
        {patterns.length > 0 ? (
          <div className="pointer-events-auto">
            <PatternLibrary
              patterns={patterns.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                purpose: (p as any).purpose,
                inputs: (p as any).inputs,
                outputs: (p as any).outputs,
                nodeCount: p.nodes.length,
              }))}
              onInsert={handleInsertPattern}
              highlightIndex={patternFocus ? patternHighlightIndex : -1}
            />
          </div>
        ) : null}
        {demoFlow ? (
          <div className="pointer-events-auto">
            <GuardrailHint message="Demo flows are read-only. Duplicate before editing.">
              <DemoFlowBanner demo={demoFlow} />
            </GuardrailHint>
          </div>
        ) : null}
      </div>

      <ReactFlow
        {...rfProps}
        fitView
        onInit={setRfInstance}
        onMoveEnd={(_, vp) => {
          if (!wrapperRef.current) return
          const rect = wrapperRef.current.getBoundingClientRect()
          setViewport({
            x: vp.x,
            y: vp.y,
            zoom: vp.zoom,
            width: rect.width,
            height: rect.height,
          })
        }}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={(sel) => {
          const ids = sel?.nodes?.map((n) => n.id) ?? []
          setSelectedIds(ids)
        }}
        onPaneClick={() => setHighlightNodeIds(new Set())}
        elementsSelectable
        nodesDraggable={!templateId}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {showPicker && pickerPosition ? (
        <div
          className="absolute z-20"
          style={{ left: pickerPosition.x, top: pickerPosition.y }}
        >
          {/* Builder-only UX.
             Edge-first creation must never infer behavior,
             affect execution, or persist non-node state. */}
          <QuickAddPalette
            options={nodeOptions}
            allowedTypes={compatibleTypes}
            recentTypes={recentTypes}
            onSelect={handleSelectType}
            onClose={() => {
              setShowPicker(false)
              setConnectState(null)
              setTypeAheadBuffer('')
            }}
            typeAhead={typeAheadBuffer}
            onTypeAheadConsumed={() => setTypeAheadBuffer('')}
            patterns={patterns.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
            }))}
            onSelectPattern={handleInsertPattern}
          />
        </div>
      ) : null}

      {selectedIds.length > 1 ? (
        <div className="pointer-events-auto absolute right-4 top-4 z-20 max-w-xs">
          <GuardrailHint
            message={
              bulkMixedTypes
                ? 'Bulk edits across mixed node types are allowed but do not change execution behavior.'
                : 'Bulk edits are visual edits only.'
            }
          >
            <BulkEditPanel
              selectedIds={selectedIds}
              nodes={nodes as any}
              onApply={(updated) => setNodes(updated as any)}
            />
          </GuardrailHint>
        </div>
      ) : null}

      {groups.map((group) => {
        const memberNodes = nodes.filter((n) => group.nodeIds.includes(n.id))
        if (memberNodes.length === 0) return null
        const xs = memberNodes.map((n) => n.position.x)
        const ys = memberNodes.map((n) => n.position.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        return (
          <GroupContainer
            key={group.id}
            name={group.name}
            collapsed={group.collapsed}
            rect={{ x: minX, y: minY, width: maxX - minX, height: maxY - minY }}
            onToggle={() => toggleGroup(group.id)}
          />
        )
      })}

      <ExecutionPathOverlay
        activeNodeIds={
          highlightNodeIds.size
            ? highlightNodeIds
            : filterKeepSet.size
              ? filterKeepSet
              : undefined
        }
        failedNodeIds={failedNodes}
        dimmedNodeIds={dimmedNodeIds}
        onClear={() => setHighlightNodeIds(new Set())}
      />

      <ExecutionLiveOverlay
        activeNodeId={liveActiveNodeId}
        completedNodeIds={liveCompletedNodeIds}
        skippedNodeIds={liveSkippedNodeIds}
        onClear={() => {
          setLiveActiveNodeId(undefined)
          setLiveCompletedNodeIds(new Set())
          setLiveSkippedNodeIds(new Set())
        }}
      />

      {/* Node-level chips (event-backed only). Consumers must place these near nodes; this is wiring only. */}
      {Array.from(approvalNodes).map((id) => (
        <div key={`approval-${id}`} className="hidden" aria-hidden>
          <ExecutionStatusChip type="approval-wait" />
        </div>
      ))}
      {Array.from(slaNodes).map((id) => (
        <div key={`sla-${id}`} className="hidden" aria-hidden>
          <ExecutionStatusChip type="sla-breach" />
        </div>
      ))}
    </div>
  )
}
