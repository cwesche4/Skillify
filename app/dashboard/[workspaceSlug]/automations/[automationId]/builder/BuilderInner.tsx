'use client'

/* ============================================================================
   ⚠️  WARNING: HIGH-COMPLEXITY FILE — DO NOT REFACTOR LIGHTLY
   ----------------------------------------------------------------------------
   This file orchestrates the Automation Builder canvas, HUD, panels,
   keyboard shortcuts, drag/drop behavior, fullscreen mode, presets,
   and workspace-scoped UI persistence.

   ❗ Changes here can easily introduce subtle regressions.

   CONTRIBUTION RULES:
   - Do NOT refactor existing logic unless absolutely necessary
   - Do NOT reorder hooks or effects
   - Add features in isolated, clearly labeled sections only
   - Preserve layout, state shape, and event flow
   - Test drag/drop, fullscreen, HUD, and keyboard shortcuts after changes

   When in doubt: EXTEND — do not rewrite.
============================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionLineType,
  useReactFlow,
  BackgroundVariant,
  Position,
  addEdge,
  getBezierPath,
  type Node as RFNode,
  type Edge,
  type Connection,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  ChevronsUpDown,
  Command as CommandIcon,
  Focus,
  Grid3X3,
  Layout,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  MousePointerClick,
  PanelLeft,
  PanelRight,
  Plus,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react'

import NodePalette from './components/NodePalette'
import InspectorPanel from './components/InspectorPanel'
import HeatmapLegend from './components/HeatmapLegend'
import TemplateSetupModal from './components/TemplateSetupModal'
import CanvasContextMenu from './components/CanvasContextMenu'
import AddNodeModal from './components/AddNodeModal'
import BuilderStartPanel from './components/BuilderStartPanel'
import AIWorkflowGeneratorModal from './components/AIWorkflowGeneratorModal'
import WorkflowTemplateGalleryModal from './components/WorkflowTemplateGalleryModal'
import TestWorkflowPanel from './components/TestWorkflowPanel'
import RunHistoryDebuggerPanel from './components/RunHistoryDebuggerPanel'
import RunTimeline from '@/components/builder/RunTimeline'
import AICoachOverlay from '@/components/builder/ai/AICoachOverlay'
import RunHistoryOverlay from '@/components/builder/RunHistoryOverlay'
import ExecutionLogsPanel from '@/components/builder/ExecutionLogsPanel'
import { useRunTimelineController } from '@/hooks/useRunTimelineController'
import { getActiveNodeIds as getReplayActiveNodes } from '@/lib/runtime/replaySelectors'
import type { RunTimeline as RuntimeRunTimeline } from '@/lib/runtime/types'
import { useAICoach } from '@/hooks/useAICoach'
import { useExecutionLogs } from '@/hooks/useExecutionLogs'
import { useAutomationRuns } from '@/hooks/useAutomationRuns'
import PresenceCursorsOverlay from '@/components/builder/collab/PresenceCursorsOverlay'
import LocksOverlay from '@/components/builder/collab/LocksOverlay'
import { useCollaborationSnapshot } from '@/hooks/useCollaborationSnapshot'
import VersionBadge from '@/components/builder/versioning/VersionBadge'
import { useAutomationVersions } from '@/hooks/useAutomationVersions'
import VersionHistoryPanel from '@/components/builder/VersionHistoryPanel'
import PresenceOverlay from '@/components/builder/collaboration/PresenceOverlay'
import LockOverlay from '@/components/builder/collaboration/LockOverlay'
import { useCollaborationPreview } from '@/hooks/useCollaborationPreview'
import { usePresencePolling } from '@/hooks/usePresencePolling'
import { useCursorBroadcaster } from '@/hooks/useCursorBroadcaster'
import VersionHistoryOverlay from '@/components/builder/versioning/VersionHistoryOverlay'
import { useVersioningPreview } from '@/hooks/useVersioningPreview'
import { useSoftLocks } from '@/hooks/useSoftLocks'
import type { LockDescriptor } from '@/lib/collab/types'
import type { AICallout } from '@/lib/ai/coach/types'
import { ReliabilityIndicators } from '@/components/builder/ReliabilityIndicators'
import type { RunTimelineData } from '@/lib/runs/types'
import { loadRunSettings } from '@/lib/runs/runSettings'
import {
  INSPECTOR_CLOSE_MS,
  INSPECTOR_EASE_IN,
  INSPECTOR_EASE_OUT,
  INSPECTOR_OPEN_MS,
} from '@/lib/ui/motion'

import { Button } from '@/components/ui/Button'
import { UpsellDFYModal } from '@/components/upsell/UpsellDFYModal'

import { useAutomationFlow } from './hooks/useAutomationFlow'
import { useNodeSelection } from './hooks/useNodeSelection'
import { usePermissions } from './hooks/usePermissions'
import { useHeatmapOverlay } from './hooks/useHeatmapOverlay'
import { useNodeLogs } from './hooks/useNodeLogs'

import {
  nodeTypes,
  NODE_DEFINITIONS,
  type BuilderNodeType,
} from '@/lib/builder/node-types'
import {
  getDefaultNodeData,
  validateNodeData,
  getNodeSchema,
  UnknownNodeSchema,
} from '@/lib/builder/node-schemas'
import { NODE_SCHEMA_MAP } from '@/lib/builder/node-schemas'
import { getBuilderCRMTemplates } from '@/lib/integrations/templates/builder'
import type { CRMTemplate } from '@/lib/integrations/templates'
import { getWorkflowBuilderPaletteItems } from '@/lib/workflows/builderAdapter'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { workflowFromReactFlow } from '@/lib/workflows/adapters'
import type { WorkflowExecution } from '@/lib/workflows/types'
import {
  buildDefaultMappings,
  getTargetMappingVariables,
  validateDataMappings,
  validateVariableValueForField,
  type MappingValidationIssue,
} from '@/lib/workflows/dataMapping'
import { createWorkflowPreflightFailurePreview } from '@/lib/workflows/executionPreview'
import {
  analyzeWorkflowData,
  type WorkflowDataFlowVariable,
} from '@/lib/workflows/workflowDataFlow'
import { analyzeWorkflowBranches } from '@/lib/workflows/workflowBranches'
import {
  branchPreviewDataFromInputs,
  branchPreviewFingerprint,
  getBranchPreviewInputs,
  type BranchPreviewOverrides,
} from '@/lib/workflows/branchPreviewInputs'
import type { WorkflowWorkspaceOptionContext } from '@/lib/workflows/workspaceFieldOptions'
import {
  executeWorkflowPreview,
  type WorkflowExecutionReport,
} from '@/lib/workflows/executionEngine'
import {
  getWorkflowRunHistoryStats,
  loadWorkflowRunHistory,
  recordWorkflowRunHistory,
  type WorkflowRunHistoryItem,
} from '@/lib/workflows/runHistory'
import {
  formatVariableReadableLabel,
  formatVariableSourceLabel,
  getAvailableVariablesForNode,
  getNodeInputVariables,
  getNodeOutputVariables,
  type WorkflowVariableDefinition,
} from '@/lib/workflows/variableRegistry'
import { replaceNodeIdsInConfigValue } from '@/lib/workflows/variableTokens'
import {
  createBuilderPreviewDraft,
  createBuilderStarterPreviewDraft,
  WORKFLOW_LAYOUT_SPACING,
  type BuilderDraftKind,
} from '@/lib/workflows/previewDrafts'
import {
  validateBuilderWorkflow,
  type BuilderValidationIssue,
} from '@/lib/workflows/builderValidation'
import type { WorkflowHealthIssue } from '@/lib/workflows/workflowHealth'
import {
  getPreviewFreshness,
  getWorkflowExecutionFingerprint,
  type PreviewFreshness,
} from '@/lib/workflows/workflowValidator'
import {
  applyWorkflowRepair,
  getWorkflowRepairActions,
  type WorkflowRepairAction,
} from '@/lib/workflows/workflowRepairs'
import {
  getWorkflowNodeRecommendations,
  validateWorkflowConnection,
} from '@/lib/workflows/connectionRules'
import { getCanvasWheelIntent } from '@/lib/workflows/canvasWheel'
import { resolveNodeBodyConnection } from '@/lib/workflows/connectionDropTarget'
import {
  canCreateTriggerRepairEdge,
  resolveMissingTriggerRepairTarget,
  type TriggerRepairContext,
} from '@/lib/workflows/triggerRepair'
import {
  getInspectorLayout,
  INSPECTOR_LAYOUTS,
  type InspectorTabId,
} from '@/lib/builder/inspector/layouts'
import { useInspectorValidation } from '@/lib/builder/inspector/hooks/useInspectorValidation'

/* --------------------------------
  Types
-------------------------------- */
type CanvasMode = 'blank' | 'dots' | 'grid'
type MiniMapPos = 'br' | 'tr'
type HudDensity = 'compact' | 'standard'
type HudVisibilityMode = 'auto' | 'always' | 'hidden'
type HeatmapVisibilityMode = 'auto' | 'on' | 'off'

type GuideLines = {
  v?: number
  h?: number
  active: boolean
}

type GhostState = {
  type: BuilderNodeType
  position: { x: number; y: number }
  size: { w: number; h: number }
}

type HUDDockMode =
  | 'floating'
  | 'dock-top-left'
  | 'dock-top-right'
  | 'dock-bottom-left'
  | 'dock-bottom-right'

type InspectorDockMode = 'left' | 'right' | 'overlay'

type FocusPreset = {
  id: string
  name: string
  viewport: Viewport
}
type BuilderPanel = null | 'ai' | 'templates' | 'addStep'
type ConnectionRepairMode = {
  nodeId: string
  issueId?: string
  label: string
  restore: {
    wasInspectorOpen: boolean
    rightCollapsed: boolean
    rightPeek: boolean
    userClosedInspector: boolean
    selectedNodeId: string | null
    tab: InspectorTabId
    scrollTop: number
  }
}
type HudSuggestion = {
  id: string
  label: string
  action?: () => void
  hint?: string
}

type HUDSavedPosition = {
  id: string
  name: string
  pos: { x: number; y: number }
  dockMode: HUDDockMode
  density: HudDensity
}

type BuilderHistorySnapshot = {
  nodes: RFNode[]
  edges: Edge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
}

type BuilderClipboard = {
  nodes: RFNode[]
  edges: Edge[]
}

function isEditableTarget(target: EventTarget | Element | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        'option',
        'button',
        'fieldset',
        '[contenteditable="true"]',
        '[contenteditable]',
        '[role="textbox"]',
        '[role="combobox"]',
        '[role="button"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[data-editor-input]',
        '[data-no-shortcuts]',
        '[data-modal-field]',
      ].join(','),
    ),
  )
}

function isTypingTarget(target: EventTarget | null) {
  return (
    isEditableTarget(target) ||
    (typeof document !== 'undefined' &&
      isEditableTarget(document.activeElement))
  )
}

function readBuilderLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeBuilderLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore unavailable storage
  }
}

function readBuilderSessionStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeBuilderSessionStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // ignore unavailable storage
  }
}

function removeBuilderSessionStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore unavailable storage
  }
}

function getBuilderNodeLabel(node?: RFNode | null) {
  if (!node) return 'Workflow'
  const data = node.data as
    | { label?: unknown; title?: unknown; __registryNodeId?: unknown }
    | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  if (typeof data?.title === 'string' && data.title.trim())
    return data.title.trim()
  const registryId =
    typeof data?.__registryNodeId === 'string'
      ? data.__registryNodeId
      : (node.type ?? 'unknown')
  return getWorkflowNodeDefinition(registryId)?.label ?? node.type ?? node.id
}

function cloneBuilderNodes(nodes: RFNode[]) {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data:
      node.data && typeof node.data === 'object'
        ? { ...(node.data as Record<string, unknown>) }
        : node.data,
  }))
}

function cloneBuilderEdges(edges: Edge[]) {
  return edges.map((edge) => ({
    ...edge,
    data:
      edge.data && typeof edge.data === 'object'
        ? { ...(edge.data as Record<string, unknown>) }
        : edge.data,
  }))
}

function snapshotSignature(snapshot: BuilderHistorySnapshot) {
  return JSON.stringify({
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      selected: Boolean(node.selected),
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data,
      selected: Boolean(edge.selected),
    })),
    selectedNodeIds: snapshot.selectedNodeIds,
    selectedEdgeIds: snapshot.selectedEdgeIds,
  })
}

/* --------------------------------
  🔼 ADDITION: Workspace UI Profiles
-------------------------------- */
type WorkspaceUIProfileId = 'default' | 'focus' | 'review' | 'minimal'
type WorkspaceUIProfile = {
  id: WorkspaceUIProfileId
  name: string
  description: string
  icon: React.ComponentType<any>
}

/* --------------------------------
  🔼 ADDITION: HUD Presets
-------------------------------- */
type HudPreset = {
  id: string
  name: string
  state: {
    density: HudDensity
    hudPos: { x: number; y: number }
    autoHide: boolean
    floatingWhenFullscreen: boolean
    leftWidth: number
    rightWidth: number
    canvasMode: CanvasMode
    snapToGrid: boolean
    miniMapPos: MiniMapPos
    leftCollapsed: boolean
    rightCollapsed: boolean
    dockMode?: HUDDockMode
  }
}

/* --------------------------------
  🔼 ADDITION: Shortcut Help Modal
-------------------------------- */
function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-5 text-slate-200 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold">Keyboard Shortcuts</h3>
        <ul className="space-y-1 text-xs text-slate-400">
          <li>
            <b>Cmd/Ctrl + K</b> — Command palette
          </li>
          <li>
            <b>Space</b> — Pan canvas
          </li>
          <li>
            <b>A</b> — Add node after selection
          </li>
          <li>
            <b>F</b> — Focus canvas / selection
          </li>
          <li>
            <b>Shift + F</b> — Fullscreen
          </li>
          <li>
            <b>[</b> — Toggle palette
          </li>
          <li>
            <b>]</b> — Toggle inspector
          </li>
          <li>
            <b>Cmd/Ctrl + Enter</b> — Run simulation
          </li>
          <li>
            <b>Esc</b> — Exit fullscreen
          </li>
          <li>
            <b>?</b> — Toggle this help
          </li>
        </ul>
        <div className="mt-4 flex justify-end">
          <Button size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

function UnsavedExitDialog({
  open,
  saving,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean
  saving: boolean
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-unsaved-exit-title"
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/95 p-5 text-slate-100 shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="builder-unsaved-exit-title"
              className="text-base font-semibold text-slate-50"
            >
              You have unsaved workflow changes.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Save before leaving Builder, or discard the current local edits.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close unsaved changes dialog"
            onClick={onCancel}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="secondary" onClick={onDiscard}>
            Discard & Exit
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save & Exit'}
          </Button>
        </div>
      </section>
    </div>
  )
}

function BuilderAssistantSection({
  title,
  count,
  defaultOpen = false,
  autoOpen = false,
  expandable = true,
  children,
  sectionRef,
  highlighted = false,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  autoOpen?: boolean
  expandable?: boolean
  children: React.ReactNode
  sectionRef?: (node: HTMLDivElement | null) => void
  highlighted?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || autoOpen)
  const isActuallyExpandable = expandable && !autoOpen

  useEffect(() => {
    if (autoOpen && !open) setOpen(true)
  }, [autoOpen, open])

  return (
    <section
      ref={sectionRef}
      className={[
        'rounded-lg border bg-slate-900/45 transition',
        highlighted
          ? 'border-cyan-300/50 ring-1 ring-cyan-300/30'
          : 'border-slate-800',
      ].join(' ')}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={[
          'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[11px] text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
          isActuallyExpandable ? 'hover:bg-slate-800/45' : 'cursor-default',
        ].join(' ')}
        aria-expanded={isActuallyExpandable ? open : undefined}
        onClick={() => {
          if (isActuallyExpandable) setOpen((value) => !value)
        }}
      >
        <span className="font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-[10px] text-slate-500">
          {typeof count === 'number' ? (
            <span className="rounded-full border border-slate-700 px-1.5 py-0.5">
              {count}
            </span>
          ) : null}
          {isActuallyExpandable ? (
            <span aria-hidden>{open ? '−' : '+'}</span>
          ) : null}
        </span>
      </button>
      {!isActuallyExpandable || open ? (
        <div className="border-t border-slate-800/70 p-2">{children}</div>
      ) : null}
    </section>
  )
}

function mappingSampleValue(
  variable?: Pick<
    WorkflowVariableDefinition,
    'sampleValue' | 'previewValue'
  > | null,
) {
  if (!variable) return 'No preview available'
  const value = variable.sampleValue ?? variable.previewValue
  if (value === undefined || value === null || value === '')
    return 'No preview available'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function mappingIssueDisplay(issue?: MappingValidationIssue) {
  if (!issue) {
    return {
      label: '✓ Valid',
      detail: '',
      className: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
    }
  }
  if (issue.severity === 'error') {
    return {
      label: issue.status === 'required-missing' ? '✕ Missing' : '✕ Error',
      detail:
        issue.status === 'incompatible'
          ? `Mapping incompatible: ${issue.message}`
          : issue.message,
      className: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
    }
  }
  return {
    label: '⚠ Warning',
    detail: issue.message,
    className: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  }
}

function mappingSectionForInput(input: WorkflowVariableDefinition) {
  if (!input.nullable) return 'Required fields'
  if (
    /(header|schema|auth|response|metadata|option|advanced)/i.test(input.key)
  ) {
    return 'Advanced fields'
  }
  return 'Optional fields'
}

function groupedMappingInputs(inputs: WorkflowVariableDefinition[]) {
  const order = ['Required fields', 'Optional fields', 'Advanced fields']
  return order
    .map((title) => ({
      title,
      inputs: inputs.filter((input) => mappingSectionForInput(input) === title),
    }))
    .filter((section) => section.inputs.length > 0)
}

function mappingFieldText(input: WorkflowVariableDefinition) {
  return `${input.key} ${input.label}`.toLowerCase()
}

function fixedMappingPlaceholder(input: WorkflowVariableDefinition) {
  const label = mappingFieldText(input)
  if (input.type === 'email' || label.includes('email'))
    return 'support@example.com'
  if (input.type === 'phone' || label.includes('phone'))
    return '+1 703-555-1234'
  if (input.type === 'url' || label.includes('url') || label.includes('link')) {
    return 'https://example.com/review'
  }
  if (input.type === 'date' || label.includes('date')) return '2026-07-10'
  if (input.type === 'datetime' || label.includes('time'))
    return '2026-07-10 2:00 PM'
  if (label.includes('unit')) return 'minutes'
  if (
    input.type === 'number' &&
    (label.includes('duration') || label.includes('delay'))
  ) {
    return '30'
  }
  if (
    input.type === 'number' ||
    label.includes('number') ||
    label.includes('duration')
  ) {
    return '10'
  }
  if (label.includes('subject')) return 'Your estimate is ready'
  if (label.includes('body') || label.includes('message')) {
    return 'Thank you for contacting us.'
  }
  return 'Enter a custom value'
}

/* --------------------------------
  🔼 ADDITION: Click Outside Hook
-------------------------------- */
function useClickOutside(
  refs: Array<React.RefObject<HTMLElement>>,
  onOutside: () => void,
  enabled = true,
  ignoredSelectors: string[] = [],
) {
  const onOutsideRef = useRef(onOutside)

  useEffect(() => {
    onOutsideRef.current = onOutside
  }, [onOutside])

  useEffect(() => {
    if (!enabled) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (ignoredSelectors.some((selector) => target.closest(selector))) return
      const inside = refs.some((r) => {
        const el = r.current
        return el ? el.contains(target) : false
      })
      if (!inside) onOutsideRef.current()
    }
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [enabled, ignoredSelectors, refs])
}

/* --------------------------------
  🔼 ADDITION: HUD Menu (icons, click outside, framer motion)
-------------------------------- */
function HudMenu({
  open,
  onClose,
  density,
  setDensity,
  autoHide,
  setAutoHide,
  visibilityMode,
  setVisibilityMode,
  floatingWhenFullscreen,
  setFloatingWhenFullscreen,
  profileId,
  setProfileId,
  profiles,
  onSaveHudPreset,
  onApplyHudPreset,
  onDeleteHudPreset,
  hudPresets,
  selectedHudPresetId,
  setSelectedHudPresetId,
  focusPresets,
  selectedFocusPresetId,
  onApplyFocusPreset,
  onSaveFocusPreset,
  onDeleteFocusPreset,
  onPreviewFocusPreset,
  hudHintPanelOpen,
  setHudHintPanelOpen,
  hudSuggestions,
  setHudHintsDismissed,
  showMinimap,
  setShowMinimap,
  heatmapMode,
  setHeatmapMode,
  canvasMode,
  setCanvasMode,
  workspaceId,
  settingsStorageKey,
  autosaveEnabled,
  setAutosaveEnabled,
  getSafeBounds,
}: {
  open: boolean
  onClose: () => void

  density: HudDensity
  setDensity: (v: HudDensity) => void

  autoHide: boolean
  setAutoHide: (v: boolean) => void
  visibilityMode: HudVisibilityMode
  setVisibilityMode: (v: HudVisibilityMode) => void

  floatingWhenFullscreen: boolean
  setFloatingWhenFullscreen: (v: boolean) => void

  profileId: WorkspaceUIProfileId
  setProfileId: (v: WorkspaceUIProfileId) => void
  profiles: WorkspaceUIProfile[]

  onSaveHudPreset: () => void
  onApplyHudPreset: (id: string) => void
  onDeleteHudPreset: (id: string) => void
  hudPresets: HudPreset[]
  selectedHudPresetId: string
  setSelectedHudPresetId: (v: string) => void

  focusPresets: FocusPreset[]
  selectedFocusPresetId: string
  onApplyFocusPreset: (id: string) => void
  onSaveFocusPreset: () => void
  onDeleteFocusPreset: () => void
  onPreviewFocusPreset: (id: string) => void
  hudHintPanelOpen: boolean
  setHudHintPanelOpen: (v: boolean) => void
  hudSuggestions: HudSuggestion[]
  setHudHintsDismissed: (v: boolean) => void
  showMinimap: boolean
  setShowMinimap: (v: boolean) => void
  heatmapMode: HeatmapVisibilityMode
  setHeatmapMode: (v: HeatmapVisibilityMode) => void
  canvasMode: CanvasMode
  setCanvasMode: (v: CanvasMode) => void
  workspaceId: string
  settingsStorageKey: string
  autosaveEnabled: boolean
  setAutosaveEnabled: (v: boolean) => void
  getSafeBounds?: () => {
    left: number
    top: number
    right: number
    bottom: number
  }
}) {
  type SettingsCategory =
    | 'general'
    | 'canvas'
    | 'hud'
    | 'insights'
    | 'view'
    | 'advanced'

  const menuRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>('general')
  const [menuPosition, setMenuPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const [menuSize, setMenuSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const latestMenuPositionRef = useRef<{ left: number; top: number } | null>(
    null,
  )

  const isInteractiveDragTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(
      target.closest(
        'button, input, textarea, select, option, a, label, [role="button"], [data-no-drag], [contenteditable="true"]',
      ),
    )
  }, [])

  const getMenuSafeBounds = useCallback(() => {
    const canvasBounds = getSafeBounds?.()
    return {
      left: canvasBounds?.left ?? 0,
      top: canvasBounds?.top ?? 0,
      right: canvasBounds?.right ?? window.innerWidth,
      bottom: canvasBounds?.bottom ?? window.innerHeight,
    }
  }, [getSafeBounds])

  const syncMenuSize = useCallback(() => {
    const bounds = getMenuSafeBounds()
    const pad = 12
    const availableWidth = Math.max(1, bounds.right - bounds.left - pad * 2)
    const availableHeight = Math.max(1, bounds.bottom - bounds.top - pad * 2)
    setMenuSize({
      width: Math.min(760, availableWidth),
      height: Math.min(620, availableHeight),
    })
  }, [getMenuSafeBounds])

  const clampMenuPosition = useCallback(
    (position: { left: number; top: number }) => {
      const menu = menuRef.current
      const bounds = getMenuSafeBounds()
      const width =
        menu?.offsetWidth ??
        menuSize?.width ??
        Math.min(760, window.innerWidth - 48)
      const height =
        menu?.offsetHeight ??
        menuSize?.height ??
        Math.min(620, window.innerHeight - 120)
      const pad = 12
      const minLeft = bounds.left + pad
      const minTop = bounds.top + pad
      const maxLeft = Math.max(minLeft, bounds.right - width - pad)
      const maxTop = Math.max(minTop, bounds.bottom - height - pad)
      return {
        left: Math.max(minLeft, Math.min(position.left, maxLeft)),
        top: Math.max(minTop, Math.min(position.top, maxTop)),
      }
    },
    [getMenuSafeBounds, menuSize?.height, menuSize?.width],
  )

  const getMenuDimensions = useCallback(() => {
    return {
      width:
        menuRef.current?.offsetWidth ??
        menuSize?.width ??
        Math.min(760, Math.max(1, window.innerWidth - 48)),
      height:
        menuRef.current?.offsetHeight ??
        menuSize?.height ??
        Math.min(620, Math.max(1, window.innerHeight - 120)),
    }
  }, [menuSize?.height, menuSize?.width])

  const getCenteredMenuPosition = useCallback(() => {
    const bounds = getMenuSafeBounds()
    const { width, height } = getMenuDimensions()
    return clampMenuPosition({
      left: bounds.left + (bounds.right - bounds.left - width) / 2,
      top: bounds.top + (bounds.bottom - bounds.top - height) / 2,
    })
  }, [clampMenuPosition, getMenuDimensions, getMenuSafeBounds])

  const savedMenuPositionFits = useCallback(
    (position: { left: number; top: number }) => {
      const bounds = getMenuSafeBounds()
      const { width, height } = getMenuDimensions()
      const pad = 12
      return (
        position.left >= bounds.left + pad &&
        position.top >= bounds.top + pad &&
        position.left + width <= bounds.right - pad &&
        position.top + height <= bounds.bottom - pad
      )
    },
    [getMenuDimensions, getMenuSafeBounds],
  )

  const setClampedMenuPosition = useCallback(
    (position: { left: number; top: number }) => {
      const next = clampMenuPosition(position)
      latestMenuPositionRef.current = next
      setMenuPosition(next)
      return next
    },
    [clampMenuPosition],
  )

  useClickOutside([menuRef], onClose, open, [
    '[data-builder-settings-trigger="true"]',
  ])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      syncMenuSize()
      const savedRaw = readBuilderLocalStorage(
        `${settingsStorageKey}:settingsPanelPos`,
      )
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw) as {
            left?: unknown
            top?: unknown
          }
          if (typeof saved.left === 'number' && typeof saved.top === 'number') {
            if (savedMenuPositionFits({ left: saved.left, top: saved.top })) {
              setClampedMenuPosition({ left: saved.left, top: saved.top })
              return
            }
            setClampedMenuPosition(getCenteredMenuPosition())
            return
          }
        } catch {
          // Invalid saved positions are ignored and replaced by the center.
        }
      }
      setClampedMenuPosition(getCenteredMenuPosition())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [
    getCenteredMenuPosition,
    open,
    savedMenuPositionFits,
    setClampedMenuPosition,
    settingsStorageKey,
    syncMenuSize,
  ])

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      syncMenuSize()
      setMenuPosition((current) => {
        if (!current) return current
        const next = clampMenuPosition(current)
        latestMenuPositionRef.current = next
        if (autosaveEnabled) {
          writeBuilderLocalStorage(
            `${settingsStorageKey}:settingsPanelPos`,
            JSON.stringify(next),
          )
        }
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [
    autosaveEnabled,
    clampMenuPosition,
    open,
    settingsStorageKey,
    syncMenuSize,
  ])

  const beginMenuDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        event.button !== 0 ||
        (event.pointerType === 'mouse' && event.buttons !== 1)
      )
        return
      event.stopPropagation()
      if (isInteractiveDragTarget(event.target)) return
      event.preventDefault()
      const rect = menuRef.current?.getBoundingClientRect()
      if (!rect) return
      event.currentTarget.setPointerCapture(event.pointerId)
      dragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      }
    },
    [isInteractiveDragTarget],
  )

  const handleMenuDragMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopPropagation()
      setClampedMenuPosition({
        left: event.clientX - drag.offsetX,
        top: event.clientY - drag.offsetY,
      })
    },
    [setClampedMenuPosition],
  )

  const endMenuDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragStateRef.current = null
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const finalPosition = latestMenuPositionRef.current
      if (finalPosition && autosaveEnabled) {
        writeBuilderLocalStorage(
          `${settingsStorageKey}:settingsPanelPos`,
          JSON.stringify(finalPosition),
        )
      }
    },
    [autosaveEnabled, settingsStorageKey],
  )

  const stopSettingsCloseButtonEvent = useCallback(
    (event: React.SyntheticEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragStateRef.current = null
    },
    [],
  )

  const closeSettingsFromButton = useCallback(
    (event: React.SyntheticEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragStateRef.current = null
      onClose()
    },
    [onClose],
  )

  const categories: Array<{
    id: SettingsCategory
    label: string
    icon: React.ComponentType<any>
  }> = [
    { id: 'general', label: 'General', icon: Sparkles },
    { id: 'canvas', label: 'Canvas', icon: Grid3X3 },
    { id: 'hud', label: 'Controls', icon: Layout },
    { id: 'insights', label: 'Insights', icon: Zap },
    { id: 'view', label: 'View', icon: Focus },
    { id: 'advanced', label: 'Advanced', icon: Wand2 },
  ]

  const renderContent = () => {
    if (activeCategory === 'general') {
      return (
        <div className="space-y-3">
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Saved views
            </div>
            <div className="grid grid-cols-2 gap-2">
              {focusPresets.length === 0 ? (
                <div className="col-span-2 rounded-md border border-slate-800/70 bg-slate-950/30 p-3 text-[11px] text-slate-400">
                  No saved views yet.
                </div>
              ) : (
                focusPresets.slice(0, 6).map((preset) => {
                  const active = preset.id === selectedFocusPresetId
                  return (
                    <button
                      key={preset.id}
                      onMouseEnter={() => onPreviewFocusPreset(preset.id)}
                      onFocus={() => onPreviewFocusPreset(preset.id)}
                      onClick={() => onApplyFocusPreset(preset.id)}
                      className={[
                        'rounded-lg border p-2 text-left transition',
                        active
                          ? 'border-slate-600 bg-slate-800/70 text-slate-100'
                          : 'border-slate-800/70 bg-slate-950/30 text-slate-300 hover:bg-slate-900/40',
                      ].join(' ')}
                    >
                      <div className="text-xs font-semibold">{preset.name}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Zoom {(preset.viewport.zoom * 100).toFixed(0)}%
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="xs" onClick={onSaveFocusPreset}>
                Save view
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={onDeleteFocusPreset}
                disabled={!selectedFocusPresetId}
              >
                Delete view
              </Button>
            </div>
          </section>
        </div>
      )
    }

    if (activeCategory === 'canvas') {
      return (
        <div className="space-y-3">
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Background
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['blank', 'dots', 'grid'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCanvasMode(mode)}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs capitalize transition',
                    canvasMode === mode
                      ? 'border-slate-600 bg-slate-800/70 text-slate-100'
                      : 'border-slate-800/70 bg-slate-950/30 text-slate-300 hover:bg-slate-900/50',
                  ].join(' ')}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Canvas overlays
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-slate-800/40">
              <span className="text-slate-300">Show Minimap</span>
              <input
                type="checkbox"
                checked={showMinimap}
                onChange={(event) => setShowMinimap(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-slate-800/40">
              <span className="text-slate-300">Failure heatmap</span>
              <select
                className="rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                value={heatmapMode}
                onChange={(event) =>
                  setHeatmapMode(event.target.value as HeatmapVisibilityMode)
                }
              >
                <option value="auto">Auto</option>
                <option value="on">Always</option>
                <option value="off">Hidden</option>
              </select>
            </label>
          </section>
        </div>
      )
    }

    if (activeCategory === 'hud') {
      return (
        <div className="space-y-3">
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Canvas Controls density
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['compact', 'standard'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDensity(mode)}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs capitalize transition',
                    density === mode
                      ? 'border-slate-600 bg-slate-800/70 text-slate-100'
                      : 'border-slate-800/70 bg-slate-950/30 text-slate-300 hover:bg-slate-900/50',
                  ].join(' ')}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Visibility
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'always', 'hidden'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVisibilityMode(mode)}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs capitalize transition',
                    visibilityMode === mode
                      ? 'border-slate-600 bg-slate-800/70 text-slate-100'
                      : 'border-slate-800/70 bg-slate-950/30 text-slate-300 hover:bg-slate-900/50',
                  ].join(' ')}
                >
                  {mode === 'always' ? 'Always' : mode}
                </button>
              ))}
            </div>
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-slate-800/40">
              <span className="text-slate-300">Float tools in fullscreen</span>
              <input
                type="checkbox"
                checked={floatingWhenFullscreen}
                onChange={(event) =>
                  setFloatingWhenFullscreen(event.target.checked)
                }
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-slate-800/40">
              <span className="text-slate-300">Auto-hide tools on idle</span>
              <input
                type="checkbox"
                checked={autoHide}
                onChange={(event) => setAutoHide(event.target.checked)}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-slate-800/40">
              <span className="text-slate-300">
                Autosave: {autosaveEnabled ? 'On' : 'Off'}
              </span>
              <input
                type="checkbox"
                checked={autosaveEnabled}
                onChange={(event) => setAutosaveEnabled(event.target.checked)}
              />
            </label>
          </section>
        </div>
      )
    }

    if (activeCategory === 'insights') {
      const insightItems = [
        'Execution timing',
        'Node runtime',
        'Success rate',
        'Failure tracking',
        'Throughput metrics',
      ]
      return (
        <div className="space-y-3">
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-1 text-xs font-semibold text-slate-200">
              Workflow insights
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              These metrics use the current run insights configuration.
            </p>
            <div className="space-y-1">
              {insightItems.map((label) => (
                <label
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-slate-800/40"
                >
                  <span>{label}</span>
                  <input type="checkbox" checked readOnly />
                </label>
              ))}
              <label className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs text-slate-500">
                <span>Debug logging</span>
                <input type="checkbox" disabled />
              </label>
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/70"
              onClick={() =>
                window.open(
                  `/dashboard/${workspaceId}/settings/run-insights`,
                  '_self',
                )
              }
            >
              Open insight settings
            </button>
          </section>
        </div>
      )
    }

    if (activeCategory === 'view') {
      return (
        <div className="space-y-3">
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Workspace view
            </div>
            <div className="space-y-1">
              {profiles.map((profile) => {
                const Icon = profile.icon
                const active = profile.id === profileId
                return (
                  <button
                    key={profile.id}
                    onClick={() => setProfileId(profile.id)}
                    className={[
                      'flex w-full items-start justify-between rounded-md px-2 py-2 text-left transition',
                      active
                        ? 'bg-slate-800/60 text-slate-100'
                        : 'text-slate-200 hover:bg-slate-800/40',
                    ].join(' ')}
                  >
                    <span className="flex items-start gap-2">
                      <Icon className="mt-[2px] h-4 w-4 text-slate-300" />
                      <span className="flex flex-col">
                        <span className="text-xs font-semibold">
                          {profile.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {profile.description}
                        </span>
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-slate-200" />}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <section className="rounded-lg bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-200">
            Canvas Controls presets
          </div>
          <div className="flex items-center gap-2">
            <select
              className="w-full rounded-md bg-slate-900 px-2 py-2 text-xs text-slate-200"
              value={selectedHudPresetId}
              onChange={(event) => {
                const id = event.target.value
                setSelectedHudPresetId(id)
                if (id) onApplyHudPreset(id)
              }}
            >
              <option value="">Select preset...</option>
              {hudPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <Button size="xs" onClick={onSaveHudPreset}>
              Save
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={!selectedHudPresetId}
              onClick={() =>
                selectedHudPresetId && onDeleteHudPreset(selectedHudPresetId)
              }
            >
              Delete
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Presets capture density, position, panel widths, and key toggles.
          </p>
        </section>

        {hudHintPanelOpen && hudSuggestions.length > 0 && (
          <section className="rounded-lg bg-slate-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-200">
                Suggested actions
              </div>
              <button
                className="text-[11px] text-slate-500 hover:text-slate-200"
                onClick={() => {
                  setHudHintsDismissed(true)
                  setHudHintPanelOpen(false)
                }}
              >
                Dismiss
              </button>
            </div>
            <ul className="space-y-1">
              {hudSuggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-slate-800/40"
                >
                  <span>{suggestion.label}</span>
                  {suggestion.action && (
                    <Button
                      size="xs"
                      onClick={() => {
                        suggestion.action?.()
                        setHudHintPanelOpen(false)
                      }}
                    >
                      Run
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          data-builder-controls-menu="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className="fixed z-[70] flex h-[min(620px,calc(100dvh-120px))] w-[min(760px,calc(100vw-48px))] cursor-grab overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 text-slate-200 shadow-2xl backdrop-blur active:cursor-grabbing"
          style={{
            left: menuPosition?.left ?? 24,
            top: menuPosition?.top ?? 80,
            width: menuSize?.width,
            height: menuSize?.height,
          }}
          onPointerDown={beginMenuDrag}
          onPointerMove={handleMenuDragMove}
          onPointerUp={endMenuDrag}
          onPointerCancel={endMenuDrag}
          onClick={(event) => event.stopPropagation()}
        >
          <aside className="w-44 shrink-0 border-r border-slate-800/70 bg-slate-950/80 p-3">
            <div
              className="mb-3 flex select-none items-center justify-between gap-2"
              title="Drag settings panel"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <Sparkles className="h-4 w-4 text-slate-300" />
                Settings
              </div>
              <button
                type="button"
                data-no-drag="true"
                className="-m-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                onPointerDown={stopSettingsCloseButtonEvent}
                onPointerUp={closeSettingsFromButton}
                onMouseDown={stopSettingsCloseButtonEvent}
                onClick={closeSettingsFromButton}
                aria-label="Close builder settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon
                const active = activeCategory === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition',
                      active
                        ? 'bg-slate-800/70 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </button>
                )
              })}
            </nav>
          </aside>
          <section className="min-w-0 flex-1 overflow-hidden">
            <div className="border-b border-slate-800/70 px-4 py-3">
              <div className="text-sm font-semibold text-slate-100">
                {
                  categories.find((category) => category.id === activeCategory)
                    ?.label
                }
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Configure the builder without leaving the workflow canvas.
              </div>
            </div>
            <div className="h-[calc(100%-58px)] overflow-y-auto p-4">
              {renderContent()}
            </div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* --------------------------------
  🔼 ADDITION: Command Palette (Cmd+K)
-------------------------------- */
type PaletteCommand = {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<any>
  run: () => void
}

function CommandPalette({
  open,
  onClose,
  commands,
  onGroupSelected,
}: {
  open: boolean
  onClose: () => void
  commands: PaletteCommand[]
  onGroupSelected?: () => void
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  useClickOutside([panelRef], onClose, open)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.hint || '').toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        onGroupSelected?.()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[activeIndex]
        if (cmd) {
          cmd.run()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, activeIndex, onClose, onGroupSelected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-24">
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-2 border-b border-slate-800/70 px-3 py-3">
          <CommandIcon className="h-4 w-4 text-slate-300" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-auto p-2">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/30 p-3 text-sm text-slate-400">
              No matches.
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c, idx) => {
                const Icon = c.icon
                const active = idx === activeIndex
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      c.run()
                      onClose()
                    }}
                    className={[
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left',
                      active ? 'bg-slate-800/60' : 'hover:bg-slate-800/40',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-300" />
                      <span className="text-sm text-slate-100">{c.label}</span>
                    </span>
                    {c.hint && (
                      <span className="text-[11px] text-slate-400">
                        {c.hint}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/70 px-3 py-2 text-[11px] text-slate-400">
          Tip: Cmd/Ctrl+K to open. Arrow keys + Enter to run.
        </div>
      </motion.div>
    </div>
  )
}

interface BuilderInnerProps {
  automationId: string
  workspaceId: string
}

export default function BuilderInner({
  automationId,
  workspaceId,
}: BuilderInnerProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const reactFlow = useReactFlow()

  /* --------------------------------
    Persisted Canvas Preferences
 -------------------------------- */
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(
    () =>
      (readBuilderLocalStorage(
        `builderControls:${workspaceId}:canvasMode`,
      ) as CanvasMode) ||
      (readBuilderLocalStorage('canvasMode') as CanvasMode) ||
      'dots',
  )
  const [miniMapPos, setMiniMapPos] = useState<MiniMapPos>(
    () =>
      (readBuilderLocalStorage(
        `builderControls:${workspaceId}:miniMapPos`,
      ) as MiniMapPos) ||
      (readBuilderLocalStorage('miniMapPos') as MiniMapPos) ||
      'br',
  )
  const [showMinimap, setShowMinimap] = useState(() => {
    const scoped = readBuilderLocalStorage(
      `builderControls:${workspaceId}:showMinimap`,
    )
    if (scoped !== null) return scoped !== 'false'
    return readBuilderLocalStorage('showMinimap') !== 'false'
  })
  const [heatmapMode, setHeatmapMode] = useState<HeatmapVisibilityMode>(() => {
    const raw =
      readBuilderLocalStorage(
        `builderControls:${workspaceId}:failureHeatmapMode`,
      ) || readBuilderLocalStorage('failureHeatmapMode')
    if (raw === 'auto' || raw === 'on' || raw === 'off') return raw
    return 'auto'
  })
  const [snapToGrid, setSnapToGrid] = useState(() => {
    const scoped = readBuilderLocalStorage(
      `builderControls:${workspaceId}:snapToGrid`,
    )
    if (scoped !== null) return scoped === 'true'
    return readBuilderLocalStorage('snapToGrid') === 'true'
  })
  const autosavePreferenceKey = useMemo(
    () => `builderAutosave:${workspaceId}:${automationId}`,
    [automationId, workspaceId],
  )
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(
      `builderAutosave:${workspaceId}:${automationId}`,
    )
    return raw ? raw === 'true' : true
  })
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [exitSaving, setExitSaving] = useState(false)
  const [startPanelDismissed, setStartPanelDismissed] = useState(false)

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(
      `builderControls:${workspaceId}:canvasMode`,
      canvasMode,
    )
    writeBuilderLocalStorage(
      `builderControls:${workspaceId}:miniMapPos`,
      miniMapPos,
    )
    writeBuilderLocalStorage(
      `builderControls:${workspaceId}:showMinimap`,
      String(showMinimap),
    )
    writeBuilderLocalStorage(
      `builderControls:${workspaceId}:failureHeatmapMode`,
      heatmapMode,
    )
    writeBuilderLocalStorage(
      `builderControls:${workspaceId}:snapToGrid`,
      String(snapToGrid),
    )
  }, [
    autosaveEnabled,
    canvasMode,
    heatmapMode,
    miniMapPos,
    showMinimap,
    snapToGrid,
    workspaceId,
  ])

  useEffect(() => {
    writeBuilderLocalStorage(autosavePreferenceKey, String(autosaveEnabled))
  }, [autosaveEnabled, autosavePreferenceKey])

  /* --------------------------------
    Hooks
 -------------------------------- */
  const { planLabel, plan, canUseFeature } = usePermissions()
  const canUseFeatureUnsafe = canUseFeature as unknown as (
    feature: string,
  ) => boolean
  // reserved for AI Coach overlays / heatmap rendering
  const { getIntensity } = useHeatmapOverlay(automationId)
  const { getLogs } = useNodeLogs()

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    applyAutoLayout,
    savingStatus,
    saveNow,
    automation,
  } = useAutomationFlow({ automationId, autosaveEnabled })
  const previousNodeCountRef = useRef(nodes.length)

  const {
    selectedNode,
    selectedNodeId,
    selectedIds,
    onNodeClick,
    onSelectionChange,
    toggleNodeSelection,
    updateSelectedNodeData,
    clearSelection,
    selectNode,
    selectNodes,
    suppressSelectionChangeFor,
  } = useNodeSelection(nodes, setNodes, setEdges)
  const selectedEdgeIds = useMemo(
    () => edges.filter((edge) => edge.selected).map((edge) => edge.id),
    [edges],
  )
  const nodesRef = useRef<RFNode[]>([])
  const edgesRef = useRef<Edge[]>([])
  const selectedIdsRef = useRef<string[]>([])
  const selectedEdgeIdsRef = useRef<string[]>([])
  const undoStackRef = useRef<BuilderHistorySnapshot[]>([])
  const redoStackRef = useRef<BuilderHistorySnapshot[]>([])
  const [historyRevision, setHistoryRevision] = useState(0)
  const clipboardRef = useRef<BuilderClipboard | null>(null)
  const [clipboardRevision, setClipboardRevision] = useState(0)
  const dragStartSnapshotRef = useRef<BuilderHistorySnapshot | null>(null)
  const mixPresetIndexRef = useRef(0)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    selectedEdgeIdsRef.current = selectedEdgeIds
  }, [selectedEdgeIds])

  const createHistorySnapshot = useCallback(
    (): BuilderHistorySnapshot => ({
      nodes: cloneBuilderNodes(nodesRef.current),
      edges: cloneBuilderEdges(edgesRef.current),
      selectedNodeIds: [...selectedIdsRef.current],
      selectedEdgeIds: [...selectedEdgeIdsRef.current],
    }),
    [],
  )

  const restoreHistorySnapshot = useCallback(
    (snapshot: BuilderHistorySnapshot) => {
      const selectedNodeSet = new Set(snapshot.selectedNodeIds)
      const selectedEdgeSet = new Set(snapshot.selectedEdgeIds)
      setNodes(
        cloneBuilderNodes(snapshot.nodes).map((node) => ({
          ...node,
          selected: selectedNodeSet.has(node.id),
        })),
      )
      setEdges(
        cloneBuilderEdges(snapshot.edges).map((edge) => ({
          ...edge,
          selected: selectedEdgeSet.has(edge.id),
        })),
      )
      selectNodes(snapshot.selectedNodeIds, true)
    },
    [selectNodes, setEdges, setNodes],
  )

  const commitHistory = useCallback(
    (previousSnapshot?: BuilderHistorySnapshot | null) => {
      const snapshot = previousSnapshot ?? createHistorySnapshot()
      const current = undoStackRef.current[undoStackRef.current.length - 1]
      if (
        current &&
        snapshotSignature(current) === snapshotSignature(snapshot)
      ) {
        return
      }
      undoStackRef.current = [...undoStackRef.current.slice(-79), snapshot]
      redoStackRef.current = []
      setHistoryRevision((revision) => revision + 1)
    },
    [createHistorySnapshot],
  )

  const undoBuilderEdit = useCallback(() => {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current = [
      ...redoStackRef.current.slice(-79),
      createHistorySnapshot(),
    ]
    restoreHistorySnapshot(previous)
    setHistoryRevision((revision) => revision + 1)
  }, [createHistorySnapshot, restoreHistorySnapshot])

  const redoBuilderEdit = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current = [
      ...undoStackRef.current.slice(-79),
      createHistorySnapshot(),
    ]
    restoreHistorySnapshot(next)
    setHistoryRevision((revision) => revision + 1)
  }, [createHistorySnapshot, restoreHistorySnapshot])

  const clearEditorSelection = useCallback(() => {
    clearSelection()
    setEdges((currentEdges) => {
      let changed = false
      const next = currentEdges.map((edge) => {
        if (!edge.selected) return edge
        changed = true
        return { ...edge, selected: false }
      })
      return changed ? next : currentEdges
    })
  }, [clearSelection, setEdges])
  const [isShiftSelectMode, setIsShiftSelectMode] = useState(false)
  const [activeBuilderPanel, setActiveBuilderPanel] =
    useState<BuilderPanel>(null)
  const shiftBoxSelectionStartRef = useRef<{ x: number; y: number } | null>(
    null,
  )
  const shiftBoxSelectionActiveRef = useRef(false)
  const shiftBoxSelectionPreviousIdsRef = useRef<string[]>([])
  const shiftBoxSelectionPreviewIdsRef = useRef<string[]>([])
  const alignCycleIndexRef = useRef(0)
  const arrangeCycleIndexRef = useRef(0)

  const sameNodeIds = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    return a.every((id, index) => id === b[index])
  }, [])

  const getShiftBoxSelectedNodeIds = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      if (!canvasRef.current) return []
      const left = Math.min(start.x, end.x)
      const right = Math.max(start.x, end.x)
      const top = Math.min(start.y, end.y)
      const bottom = Math.max(start.y, end.y)

      return Array.from(
        canvasRef.current.querySelectorAll<HTMLElement>(
          '.react-flow__node[data-id]',
        ),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return (
            rect.right >= left &&
            rect.left <= right &&
            rect.bottom >= top &&
            rect.top <= bottom
          )
        })
        .map((element) => element.getAttribute('data-id'))
        .filter((id): id is string => Boolean(id))
    },
    [],
  )

  const previewShiftBoxSelection = useCallback(
    (nodeIds: string[]) => {
      if (sameNodeIds(shiftBoxSelectionPreviewIdsRef.current, nodeIds)) return
      shiftBoxSelectionPreviewIdsRef.current = nodeIds
      suppressSelectionChangeFor(350)
      const previewIds = new Set(nodeIds)
      setNodes((nds) => {
        let changed = false
        const next = nds.map((node) => {
          const selected = previewIds.has(node.id)
          if (node.selected === selected) return node
          changed = true
          return { ...node, selected }
        })
        return changed ? next : nds
      })
    },
    [sameNodeIds, setNodes, suppressSelectionChangeFor],
  )

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!event.shiftKey) {
        shiftBoxSelectionStartRef.current = null
        shiftBoxSelectionActiveRef.current = false
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.closest('.react-flow__node')) {
        shiftBoxSelectionStartRef.current = null
        shiftBoxSelectionActiveRef.current = false
        return
      }
      shiftBoxSelectionStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      shiftBoxSelectionPreviousIdsRef.current = selectedIds
      shiftBoxSelectionPreviewIdsRef.current = selectedIds
      shiftBoxSelectionActiveRef.current = true
      suppressSelectionChangeFor(1000)
      setIsShiftSelectMode(true)
    },
    [selectedIds, suppressSelectionChangeFor],
  )

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      if (shiftBoxSelectionActiveRef.current) {
        suppressSelectionChangeFor(350)
        const start = shiftBoxSelectionStartRef.current
        if (start) {
          previewShiftBoxSelection(
            getShiftBoxSelectedNodeIds(start, {
              x: event.clientX,
              y: event.clientY,
            }),
          )
        }
        return
      }
      if (event.shiftKey !== isShiftSelectMode) {
        setIsShiftSelectMode(event.shiftKey)
      }
    },
    [
      getShiftBoxSelectedNodeIds,
      isShiftSelectMode,
      previewShiftBoxSelection,
      suppressSelectionChangeFor,
    ],
  )

  const handleCanvasMouseUp = useCallback(
    (event: React.MouseEvent) => {
      const boxSelectionActive = shiftBoxSelectionActiveRef.current
      if (!event.shiftKey && !boxSelectionActive) return
      const target = event.target as HTMLElement | null
      const nodeElement = target?.closest(
        '.react-flow__node',
      ) as HTMLElement | null
      const nodeId = nodeElement?.getAttribute('data-id')
      if (!boxSelectionActive && nodeId && event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        shiftBoxSelectionStartRef.current = null
        shiftBoxSelectionActiveRef.current = false
        toggleNodeSelection(nodeId)
        return
      }

      const start = shiftBoxSelectionStartRef.current
      shiftBoxSelectionStartRef.current = null
      shiftBoxSelectionActiveRef.current = false
      suppressSelectionChangeFor(350)
      if (!event.shiftKey) setIsShiftSelectMode(false)
      if (!start || !canvasRef.current) {
        previewShiftBoxSelection(shiftBoxSelectionPreviousIdsRef.current)
        return
      }

      const left = Math.min(start.x, event.clientX)
      const right = Math.max(start.x, event.clientX)
      const top = Math.min(start.y, event.clientY)
      const bottom = Math.max(start.y, event.clientY)
      if (right - left < 4 || bottom - top < 4) {
        previewShiftBoxSelection(shiftBoxSelectionPreviousIdsRef.current)
        return
      }

      const selectedNodeIds = getShiftBoxSelectedNodeIds(start, {
        x: event.clientX,
        y: event.clientY,
      })

      if (selectedNodeIds.length === 0) {
        previewShiftBoxSelection(shiftBoxSelectionPreviousIdsRef.current)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      shiftBoxSelectionPreviewIdsRef.current = selectedNodeIds
      selectNodes(selectedNodeIds, true)
    },
    [
      getShiftBoxSelectedNodeIds,
      previewShiftBoxSelection,
      selectNodes,
      suppressSelectionChangeFor,
      toggleNodeSelection,
    ],
  )

  const handleReactFlowNodesChange = useCallback(
    (changes: any[]) => {
      if (!shiftBoxSelectionActiveRef.current) {
        onNodesChange(changes)
        return
      }
      const nonSelectionChanges = changes.filter(
        (change) => change?.type !== 'select',
      )
      if (nonSelectionChanges.length) {
        onNodesChange(nonSelectionChanges)
      }
    },
    [onNodesChange],
  )

  const handleReactFlowEdgesChange = useCallback(
    (changes: any[]) => {
      if (changes.some((change) => change?.type !== 'select')) {
        commitHistory()
      }
      onEdgesChange(changes)
    },
    [commitHistory, onEdgesChange],
  )

  const [addNodeSourceId, setAddNodeSourceId] = useState<string | null>(null)
  const [addNodeSourceHandle, setAddNodeSourceHandle] = useState<string | null>(
    null,
  )
  const [previewExecution, setPreviewExecution] =
    useState<WorkflowExecution | null>(null)
  const [branchPreviewOverrides, setBranchPreviewOverrides] =
    useState<BranchPreviewOverrides>({})
  const [workspaceOptionContext, setWorkspaceOptionContext] =
    useState<WorkflowWorkspaceOptionContext | null>(null)
  const [failedPreviewSnapshot, setFailedPreviewSnapshot] = useState<{
    fingerprint: string
    issueIds: string[]
  } | null>(null)
  const [lastPreviewFingerprint, setLastPreviewFingerprint] = useState<
    string | null
  >(null)
  const [previewRunState, setPreviewRunState] = useState<
    'idle' | 'running' | 'paused' | 'stopped'
  >('idle')
  const previewControlRef = useRef({
    paused: false,
    stopped: false,
  })
  const [previewRunHistory, setPreviewRunHistory] = useState<
    WorkflowExecutionReport[]
  >([])
  const [localRunHistory, setLocalRunHistory] = useState<
    WorkflowRunHistoryItem[]
  >([])
  const [runHistoryPanelOpen, setRunHistoryPanelOpen] = useState(false)
  const [replayState, setReplayState] = useState<{
    runId: string
    stepIndex: number
    playing: boolean
  } | null>(null)
  const [previewActiveEdgeIds, setPreviewActiveEdgeIds] = useState<string[]>([])
  const [dataFlowHighlight, setDataFlowHighlight] = useState<{
    variableKey?: string
    nodeIds: string[]
  } | null>(null)
  const [mappingEdgeId, setMappingEdgeId] = useState<string | null>(null)
  const [inspectorFieldFocus, setInspectorFieldFocus] = useState<{
    nodeId: string
    fieldKey: string
    fieldKeys?: string[]
    requestId: number
  } | null>(null)
  const inspectorViewRef = useRef<{
    tab: InspectorTabId
    scrollTop: number
  }>({ tab: 'config', scrollTop: 0 })
  const [inspectorViewRequest, setInspectorViewRequest] = useState<{
    tab: InspectorTabId
    scrollTop: number
    requestId: number
  } | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    edgeId: string | null
  }>({
    open: false,
    x: 0,
    y: 0,
    edgeId: null,
  })
  const [addNodeInitialCategory, setAddNodeInitialCategory] = useState<
    string | undefined
  >()
  const [addNodeHelperText, setAddNodeHelperText] = useState<
    string | undefined
  >()
  const [addNodePreferredIds, setAddNodePreferredIds] = useState<string[]>([])
  const [addNodeRepairContext, setAddNodeRepairContext] =
    useState<TriggerRepairContext | null>(null)
  const [addNodeInsertionContext, setAddNodeInsertionContext] = useState<
    'before' | 'after' | 'between' | 'branch' | 'disconnected'
  >('disconnected')
  const [addNodePlacementCenter, setAddNodePlacementCenter] = useState<{
    x: number
    y: number
  } | null>(null)
  const [addNodeDrag, setAddNodeDrag] = useState<{
    sourceId: string
    start: { x: number; y: number }
    current: { x: number; y: number }
    moved: boolean
  } | null>(null)
  const suppressAddNodeClickRef = useRef(false)
  const [connectionWarning, setConnectionWarning] = useState<{
    message: string
    x: number
    y: number
  } | null>(null)
  const [connectionRepairMode, setConnectionRepairMode] =
    useState<ConnectionRepairMode | null>(null)
  const activeConnectionStartRef = useRef<{
    sourceId: string | null
    sourceHandle: string | null
    handleType: 'source' | 'target' | string | null
  } | null>(null)
  const showConnectionWarning = useCallback((message: string) => {
    setConnectionWarning({
      message,
      x: lastPointerRef.current.x,
      y: lastPointerRef.current.y,
    })
    window.setTimeout(() => setConnectionWarning(null), 2200)
  }, [])
  const [assistantFocusTarget, setAssistantFocusTarget] = useState<
    | 'errors'
    | 'warnings'
    | 'suggestions'
    | 'optimizations'
    | 'runtime'
    | 'ready'
    | 'blocked'
    | 'execution-summary'
    | 'future-recommendations'
    | 'produced-variables'
    | 'consumed-variables'
    | 'unused-variables'
    | 'overwritten-variables'
    | 'broken-variable-flow'
    | 'unavailable-variables'
    | 'missing-trigger'
    | 'missing-end-path'
    | 'summary'
    | null
  >(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [workflowCategory, setWorkflowCategory] = useState('Sales')
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>()
  const [returnToStarterAfterAi, setReturnToStarterAfterAi] = useState(false)
  const [returnToStarterAfterTemplates, setReturnToStarterAfterTemplates] =
    useState(false)
  const addNodeModalOpen = activeBuilderPanel === 'addStep'
  const aiGeneratorOpen = activeBuilderPanel === 'ai'
  const templateGalleryOpen = activeBuilderPanel === 'templates'

  useEffect(() => {
    if (!activeBuilderPanel && !publishDialogOpen && !previewExecution) return
    window.dispatchEvent(new Event('workflow-builder:close-field-assistance'))
  }, [activeBuilderPanel, previewExecution, publishDialogOpen])
  useEffect(() => {
    let cancelled = false
    async function loadWorkspaceOptions() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
          credentials: 'same-origin',
        })
        if (!response.ok) return
        const data = (await response.json()) as {
          members?: Array<{
            userId?: string
            id?: string
            fullName?: string | null
            email?: string | null
            role?: string | null
          }>
        }
        if (cancelled) return
        setWorkspaceOptionContext((current) => ({
          ...(current ?? {}),
          members: data.members ?? [],
        }))
      } catch {
        // Workspace options are best-effort in local preview.
      }
    }
    loadWorkspaceOptions()
    return () => {
      cancelled = true
    }
  }, [workspaceId])
  const draftStorageKey = useMemo(
    () => `skillify.workflowDraft:${workspaceId}:${automationId}`,
    [automationId, workspaceId],
  )

  useEffect(() => {
    try {
      const raw = readBuilderSessionStorage(draftStorageKey)
      if (!raw) return
      const draft = JSON.parse(raw) as { nodes?: RFNode[]; edges?: Edge[] }
      if (draft.nodes?.length) setNodes(draft.nodes)
      if (draft.edges) setEdges(draft.edges)
    } catch {
      // Local preview drafts are best-effort only.
    }
  }, [draftStorageKey, setEdges, setNodes])

  useEffect(() => {
    try {
      writeBuilderSessionStorage(
        draftStorageKey,
        JSON.stringify({ nodes, edges }),
      )
    } catch {
      // Local preview drafts are best-effort only.
    }
  }, [draftStorageKey, edges, nodes])
  useEffect(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const branchOrdinalBySource = new Map<string, number>()
    const explicitBranchPathIndexesBySource = new Map<string, Set<number>>()
    for (const edge of edges) {
      if (!edge.sourceHandle) continue
      const sourceNode = nodeById.get(edge.source)
      const definitionId =
        typeof (sourceNode?.data as any)?.__registryNodeId === 'string'
          ? ((sourceNode?.data as any).__registryNodeId as string)
          : sourceNode?.type
      const definition = definitionId
        ? getWorkflowNodeDefinition(definitionId)
        : null
      const pathIndex = (definition?.branchPaths ?? []).findIndex(
        (path) =>
          path.sourceHandle === edge.sourceHandle ||
          (path.handleAliases ?? []).includes(edge.sourceHandle ?? ''),
      )
      if (pathIndex >= 0) {
        const indexes =
          explicitBranchPathIndexesBySource.get(edge.source) ??
          new Set<number>()
        indexes.add(pathIndex)
        explicitBranchPathIndexesBySource.set(edge.source, indexes)
      }
    }
    let changed = false
    const nextEdges: Edge[] = edges.map((edge) => {
      const sourceNode = nodeById.get(edge.source)
      const definitionId =
        typeof (sourceNode?.data as any)?.__registryNodeId === 'string'
          ? ((sourceNode?.data as any).__registryNodeId as string)
          : sourceNode?.type
      const definition = definitionId
        ? getWorkflowNodeDefinition(definitionId)
        : null
      const branchPaths = definition?.branchPaths ?? []
      if (!branchPaths.length) return edge

      if (edge.sourceHandle) {
        const canonicalPath = branchPaths.find(
          (path) =>
            path.sourceHandle === edge.sourceHandle ||
            (path.handleAliases ?? []).includes(edge.sourceHandle ?? ''),
        )
        if (canonicalPath && canonicalPath.sourceHandle !== edge.sourceHandle) {
          changed = true
          return { ...edge, sourceHandle: canonicalPath.sourceHandle }
        }
        return edge
      }

      const explicitIndexes =
        explicitBranchPathIndexesBySource.get(edge.source) ?? new Set<number>()
      const unassignedPathIndexes = branchPaths
        .map((_, index) => index)
        .filter((index) => !explicitIndexes.has(index))
      const ordinal = branchOrdinalBySource.get(edge.source) ?? 0
      branchOrdinalBySource.set(edge.source, ordinal + 1)
      const inferredPath =
        branchPaths[unassignedPathIndexes[ordinal] ?? ordinal]
      if (!inferredPath) return edge
      changed = true
      return {
        ...edge,
        sourceHandle: inferredPath.sourceHandle,
        data: {
          ...((edge.data as Record<string, unknown> | undefined) ?? {}),
          branchHandleInferred: true,
          branchHandleReview:
            'Branch path was inferred from an older connection. Review Matches and Otherwise paths.',
        },
      }
    })
    if (changed) setEdges(nextEdges)
  }, [edges, nodes, setEdges])
  const addNodeSource = useMemo(
    () => nodes.find((node) => node.id === addNodeSourceId) ?? null,
    [addNodeSourceId, nodes],
  )
  const openAddNodeModal = useCallback(
    (
      sourceId?: string | null,
      category?: string,
      options: {
        helperText?: string
        preferredNodeIds?: string[]
        repairContext?: TriggerRepairContext | null
        position?: { x: number; y: number } | null
        sourceHandle?: string | null
        insertionContext?:
          | 'before'
          | 'after'
          | 'between'
          | 'branch'
          | 'disconnected'
      } = {},
    ) => {
      setAddNodeSourceId(sourceId ?? null)
      setAddNodeSourceHandle(
        Object.prototype.hasOwnProperty.call(options, 'sourceHandle')
          ? (options.sourceHandle ?? null)
          : null,
      )
      setAddNodeInitialCategory(category)
      setAddNodeHelperText(options.helperText)
      setAddNodePreferredIds(options.preferredNodeIds ?? [])
      setAddNodeRepairContext(options.repairContext ?? null)
      setAddNodeInsertionContext(
        options.insertionContext ??
          (options.repairContext?.type === 'missing-trigger'
            ? 'before'
            : sourceId
              ? 'after'
              : 'disconnected'),
      )
      if (Object.prototype.hasOwnProperty.call(options, 'position')) {
        setAddNodePlacementCenter(options.position ?? null)
      }
      setActiveBuilderPanel('addStep')
    },
    [],
  )

  const closeAddNodeModal = useCallback(() => {
    setActiveBuilderPanel(null)
    setAddNodeSourceId(null)
    setAddNodeInitialCategory(undefined)
    setAddNodeHelperText(undefined)
    setAddNodePreferredIds([])
    setAddNodeRepairContext(null)
    setAddNodeInsertionContext('disconnected')
    setAddNodePlacementCenter(null)
    setAddNodeSourceHandle(null)
  }, [])
  const canShowAddNextAffordance = useCallback((node: RFNode) => {
    const nodeType = node.type as BuilderNodeType | undefined
    if (!nodeType || !NODE_DEFINITIONS[nodeType]) return false
    const registryId = (node.data as any)?.__registryNodeId as
      | string
      | undefined
    const definition =
      (registryId ? getWorkflowNodeDefinition(registryId) : null) ??
      getWorkflowNodeDefinition(nodeType)
    if (!definition) return true
    return (definition.allowedOutputs?.length ?? 0) > 0
  }, [])
  const shouldShowAddNextAffordance = useCallback(
    (node: RFNode) => {
      if (!canShowAddNextAffordance(node)) return false
      const hasOutgoingConnection = edges.some(
        (edge) => edge.source === node.id,
      )
      if (!hasOutgoingConnection) return true
      if (selectedIds.length > 1) return false
      if (selectedNodeId) return node.id === selectedNodeId
      return false
    },
    [canShowAddNextAffordance, edges, selectedIds.length, selectedNodeId],
  )
  const { graph: validationGraph } = useInspectorValidation(
    selectedNode?.type as BuilderNodeType | undefined,
    (selectedNode?.data as any) ?? {},
  ) as {
    graph?: { nodes?: Array<{ state?: string | null }> } | null
  }
  const [pendingGroupDelete, setPendingGroupDelete] = useState<{
    nodeIds: string[]
    edgeIds: string[]
  } | null>(null)

  /* --------------------------------
  Multi-select graph actions
-------------------------------- */
  const getDescendantNodeIds = useCallback((groupIds: Set<string>) => {
    const descendants = new Set<string>()
    let changed = true
    while (changed) {
      changed = false
      for (const node of nodesRef.current) {
        const parentId = node.parentNode
        if (!parentId) continue
        if (
          (groupIds.has(parentId) || descendants.has(parentId)) &&
          !descendants.has(node.id)
        ) {
          descendants.add(node.id)
          changed = true
        }
      }
    }
    return descendants
  }, [])

  const performDeleteSelection = useCallback(
    (
      nodeIds: string[],
      edgeIds: string[],
      options: { includeGroupChildren?: boolean } = {},
    ) => {
      if (!nodeIds.length && !edgeIds.length) return
      commitHistory()
      const nodeSet = new Set(nodeIds)
      const edgeSet = new Set(edgeIds)
      if (options.includeGroupChildren) {
        for (const childId of getDescendantNodeIds(nodeSet))
          nodeSet.add(childId)
      }
      if (
        nodeSet.size > 0 &&
        nodesRef.current.filter((node) => !nodeSet.has(node.id)).length === 0
      ) {
        setStartPanelDismissed(false)
      }

      setNodes((nds) => {
        const deletingGroupOnly = !options.includeGroupChildren
        const groupPositions = new Map(
          nds
            .filter((node) => nodeSet.has(node.id) && node.type === 'group')
            .map((node) => [node.id, node.position]),
        )
        return nds
          .filter((node) => !nodeSet.has(node.id))
          .map((node) => {
            if (!deletingGroupOnly || !node.parentNode) return node
            const parentPosition = groupPositions.get(node.parentNode)
            if (!parentPosition) return node
            const {
              parentNode: _parentNode,
              extent: _extent,
              ...rest
            } = node as any
            return {
              ...rest,
              position: {
                x: parentPosition.x + node.position.x,
                y: parentPosition.y + node.position.y,
              },
            } as RFNode
          })
      })
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !edgeSet.has(e.id) &&
            !nodeSet.has(e.source) &&
            !nodeSet.has(e.target),
        ),
      )

      clearEditorSelection()
    },
    [
      clearEditorSelection,
      commitHistory,
      getDescendantNodeIds,
      setEdges,
      setNodes,
    ],
  )

  const deleteSelectedNodes = useCallback(() => {
    const currentSelectedNodeIds = selectedIdsRef.current
    const currentSelectedEdgeIds = selectedEdgeIdsRef.current
    if (!currentSelectedNodeIds.length && !currentSelectedEdgeIds.length) return

    const selectedGroups = nodesRef.current.filter(
      (node) =>
        currentSelectedNodeIds.includes(node.id) && node.type === 'group',
    )
    if (selectedGroups.length) {
      setPendingGroupDelete({
        nodeIds: [...currentSelectedNodeIds],
        edgeIds: [...currentSelectedEdgeIds],
      })
      return
    }

    performDeleteSelection(currentSelectedNodeIds, currentSelectedEdgeIds)
  }, [performDeleteSelection])

  const copySelectedGraph = useCallback(() => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    const nodeSet = new Set(selectedIdsRef.current)
    const explicitEdgeSet = new Set(selectedEdgeIdsRef.current)
    const copiedNodes = currentNodes.filter((node) => nodeSet.has(node.id))
    const copiedEdges = currentEdges.filter(
      (edge) =>
        explicitEdgeSet.has(edge.id) ||
        (nodeSet.has(edge.source) && nodeSet.has(edge.target)),
    )
    if (!copiedNodes.length && !copiedEdges.length) return false
    clipboardRef.current = {
      nodes: cloneBuilderNodes(copiedNodes),
      edges: cloneBuilderEdges(copiedEdges),
    }
    setClipboardRevision((revision) => revision + 1)
    return true
  }, [])

  const pasteClipboardGraph = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard || !clipboard.nodes.length) return []

    commitHistory()
    const idMap = new Map<string, string>()
    const offset = { x: 48, y: 48 }
    for (const node of clipboard.nodes) {
      idMap.set(node.id, crypto.randomUUID())
    }
    const clones = clipboard.nodes.map((node) => {
      const id = idMap.get(node.id) ?? crypto.randomUUID()
      return {
        ...node,
        id,
        data: replaceNodeIdsInConfigValue(node.data, idMap),
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true,
      }
    })
    const clonedEdges = clipboard.edges
      .map((edge): Edge | null => {
        const source = idMap.get(edge.source)
        const target = idMap.get(edge.target)
        if (!source || !target) return null
        return {
          ...edge,
          id: crypto.randomUUID(),
          source,
          target,
          selected: false,
        }
      })
      .filter((edge): edge is Edge => Boolean(edge))

    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      ...clones,
    ])
    setEdges((currentEdges) => [
      ...currentEdges.map((edge) => ({ ...edge, selected: false })),
      ...clonedEdges,
    ])
    const cloneIds = clones.map((node) => node.id)
    selectNodes(cloneIds, true)
    setRightCollapsed(false)
    return cloneIds
  }, [commitHistory, selectNodes, setEdges, setNodes])

  const duplicateSelectedNodes = useCallback(() => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    const currentSelectedNodeIds = selectedIdsRef.current
    const currentSelectedEdgeIds = selectedEdgeIdsRef.current
    if (!currentSelectedNodeIds.length && !currentSelectedEdgeIds.length)
      return []

    commitHistory()
    const set = new Set(currentSelectedNodeIds)
    const explicitEdgeSet = new Set(currentSelectedEdgeIds)
    const idMap = new Map<string, string>()
    const offset = { x: 40, y: 40 }
    const selected = currentNodes.filter((n) => set.has(n.id))
    for (const node of selected) {
      idMap.set(node.id, crypto.randomUUID())
    }
    const clones = selected.map((n) => {
      const newId = idMap.get(n.id) ?? crypto.randomUUID()
      return {
        ...n,
        id: newId,
        data: replaceNodeIdsInConfigValue(n.data, idMap),
        position: {
          x: n.position.x + offset.x,
          y: n.position.y + offset.y,
        },
        selected: true,
      }
    })

    setNodes((nds) => {
      return [...nds.map((node) => ({ ...node, selected: false })), ...clones]
    })

    setEdges((eds) => {
      const clonedEdges: Edge[] = []

      for (const e of currentEdges) {
        if (
          (set.has(e.source) && set.has(e.target)) ||
          explicitEdgeSet.has(e.id)
        ) {
          const ns = idMap.get(e.source)
          const nt = idMap.get(e.target)
          if (ns && nt) {
            clonedEdges.push({
              ...e,
              id: crypto.randomUUID(),
              source: ns,
              target: nt,
              selected: false,
            })
          }
        }
      }

      return [...eds, ...clonedEdges]
    })
    const cloneIds = clones.map((node) => node.id)
    selectNodes(cloneIds, true)
    return cloneIds
  }, [commitHistory, selectNodes, setNodes, setEdges])

  const cutSelectedGraph = useCallback(() => {
    if (!copySelectedGraph()) return
    deleteSelectedNodes()
  }, [copySelectedGraph, deleteSelectedNodes])

  const GRID_SIZE = 16
  const DEFAULT_NODE_WIDTH = 220
  const DEFAULT_NODE_HEIGHT = 96

  const snapToGridPos = useCallback((p: { x: number; y: number }) => {
    return {
      x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
    }
  }, [])

  const selectAllGraph = useCallback(() => {
    const allNodeIds = nodesRef.current.map((node) => node.id)
    const allEdgeIds = edgesRef.current.map((edge) => edge.id)
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, selected: true })),
    )
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({ ...edge, selected: true })),
    )
    selectNodes(allNodeIds, true)
    selectedEdgeIdsRef.current = allEdgeIds
  }, [selectNodes, setEdges, setNodes])

  const nudgeSelectedNodes = useCallback(
    (dx: number, dy: number) => {
      const selectedSet = new Set(selectedIdsRef.current)
      if (!selectedSet.size) return
      commitHistory()
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          selectedSet.has(node.id)
            ? {
                ...node,
                position: snapToGridPos({
                  x: node.position.x + dx,
                  y: node.position.y + dy,
                }),
              }
            : node,
        ),
      )
    },
    [commitHistory, setNodes, snapToGridPos],
  )

  const applyAutoLayoutWithHistory = useCallback(() => {
    commitHistory()
    applyAutoLayout()
  }, [applyAutoLayout, commitHistory])

  /* --------------------------------
    Drop Enhancements (shared helpers)
    - dynamic node-size centering per node type
  -------------------------------- */
  const NODE_SIZE_BY_TYPE = useMemo<
    Partial<Record<BuilderNodeType, { w: number; h: number }>>
  >(() => {
    return {
      // extend as needed
    }
  }, [])

  const getNodeSize = useCallback(
    (type: BuilderNodeType) => {
      return (
        NODE_SIZE_BY_TYPE[type] || {
          w: DEFAULT_NODE_WIDTH,
          h: DEFAULT_NODE_HEIGHT,
        }
      )
    },
    [NODE_SIZE_BY_TYPE],
  )

  const getMeasuredNodeSize = useCallback(
    (node: RFNode | null | undefined) => {
      if (!node) {
        return { w: DEFAULT_NODE_WIDTH, h: DEFAULT_NODE_HEIGHT }
      }
      const fallback = getNodeSize((node.type as BuilderNodeType) ?? 'trigger')
      return {
        w:
          typeof node.width === 'number' && node.width > 0
            ? node.width
            : fallback.w,
        h:
          typeof node.height === 'number' && node.height > 0
            ? node.height
            : fallback.h,
      }
    },
    [getNodeSize],
  )

  type LayoutNodeBounds = {
    id: string
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
    node: RFNode
  }

  const getSelectedLayoutBounds = useCallback(() => {
    const selectedSet = new Set(selectedIdsRef.current)
    return nodesRef.current
      .filter((node) => selectedSet.has(node.id))
      .map((node): LayoutNodeBounds => {
        const size = getMeasuredNodeSize(node)
        return {
          id: node.id,
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + size.w,
          bottom: node.position.y + size.h,
          width: size.w,
          height: size.h,
          node,
        }
      })
  }, [getMeasuredNodeSize])

  const applyNodePositionMap = useCallback(
    (positionById: Map<string, { x: number; y: number }>) => {
      setNodes((current) =>
        current.map((node) => {
          const next = positionById.get(node.id)
          return next ? { ...node, position: snapToGridPos(next) } : node
        }),
      )
    },
    [setNodes, snapToGridPos],
  )

  const enforceMinimumSpacing = useCallback(
    (
      bounds: LayoutNodeBounds[],
      positions: Map<string, { x: number; y: number }>,
      axis: 'horizontal' | 'vertical',
    ) => {
      const safeGap = 56
      const ordered = bounds
        .slice()
        .sort((a, b) =>
          axis === 'horizontal'
            ? (positions.get(a.id)?.x ?? a.left) -
              (positions.get(b.id)?.x ?? b.left)
            : (positions.get(a.id)?.y ?? a.top) -
              (positions.get(b.id)?.y ?? b.top),
        )
      let cursor = -Infinity
      for (const item of ordered) {
        const current = positions.get(item.id) ?? { x: item.left, y: item.top }
        if (axis === 'horizontal') {
          const x = Math.max(current.x, cursor)
          positions.set(item.id, { x, y: current.y })
          cursor = x + item.width + safeGap
        } else {
          const y = Math.max(current.y, cursor)
          positions.set(item.id, { x: current.x, y })
          cursor = y + item.height + safeGap
        }
      }
      return positions
    },
    [],
  )

  const sortLayoutBoundsByWorkflowOrder = useCallback(
    (bounds: LayoutNodeBounds[]) => {
      if (bounds.length < 2) return bounds
      const byId = new Map(bounds.map((item) => [item.id, item]))
      const selectedSet = new Set(byId.keys())
      const outgoing = new Map<string, string[]>()
      const incomingCount = new Map(bounds.map((item) => [item.id, 0]))
      let selectedEdgeCount = 0

      for (const edge of edgesRef.current) {
        if (!selectedSet.has(edge.source) || !selectedSet.has(edge.target))
          continue
        selectedEdgeCount += 1
        outgoing.set(edge.source, [
          ...(outgoing.get(edge.source) ?? []),
          edge.target,
        ])
        incomingCount.set(
          edge.target,
          (incomingCount.get(edge.target) ?? 0) + 1,
        )
      }

      if (selectedEdgeCount === 0) {
        return bounds.slice().sort((a, b) => a.left - b.left || a.top - b.top)
      }

      const byCurrentPosition = (a: string, b: string) => {
        const nodeA = byId.get(a)
        const nodeB = byId.get(b)
        if (!nodeA || !nodeB) return a.localeCompare(b)
        return nodeA.left - nodeB.left || nodeA.top - nodeB.top
      }
      const queue = bounds
        .filter((item) => (incomingCount.get(item.id) ?? 0) === 0)
        .map((item) => item.id)
        .sort(byCurrentPosition)
      const orderedIds: string[] = []
      const seen = new Set<string>()

      while (queue.length) {
        const id = queue.shift()!
        if (seen.has(id)) continue
        seen.add(id)
        orderedIds.push(id)
        const targets = (outgoing.get(id) ?? []).slice().sort(byCurrentPosition)
        for (const targetId of targets) {
          incomingCount.set(
            targetId,
            Math.max(0, (incomingCount.get(targetId) ?? 0) - 1),
          )
          if ((incomingCount.get(targetId) ?? 0) === 0) queue.push(targetId)
        }
        queue.sort(byCurrentPosition)
      }

      const remainder = bounds
        .filter((item) => !seen.has(item.id))
        .sort((a, b) => a.left - b.left || a.top - b.top)
        .map((item) => item.id)
      return [...orderedIds, ...remainder]
        .map((id) => byId.get(id))
        .filter((item): item is LayoutNodeBounds => Boolean(item))
    },
    [],
  )

  const alignSelectedNodes = useCallback(
    (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      const bounds = getSelectedLayoutBounds()
      if (bounds.length < 2) return
      commitHistory()
      const left = Math.min(...bounds.map((item) => item.left))
      const right = Math.max(...bounds.map((item) => item.right))
      const top = Math.min(...bounds.map((item) => item.top))
      const bottom = Math.max(...bounds.map((item) => item.bottom))
      const center = left + (right - left) / 2
      const middle = top + (bottom - top) / 2
      const positions = new Map(
        bounds.map((item) => {
          let x = item.left
          let y = item.top
          if (mode === 'left') x = left
          if (mode === 'center') x = center - item.width / 2
          if (mode === 'right') x = right - item.width
          if (mode === 'top') y = top
          if (mode === 'middle') y = middle - item.height / 2
          if (mode === 'bottom') y = bottom - item.height
          return [item.id, { x, y }] as const
        }),
      )
      enforceMinimumSpacing(
        bounds,
        positions,
        mode === 'left' || mode === 'center' || mode === 'right'
          ? 'vertical'
          : 'horizontal',
      )
      applyNodePositionMap(positions)
    },
    [
      applyNodePositionMap,
      commitHistory,
      enforceMinimumSpacing,
      getSelectedLayoutBounds,
    ],
  )

  const cycleAlignSelectedNodes = useCallback(() => {
    const modes: Array<'left' | 'center' | 'right'> = [
      'left',
      'center',
      'right',
    ]
    const mode = modes[alignCycleIndexRef.current % modes.length]
    alignCycleIndexRef.current += 1
    alignSelectedNodes(mode)
  }, [alignSelectedNodes])

  const nextAlignTitle = useCallback(() => {
    const labels = ['Left', 'Center', 'Right']
    return `Align: ${labels[alignCycleIndexRef.current % labels.length]}`
  }, [])

  const spaceSelectedNodes = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      const bounds = getSelectedLayoutBounds()
      if (bounds.length < 2) return
      const ordered =
        axis === 'horizontal'
          ? sortLayoutBoundsByWorkflowOrder(bounds)
          : bounds.slice().sort((a, b) => a.top - b.top || a.left - b.left)
      commitHistory()
      const gap = axis === 'horizontal' ? 128 : 88
      const positions = new Map<string, { x: number; y: number }>()
      let cursor = axis === 'horizontal' ? ordered[0].left : ordered[0].top
      for (const item of ordered) {
        positions.set(item.id, {
          x: axis === 'horizontal' ? cursor : item.left,
          y: axis === 'vertical' ? cursor : item.top,
        })
        cursor += (axis === 'horizontal' ? item.width : item.height) + gap
      }
      applyNodePositionMap(positions)
    },
    [
      applyNodePositionMap,
      commitHistory,
      getSelectedLayoutBounds,
      sortLayoutBoundsByWorkflowOrder,
    ],
  )

  const autoArrangeSelectedNodes = useCallback(() => {
    const bounds = getSelectedLayoutBounds()
    if (bounds.length < 2) return
    commitHistory()
    const ordered = sortLayoutBoundsByWorkflowOrder(bounds)
    const originX = Math.min(...ordered.map((item) => item.left))
    const originY = Math.min(...ordered.map((item) => item.top))
    const maxWidth = Math.max(...ordered.map((item) => item.width))
    const hGap = Math.max(WORKFLOW_LAYOUT_SPACING.horizontalGap, maxWidth + 144)
    const positions = new Map<string, { x: number; y: number }>()
    ordered.forEach((item, index) => {
      positions.set(item.id, { x: originX + index * hGap, y: originY })
    })
    applyNodePositionMap(positions)
  }, [
    applyNodePositionMap,
    commitHistory,
    getSelectedLayoutBounds,
    sortLayoutBoundsByWorkflowOrder,
  ])

  const cycleArrangeSelectedNodes = useCallback(() => {
    const bounds = getSelectedLayoutBounds()
    if (bounds.length < 2) return
    commitHistory()
    const preset = arrangeCycleIndexRef.current % 3
    arrangeCycleIndexRef.current += 1
    const ordered = sortLayoutBoundsByWorkflowOrder(bounds)
    const originX = Math.min(...ordered.map((item) => item.left))
    const minTop = Math.min(...ordered.map((item) => item.top))
    const maxBottom = Math.max(...ordered.map((item) => item.bottom))
    const centerY = minTop + (maxBottom - minTop) / 2
    const maxWidth = Math.max(...ordered.map((item) => item.width))
    const hGap = Math.max(WORKFLOW_LAYOUT_SPACING.horizontalGap, maxWidth + 144)
    const positions = new Map<string, { x: number; y: number }>()

    ordered.forEach((item, index) => {
      let y = minTop
      if (preset === 1) y = centerY - item.height / 2
      if (preset === 2) y = maxBottom - item.height
      positions.set(item.id, { x: originX + index * hGap, y })
    })

    applyNodePositionMap(positions)
  }, [
    applyNodePositionMap,
    commitHistory,
    getSelectedLayoutBounds,
    sortLayoutBoundsByWorkflowOrder,
  ])

  const nextArrangeTitle = useCallback(() => {
    const labels = ['Top row', 'Center row', 'Bottom row']
    return `Arrange: ${labels[arrangeCycleIndexRef.current % labels.length]}`
  }, [])

  const mixSelectedNodes = useCallback(() => {
    const bounds = getSelectedLayoutBounds()
    if (bounds.length < 2) return
    commitHistory()
    const preset = mixPresetIndexRef.current % 6
    mixPresetIndexRef.current += 1
    const ordered = sortLayoutBoundsByWorkflowOrder(bounds)
    const originX = Math.min(...ordered.map((item) => item.left))
    const originY = Math.min(...ordered.map((item) => item.top))
    const maxWidth = Math.max(...ordered.map((item) => item.width))
    const maxHeight = Math.max(...ordered.map((item) => item.height))
    const hGap = Math.max(WORKFLOW_LAYOUT_SPACING.horizontalGap, maxWidth + 132)
    const vGap = Math.max(
      WORKFLOW_LAYOUT_SPACING.verticalGap * 0.72,
      maxHeight + 92,
    )
    const positions = new Map<string, { x: number; y: number }>()
    const twoRowGap = Math.max(maxHeight + 84, 150)

    ordered.forEach((item, index) => {
      if (preset === 0) {
        positions.set(item.id, {
          x: originX + index * hGap,
          y: originY,
        })
        return
      }
      if (preset === 1) {
        positions.set(item.id, {
          x: originX + index * hGap,
          y: originY + (index % 2 === 0 ? 0 : vGap * 0.5),
        })
        return
      }
      if (preset === 2) {
        positions.set(item.id, {
          x: originX,
          y: originY + index * vGap,
        })
        return
      }
      if (preset === 3) {
        positions.set(item.id, {
          x: originX + index * Math.max(hGap * 0.82, maxWidth + 124),
          y: originY + index * Math.max(maxHeight * 0.34, 54),
        })
        return
      }
      if (preset === 4) {
        const upperCount = Math.ceil(ordered.length / 2)
        const row = index < upperCount ? 0 : 1
        const column = row === 0 ? index : index - upperCount
        const xOffset = row === 0 ? 0 : hGap * 0.5
        positions.set(item.id, {
          x: originX + column * hGap + xOffset,
          y: originY + row * twoRowGap,
        })
        return
      }
      const center = (ordered.length - 1) / 2
      const curve = Math.abs(index - center)
      const yOffset =
        (Math.max(0, center - curve) / Math.max(1, center)) * vGap * 0.62
      positions.set(item.id, {
        x: originX + index * Math.max(hGap * 0.78, maxWidth + 120),
        y: originY + yOffset,
      })
    })

    applyNodePositionMap(positions)
  }, [
    applyNodePositionMap,
    commitHistory,
    getSelectedLayoutBounds,
    sortLayoutBoundsByWorkflowOrder,
  ])

  const groupSelectedNodes = useCallback(() => {
    const bounds = getSelectedLayoutBounds()
    if (bounds.length < 2) return
    commitHistory()
    const padding = 72
    const left = Math.min(...bounds.map((item) => item.left)) - padding
    const top = Math.min(...bounds.map((item) => item.top)) - padding
    const right = Math.max(...bounds.map((item) => item.right)) + padding
    const bottom = Math.max(...bounds.map((item) => item.bottom)) + padding
    const groupId = crypto.randomUUID()
    const childIds = new Set(bounds.map((item) => item.id))
    const groupNode: RFNode = {
      id: groupId,
      type: 'group',
      position: snapToGridPos({ x: left, y: top }),
      data: {
        label: 'Group',
        count: bounds.length,
        note: 'Grouped steps',
        collapsed: false,
        __iconKey: 'boxes',
      },
      selected: true,
      draggable: true,
      style: {
        width: Math.max(320, right - left),
        height: Math.max(220, bottom - top),
        border: '1px solid rgba(129, 140, 248, 0.34)',
        borderRadius: 18,
        background: 'rgba(30, 41, 59, 0.22)',
      },
    }
    setNodes((current) => [
      groupNode,
      ...current.map((node) => {
        if (!childIds.has(node.id)) return { ...node, selected: false }
        return {
          ...node,
          parentNode: groupId,
          extent: 'parent' as const,
          selected: false,
          position: {
            x: node.position.x - groupNode.position.x,
            y: node.position.y - groupNode.position.y,
          },
        }
      }),
    ])
    selectNodes([groupId], true)
  }, [
    commitHistory,
    getSelectedLayoutBounds,
    selectNodes,
    setNodes,
    snapToGridPos,
  ])

  /* --------------------------------
  Inline Rename (explicit action)
-------------------------------- */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState<string>('')

  const beginRename = useCallback(
    (nodeId: string) => {
      const n = nodes.find((x) => x.id === nodeId)
      if (!n) return
      const current =
        (n.data as any)?.label ??
        (n.data as any)?.name ??
        (n.data as any)?.title ??
        ''
      setRenamingId(nodeId)
      setRenameDraft(String(current || ''))
    },
    [nodes],
  )

  const focusNodeInCanvas = useCallback(
    (node: RFNode) => {
      const size = getMeasuredNodeSize(node)
      reactFlow.setCenter(
        node.position.x + size.w / 2,
        node.position.y + size.h / 2,
        {
          zoom: 1,
          duration: 360,
        },
      )
    },
    [getMeasuredNodeSize, reactFlow],
  )

  const commitRename = useCallback(() => {
    if (!renamingId) return
    // we store as `label` (works with most node UIs; safe even if unused)
    commitHistory()
    updateSelectedNodeData(renamingId, { label: renameDraft.trim() } as any)
    setRenamingId(null)
  }, [commitHistory, renamingId, renameDraft, updateSelectedNodeData])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameDraft('')
  }, [])

  const updateSelectedNodeDataWithHistory = useCallback(
    (nodeId: string, partial: any) => {
      commitHistory()
      updateSelectedNodeData(nodeId, partial)
    },
    [commitHistory, updateSelectedNodeData],
  )

  /* --------------------------------
    Context Menu (state)
  -------------------------------- */
  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean
    x: number
    y: number
    target: 'pane' | 'node'
    nodeId?: string
  }>({ open: false, x: 0, y: 0, target: 'pane' })

  const closeContextMenu = useCallback(() => {
    setCtxMenu((s) => ({ ...s, open: false }))
  }, [])

  // Programmatic selection for right-click (ReactFlow uses `selected` flag)
  const selectOnlyNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        let changed = false
        const next = nds.map((n) => {
          const selected = n.id === nodeId
          if (n.selected === selected) return n
          changed = true
          return { ...n, selected }
        })
        return changed ? next : nds
      })
    },
    [setNodes],
  )

  const [pendingTemplate, setPendingTemplate] = useState<CRMTemplate | null>(
    null,
  )

  /* --------------------------------
    Viewport / Zoom HUD
    (throttled for performance)
 -------------------------------- */
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const rafMoveRef = useRef<number | null>(null)
  const lastVpRef = useRef<Viewport>(viewport)

  const handleMove = useCallback((_: unknown, vp: Viewport) => {
    lastVpRef.current = vp
    if (rafMoveRef.current) return
    rafMoveRef.current = requestAnimationFrame(() => {
      rafMoveRef.current = null
      setViewport(lastVpRef.current)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafMoveRef.current) cancelAnimationFrame(rafMoveRef.current)
    }
  }, [])

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === 'Shift') setIsShiftSelectMode(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === 'Shift' && !shiftBoxSelectionActiveRef.current) {
        setIsShiftSelectMode(false)
      }
      if (event.key === ' ') {
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
    const onBlur = () => {
      shiftBoxSelectionStartRef.current = null
      shiftBoxSelectionActiveRef.current = false
      setIsShiftSelectMode(false)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        shiftBoxSelectionStartRef.current = null
        shiftBoxSelectionActiveRef.current = false
        setIsShiftSelectMode(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  /* --------------------------------
    Focus (128%)
 -------------------------------- */
  const focusCanvas = useCallback(() => {
    reactFlow.fitView({
      nodes:
        selectedIds.length > 0
          ? nodes.filter((n) => selectedIds.includes(n.id))
          : undefined,
      maxZoom: 1.28,
      padding: 0.3,
    })
  }, [reactFlow, nodes, selectedIds])

  /* --------------------------------
    Steps 1–6: Fullscreen + Sliding Panels + Auto-collapse
    + True browser fullscreen + remembered panel state
    + edge-hover peek + slide animations
    🔼 ADDITION: Panel resize (not collapse)
 -------------------------------- */
  const panelKey = useMemo(() => `builderPanels:${workspaceId}`, [workspaceId])
  const presetKey = useMemo(
    () => `builderFocusPresets:${workspaceId}`,
    [workspaceId],
  )
  const hudKey = useMemo(() => `builderHud:${workspaceId}`, [workspaceId])
  const builderSettingsKey = useMemo(
    () => `builderSettingsPanel:${workspaceId}:${automationId}`,
    [automationId, workspaceId],
  )
  const builderAssistantKey = useMemo(
    () => `builderAssistant:${workspaceId}:${automationId}`,
    [automationId, workspaceId],
  )
  const hudPresetKey = useMemo(
    () => `builderHudPresets:${workspaceId}`,
    [workspaceId],
  )
  const profileKey = useMemo(
    () => `builderUIProfile:${workspaceId}`,
    [workspaceId],
  )

  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${panelKey}:canvasFullscreen`)
    return raw ? raw === 'true' : false
  })
  const userClosedInspectorAtRef = useRef<number>(0)

  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${panelKey}:leftCollapsed`)
    return raw ? raw === 'true' : true
  })
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${panelKey}:rightCollapsed`)
    return raw ? raw === 'true' : false
  })

  const [leftPeek, setLeftPeek] = useState(false)
  const [rightPeek, setRightPeek] = useState(false)
  const leftPeekTimer = useRef<number | null>(null)
  const rightPeekTimer = useRef<number | null>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const leftHoverRailRef = useRef<HTMLDivElement>(null)
  const rightHoverRailRef = useRef<HTMLDivElement>(null)
  const isPointerInsideLeftPanelRef = useRef(false)
  const isPointerInsideRightPanelRef = useRef(false)
  const isHudDraggingRef = useRef(false)
  const [userClosedInspector, setUserClosedInspector] = useState(false)
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)

  // 🔼 ADDITION: Resizable panel widths (persisted per workspace)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const raw = readBuilderLocalStorage(`${panelKey}:leftWidth`)
    return raw ? Math.max(240, Math.min(320, Number(raw))) : 260
  })
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const stored =
      readBuilderLocalStorage('skillify.inspectorWidth') ||
      readBuilderLocalStorage(`${panelKey}:rightWidth`)
    return stored ? Math.max(260, Math.min(640, Number(stored))) : 360
  })
  const [inspectorDock, setInspectorDock] = useState<InspectorDockMode>(() => {
    return 'right'
  })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [inspectorPinned, setInspectorPinned] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${panelKey}:inspectorPinned`)
    return raw ? raw === 'true' : false
  })
  const [inspectorFollowsSelection, setInspectorFollowsSelection] =
    useState<boolean>(() => {
      const raw = readBuilderLocalStorage(
        `${panelKey}:inspectorFollowsSelection`,
      )
      return raw ? raw === 'true' : true
    })
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('config')
  const inspectorProfileKey = useMemo(
    () => `skillify.inspector.profile.${workspaceId}`,
    [workspaceId],
  )
  const inspectorWidthPreset = useMemo(() => {
    if (rightPanelWidth <= 340) return 'compact'
    if (rightPanelWidth >= 440) return 'wide'
    return 'standard'
  }, [rightPanelWidth])

  // remember panel state per user/workspace
  useEffect(() => {
    // Load saved inspector profile (workspace-scoped)
    const rawProfile = readBuilderLocalStorage(inspectorProfileKey)
    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile) as Partial<{
          dock: InspectorDockMode
          preset: 'compact' | 'standard' | 'wide'
          pinned: boolean
          followSelection: boolean
        }>
        setInspectorDock('right')
        if (parsed.preset === 'compact') setRightPanelWidth(320)
        if (parsed.preset === 'standard') setRightPanelWidth(380)
        if (parsed.preset === 'wide') setRightPanelWidth(460)
        if (typeof parsed.pinned === 'boolean')
          setInspectorPinned(parsed.pinned)
        if (typeof parsed.followSelection === 'boolean')
          setInspectorFollowsSelection(parsed.followSelection)
      } catch {
        // ignore malformed profile
      }
    }
    const onResize = () => {
      setIsNarrowViewport(window.innerWidth < 1100)
      setInspectorDock('right')
    }
    onResize()
    window.addEventListener('resize', onResize)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(media.matches)
    const onMedia = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    media.addEventListener('change', onMedia)
    return () => {
      window.removeEventListener('resize', onResize)
      media.removeEventListener('change', onMedia)
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const missingLayouts = Object.keys(NODE_DEFINITIONS).filter(
        (k) => !INSPECTOR_LAYOUTS[k as BuilderNodeType],
      )
      if (missingLayouts.length) {
        // eslint-disable-next-line no-console
        console.warn(
          '[Inspector] Missing layouts for node types:',
          missingLayouts,
          'Add entries to INSPECTOR_LAYOUTS.',
        )
      }
    }
  }, [])

  useEffect(() => {
    setLocalRunHistory(loadWorkflowRunHistory(workspaceId, automationId))
  }, [automationId, workspaceId])

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(
      `${panelKey}:canvasFullscreen`,
      String(isCanvasFullscreen),
    )
    writeBuilderLocalStorage(`${panelKey}:leftCollapsed`, String(leftCollapsed))
    writeBuilderLocalStorage(
      `${panelKey}:rightCollapsed`,
      String(rightCollapsed),
    )
    writeBuilderLocalStorage(`${panelKey}:leftWidth`, String(leftPanelWidth))
    writeBuilderLocalStorage(`${panelKey}:rightWidth`, String(rightPanelWidth))
    writeBuilderLocalStorage(`${panelKey}:inspectorDock`, inspectorDock)
    writeBuilderLocalStorage(
      `${panelKey}:inspectorPinned`,
      String(inspectorPinned),
    )
    writeBuilderLocalStorage(
      `${panelKey}:inspectorFollowsSelection`,
      String(inspectorFollowsSelection),
    )
    writeBuilderLocalStorage('skillify.inspectorWidth', String(rightPanelWidth))
    writeBuilderLocalStorage(`${panelKey}:inspectorDock`, inspectorDock)
    writeBuilderLocalStorage(
      `${panelKey}:inspectorPinned`,
      String(inspectorPinned),
    )
    writeBuilderLocalStorage(
      `${panelKey}:inspectorFollowsSelection`,
      String(inspectorFollowsSelection),
    )
    writeBuilderLocalStorage(
      inspectorProfileKey,
      JSON.stringify({
        dock: inspectorDock,
        preset: inspectorWidthPreset,
        pinned: inspectorPinned,
        followSelection: inspectorFollowsSelection,
      }),
    )
  }, [
    autosaveEnabled,
    panelKey,
    isCanvasFullscreen,
    leftCollapsed,
    rightCollapsed,
    leftPanelWidth,
    rightPanelWidth,
    inspectorDock,
    inspectorPinned,
    inspectorFollowsSelection,
    inspectorProfileKey,
    inspectorWidthPreset,
  ])

  // auto-collapse rules (light + safe)
  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth
      if (!isCanvasFullscreen) return
      // Keep canvas priority on smaller screens
      if (w < 1280) setRightCollapsed(true)
      if (w < 1100) setLeftCollapsed(true)
    }
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [isCanvasFullscreen])

  // true browser fullscreen (Fullscreen API)
  const enterBrowserFullscreen = useCallback(async () => {
    const el = rootRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      }
    } catch {
      // ignore (browser can block if not user-initiated)
    }
  }, [])

  const exitBrowserFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleCanvasFullscreen = useCallback(async () => {
    setIsCanvasFullscreen((v) => !v)
    // Try to enter browser fullscreen when turning on
    if (!isCanvasFullscreen) {
      await enterBrowserFullscreen()
    } else {
      await exitBrowserFullscreen()
    }
  }, [isCanvasFullscreen, enterBrowserFullscreen, exitBrowserFullscreen])

  // slide animations + peek behavior
  const PEEK_CLOSE_DELAY_MS = 220
  const isEventInsideHud = useCallback((eventTarget: EventTarget | null) => {
    const target = eventTarget as Node | null
    return !!target && !!hudRef.current?.contains(target)
  }, [])

  const openLeftPeek = useCallback(
    (eventTarget?: EventTarget | null) => {
      if (isHudDraggingRef.current) return
      if (isEventInsideHud(eventTarget ?? null)) return
      if (leftPeekTimer.current) window.clearTimeout(leftPeekTimer.current)
      setLeftPeek(true)
    },
    [isEventInsideHud],
  )
  const closeLeftPeek = useCallback(() => {
    if (leftPeekTimer.current) window.clearTimeout(leftPeekTimer.current)
    leftPeekTimer.current = window.setTimeout(() => {
      if (isPointerInsideLeftPanelRef.current) return
      setLeftPeek(false)
    }, PEEK_CLOSE_DELAY_MS)
  }, [])

  const openRightPeek = useCallback(
    (eventTarget?: EventTarget | null) => {
      if (isHudDraggingRef.current) return
      if (isEventInsideHud(eventTarget ?? null)) return
      if (rightPeekTimer.current) window.clearTimeout(rightPeekTimer.current)
      setRightPeek(true)
    },
    [isEventInsideHud],
  )
  const closeRightPeek = useCallback(() => {
    if (rightPeekTimer.current) window.clearTimeout(rightPeekTimer.current)
    rightPeekTimer.current = window.setTimeout(() => {
      if (isPointerInsideRightPanelRef.current) return
      setRightPeek(false)
    }, PEEK_CLOSE_DELAY_MS)
  }, [])

  const handleLeftPanelPointerEnter = useCallback(() => {
    isPointerInsideLeftPanelRef.current = true
    openLeftPeek()
  }, [openLeftPeek])

  const handleLeftPanelPointerLeave = useCallback(() => {
    isPointerInsideLeftPanelRef.current = false
    closeLeftPeek()
  }, [closeLeftPeek])

  const handleRightPanelPointerEnter = useCallback(() => {
    isPointerInsideRightPanelRef.current = true
    openRightPeek()
  }, [openRightPeek])

  const handleRightPanelPointerLeave = useCallback(() => {
    isPointerInsideRightPanelRef.current = false
    closeRightPeek()
  }, [closeRightPeek])

  const stopPanelEventPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  const handleCanvasPointerEnter = useCallback(() => {
    if (leftCollapsed) {
      isPointerInsideLeftPanelRef.current = false
      closeLeftPeek()
    }
    if (rightCollapsed) {
      isPointerInsideRightPanelRef.current = false
      closeRightPeek()
    }
  }, [closeLeftPeek, closeRightPeek, leftCollapsed, rightCollapsed])

  useEffect(() => {
    return () => {
      if (leftPeekTimer.current) window.clearTimeout(leftPeekTimer.current)
      if (rightPeekTimer.current) window.clearTimeout(rightPeekTimer.current)
    }
  }, [])

  const prevSelectedRef = useRef<string | null>(null)
  const closeInspectorPanel = useCallback(() => {
    setRightCollapsed(true)
    setRightPeek(false)
    setUserClosedInspector(true)
    userClosedInspectorAtRef.current = Date.now()
    prevSelectedRef.current = null
    clearSelection()
  }, [clearSelection])

  const handleInspectorViewChange = useCallback(
    (state: { tab: InspectorTabId; scrollTop: number }) => {
      inspectorViewRef.current = state
    },
    [],
  )

  const exitConnectionRepairMode = useCallback(
    (
      modeOverride?: ConnectionRepairMode | null,
      outcome: {
        type: 'cancel' | 'success'
        selectedNodeId?: string
        completedEdgeId?: string
      } = { type: 'cancel' },
    ) => {
      const mode = modeOverride ?? connectionRepairMode
      setConnectionRepairMode(null)
      document.body.style.cursor = ''
      if (!mode) return

      const shouldOpenInspector =
        outcome.type === 'success'
          ? mode.restore.wasInspectorOpen
          : !mode.restore.rightCollapsed

      setRightCollapsed(!shouldOpenInspector)
      setRightPeek(outcome.type === 'cancel' ? mode.restore.rightPeek : false)
      setUserClosedInspector(
        outcome.type === 'cancel'
          ? mode.restore.userClosedInspector
          : !shouldOpenInspector,
      )
      userClosedInspectorAtRef.current =
        outcome.type === 'cancel' && mode.restore.userClosedInspector
          ? Date.now()
          : 0

      if (outcome.completedEdgeId) {
        setPreviewActiveEdgeIds([outcome.completedEdgeId])
        window.setTimeout(() => {
          setPreviewActiveEdgeIds((current) =>
            current.filter((edgeId) => edgeId !== outcome.completedEdgeId),
          )
        }, 1400)
      }

      const nextSelectedNodeId =
        outcome.type === 'success'
          ? outcome.selectedNodeId
          : mode.restore.selectedNodeId
      if (nextSelectedNodeId) {
        const nodeStillExists = nodes.some(
          (node) => node.id === nextSelectedNodeId,
        )
        if (nodeStillExists) selectNode(nextSelectedNodeId)
        else clearSelection()
      } else {
        clearSelection()
      }

      const requestedView =
        outcome.type === 'success'
          ? { tab: 'config' as InspectorTabId, scrollTop: 0 }
          : { tab: mode.restore.tab, scrollTop: mode.restore.scrollTop }
      setInspectorViewRequest({
        ...requestedView,
        requestId: Date.now(),
      })
    },
    [clearSelection, connectionRepairMode, nodes, selectNode],
  )

  const completeConnectionRepair = useCallback(
    (candidateNode: RFNode) => {
      if (!connectionRepairMode) return false
      const activeMode = connectionRepairMode
      const repairNode = nodes.find(
        (node) => node.id === connectionRepairMode.nodeId,
      )
      if (!repairNode || candidateNode.id === repairNode.id) {
        showConnectionWarning(
          'Choose a different step to connect this workflow.',
        )
        return true
      }

      const candidateToRepair = validateWorkflowConnection({
        source: candidateNode,
        target: repairNode,
        edges,
      })
      const repairToCandidate = validateWorkflowConnection({
        source: repairNode,
        target: candidateNode,
        edges,
      })

      if (!candidateToRepair.valid && !repairToCandidate.valid) {
        showConnectionWarning(
          candidateToRepair.reason ??
            repairToCandidate.reason ??
            'This step cannot be connected to that workflow path.',
        )
        return true
      }

      let source = candidateToRepair.valid ? candidateNode : repairNode
      let target = candidateToRepair.valid ? repairNode : candidateNode
      if (candidateToRepair.valid && repairToCandidate.valid) {
        const connectBefore = window.confirm(
          `Connect ${getBuilderNodeLabel(candidateNode)} before ${getBuilderNodeLabel(repairNode)}?\n\nChoose Cancel to connect ${getBuilderNodeLabel(repairNode)} before ${getBuilderNodeLabel(candidateNode)}.`,
        )
        source = connectBefore ? candidateNode : repairNode
        target = connectBefore ? repairNode : candidateNode
      }

      if (
        edges.some(
          (edge) => edge.source === source.id && edge.target === target.id,
        )
      ) {
        showConnectionWarning('These steps are already connected.')
        exitConnectionRepairMode(activeMode, { type: 'cancel' })
        document.body.style.cursor = ''
        return true
      }

      const edgeId = `edge-${source.id}-${target.id}-${Date.now()}`
      const mappings = buildDefaultMappings({ source, target })
      commitHistory()
      setEdges((currentEdges) =>
        addEdge(
          {
            id: edgeId,
            source: source.id,
            target: target.id,
            type: 'default',
            data: { mappings },
          },
          currentEdges,
        ),
      )
      exitConnectionRepairMode(activeMode, {
        type: 'success',
        selectedNodeId: target.id,
        completedEdgeId: edgeId,
      })
      document.body.style.cursor = ''
      return true
    },
    [
      commitHistory,
      connectionRepairMode,
      edges,
      exitConnectionRepairMode,
      nodes,
      setEdges,
      showConnectionWarning,
    ],
  )

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (connectionRepairMode) {
        event.preventDefault()
        event.stopPropagation()
        completeConnectionRepair(node)
        return
      }
      setInspectorFieldFocus(null)
      onNodeClick(event, node)
      if (event.shiftKey) return
      setRightCollapsed(false)
      setRightPeek(false)
      setUserClosedInspector(false)
    },
    [completeConnectionRepair, connectionRepairMode, onNodeClick],
  )

  useEffect(() => {
    if (!inspectorFollowsSelection) {
      prevSelectedRef.current = selectedNodeId ?? null
      return
    }
    if (selectedNodeId) {
      const isNewSelection = selectedNodeId !== prevSelectedRef.current
      if (!userClosedInspector || isNewSelection) {
        setRightCollapsed(false)
        setUserClosedInspector(false)
      }
      prevSelectedRef.current = selectedNodeId
      return
    }
    if (inspectorPinned) {
      if (!userClosedInspector) {
        setRightCollapsed(false)
      }
      return
    }
    setRightCollapsed(true)
  }, [
    inspectorFollowsSelection,
    selectedNodeId,
    inspectorPinned,
    userClosedInspector,
  ])

  const effectiveLeftOpen = !leftCollapsed || leftPeek
  const effectiveRightOpen = !rightCollapsed || rightPeek
  const shouldRenderInspectorContent = Boolean(selectedNode || inspectorPinned)
  const effectiveInspectorOpen =
    effectiveRightOpen && shouldRenderInspectorContent

  // grid template columns (only changes when collapsing/peeking)
  const inspectorWidth = rightPanelWidth
  const inspectorColumnOpen =
    effectiveInspectorOpen && inspectorDock === 'right'
  const leftInspectorOpen = false
  const bottomActionBarOffset =
    inspectorColumnOpen && !isNarrowViewport
      ? Math.min(36, Math.round(inspectorWidth * 0.1))
      : 0

  const leftW =
    effectiveLeftOpen || leftInspectorOpen
      ? Math.max(leftPanelWidth, leftInspectorOpen ? inspectorWidth : 0)
      : 0
  const rightW = inspectorColumnOpen ? inspectorWidth : 0
  const canvasGutter = useMemo(() => {
    if (inspectorDock === 'overlay') {
      return { left: 0, right: 16 }
    }
    if (inspectorDock === 'right' && inspectorColumnOpen) {
      return { left: 0, right: inspectorWidth + 16 }
    }
    if (inspectorDock === 'left' && leftInspectorOpen) {
      return { left: inspectorWidth + 16, right: 16 }
    }
    return { left: 0, right: 16 }
  }, [inspectorDock, inspectorColumnOpen, inspectorWidth, leftInspectorOpen])

  // Workspace UI Profiles (persisted)
  const profiles = useMemo<WorkspaceUIProfile[]>(() => {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'Balanced builder experience.',
        icon: Layout,
      },
      {
        id: 'focus',
        name: 'Focus',
        description: 'Canvas-first, minimal distractions.',
        icon: Focus,
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Inspector-heavy, analyze and tune.',
        icon: PanelRight,
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Super clean controls + panels off.',
        icon: Minimize2,
      },
    ]
  }, [])

  const [uiProfileId, setUiProfileId] = useState<WorkspaceUIProfileId>(() => {
    const raw = readBuilderLocalStorage(
      profileKey,
    ) as WorkspaceUIProfileId | null
    return raw || 'default'
  })

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(profileKey, uiProfileId)
  }, [autosaveEnabled, profileKey, uiProfileId])

  useEffect(() => {
    if (uiProfileId === 'default') return
    setLeftPeek(false)
    setRightPeek(false)

    if (uiProfileId === 'focus') {
      setLeftCollapsed(true)
      setRightCollapsed(true)
      setHudDensity('compact')
      setHudVisible(false)
      setRightPanelWidth(320)
      setHudAutoHideOnIdle(true)
      setCanvasMode('dots')
      setMiniMapPos('tr')
      requestAnimationFrame(() => {
        reactFlow.fitView({
          padding: 0.35,
          maxZoom: 1.28,
        })
      })
    }

    if (uiProfileId === 'review') {
      setLeftCollapsed(true)
      setRightCollapsed(false)
      setHudDensity('standard')
      setHudVisible(true)
      setRightPanelWidth(380)
      setHudAutoHideOnIdle(false)
      setCanvasMode('grid')
      setMiniMapPos('br')
    }

    if (uiProfileId === 'minimal') {
      setLeftCollapsed(true)
      setRightCollapsed(true)
      setHudDensity('compact')
      setHudVisible(false)
      setRightPanelWidth(320)
      setHudAutoHideOnIdle(true)
      setCanvasMode('blank')
      setMiniMapPos('br')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiProfileId])

  /* --------------------------------
    🔼 ADDITION: Panel resize drag handles
-------------------------------- */
  const resizingRef = useRef<null | {
    side: 'left' | 'right' | 'inspector-left'
    startX: number
    startW: number
  }>(null)
  const [activeResizeSide, setActiveResizeSide] = useState<
    'left' | 'right' | 'inspector-left' | null
  >(null)

  const beginResize = useCallback(
    (side: 'left' | 'right' | 'inspector-left', e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      setActiveResizeSide(side)
      resizingRef.current = {
        side,
        startX: e.clientX,
        startW:
          side === 'left'
            ? leftPanelWidth
            : side === 'inspector-left'
              ? rightPanelWidth
              : rightPanelWidth,
      }
    },
    [leftPanelWidth, rightPanelWidth],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const { side, startX, startW } = resizingRef.current
      const dx = e.clientX - startX
      if (side === 'left') {
        const next = Math.max(240, Math.min(320, startW + dx))
        setLeftPanelWidth(next)
      } else if (side === 'inspector-left') {
        const next = Math.max(320, Math.min(640, startW + dx))
        setRightPanelWidth(next)
      } else {
        const next = Math.max(320, Math.min(640, startW - dx))
        setRightPanelWidth(next)
      }
    }
    const onUp = () => {
      resizingRef.current = null
      setActiveResizeSide(null)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [])

  const setInspectorWidthPreset = useCallback((size: number) => {
    setRightPanelWidth(Math.max(320, Math.min(640, size)))
  }, [])

  /* --------------------------------
    Focus Presets (saved per workspace)
 -------------------------------- */
  const [focusPresets, setFocusPresets] = useState<FocusPreset[]>(() => {
    const raw = readBuilderLocalStorage(presetKey)
    if (!raw) return []
    try {
      return JSON.parse(raw) as FocusPreset[]
    } catch {
      return []
    }
  })
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')

  useEffect(() => {
    writeBuilderLocalStorage(presetKey, JSON.stringify(focusPresets))
  }, [presetKey, focusPresets])

  const applyPreset = useCallback(
    (id: string) => {
      const p = focusPresets.find((x) => x.id === id)
      if (!p) return
      reactFlow.setViewport(p.viewport, { duration: 220 })
      setSelectedPresetId(id)
    },
    [focusPresets, reactFlow],
  )

  const savePreset = useCallback(() => {
    const name = window.prompt('Name this focus preset:', 'My Preset')
    if (!name) return
    const preset: FocusPreset = {
      id: crypto.randomUUID(),
      name,
      viewport: lastVpRef.current,
    }
    setFocusPresets((prev) => [preset, ...prev].slice(0, 12))
    setSelectedPresetId(preset.id)
  }, [])

  const deletePreset = useCallback(() => {
    if (!selectedPresetId) return
    setFocusPresets((prev) => prev.filter((p) => p.id !== selectedPresetId))
    setSelectedPresetId('')
  }, [selectedPresetId])

  /* --------------------------------
      🔼 ADDITION: Focus preset preview (hover)
  -------------------------------- */
  const focusPreviewTimerRef = useRef<number | null>(null)
  const previewFocusPreset = useCallback(
    (id: string) => {
      const p = focusPresets.find((x) => x.id === id)
      if (!p) return
      if (focusPreviewTimerRef.current)
        window.clearTimeout(focusPreviewTimerRef.current)
      // subtle preview nudge (do not overwrite selectedPresetId)
      reactFlow.setViewport(p.viewport, { duration: 180 })
      // return to current after a short moment if user doesn't click
      focusPreviewTimerRef.current = window.setTimeout(() => {
        // return to last known viewport (HUD uses lastVpRef)
        reactFlow.setViewport(lastVpRef.current, { duration: 180 })
      }, 700)
    },
    [focusPresets, reactFlow],
  )

  useEffect(() => {
    return () => {
      if (focusPreviewTimerRef.current)
        window.clearTimeout(focusPreviewTimerRef.current)
    }
  }, [])

  /* --------------------------------
      🔼 ADDITION: HUD state (density, drag position, menu, auto-hide)
  -------------------------------- */
  const [hudDensity, setHudDensity] = useState<HudDensity>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:density`)
    if (raw === 'standard') return 'standard'
    return 'compact'
  })
  const inspectorWidthForDensity = useCallback((density: HudDensity) => {
    if (density === 'compact') return 320
    return 380
  }, [])
  const applyBuilderDensity = useCallback(
    (density: HudDensity) => {
      setHudDensity(density)
      setInspectorWidthPreset(inspectorWidthForDensity(density))
    },
    [inspectorWidthForDensity, setInspectorWidthPreset],
  )
  const DEFAULT_HUD_POS = { x: 24, y: 24 }
  const [hudPos, setHudPos] = useState<{ x: number; y: number }>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:pos`)
    if (!raw) return DEFAULT_HUD_POS
    try {
      const parsed = JSON.parse(raw) as { x: number; y: number }
      return {
        x: typeof parsed.x === 'number' ? parsed.x : DEFAULT_HUD_POS.x,
        y: typeof parsed.y === 'number' ? parsed.y : DEFAULT_HUD_POS.y,
      }
    } catch {
      return DEFAULT_HUD_POS
    }
  })
  const [renderHudPos, setRenderHudPos] = useState<{ x: number; y: number }>(
    () => hudPos,
  )
  const hudAvoidanceReturnPosRef = useRef<{ x: number; y: number } | null>(null)
  const [hudAutoHideOnIdle, setHudAutoHideOnIdle] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:autoHide`)
    return raw ? raw === 'true' : true
  })
  const [hudVisibilityMode, setHudVisibilityMode] = useState<HudVisibilityMode>(
    () => {
      const raw = readBuilderLocalStorage(`${hudKey}:visibilityMode`)
      if (raw === 'auto' || raw === 'always' || raw === 'hidden') return raw
      return 'auto'
    },
  )
  const [hudFloatingWhenFullscreen, setHudFloatingWhenFullscreen] =
    useState<boolean>(() => {
      const raw = readBuilderLocalStorage(`${hudKey}:floatingFullscreen`)
      return raw ? raw === 'true' : true
    })

  const [hudMenuOpen, setHudMenuOpen] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:menuOpen`)
    return raw ? raw === 'true' : false
  })

  const hudDockModeOptions = [
    'floating',
    'dock-top-left',
    'dock-top-right',
    'dock-bottom-left',
    'dock-bottom-right',
  ] as const
  const [hudDockMode, setHudDockMode] = useState<HUDDockMode>(() => {
    const raw = readBuilderLocalStorage(
      `${hudKey}:dockMode`,
    ) as HUDDockMode | null
    return raw || 'floating'
  })
  const [hudPhysicsEnabled, setHudPhysicsEnabled] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:physicsEnabled`)
    return raw ? raw === 'true' : false
  })
  const [hudMiniMode, setHudMiniMode] = useState(false)
  const [hudHintsEnabled, setHudHintsEnabled] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:hintsEnabled`)
    return raw ? raw === 'true' : true
  })
  const [hudHintsDismissed, setHudHintsDismissed] = useState<boolean>(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:hintsDismissed`)
    return raw ? raw === 'true' : false
  })
  const [hudHintPanelOpen, setHudHintPanelOpen] = useState(false)
  const [builderAssistantVisible, setBuilderAssistantVisible] =
    useState<boolean>(() => {
      const raw = readBuilderLocalStorage(`${builderAssistantKey}:visible`)
      return raw ? raw === 'true' : true
    })
  const [builderAssistantExpanded, setBuilderAssistantExpanded] =
    useState<boolean>(() => {
      const raw = readBuilderLocalStorage(`${builderAssistantKey}:expanded`)
      return raw ? raw === 'true' : false
    })
  const [isHudDragging, setIsHudDragging] = useState(false)
  void isHudDragging
  const HUD_SNAP_VISUAL_THRESHOLD = 32
  const getCanvasBounds = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      right: rect?.right ?? window.innerWidth,
      bottom: rect?.bottom ?? window.innerHeight,
    }
  }, [])
  const getHudBounds = useCallback(() => {
    const PAD = 0
    const MINIMAP_WIDTH = 244
    const MINIMAP_HEIGHT = 164
    const MINIMAP_GAP = 16
    const hudW = hudRef.current?.offsetWidth ?? 360
    const hudH = hudRef.current?.offsetHeight ?? 56
    const canvas = getCanvasBounds()
    const canvasWidth = canvas.right - canvas.left
    const canvasHeight = canvas.bottom - canvas.top
    const leftReserve = effectiveLeftOpen ? leftPanelWidth : 0
    const rightReserve = inspectorColumnOpen ? rightPanelWidth : 0
    const minX = leftReserve
    const maxX = Math.max(minX, canvasWidth - hudW - rightReserve)
    const minY = 0
    const maxY = Math.max(minY, canvasHeight - hudH)
    const minimap = showMinimap
      ? {
          left: Math.max(0, canvasWidth - MINIMAP_WIDTH - MINIMAP_GAP),
          top: Math.max(0, canvasHeight - MINIMAP_HEIGHT - MINIMAP_GAP),
          right: canvasWidth - MINIMAP_GAP,
          bottom: canvasHeight - MINIMAP_GAP,
        }
      : null

    return {
      minX,
      maxX,
      minY,
      maxY,
      hudW,
      hudH,
      minimap,
      canvasLeft: canvas.left,
      canvasTop: canvas.top,
    }
  }, [
    effectiveLeftOpen,
    getCanvasBounds,
    inspectorColumnOpen,
    leftPanelWidth,
    rightPanelWidth,
    showMinimap,
  ])
  const hudSnapHints = useMemo(() => {
    if (!hudPhysicsEnabled || !isHudDragging || hudDockMode !== 'floating')
      return { top: false, bottom: false, left: false, right: false }
    const bounds = getHudBounds()
    return {
      top: hudPos.y - bounds.minY <= HUD_SNAP_VISUAL_THRESHOLD,
      bottom: bounds.maxY - hudPos.y <= HUD_SNAP_VISUAL_THRESHOLD * 2,
      left: hudPos.x - bounds.minX <= HUD_SNAP_VISUAL_THRESHOLD,
      right: bounds.maxX - hudPos.x <= HUD_SNAP_VISUAL_THRESHOLD * 2,
    }
  }, [
    getHudBounds,
    hudDockMode,
    hudPhysicsEnabled,
    hudPos.x,
    hudPos.y,
    isHudDragging,
  ])

  const clampHudPosition = useCallback(
    (pos: { x: number; y: number }) => {
      const bounds = getHudBounds()
      const clampVal = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v))
      let x = clampVal(pos.x, bounds.minX, bounds.maxX)
      let y = clampVal(pos.y, bounds.minY, bounds.maxY)
      if (bounds.minimap) {
        const overlapsX =
          x < bounds.minimap.right && x + bounds.hudW > bounds.minimap.left
        const overlapsY =
          y < bounds.minimap.bottom && y + bounds.hudH > bounds.minimap.top
        if (overlapsX && overlapsY) {
          y = clampVal(
            bounds.minimap.top - bounds.hudH,
            bounds.minY,
            bounds.maxY,
          )
        }
      }
      return { x, y, bounds }
    },
    [getHudBounds],
  )

  const [hudSavedPositions, setHudSavedPositions] = useState<
    HUDSavedPosition[]
  >(() => {
    const raw = readBuilderLocalStorage(`${hudKey}:positions`)
    if (!raw) return []
    try {
      return JSON.parse(raw) as HUDSavedPosition[]
    } catch {
      return []
    }
  })
  const [selectedHudPositionId, setSelectedHudPositionId] = useState<string>('')

  useEffect(() => {
    writeBuilderLocalStorage(
      `${hudKey}:positions`,
      JSON.stringify(hudSavedPositions.slice(0, 8)),
    )
  }, [hudKey, hudSavedPositions])

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(
      `${builderAssistantKey}:visible`,
      String(builderAssistantVisible),
    )
    writeBuilderLocalStorage(
      `${builderAssistantKey}:expanded`,
      String(builderAssistantExpanded),
    )
  }, [
    autosaveEnabled,
    builderAssistantExpanded,
    builderAssistantKey,
    builderAssistantVisible,
  ])

  const focusBuilderAssistantSection = useCallback(
    (
      target:
        | 'errors'
        | 'warnings'
        | 'suggestions'
        | 'optimizations'
        | 'runtime'
        | 'ready'
        | 'blocked'
        | 'execution-summary'
        | 'future-recommendations'
        | 'produced-variables'
        | 'consumed-variables'
        | 'unused-variables'
        | 'overwritten-variables'
        | 'broken-variable-flow'
        | 'unavailable-variables'
        | 'missing-trigger'
        | 'missing-end-path'
        | 'summary',
    ) => {
      setBuilderAssistantVisible(true)
      setBuilderAssistantExpanded(true)
      setAssistantFocusTarget(target)
      window.setTimeout(() => {
        assistantRefs.current[target]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 80)
    },
    [],
  )

  const magnetPreviewPos = useMemo(() => {
    if (!hudPhysicsEnabled || !isHudDragging || hudDockMode !== 'floating')
      return null
    const { bounds, x: baseX, y: baseY } = clampHudPosition(hudPos)
    let x = baseX
    let y = baseY
    const MAGNET = 48
    const distL = x - bounds.minX
    const distR = bounds.maxX - x
    const distT = y - bounds.minY
    const distB = bounds.maxY - y
    if (distL <= MAGNET) x = bounds.minX
    if (distR <= MAGNET) x = bounds.maxX
    if (distT <= MAGNET) y = bounds.minY
    if (distB <= MAGNET) y = bounds.maxY
    return { x, y, w: bounds.hudW, h: bounds.hudH }
  }, [clampHudPosition, hudDockMode, hudPos, isHudDragging])

  useEffect(() => {
    if (hudDockMode !== 'floating') {
      setRenderHudPos(hudPos)
      return
    }
    if (isHudDragging && !hudPhysicsEnabled) {
      setRenderHudPos(hudPos)
      return
    }
    let raf: number | null = null
    const tick = () => {
      setRenderHudPos((cur) => {
        const lerp = hudPhysicsEnabled ? 0.12 : isHudDragging ? 0.18 : 0.28
        const nx = cur.x + (hudPos.x - cur.x) * lerp
        const ny = cur.y + (hudPos.y - cur.y) * lerp
        if (Math.abs(nx - hudPos.x) < 0.5 && Math.abs(ny - hudPos.y) < 0.5) {
          return hudPos
        }
        raf = requestAnimationFrame(tick)
        return { x: nx, y: ny }
      })
    }
    if (isHudDragging || hudPhysicsEnabled) {
      raf = requestAnimationFrame(tick)
    } else {
      setRenderHudPos(hudPos)
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [hudDockMode, hudPos, isHudDragging, hudPhysicsEnabled])

  useEffect(() => {
    if (hudDockMode !== 'floating') return
    if (isHudDraggingRef.current) return
    const base = hudAvoidanceReturnPosRef.current ?? hudPos
    const next = clampHudPosition(base)
    const isShifted = next.x !== base.x || next.y !== base.y
    if (isShifted) {
      hudAvoidanceReturnPosRef.current = base
      setRenderHudPos({ x: next.x, y: next.y })
      return
    }
    if (hudAvoidanceReturnPosRef.current) {
      const restored = hudAvoidanceReturnPosRef.current
      hudAvoidanceReturnPosRef.current = null
      setHudPos(restored)
      setRenderHudPos(restored)
      return
    }
    setRenderHudPos(hudPos)
  }, [clampHudPosition, hudDockMode, hudPos])

  /* --------------------------------
    🔼 ADDITION: HUD Intelligence Layer
  -------------------------------- */
  const hudSuggestions = useMemo<HudSuggestion[]>(() => [], [])

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(`${hudKey}:density`, hudDensity)
    writeBuilderLocalStorage(`${hudKey}:pos`, JSON.stringify(hudPos))
    writeBuilderLocalStorage(`${hudKey}:autoHide`, String(hudAutoHideOnIdle))
    writeBuilderLocalStorage(`${hudKey}:visibilityMode`, hudVisibilityMode)
    writeBuilderLocalStorage(
      `${hudKey}:floatingFullscreen`,
      String(hudFloatingWhenFullscreen),
    )
    writeBuilderLocalStorage(`${hudKey}:menuOpen`, String(hudMenuOpen))
    writeBuilderLocalStorage(`${hudKey}:dockMode`, hudDockMode)
    writeBuilderLocalStorage(
      `${hudKey}:physicsEnabled`,
      String(hudPhysicsEnabled),
    )
    writeBuilderLocalStorage(`${hudKey}:hintsEnabled`, String(hudHintsEnabled))
    writeBuilderLocalStorage(
      `${hudKey}:hintsDismissed`,
      String(hudHintsDismissed),
    )
  }, [
    autosaveEnabled,
    hudKey,
    hudDensity,
    hudPos,
    hudAutoHideOnIdle,
    hudVisibilityMode,
    hudFloatingWhenFullscreen,
    hudMenuOpen,
    hudDockMode,
    hudPhysicsEnabled,
    hudHintsEnabled,
    hudHintsDismissed,
  ])

  // Auto-hide HUD on idle (only when fullscreen, per your requirement)
  const [hudVisible, setHudVisible] = useState<boolean>(() => {
    return hudDensity === 'standard'
  })
  const idleTimerRef = useRef<number | null>(null)
  const setBuilderControlMode = useCallback(
    (density: HudDensity) => {
      applyBuilderDensity(density)
      const shouldOpenPanel = density === 'standard'
      setHudVisible(shouldOpenPanel)
    },
    [applyBuilderDensity],
  )

  useEffect(() => {
    if (!autosaveEnabled) return
    writeBuilderLocalStorage(`${hudKey}:panelOpen`, String(hudVisible))
  }, [autosaveEnabled, hudKey, hudVisible])

  const bumpHudActivity = useCallback(() => {
    if (hudVisibilityMode === 'hidden') return
    if (!hudVisible && !hudMenuOpen) return
    setHudVisible(true)
    if (hudVisibilityMode === 'always') return
    if (hudDensity === 'standard') return
    if (!hudAutoHideOnIdle) return
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    if (hudMenuOpen) return
    idleTimerRef.current = window.setTimeout(() => {
      setHudVisible(false)
    }, 2500)
  }, [
    hudAutoHideOnIdle,
    hudDensity,
    hudMenuOpen,
    hudVisible,
    hudVisibilityMode,
  ])

  useEffect(() => {
    if (hudVisibilityMode === 'always') {
      setHudVisible(true)
      return
    }
    if (hudVisibilityMode === 'hidden') {
      setHudVisible(false)
      return
    }
    bumpHudActivity()
  }, [bumpHudActivity, hudVisibilityMode])

  useEffect(() => {
    if (!hudMenuOpen) return
    setHudVisible(true)
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
  }, [hudMenuOpen])

  useEffect(() => {
    if (hudDensity !== 'compact' || !hudVisible) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (hudRef.current?.contains(target)) return
      if (target.closest('[data-builder-controls-menu="true"]')) return
      if (target.closest('[data-canvas-controls-trigger="true"]')) return
      setHudVisible(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [hudDensity, hudVisible])

  useEffect(() => {
    bumpHudActivity()
    const el = canvasRef.current
    if (!el) return
    const onAny = () => {
      bumpHudActivity()
      setHudMiniMode(false)
    }
    el.addEventListener('mousemove', onAny, { passive: true })
    el.addEventListener('mousedown', onAny, { passive: true })
    el.addEventListener('wheel', onAny, { passive: true })
    el.addEventListener('touchstart', onAny, { passive: true })
    return () => {
      el.removeEventListener('mousemove', onAny as any)
      el.removeEventListener('mousedown', onAny as any)
      el.removeEventListener('wheel', onAny as any)
      el.removeEventListener('touchstart', onAny as any)
    }
  }, [bumpHudActivity, setHudMiniMode])

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setIsNarrowViewport(window.innerWidth < 1024)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // HUD drag positioning (click vs drag threshold)
  const hudRef = useRef<HTMLDivElement>(null)
  const assistantRefs = useRef<
    Partial<
      Record<NonNullable<typeof assistantFocusTarget>, HTMLElement | null>
    >
  >({})
  const hudDragRef = useRef<null | {
    startX: number
    startY: number
    initialPos: { x: number; y: number }
    grabOffset: { x: number; y: number }
    started: boolean
    dockModeAtStart: HUDDockMode
  }>(null)
  const HUD_DRAG_THRESHOLD = 5
  const resetPointerInteractionState = useCallback(() => {
    resizingRef.current = null
    hudDragRef.current = null
    isHudDraggingRef.current = false
    activeConnectionStartRef.current = null
    setAddNodeDrag(null)
    setConnectionRepairMode(null)
    setConnectionWarning(null)
    setIsHudDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const handleCanvasWheel = useCallback(
    (event: React.WheelEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, option, button, a, [role="dialog"], [data-no-canvas-wheel], .nowheel, .nodrag, .react-flow__panel',
        )
      ) {
        return
      }

      const intent = getCanvasWheelIntent(event)
      if (intent.type === 'zoom') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      const viewport = reactFlow.getViewport()
      const speed = 0.9
      if (intent.type === 'pan-x') {
        reactFlow.setViewport({
          ...viewport,
          x: viewport.x - intent.delta * speed,
        })
        return
      }
      reactFlow.setViewport({
        ...viewport,
        y: viewport.y - intent.delta * speed,
      })
    },
    [reactFlow],
  )
  const beginHudDrag = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName.toLowerCase()
      const isInteractive =
        tag === 'button' ||
        tag === 'option' ||
        tag === 'select' ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'label' ||
        tag === 'a' ||
        target.closest(
          'button, input, textarea, select, option, a, label, [role="button"], [data-no-drag], [data-builder-controls-menu="true"]',
        )
      if (isInteractive) return

      e.preventDefault()
      e.stopPropagation()

      const rect = hudRef.current?.getBoundingClientRect()
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!rect || !canvasRect) return

      const currentPos = {
        x: rect.left - canvasRect.left,
        y: rect.top - canvasRect.top,
      }

      hudDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPos: currentPos,
        grabOffset: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
        started: false,
        dockModeAtStart: hudDockMode,
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    },
    [hudDockMode, setHudDockMode],
  )

  useEffect(() => {
    const applyMagnetAndSnap = (pos: { x: number; y: number }) => {
      const bounds = getHudBounds()
      const clampVal = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v))
      let x = clampVal(pos.x, bounds.minX, bounds.maxX)
      let y = clampVal(pos.y, bounds.minY, bounds.maxY)
      const MAGNET = 48

      const distL = x - bounds.minX
      const distR = bounds.maxX - x
      const distT = y - bounds.minY
      const distB = bounds.maxY - y

      if (distL <= MAGNET) x = bounds.minX
      if (distR <= MAGNET) x = bounds.maxX
      if (distT <= MAGNET) y = bounds.minY
      if (distB <= MAGNET) y = bounds.maxY

      return { x, y, clamp: bounds }
    }

    const applyFinalSnap = (pos: { x: number; y: number }) => {
      const { x, y, clamp } = applyMagnetAndSnap(pos)
      const SNAP = 12

      let sx = x
      let sy = y

      if (Math.abs(x - clamp.minX) <= SNAP) sx = clamp.minX
      if (Math.abs(x - clamp.maxX) <= SNAP) sx = clamp.maxX
      if (Math.abs(y - clamp.minY) <= SNAP) sy = clamp.minY
      if (Math.abs(y - clamp.maxY) <= SNAP) sy = clamp.maxY

      return { x: sx, y: sy }
    }

    const onMove = (e: MouseEvent) => {
      if (!hudDragRef.current) return

      const { startX, startY, initialPos, grabOffset, started } =
        hudDragRef.current
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      const hudRect = hudRef.current?.getBoundingClientRect()
      if (!canvasRect || !hudRect) return

      const rawX = e.clientX - canvasRect.left - grabOffset.x
      const rawY = e.clientY - canvasRect.top - grabOffset.y

      const clamped = clampHudPosition({ x: rawX, y: rawY })
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (!started) {
        if (
          Math.abs(dx) < HUD_DRAG_THRESHOLD &&
          Math.abs(dy) < HUD_DRAG_THRESHOLD
        ) {
          return
        }
        hudDragRef.current.started = true
        if (hudDockMode !== 'floating') {
          setHudDockMode('floating')
        }
        setHudPos(initialPos)
        setRenderHudPos(initialPos)
        isHudDraggingRef.current = true
        setIsHudDragging(true)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
      }

      const next = {
        x: clamped.x,
        y: clamped.y,
      }

      setHudPos(next)
      setRenderHudPos(next)
    }

    const onUp = () => {
      const drag = hudDragRef.current
      if (!drag) return

      if (drag.started) {
        setHudPos((cur) => {
          const clamped = clampHudPosition(cur)
          const clampedPos = { x: clamped.x, y: clamped.y }
          const snapped = hudPhysicsEnabled
            ? applyFinalSnap(clampedPos)
            : clampedPos
          setRenderHudPos(snapped)
          return snapped
        })
        isHudDraggingRef.current = false
        setIsHudDragging(false)
      }
      hudDragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('blur', resetPointerInteractionState)
    window.addEventListener('mouseleave', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', resetPointerInteractionState)
      window.removeEventListener('mouseleave', onUp)
    }
  }, [
    hudDockMode,
    setHudDockMode,
    setHudPos,
    getHudBounds,
    clampHudPosition,
    setRenderHudPos,
    hudPhysicsEnabled,
    resetPointerInteractionState,
  ])

  /* --------------------------------
    🔼 ADDITION: HUD Presets (per workspace)
  -------------------------------- */
  const [hudPresets, setHudPresets] = useState<HudPreset[]>(() => {
    const raw = readBuilderLocalStorage(hudPresetKey)
    if (!raw) return []
    try {
      return JSON.parse(raw) as HudPreset[]
    } catch {
      return []
    }
  })
  const [selectedHudPresetId, setSelectedHudPresetId] = useState<string>('')

  useEffect(() => {
    writeBuilderLocalStorage(hudPresetKey, JSON.stringify(hudPresets))
  }, [hudPresetKey, hudPresets])

  const applyHudPreset = useCallback(
    (id: string) => {
      const p = hudPresets.find((x) => x.id === id)
      if (!p) return
      const s = p.state
      setBuilderControlMode(s.density === 'compact' ? 'compact' : 'standard')
      setHudPos(s.hudPos)
      setHudAutoHideOnIdle(s.autoHide)
      setHudFloatingWhenFullscreen(s.floatingWhenFullscreen)

      setLeftPanelWidth(s.leftWidth)
      setRightPanelWidth(s.rightWidth)

      setCanvasMode(s.canvasMode)
      setSnapToGrid(s.snapToGrid)
      setMiniMapPos(s.miniMapPos)

      setLeftCollapsed(s.leftCollapsed)
      setRightCollapsed(s.rightCollapsed)
      setHudDockMode(s.dockMode ?? 'floating')

      setSelectedHudPresetId(id)
    },
    [hudPresets, setBuilderControlMode],
  )

  const saveHudPreset = useCallback(() => {
    const name = window.prompt(
      'Name this Canvas Controls preset:',
      'My Canvas Controls Preset',
    )
    if (!name) return
    const preset: HudPreset = {
      id: crypto.randomUUID(),
      name,
      state: {
        density: hudDensity,
        hudPos,
        autoHide: hudAutoHideOnIdle,
        floatingWhenFullscreen: hudFloatingWhenFullscreen,
        leftWidth: leftPanelWidth,
        rightWidth: rightPanelWidth,
        canvasMode,
        snapToGrid,
        miniMapPos,
        leftCollapsed,
        rightCollapsed,
        dockMode: hudDockMode,
      },
    }
    setHudPresets((prev) => [preset, ...prev].slice(0, 16))
    setSelectedHudPresetId(preset.id)
  }, [
    hudDensity,
    hudPos,
    hudAutoHideOnIdle,
    hudFloatingWhenFullscreen,
    leftPanelWidth,
    rightPanelWidth,
    canvasMode,
    snapToGrid,
    miniMapPos,
    leftCollapsed,
    rightCollapsed,
  ])

  const deleteHudPreset = useCallback((id: string) => {
    setHudPresets((prev) => prev.filter((p) => p.id !== id))
    setSelectedHudPresetId((cur) => (cur === id ? '' : cur))
  }, [])

  const clearPreviewRuntimeState = useCallback(() => {
    setPreviewActiveEdgeIds([])
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: {
          ...(node.data as Record<string, unknown>),
          __active: false,
          __hot: false,
          __lastPreviewStatus: undefined,
        },
      })),
    )
  }, [setNodes])

  /* --------------------------------
    Preview execution engine
  -------------------------------- */
  const runSimulation = useCallback(async () => {
    if (previewRunState === 'running' || previewRunState === 'paused') return
    previewControlRef.current = { paused: false, stopped: false }
    setPreviewRunState('running')
    clearPreviewRuntimeState()
    const currentBranchPreviewInputs = getBranchPreviewInputs({
      nodes,
      edges,
      workspace: workspaceOptionContext,
      overrides: branchPreviewOverrides,
    })
    const currentBranchPreviewData = branchPreviewDataFromInputs(
      currentBranchPreviewInputs,
    )
    const currentWorkflowFingerprint = getWorkflowExecutionFingerprint({
      nodes,
      edges,
      previewInputFingerprint: branchPreviewFingerprint(branchPreviewOverrides),
    })
    const validation = validateBuilderWorkflow({ nodes, edges })
    const blockingIssues = validation.publishErrors.length
      ? validation.publishErrors
      : validation.issues.filter((item) => item.severity === 'error')

    if (!validation.validationReport.readiness.canPreview) {
      const execution = createWorkflowPreflightFailurePreview({
        automationId,
        workspaceId,
        issues: blockingIssues,
        nodes,
        edges,
        validationReport: validation.validationReport,
        workflowFingerprint: currentWorkflowFingerprint,
      })
      setFailedPreviewSnapshot({
        fingerprint: currentWorkflowFingerprint,
        issueIds: blockingIssues.map((item) => item.id),
      })
      setPreviewExecution(execution)
      setLastPreviewFingerprint(
        execution.workflowFingerprint ?? currentWorkflowFingerprint,
      )
      setLocalRunHistory(
        recordWorkflowRunHistory(execution as WorkflowExecutionReport),
      )
      setPreviewRunState('idle')
      return
    }
    setFailedPreviewSnapshot(null)

    const startedAt = new Date().toISOString()
    setPreviewExecution({
      id: `preview-${automationId}-running`,
      workflowId: automationId,
      workspaceId,
      status: 'running',
      triggerSource: 'Preview run in progress',
      startedAt,
      steps: nodes.map((node) => ({
        id: `preview-waiting-${node.id}`,
        runId: `preview-${automationId}-running`,
        nodeId: node.id,
        nodeType: node.type ?? 'unknown',
        label: String((node.data as any)?.label ?? node.type ?? 'Node'),
        status: 'pending',
        logs: [],
        output: {},
      })),
      logs: [],
      mode: 'preview',
      summary: {
        workflow: automationId,
        completed: 0,
        failed: 0,
        skipped: 0,
        executionTimeMs: 0,
        variablesCreated: 0,
        variablesUsed: 0,
        nodesExecuted: 0,
        warnings: 0,
        errors: 0,
        branchCount: 0,
        estimatedRuntimeMs: nodes.length * 900,
      },
    })

    const waitIfPaused = async () => {
      while (
        previewControlRef.current.paused &&
        !previewControlRef.current.stopped
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 120))
      }
    }

    try {
      const execution = await executeWorkflowPreview({
        automationId,
        workspaceId,
        nodes,
        edges,
        previewData: currentBranchPreviewData,
        preflightIssues: blockingIssues,
        validationReport: validation.validationReport,
        workflowFingerprint: currentWorkflowFingerprint,
        controls: {
          shouldStop: () => previewControlRef.current.stopped,
          waitIfPaused,
          onLifecycle: (event) => {
            if (event.edgeId) {
              setPreviewActiveEdgeIds((current) =>
                current.includes(event.edgeId!)
                  ? current
                  : [...current, event.edgeId!],
              )
            }
            if (!event.nodeId) return
            setNodes((currentNodes) =>
              currentNodes.map((node) =>
                node.id === event.nodeId
                  ? {
                      ...node,
                      data: {
                        ...(node.data as Record<string, unknown>),
                        __active: event.status === 'running',
                        __hot: event.status === 'failed',
                        __lastPreviewStatus: event.status,
                        __lastPreviewOutput: event.step?.output,
                        __lastPreviewDurationMs:
                          event.step?.output?.__durationMs,
                        __lastPreviewWarnings: event.step?.output?.__warnings,
                        __lastPreviewErrors: event.step?.error
                          ? [event.step.error]
                          : [],
                      },
                    }
                  : event.status === 'running'
                    ? {
                        ...node,
                        data: {
                          ...(node.data as Record<string, unknown>),
                          __active: false,
                        },
                      }
                    : node,
              ),
            )
          },
        },
      })
      setPreviewExecution(execution)
      setLastPreviewFingerprint(
        execution.workflowFingerprint ?? currentWorkflowFingerprint,
      )
      setPreviewRunHistory((history) => [execution, ...history].slice(0, 10))
      setLocalRunHistory(recordWorkflowRunHistory(execution))
    } finally {
      setPreviewRunState(previewControlRef.current.stopped ? 'stopped' : 'idle')
      window.setTimeout(() => {
        setPreviewActiveEdgeIds([])
        setNodes((currentNodes) =>
          currentNodes.map((node) => ({
            ...node,
            data: {
              ...(node.data as Record<string, unknown>),
              __active: false,
            },
          })),
        )
      }, 500)
    }
  }, [
    automationId,
    branchPreviewOverrides,
    clearPreviewRuntimeState,
    edges,
    nodes,
    previewRunState,
    setNodes,
    workspaceOptionContext,
    workspaceId,
  ])

  const stopPreviewRun = useCallback(() => {
    previewControlRef.current.stopped = true
    previewControlRef.current.paused = false
    setPreviewRunState('stopped')
  }, [])

  const pausePreviewRun = useCallback(() => {
    if (previewRunState !== 'running') return
    previewControlRef.current.paused = true
    setPreviewRunState('paused')
  }, [previewRunState])

  const resumePreviewRun = useCallback(() => {
    if (previewRunState !== 'paused') return
    previewControlRef.current.paused = false
    setPreviewRunState('running')
  }, [previewRunState])

  const restartPreviewRun = useCallback(() => {
    previewControlRef.current.stopped = true
    previewControlRef.current.paused = false
    setPreviewRunState('idle')
    window.setTimeout(() => {
      runSimulation()
    }, 0)
  }, [runSimulation])

  const runHistoryStats = useMemo(
    () => getWorkflowRunHistoryStats(localRunHistory),
    [localRunHistory],
  )

  const applyReplayStep = useCallback(
    (run: WorkflowRunHistoryItem, stepIndex: number) => {
      const step = run.steps[stepIndex]
      if (!step) return
      const previousStep = run.steps[stepIndex - 1]
      const incomingEdgeIds = previousStep
        ? edges
            .filter(
              (edge) =>
                edge.source === previousStep.nodeId &&
                edge.target === step.nodeId,
            )
            .map((edge) => edge.id)
        : []
      setPreviewActiveEdgeIds(incomingEdgeIds)
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const isActive = node.id === step.nodeId
          return {
            ...node,
            data: {
              ...(node.data as Record<string, unknown>),
              __active: isActive,
              __hot: isActive && step.status === 'failed',
              __replayMode: isActive,
              __lastPreviewStatus: isActive
                ? step.status
                : (node.data as any)?.__lastPreviewStatus,
              __lastPreviewOutput: isActive
                ? step.output
                : (node.data as any)?.__lastPreviewOutput,
              __lastPreviewDurationMs: isActive
                ? (step.output?.__durationMs ??
                  (step.startedAt && step.finishedAt
                    ? Math.max(
                        0,
                        Date.parse(step.finishedAt) -
                          Date.parse(step.startedAt),
                      )
                    : 0))
                : (node.data as any)?.__lastPreviewDurationMs,
              __lastPreviewWarnings: isActive
                ? step.logs
                    .filter((log) => log.level === 'warning')
                    .map((log) => log.message)
                : (node.data as any)?.__lastPreviewWarnings,
              __lastPreviewErrors: isActive
                ? [
                    ...(step.error ? [step.error] : []),
                    ...step.logs
                      .filter((log) => log.level === 'error')
                      .map((log) => log.message),
                  ]
                : (node.data as any)?.__lastPreviewErrors,
            },
          }
        }),
      )
      if (step.nodeId !== 'workflow') {
        selectNode(step.nodeId)
        const node = nodes.find((item) => item.id === step.nodeId)
        if (node) {
          reactFlow.setCenter(node.position.x + 120, node.position.y + 80, {
            zoom: 0.9,
            duration: 300,
          })
        }
      }
    },
    [edges, nodes, reactFlow, selectNode, setNodes],
  )

  const startReplay = useCallback(
    (run: WorkflowRunHistoryItem) => {
      setPreviewExecution(run.execution)
      setRunHistoryPanelOpen(true)
      setReplayState({ runId: run.id, stepIndex: 0, playing: false })
      applyReplayStep(run, 0)
    },
    [applyReplayStep],
  )

  const stepReplay = useCallback(
    (direction: 'previous' | 'next') => {
      setReplayState((current) => {
        if (!current) return current
        const run = localRunHistory.find((item) => item.id === current.runId)
        if (!run) return current
        const delta = direction === 'next' ? 1 : -1
        const nextIndex = Math.max(
          0,
          Math.min(run.steps.length - 1, current.stepIndex + delta),
        )
        applyReplayStep(run, nextIndex)
        return { ...current, stepIndex: nextIndex, playing: false }
      })
    },
    [applyReplayStep, localRunHistory],
  )

  const toggleReplayPlayback = useCallback(() => {
    setReplayState((current) =>
      current ? { ...current, playing: !current.playing } : current,
    )
  }, [])

  const restartReplay = useCallback(() => {
    setReplayState((current) => {
      if (!current) return current
      const run = localRunHistory.find((item) => item.id === current.runId)
      if (!run) return current
      applyReplayStep(run, 0)
      return { ...current, stepIndex: 0, playing: false }
    })
  }, [applyReplayStep, localRunHistory])

  const selectReplayNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'workflow') return
      selectNode(nodeId)
      const node = nodes.find((item) => item.id === nodeId)
      if (node) {
        reactFlow.setCenter(node.position.x + 120, node.position.y + 80, {
          zoom: 0.9,
          duration: 300,
        })
      }
    },
    [nodes, reactFlow, selectNode],
  )

  useEffect(() => {
    if (!replayState?.playing) return
    const run = localRunHistory.find((item) => item.id === replayState.runId)
    if (!run) return
    const timer = window.setTimeout(() => {
      setReplayState((current) => {
        if (!current || current.runId !== run.id || !current.playing)
          return current
        const nextIndex = current.stepIndex + 1
        if (nextIndex >= run.steps.length) {
          return { ...current, playing: false }
        }
        applyReplayStep(run, nextIndex)
        return { ...current, stepIndex: nextIndex }
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [applyReplayStep, localRunHistory, replayState])

  const builderWorkflow = useMemo(
    () =>
      workflowFromReactFlow({
        id: automationId,
        workspaceId,
        name: automation?.name?.trim() || 'Untitled Workflow',
        nodes,
        edges,
      }),
    [automation?.name, automationId, edges, nodes, workspaceId],
  )
  const builderValidation = useMemo(
    () => validateBuilderWorkflow({ nodes, edges }),
    [edges, nodes],
  )
  const workflowDataFlow = useMemo(
    () => analyzeWorkflowData({ nodes, edges }),
    [edges, nodes],
  )
  const branchPreviewInputs = useMemo(
    () =>
      getBranchPreviewInputs({
        nodes,
        edges,
        dataFlow: workflowDataFlow,
        workspace: workspaceOptionContext,
        overrides: branchPreviewOverrides,
      }),
    [
      branchPreviewOverrides,
      edges,
      nodes,
      workflowDataFlow,
      workspaceOptionContext,
    ],
  )
  const branchPreviewData = useMemo(
    () => branchPreviewDataFromInputs(branchPreviewInputs),
    [branchPreviewInputs],
  )
  const workflowBranchAnalysis = useMemo(
    () =>
      analyzeWorkflowBranches({
        nodes,
        edges,
        dataFlow: workflowDataFlow,
        previewData: branchPreviewData,
      }),
    [branchPreviewData, edges, nodes, workflowDataFlow],
  )
  const selectedNodeDataFlowSummary = useMemo(() => {
    if (!selectedNodeId) return null
    return {
      available: workflowDataFlow.downstreamAvailability[selectedNodeId] ?? [],
      produces: workflowDataFlow.nodeOutputs[selectedNodeId] ?? [],
      consumes: workflowDataFlow.nodeInputs[selectedNodeId] ?? [],
      branchNode: workflowBranchAnalysis.branchNodes.find(
        (branch) => branch.nodeId === selectedNodeId,
      ),
      pathContext: workflowBranchAnalysis.pathByNodeId[selectedNodeId],
      mergePoints: workflowBranchAnalysis.merges.filter(
        (merge) => merge.mergeNodeId === selectedNodeId,
      ),
    }
  }, [selectedNodeId, workflowBranchAnalysis, workflowDataFlow])
  const connectBranchPathFromInspector = useCallback(
    (nodeId: string, sourceHandle: string, pathLabel: string) => {
      selectNode(nodeId)
      setRightCollapsed(false)
      openAddNodeModal(nodeId, undefined, {
        helperText: `Choose the step for the ${pathLabel} path.`,
        sourceHandle,
        insertionContext: 'branch',
      })
    },
    [openAddNodeModal, selectNode],
  )
  const workflowFingerprint = useMemo(
    () =>
      getWorkflowExecutionFingerprint({
        nodes,
        edges,
        previewInputFingerprint: branchPreviewFingerprint(
          branchPreviewOverrides,
        ),
      }),
    [branchPreviewOverrides, edges, nodes],
  )
  const lastPreviewFingerprintRef = useRef<string | null>(null)
  useEffect(() => {
    if (!previewExecution) return
    if (lastPreviewFingerprintRef.current === null) {
      lastPreviewFingerprintRef.current = workflowFingerprint
      return
    }
    if (lastPreviewFingerprintRef.current === workflowFingerprint) return
    setPreviewActiveEdgeIds([])
    setNodes((currentNodes) => {
      let changed = false
      const next = currentNodes.map((node) => {
        const data = node.data as Record<string, unknown>
        if (!data.__lastPreviewOutput && !data.__lastPreviewStatus) return node
        changed = true
        return {
          ...node,
          data: {
            ...data,
            __lastPreviewOutput: undefined,
            __lastPreviewStatus: undefined,
            __lastPreviewDurationMs: undefined,
            __lastPreviewWarnings: undefined,
            __lastPreviewErrors: undefined,
          },
        }
      })
      return changed ? next : currentNodes
    })
    lastPreviewFingerprintRef.current = workflowFingerprint
  }, [previewExecution, setNodes, workflowFingerprint])
  const previewFreshness: PreviewFreshness = useMemo(
    () =>
      previewExecution
        ? getPreviewFreshness({
            previewFingerprint:
              lastPreviewFingerprint ?? previewExecution.workflowFingerprint,
            currentFingerprint: workflowFingerprint,
          })
        : 'none',
    [lastPreviewFingerprint, previewExecution, workflowFingerprint],
  )
  const stalePreviewState = useMemo(() => {
    if (!previewExecution || previewFreshness !== 'out_of_date') {
      return null
    }
    const currentBlockingIds = new Set(
      (builderValidation.publishErrors.length
        ? builderValidation.publishErrors
        : builderValidation.issues.filter((item) => item.severity === 'error')
      ).map((item) => item.id),
    )
    const historicalIssueIds =
      failedPreviewSnapshot?.issueIds ??
      previewExecution.validation?.blockingIssueIds ??
      previewExecution.validation?.issueIds ??
      []
    const resolved = historicalIssueIds.filter(
      (id) => !currentBlockingIds.has(id),
    )
    const remaining = Array.from(currentBlockingIds)
    return {
      freshness: previewFreshness,
      previewStatus: previewExecution.status,
      currentReadinessLabel: builderValidation.readinessLabel,
      currentErrorCount: builderValidation.errors,
      currentWarningCount: builderValidation.warnings,
      resolvedCount: resolved.length,
      remainingCount: remaining.length,
      remainingIssues: (builderValidation.publishErrors.length
        ? builderValidation.publishErrors
        : builderValidation.issues.filter((item) => item.severity === 'error')
      )
        .slice(0, 4)
        .map((item) => item.message),
    }
  }, [
    builderValidation,
    failedPreviewSnapshot,
    previewExecution,
    previewFreshness,
  ])
  const focusValidationIssue = useCallback(
    (issue: { nodeId?: string }) => {
      if (issue.nodeId) {
        const node = nodes.find((item) => item.id === issue.nodeId)
        if (node) {
          selectNode(node.id)
          reactFlow.setCenter(node.position.x + 120, node.position.y + 80, {
            zoom: 0.9,
            duration: 350,
          })
          return
        }
      }

      clearSelection()
      setStartPanelDismissed(false)
      reactFlow.fitView({ padding: 0.3, duration: 350 })
    },
    [clearSelection, nodes, reactFlow, selectNode],
  )
  const focusConnectionRepairArea = useCallback(
    (repairNode: RFNode) => {
      const viewport = reactFlow.getViewport()
      const currentZoom = viewport.zoom || 1
      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      const adjacency = new Map<string, string[]>()
      for (const edge of edges) {
        adjacency.set(edge.source, [
          ...(adjacency.get(edge.source) ?? []),
          edge.target,
        ])
        adjacency.set(edge.target, [
          ...(adjacency.get(edge.target) ?? []),
          edge.source,
        ])
      }
      const componentIds = new Set<string>()
      const queue = [repairNode.id]
      while (queue.length) {
        const nodeId = queue.shift()
        if (!nodeId || componentIds.has(nodeId)) continue
        componentIds.add(nodeId)
        for (const next of adjacency.get(nodeId) ?? []) {
          if (!componentIds.has(next)) queue.push(next)
        }
      }
      const componentNodes = Array.from(componentIds)
        .map((nodeId) => nodeMap.get(nodeId))
        .filter((node): node is RFNode => Boolean(node))
      const repairSize = getMeasuredNodeSize(repairNode)
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      const componentBounds = (
        componentNodes.length ? componentNodes : [repairNode]
      ).reduce(
        (acc, node) => {
          const size = getMeasuredNodeSize(node)
          return {
            minX: Math.min(acc.minX, node.position.x),
            minY: Math.min(acc.minY, node.position.y),
            maxX: Math.max(acc.maxX, node.position.x + size.w),
            maxY: Math.max(acc.maxY, node.position.y + size.h),
          }
        },
        {
          minX: repairNode.position.x,
          minY: repairNode.position.y,
          maxX: repairNode.position.x + repairSize.w,
          maxY: repairNode.position.y + repairSize.h,
        },
      )
      const componentScreenRect = {
        left: componentBounds.minX * currentZoom + viewport.x,
        top: componentBounds.minY * currentZoom + viewport.y,
        right: componentBounds.maxX * currentZoom + viewport.x,
        bottom: componentBounds.maxY * currentZoom + viewport.y,
      }
      const comfortablyVisible = canvasRect
        ? componentScreenRect.left >= 96 &&
          componentScreenRect.top >= 96 &&
          componentScreenRect.right <= canvasRect.width - 96 &&
          componentScreenRect.bottom <= canvasRect.height - 120
        : false

      if (comfortablyVisible) return

      const compatibleNodes = nodes.filter((candidate) => {
        if (candidate.id === repairNode.id) return false
        return (
          validateWorkflowConnection({
            source: candidate,
            target: repairNode,
            edges,
          }).valid ||
          validateWorkflowConnection({
            source: repairNode,
            target: candidate,
            edges,
          }).valid
        )
      })
      const nearbyCandidates = compatibleNodes.length
        ? compatibleNodes
        : nodes
            .filter((candidate) => candidate.id !== repairNode.id)
            .sort((a, b) => {
              const aDistance =
                Math.abs(a.position.x - repairNode.position.x) +
                Math.abs(a.position.y - repairNode.position.y)
              const bDistance =
                Math.abs(b.position.x - repairNode.position.x) +
                Math.abs(b.position.y - repairNode.position.y)
              return aDistance - bDistance
            })
            .slice(0, 3)
      const boundsNodes = [
        ...(componentNodes.length ? componentNodes : [repairNode]),
        ...nearbyCandidates.slice(0, 5),
      ]
      const bounds = boundsNodes.reduce(
        (acc, node) => {
          const size = getMeasuredNodeSize(node)
          return {
            minX: Math.min(acc.minX, node.position.x),
            minY: Math.min(acc.minY, node.position.y),
            maxX: Math.max(acc.maxX, node.position.x + size.w),
            maxY: Math.max(acc.maxY, node.position.y + size.h),
          }
        },
        {
          minX: repairNode.position.x,
          minY: repairNode.position.y,
          maxX: repairNode.position.x + repairSize.w,
          maxY: repairNode.position.y + repairSize.h,
        },
      )
      if (!canvasRect) return

      const paddedBounds = {
        minX: bounds.minX - 80,
        minY: bounds.minY - 80,
        maxX: bounds.maxX + 80,
        maxY: bounds.maxY + 80,
      }
      const boundsWidth = Math.max(360, paddedBounds.maxX - paddedBounds.minX)
      const boundsHeight = Math.max(260, paddedBounds.maxY - paddedBounds.minY)
      const fitZoom = Math.min(
        canvasRect.width / boundsWidth,
        canvasRect.height / boundsHeight,
      )
      const targetZoom =
        currentZoom < 0.8
          ? currentZoom
          : Math.max(0.6, Math.min(0.7, fitZoom, currentZoom))
      const centerX = paddedBounds.minX + boundsWidth / 2
      const centerY = paddedBounds.minY + boundsHeight / 2

      reactFlow.setViewport(
        {
          x: canvasRect.width / 2 - centerX * targetZoom,
          y: canvasRect.height / 2 - centerY * targetZoom,
          zoom: targetZoom,
        },
        { duration: 350 },
      )
    },
    [edges, getMeasuredNodeSize, nodes, reactFlow],
  )
  const getRepairFieldKeys = useCallback(
    (nodeId: string, fieldKey: string) => {
      const node = nodes.find((item) => item.id === nodeId)
      const registryId =
        typeof (node?.data as any)?.__registryNodeId === 'string'
          ? String((node?.data as any).__registryNodeId)
          : node?.type
      const definition = registryId
        ? getWorkflowNodeDefinition(registryId)
        : null
      const fields = definition?.configFields ?? []
      const targetField = fields.find(
        (field) =>
          (field.key ?? field.id) === fieldKey || field.id === fieldKey,
      )
      if (!targetField?.repairGroup) return [fieldKey]
      const groupedKeys = fields
        .filter((field) => field.repairGroup === targetField.repairGroup)
        .map((field) => field.key ?? field.id)
      return groupedKeys.length ? groupedKeys : [fieldKey]
    },
    [nodes],
  )
  const editMappingInStepSettings = useCallback(
    (nodeId: string, fieldKey: string) => {
      const node = nodes.find((item) => item.id === nodeId)
      if (node) {
        const fieldKeys = getRepairFieldKeys(nodeId, fieldKey)
        selectNode(node.id)
        setRightCollapsed(false)
        setUserClosedInspector(false)
        setInspectorFieldFocus({
          nodeId,
          fieldKey,
          fieldKeys,
          requestId: Date.now(),
        })
        reactFlow.setCenter(node.position.x + 120, node.position.y + 80, {
          zoom: 0.9,
          duration: 350,
        })
      }
    },
    [getRepairFieldKeys, nodes, reactFlow, selectNode],
  )
  const focusDataFlowVariable = useCallback(
    (variable: WorkflowDataFlowVariable) => {
      const nodeIds = [
        variable.sourceNodeId,
        ...variable.consumers.map((consumer) => consumer.nodeId),
      ].filter((value): value is string => Boolean(value))
      if (!nodeIds.length) return
      setDataFlowHighlight({ variableKey: variable.key, nodeIds })
      const focusNodeId = variable.sourceNodeId ?? nodeIds[0]
      selectNode(focusNodeId)
      setRightCollapsed(false)
      setRightPeek(false)
      setUserClosedInspector(false)
      setInspectorViewRequest({
        tab: 'data',
        scrollTop: 0,
        requestId: Date.now(),
      })
      const node = nodes.find((item) => item.id === focusNodeId)
      if (node) {
        reactFlow.setCenter(node.position.x + 140, node.position.y + 90, {
          duration: 300,
          zoom: Math.max(0.7, reactFlow.getZoom()),
        })
      }
    },
    [nodes, reactFlow, selectNode],
  )
  const focusDataFlowConsumption = useCallback(
    (consumption: {
      nodeId: string
      fieldKey?: string
      sourceNodeId?: string
    }) => {
      setDataFlowHighlight({
        nodeIds: [consumption.sourceNodeId, consumption.nodeId].filter(
          (value): value is string => Boolean(value),
        ),
      })
      if (consumption.fieldKey) {
        editMappingInStepSettings(consumption.nodeId, consumption.fieldKey)
        return
      }
      focusValidationIssue({ nodeId: consumption.nodeId })
    },
    [editMappingInStepSettings, focusValidationIssue],
  )
  const viewDataFlowConsumption = useCallback(
    (consumption: { nodeId: string; sourceNodeId?: string }) => {
      setDataFlowHighlight({
        nodeIds: [consumption.sourceNodeId, consumption.nodeId].filter(
          (value): value is string => Boolean(value),
        ),
      })
      selectNode(consumption.nodeId)
      setRightCollapsed(false)
      setRightPeek(false)
      setUserClosedInspector(false)
      setInspectorViewRequest({
        tab: 'data',
        scrollTop: 0,
        requestId: Date.now(),
      })
      const node = nodes.find((item) => item.id === consumption.nodeId)
      if (node) {
        reactFlow.setCenter(node.position.x + 140, node.position.y + 90, {
          duration: 300,
          zoom: Math.max(0.7, reactFlow.getZoom()),
        })
      }
    },
    [nodes, reactFlow, selectNode],
  )
  const triggerRecommendationsForNode = useCallback((node?: RFNode | null) => {
    const registryId =
      typeof (node?.data as any)?.__registryNodeId === 'string'
        ? String((node?.data as any).__registryNodeId)
        : (node?.type ?? '')
    const label =
      `${registryId} ${(node?.data as any)?.label ?? ''}`.toLowerCase()
    if (label.includes('sms')) {
      return [
        'crm.trigger',
        'lead.created',
        'task.created',
        'service_request.submitted',
      ]
    }
    if (label.includes('email')) {
      return [
        'lead.created',
        'crm.trigger',
        'service_request.submitted',
        'task.completed',
      ]
    }
    if (label.includes('task')) {
      return [
        'lead.created',
        'opportunity.stage_changed',
        'crm.trigger',
        'task.created',
      ]
    }
    return [
      'lead.created',
      'crm.trigger',
      'service_request.submitted',
      'task.completed',
    ]
  }, [])
  const openTriggerRepair = useCallback(
    (nodeId?: string) => {
      const affectedNode = nodeId
        ? nodes.find((node) => node.id === nodeId)
        : null
      if (affectedNode) {
        focusValidationIssue({ nodeId: affectedNode.id })
      }
      const registryId =
        typeof (affectedNode?.data as any)?.__registryNodeId === 'string'
          ? String((affectedNode?.data as any).__registryNodeId)
          : (affectedNode?.type ?? '')
      const workflowKind =
        registryId === 'send.email'
          ? 'this email workflow'
          : registryId === 'send.sms'
            ? 'this SMS workflow'
            : registryId === 'task.create'
              ? 'this task workflow'
              : 'this workflow'
      openAddNodeModal(null, 'Triggers', {
        helperText: `Choose what should start ${workflowKind}.`,
        preferredNodeIds: triggerRecommendationsForNode(affectedNode),
        insertionContext: 'before',
        repairContext: affectedNode
          ? {
              type: 'missing-trigger',
              targetNodeId: affectedNode.id,
              insertion: 'before',
              preferredNodeIds: triggerRecommendationsForNode(affectedNode),
            }
          : null,
      })
    },
    [
      focusValidationIssue,
      nodes,
      openAddNodeModal,
      triggerRecommendationsForNode,
    ],
  )
  const openStepSettingsRepair = useCallback(
    (issue: { nodeId?: string; field?: string }) => {
      if (!issue.nodeId) return
      if (issue.field) {
        editMappingInStepSettings(issue.nodeId, issue.field)
        return
      }
      focusValidationIssue(issue)
      setRightCollapsed(false)
    },
    [editMappingInStepSettings, focusValidationIssue],
  )
  const openDataLinksRepair = useCallback(
    (issue: { nodeId?: string }) => {
      if (!issue.nodeId) return
      focusValidationIssue(issue)
      const incomingEdge = edges.find((edge) => edge.target === issue.nodeId)
      if (incomingEdge) setMappingEdgeId(incomingEdge.id)
    },
    [edges, focusValidationIssue],
  )
  const openNextStepRepair = useCallback(
    (nodeId?: string) => {
      if (nodeId) {
        focusValidationIssue({ nodeId })
        openAddNodeModal(nodeId, undefined, {
          helperText: 'Choose the next step to complete this workflow path.',
        })
        return
      }
      openAddNodeModal(null, undefined, {
        helperText: 'Choose the next step to complete this workflow path.',
      })
    },
    [focusValidationIssue, openAddNodeModal],
  )
  const workflowRepairContext = useMemo(
    () => ({
      nodes,
      edges,
      health: builderValidation.healthReport,
    }),
    [builderValidation.healthReport, edges, nodes],
  )
  const healthIssueById = useMemo(() => {
    const entries = [
      ...builderValidation.healthReport.errors,
      ...builderValidation.healthReport.warnings,
      ...builderValidation.healthReport.suggestions,
    ]
    return new Map(entries.map((issue) => [issue.id, issue]))
  }, [builderValidation.healthReport])
  const executeWorkflowRepairAction = useCallback(
    (repair: WorkflowRepairAction) => {
      if (repair.actionType === 'connect_nodes' && repair.targetNodeId) {
        const repairNode = nodes.find((node) => node.id === repair.targetNodeId)
        const nextMode: ConnectionRepairMode = {
          nodeId: repair.targetNodeId,
          issueId: repair.issueId,
          label: getBuilderNodeLabel(repairNode),
          restore: {
            wasInspectorOpen: effectiveInspectorOpen,
            rightCollapsed,
            rightPeek,
            userClosedInspector,
            selectedNodeId: selectedNodeId ?? null,
            tab: inspectorViewRef.current.tab,
            scrollTop: inspectorViewRef.current.scrollTop,
          },
        }
        setConnectionRepairMode(nextMode)
        setRightCollapsed(true)
        setRightPeek(false)
        setUserClosedInspector(true)
        userClosedInspectorAtRef.current = Date.now()
        if (repairNode) {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() =>
              focusConnectionRepairArea(repairNode),
            )
          })
        }
        closeContextMenu()
        setEdgeContextMenu((current) => ({ ...current, open: false }))
        setConnectionWarning(null)
        document.body.style.cursor = ''
        return
      }
      const result = applyWorkflowRepair(repair, workflowRepairContext)
      if (!result.ok) return
      const needsConfirmation = result.effects.find(
        (effect) => effect.type === 'confirm',
      )
      if (needsConfirmation?.type === 'confirm') {
        const confirmed = window.confirm(
          `${needsConfirmation.title}\n\n${needsConfirmation.description}`,
        )
        if (!confirmed) return
      }
      for (const effect of result.effects) {
        if (effect.type === 'confirm') continue
        if (effect.type === 'focus_node') {
          focusValidationIssue({ nodeId: effect.nodeId })
        } else if (effect.type === 'focus_field') {
          editMappingInStepSettings(effect.nodeId, effect.fieldKey)
        } else if (effect.type === 'open_data_mapping') {
          if (effect.nodeId) openDataLinksRepair({ nodeId: effect.nodeId })
          else if (effect.edgeId) setMappingEdgeId(effect.edgeId)
        } else if (effect.type === 'open_add_node') {
          openAddNodeModal(effect.sourceNodeId ?? null, effect.category, {
            helperText: repair.description,
            preferredNodeIds: effect.preferredNodeIds,
            repairContext: effect.repairContext as
              | TriggerRepairContext
              | null
              | undefined,
            insertionContext: repair.suggestedPlacement ?? undefined,
          })
        } else if (effect.type === 'focus_edges') {
          setEdges((currentEdges) =>
            currentEdges.map((edge) => ({
              ...edge,
              selected: effect.edgeIds.includes(edge.id),
            })),
          )
          if (
            repair.actionType === 'remove_connection' &&
            repair.canAutoApply
          ) {
            commitHistory()
            setEdges((currentEdges) =>
              currentEdges.filter((edge) => !effect.edgeIds.includes(edge.id)),
            )
          }
        }
      }
      resetPointerInteractionState()
    },
    [
      closeContextMenu,
      commitHistory,
      editMappingInStepSettings,
      effectiveInspectorOpen,
      focusConnectionRepairArea,
      focusValidationIssue,
      nodes,
      openAddNodeModal,
      openDataLinksRepair,
      resetPointerInteractionState,
      rightCollapsed,
      rightPeek,
      selectedNodeId,
      setEdges,
      userClosedInspector,
      workflowRepairContext,
    ],
  )
  const handleValidatedConnect = useCallback(
    (connection: Connection) => {
      const result = resolveNodeBodyConnection({
        nodes,
        edges,
        sourceId: connection.source,
        targetId: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        explicitTargetHandle: connection.targetHandle ?? null,
      })
      if (!result.valid) {
        showConnectionWarning(
          result.reason ?? 'This node does not accept this connection.',
        )
        return
      }
      const resolvedConnection = result.connection
      const source = nodes.find((node) => node.id === resolvedConnection.source)
      const target = nodes.find((node) => node.id === resolvedConnection.target)
      const edgeId = `edge-${resolvedConnection.source}-${resolvedConnection.target}-${Date.now()}`
      const mappings =
        source && target ? buildDefaultMappings({ source, target }) : []
      commitHistory()
      setEdges((currentEdges) =>
        addEdge(
          {
            ...resolvedConnection,
            id: edgeId,
            type: 'default',
            data: { mappings },
          },
          currentEdges,
        ),
      )
      setMappingEdgeId(edgeId)
      activeConnectionStartRef.current = null
      document.body.style.cursor = ''
    },
    [commitHistory, edges, nodes, setEdges, showConnectionWarning],
  )
  const handleConnectionStart = useCallback((_: unknown, params: any) => {
    activeConnectionStartRef.current = {
      sourceId: params?.nodeId ?? params?.node?.id ?? null,
      sourceHandle: params?.handleId ?? null,
      handleType: params?.handleType ?? null,
    }
  }, [])
  const handleConnectionEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState?: any) => {
      const wasValidHandleDrop = Boolean(connectionState?.isValid)
      if (wasValidHandleDrop) {
        activeConnectionStartRef.current = null
        document.body.style.cursor = ''
        return
      }

      const start = activeConnectionStartRef.current
      activeConnectionStartRef.current = null
      if (!start?.sourceId) return

      const point =
        'changedTouches' in event && event.changedTouches.length
          ? {
              x: event.changedTouches[0].clientX,
              y: event.changedTouches[0].clientY,
            }
          : {
              x: (event as MouseEvent).clientX,
              y: (event as MouseEvent).clientY,
            }
      const element = document.elementFromPoint(
        point.x,
        point.y,
      ) as HTMLElement | null
      const nodeElement = element?.closest(
        '.react-flow__node[data-id]',
      ) as HTMLElement | null
      const targetId = nodeElement?.getAttribute('data-id')
      if (!targetId) {
        const sourceNode = nodes.find((node) => node.id === start.sourceId)
        const dropPosition = reactFlow.screenToFlowPosition(point)
        if (sourceNode && start.handleType === 'target') {
          const repairTarget = resolveMissingTriggerRepairTarget({
            nodes,
            edges,
            targetNodeId: sourceNode.id,
          })

          if (repairTarget.status === 'already-triggered') {
            showConnectionWarning('This workflow already has a trigger path.')
            document.body.style.cursor = ''
            return
          }

          const targetNode = nodes.find(
            (node) => node.id === repairTarget.targetNodeId,
          )
          if (repairTarget.status !== 'insert' || !targetNode) {
            showConnectionWarning(
              'Choose a workflow root before adding a trigger.',
            )
            document.body.style.cursor = ''
            return
          }

          openAddNodeModal(null, 'Triggers', {
            helperText: `Choose what should start ${getBuilderNodeLabel(targetNode)}.`,
            preferredNodeIds: triggerRecommendationsForNode(targetNode),
            repairContext: {
              type: 'missing-trigger',
              targetNodeId: targetNode.id,
              insertion: 'before',
              preferredNodeIds: triggerRecommendationsForNode(targetNode),
            },
            insertionContext: 'before',
            position: dropPosition,
          })
          document.body.style.cursor = ''
          return
        }
        const outgoingEdges = edges.filter(
          (edge) => edge.source === start.sourceId,
        )
        const definitionId =
          typeof (sourceNode?.data as any)?.__registryNodeId === 'string'
            ? ((sourceNode?.data as any).__registryNodeId as string)
            : sourceNode?.type
        const definition = definitionId
          ? getWorkflowNodeDefinition(definitionId)
          : null
        if (
          sourceNode &&
          definition?.acceptsMultipleOutputs === false &&
          !definition?.allowsMultipleOutgoing &&
          outgoingEdges.length > 0
        ) {
          showConnectionWarning(
            'This output already has a connected step. Replace it or use a branch-capable output.',
          )
          document.body.style.cursor = ''
          return
        }
        openAddNodeModal(start.sourceId, undefined, {
          helperText: 'Choose the step to place at the dropped connection.',
          sourceHandle: start.sourceHandle,
          position: dropPosition,
        })
        document.body.style.cursor = ''
        return
      }

      const result = resolveNodeBodyConnection({
        nodes,
        edges,
        sourceId: start.sourceId,
        targetId,
        sourceHandle: start.sourceHandle,
      })
      if (!result.valid) {
        showConnectionWarning(result.reason)
        document.body.style.cursor = ''
        return
      }

      handleValidatedConnect(result.connection)
      document.body.style.cursor = ''
    },
    [
      edges,
      handleValidatedConnect,
      nodes,
      openAddNodeModal,
      reactFlow,
      showConnectionWarning,
      triggerRecommendationsForNode,
    ],
  )
  const mappingEdge = useMemo(
    () => edges.find((edge) => edge.id === mappingEdgeId) ?? null,
    [edges, mappingEdgeId],
  )
  const mappingSourceNode = useMemo(
    () => nodes.find((node) => node.id === mappingEdge?.source) ?? null,
    [mappingEdge?.source, nodes],
  )
  const mappingTargetNode = useMemo(
    () => nodes.find((node) => node.id === mappingEdge?.target) ?? null,
    [mappingEdge?.target, nodes],
  )
  const edgeContextEdge = useMemo(
    () => edges.find((edge) => edge.id === edgeContextMenu.edgeId) ?? null,
    [edgeContextMenu.edgeId, edges],
  )
  const edgeContextSourceNode = useMemo(
    () => nodes.find((node) => node.id === edgeContextEdge?.source) ?? null,
    [edgeContextEdge?.source, nodes],
  )
  const edgeContextTargetNode = useMemo(
    () => nodes.find((node) => node.id === edgeContextEdge?.target) ?? null,
    [edgeContextEdge?.target, nodes],
  )
  const mappingIssues = useMemo(
    () =>
      mappingEdge
        ? validateDataMappings({
            edge: mappingEdge,
            source: mappingSourceNode ?? undefined,
            target: mappingTargetNode ?? undefined,
            nodes,
            edges,
          })
        : [],
    [edges, mappingEdge, mappingSourceNode, mappingTargetNode, nodes],
  )
  const workflowName =
    automation?.name?.trim() ||
    builderWorkflow.name?.trim() ||
    'Untitled Workflow'
  const workflowStatusDisplay = useMemo(() => {
    const raw = automation?.status?.toLowerCase().trim()
    if (raw === 'active' || raw === 'running' || raw === 'enabled') {
      return {
        label: 'Active',
        className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
      }
    }
    if (raw === 'paused') {
      return {
        label: 'Paused',
        className: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
      }
    }
    if (raw === 'inactive' || raw === 'disabled' || raw === 'archived') {
      return {
        label: 'Inactive',
        className: 'border-slate-700 bg-slate-900/70 text-slate-300',
      }
    }
    if (
      raw === 'error' ||
      raw === 'failed' ||
      raw === 'broken config' ||
      raw === 'broken_config'
    ) {
      return {
        label: 'Error',
        className: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
      }
    }
    return {
      label: 'Draft',
      className: 'border-slate-800 bg-slate-900/70 text-slate-300',
    }
  }, [automation?.status])
  const hasUnsavedBuilderChanges =
    savingStatus === 'dirty' ||
    savingStatus === 'saving' ||
    savingStatus === 'error'
  const saveStateDisplay = useMemo(() => {
    if (savingStatus === 'saving') {
      return {
        label: '● Saving...',
        className: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
      }
    }
    if (savingStatus === 'dirty' || savingStatus === 'error') {
      return {
        label: '● Unsaved changes',
        className: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
      }
    }
    return {
      label: '● Saved',
      className: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    }
  }, [savingStatus])

  const exitBuilderNow = useCallback(
    (target: 'previous' | 'automations' = 'previous') => {
      if (target === 'automations') {
        router.push(`/dashboard/${workspaceId}/automations`)
        return
      }
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
        return
      }
      router.push(`/dashboard/${workspaceId}`)
    },
    [router, workspaceId],
  )

  const requestExitBuilder = useCallback(
    (target: 'previous' | 'automations' = 'previous') => {
      if (hasUnsavedBuilderChanges) {
        setExitDialogOpen(true)
        return
      }
      exitBuilderNow(target)
    },
    [exitBuilderNow, hasUnsavedBuilderChanges],
  )

  const clearLocalPreviewDraft = useCallback(() => {
    try {
      removeBuilderSessionStorage(draftStorageKey)
    } catch {
      // Local preview drafts are best-effort only.
    }
  }, [draftStorageKey])

  const saveAndExitBuilder = useCallback(async () => {
    setExitSaving(true)
    try {
      await saveNow()
      clearLocalPreviewDraft()
      setExitDialogOpen(false)
      exitBuilderNow('automations')
    } finally {
      setExitSaving(false)
    }
  }, [clearLocalPreviewDraft, exitBuilderNow, saveNow])

  const reportUnknownNodes = useCallback(() => {
    if (process.env.NODE_ENV === 'production') return
    const missingSchema = new Set<string>()
    const missingRenderer = new Set<string>()
    nodes.forEach((n) => {
      const schema = getNodeSchema(n.type as BuilderNodeType)
      if (schema === UnknownNodeSchema) missingSchema.add(n.type as string)
      if (!nodeTypes[n.type as any]) missingRenderer.add(n.type as string)
    })
    console.table(
      Array.from(
        new Set([
          ...Array.from(missingSchema).map((type) => ({
            type,
            issue: 'missing-schema',
          })),
          ...Array.from(missingRenderer).map((type) => ({
            type,
            issue: 'missing-renderer',
          })),
        ]),
      ),
    )
    alert(
      `Unknown nodes: ${missingSchema.size} missing schema, ${missingRenderer.size} missing renderer`,
    )
  }, [nodes])

  /* --------------------------------
    🔼 ADDITION: Command palette wiring (Cmd+K)
  -------------------------------- */
  const [commandOpen, setCommandOpen] = useState(false)

  const toggleCommandPalette = useCallback(() => {
    setCommandOpen((v) => !v)
  }, [])

  const commands = useMemo<PaletteCommand[]>(() => {
    return [
      {
        id: 'hud.toggle',
        label: 'Canvas Controls: Toggle visibility',
        hint: isCanvasFullscreen
          ? 'Fullscreen auto-hide respected'
          : 'Show/Hide',
        icon: MousePointerClick,
        run: () => setHudVisible((v) => !v),
      },
      {
        id: 'hud.density.compact',
        label: 'Canvas Controls: Compact',
        icon: Layout,
        run: () => setBuilderControlMode('compact'),
      },
      {
        id: 'hud.density.standard',
        label: 'Canvas Controls: Standard',
        icon: Layout,
        run: () => setBuilderControlMode('standard'),
      },
      {
        id: 'hud.menu',
        label: 'Canvas Controls: Open settings',
        icon: Sparkles,
        run: () => setHudMenuOpen(true),
      },
      {
        id: 'hud.dock.toggle',
        label: 'Canvas Controls: Toggle dock mode',
        icon: PanelRight,
        run: () =>
          setHudDockMode((m) =>
            m === 'floating' ? 'dock-top-right' : 'floating',
          ),
      },
      {
        id: 'hud.physics.toggle',
        label: `Canvas Controls: Motion assist → ${hudPhysicsEnabled ? 'Off' : 'On'}`,
        icon: Layout,
        run: () => setHudPhysicsEnabled((v) => !v),
      },
      {
        id: 'hud.move.tl',
        label: 'Canvas Controls: Move to Top-Left',
        icon: PanelLeft,
        run: () => setHudDockMode('dock-top-left'),
      },
      {
        id: 'hud.move.tr',
        label: 'Canvas Controls: Move to Top-Right',
        icon: PanelRight,
        run: () => setHudDockMode('dock-top-right'),
      },
      {
        id: 'hud.move.bl',
        label: 'Canvas Controls: Move to Bottom-Left',
        icon: PanelLeft,
        run: () => setHudDockMode('dock-bottom-left'),
      },
      {
        id: 'hud.move.br',
        label: 'Canvas Controls: Move to Bottom-Right',
        icon: PanelRight,
        run: () => setHudDockMode('dock-bottom-right'),
      },
      {
        id: 'hud.reset',
        label: 'Canvas Controls: Reset position',
        icon: Grid3X3,
        run: () => {
          const bounds = getHudBounds()
          setHudDockMode('floating')
          setBuilderControlMode('compact')
          setHudPos({ x: bounds.minX, y: bounds.minY })
          setRenderHudPos({ x: bounds.minX, y: bounds.minY })
        },
      },
      {
        id: 'hud.mini.toggle',
        label: `Canvas Controls: Mini mode → ${hudMiniMode ? 'Off' : 'On'}`,
        icon: Minimize2,
        run: () => setHudMiniMode((v) => !v),
      },
      {
        id: 'hud.visibility.auto',
        label: 'Canvas Controls: Visibility → Auto',
        icon: MousePointerClick,
        run: () => setHudVisibilityMode('auto'),
      },
      {
        id: 'hud.visibility.always',
        label: 'Canvas Controls: Visibility → Always On',
        icon: MousePointerClick,
        run: () => setHudVisibilityMode('always'),
      },
      {
        id: 'hud.visibility.hidden',
        label: 'Canvas Controls: Visibility → Hidden',
        icon: MousePointerClick,
        run: () => setHudVisibilityMode('hidden'),
      },
      {
        id: 'hud.hints.toggle',
        label: `Canvas Controls: Suggestions → ${hudHintsEnabled ? 'Off' : 'On'}`,
        icon: Sparkles,
        run: () => setHudHintsEnabled((v) => !v),
      },
      {
        id: 'hud.hints.show',
        label: 'Canvas Controls: Show suggested actions',
        icon: MousePointerClick,
        run: () => {
          if (hudSuggestions.length) setHudHintPanelOpen(true)
        },
      },
      {
        id: 'hud.hints.reset',
        label: 'Canvas Controls: Reset adaptive layout',
        icon: Layout,
        run: () => {
          setBuilderControlMode('standard')
          setHudMiniMode(false)
          setHudHintsDismissed(false)
        },
      },
      {
        id: 'hud.hints.explain',
        label: 'Canvas Controls: Explain current state',
        icon: Focus,
        run: () => {
          const msg = `Mode: ${hudDockMode}, Density: ${hudDensity}, Mini: ${hudMiniMode ? 'on' : 'off'}`
          window.alert(msg)
        },
      },
      {
        id: 'canvas.focus',
        label: 'Canvas: Focus selection/all',
        icon: Focus,
        run: () => focusCanvas(),
      },
      {
        id: 'canvas.fullscreen',
        label: 'Canvas: Toggle fullscreen',
        icon: Maximize2,
        run: () => toggleCanvasFullscreen(),
      },
      {
        id: 'panel.left',
        label: 'Library: Toggle',
        icon: PanelLeft,
        run: () => setLeftCollapsed((v) => !v),
      },
      {
        id: 'panel.right',
        label: 'Step Settings: Toggle',
        icon: PanelRight,
        run: () =>
          setRightCollapsed((v) => {
            const next = !v
            setUserClosedInspector(next)
            userClosedInspectorAtRef.current = next ? Date.now() : 0
            if (!next) setUserClosedInspector(false)
            return next
          }),
      },
      {
        id: 'inspector.pin',
        label: `Step Settings: ${inspectorPinned ? 'Unpin (Pinned)' : 'Pin'}`,
        icon: PanelRight,
        run: () => setInspectorPinned((v) => !v),
      },
      {
        id: 'inspector.follow',
        label: `Step Settings: Follow selected step (${inspectorFollowsSelection ? 'On •' : 'Off'})`,
        icon: PanelRight,
        run: () => setInspectorFollowsSelection((v) => !v),
      },
      {
        id: 'inspector.preset.compact',
        label: `Step Settings: Width → Compact${inspectorWidthPreset === 'compact' ? ' • Active' : ''}`,
        icon: Layout,
        hint: `Current width: ${rightPanelWidth}px`,
        run: () => setInspectorWidthPreset(320),
      },
      {
        id: 'inspector.preset.standard',
        label: `Step Settings: Width → Standard${inspectorWidthPreset === 'standard' ? ' • Active' : ''}`,
        icon: Layout,
        hint: `Current width: ${rightPanelWidth}px`,
        run: () => setInspectorWidthPreset(380),
      },
      {
        id: 'inspector.preset.wide',
        label: `Step Settings: Width → Wide${inspectorWidthPreset === 'wide' ? ' • Active' : ''}`,
        icon: Layout,
        hint: `Current width: ${rightPanelWidth}px`,
        run: () => setInspectorWidthPreset(460),
      },
      {
        id: 'canvas.mode.blank',
        label: 'Canvas: Background → Blank',
        icon: Grid3X3,
        run: () => setCanvasMode('blank'),
      },
      {
        id: 'canvas.mode.dots',
        label: 'Canvas: Background → Dots',
        icon: Grid3X3,
        run: () => setCanvasMode('dots'),
      },
      {
        id: 'canvas.mode.grid',
        label: 'Canvas: Background → Grid',
        icon: Grid3X3,
        run: () => setCanvasMode('grid'),
      },
      {
        id: 'snap.toggle',
        label: `Snap to grid: Toggle (${snapToGrid ? 'On' : 'Off'})`,
        icon: Grid3X3,
        run: () => setSnapToGrid((v) => !v),
      },
      {
        id: 'layout.autolayout',
        label: 'Layout: Auto-layout',
        icon: Layout,
        run: () => applyAutoLayoutWithHistory(),
      },
      {
        id: 'node.add',
        label: selectedNodeId ? 'Add step after selection' : 'Add step',
        hint: selectedNodeId
          ? 'Search steps and connect after the selected step'
          : 'Search steps and add near the viewport center',
        icon: Zap,
        run: () => {
          setCommandOpen(false)
          openAddNodeModal(selectedNodeId)
        },
      },
      {
        id: 'run.simulation',
        label: 'Run: Simulation',
        icon: Zap,
        run: () => runSimulation(),
      },
      {
        id: 'debug.unknownNodes',
        label: 'Debug: Report unknown node types',
        icon: AlertTriangle,
        run: () => reportUnknownNodes(),
      },
    ]
  }, [
    applyAutoLayoutWithHistory,
    focusCanvas,
    getHudBounds,
    hudDensity,
    hudDockMode,
    hudHintsEnabled,
    hudMiniMode,
    hudPhysicsEnabled,
    hudSuggestions.length,
    hudVisibilityMode,
    isCanvasFullscreen,
    applyBuilderDensity,
    setHudDockMode,
    setHudHintsDismissed,
    setHudHintsEnabled,
    setHudHintPanelOpen,
    setHudMiniMode,
    setHudVisibilityMode,
    setHudPos,
    setRenderHudPos,
    inspectorPinned,
    setInspectorPinned,
    setInspectorWidthPreset,
    snapToGrid,
    toggleCanvasFullscreen,
    reportUnknownNodes,
    inspectorPinned,
    setInspectorPinned,
    setInspectorWidthPreset,
    openAddNodeModal,
    selectedNodeId,
  ])

  /* --------------------------------
    Keyboard Shortcuts
    - Cmd/Ctrl + K : command palette
    - Shift+F : toggle fullscreen (browser + canvas)
    - [ / ]   : toggle left / right panel
    - F       : focus selection/all
    - Cmd/Ctrl+Enter : run simulation
    - Esc     : exit browser fullscreen + canvas fullscreen
    - ?       : toggle shortcut help modal
  -------------------------------- */
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const resetAfterShortcut = () => {
        resetPointerInteractionState()
        if (!e.shiftKey && !shiftBoxSelectionActiveRef.current) {
          setIsShiftSelectMode(false)
        }
      }
      const ignoreRepeatedGraphShortcut = () => {
        if (!e.repeat) return false
        e.preventDefault()
        resetAfterShortcut()
        return true
      }

      if (exitDialogOpen) return

      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
        return
      }

      if (mod && key === 's') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        saveNow()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'z') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        if (e.shiftKey) redoBuilderEdit()
        else undoBuilderEdit()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'y') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        redoBuilderEdit()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'c') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        copySelectedGraph()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'x') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        cutSelectedGraph()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'v') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        pasteClipboardGraph()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'd') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        duplicateSelectedNodes()
        resetAfterShortcut()
        return
      }

      if (mod && key === 'a') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        selectAllGraph()
        resetAfterShortcut()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          selectedIdsRef.current.length ||
          selectedEdgeIdsRef.current.length
        ) {
          e.preventDefault()
          if (ignoreRepeatedGraphShortcut()) return
          deleteSelectedNodes()
          resetAfterShortcut()
        }
        return
      }

      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        const amount = e.shiftKey ? 40 : 10
        const dx =
          e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0
        const dy =
          e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0
        if (selectedIdsRef.current.length) {
          e.preventDefault()
          nudgeSelectedNodes(dx, dy)
          resetAfterShortcut()
        }
        return
      }

      if (mod && key === 'g') {
        e.preventDefault()
        if (ignoreRepeatedGraphShortcut()) return
        groupSelectedNodes()
        resetAfterShortcut()
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShortcutHelpOpen((v) => !v)
        return
      }

      if (!mod && !e.shiftKey) {
        switch (key) {
          case 'a':
            e.preventDefault()
            if (ignoreRepeatedGraphShortcut()) return
            openAddNodeModal(selectedNodeId)
            resetAfterShortcut()
            return
        }
      }

      if (e.key === 'Escape') {
        if (connectionRepairMode) {
          exitConnectionRepairMode(connectionRepairMode)
          return
        }
        if (activeBuilderPanel) {
          setActiveBuilderPanel(null)
          return
        }
        if (commandOpen) {
          setCommandOpen(false)
          return
        }
        if (shortcutHelpOpen) {
          setShortcutHelpOpen(false)
          return
        }
        if (ctxMenu.open) {
          closeContextMenu()
          return
        }
        if (edgeContextMenu.open) {
          setEdgeContextMenu((current) => ({ ...current, open: false }))
          return
        }
        if (
          selectedIdsRef.current.length ||
          selectedEdgeIdsRef.current.length
        ) {
          clearEditorSelection()
          return
        }
        if (document.fullscreenElement) exitBrowserFullscreen()
        if (isCanvasFullscreen) setIsCanvasFullscreen(false)
        if (!document.fullscreenElement && !isCanvasFullscreen) {
          requestExitBuilder()
        }
        return
      }

      if (key === 'f' && e.shiftKey) {
        e.preventDefault()
        toggleCanvasFullscreen()
        resetAfterShortcut()
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        setLeftCollapsed((v) => !v)
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        setRightCollapsed((v) => {
          const next = !v
          setUserClosedInspector(next)
          userClosedInspectorAtRef.current = next ? Date.now() : 0
          if (!next) setUserClosedInspector(false)
          return next
        })
        return
      }

      if (key === 'f' && !e.shiftKey) {
        e.preventDefault()
        focusCanvas()
        resetAfterShortcut()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    focusCanvas,
    toggleCanvasFullscreen,
    exitBrowserFullscreen,
    isCanvasFullscreen,
    toggleCommandPalette,
    commandOpen,
    shortcutHelpOpen,
    groupSelectedNodes,
    openAddNodeModal,
    activeBuilderPanel,
    clearEditorSelection,
    closeContextMenu,
    connectionRepairMode,
    copySelectedGraph,
    ctxMenu.open,
    cutSelectedGraph,
    deleteSelectedNodes,
    duplicateSelectedNodes,
    edgeContextMenu.open,
    exitDialogOpen,
    nudgeSelectedNodes,
    pasteClipboardGraph,
    requestExitBuilder,
    exitConnectionRepairMode,
    resetPointerInteractionState,
    saveNow,
    selectAllGraph,
    selectedNodeId,
    undoBuilderEdit,
    redoBuilderEdit,
  ])

  const [guides, setGuides] = useState<GuideLines>({ active: false })
  const [ghost, setGhost] = useState<GhostState | null>(null)
  const clearGuides = useCallback(() => setGuides({ active: false }), [])

  const flowToCanvasPx = useCallback(
    (p: { x: number; y: number }) => {
      return {
        x: p.x * viewport.zoom + viewport.x,
        y: p.y * viewport.zoom + viewport.y,
      }
    },
    [viewport.x, viewport.y, viewport.zoom],
  )

  const computeMagnetAndGuides = useCallback(
    (type: BuilderNodeType, topLeft: { x: number; y: number }) => {
      const THRESHOLD_PX = 10
      const thresholdFlow = THRESHOLD_PX / Math.max(0.0001, viewport.zoom)

      const size = getNodeSize(type)
      const center = {
        x: topLeft.x + size.w / 2,
        y: topLeft.y + size.h / 2,
      }

      let bestV: { x: number; dx: number } | null = null
      let bestH: { y: number; dy: number } | null = null

      for (const n of nodes) {
        const nType = n.type as BuilderNodeType
        const nSize = nType
          ? getNodeSize(nType)
          : { w: DEFAULT_NODE_WIDTH, h: DEFAULT_NODE_HEIGHT }
        const nCenter = {
          x: n.position.x + nSize.w / 2,
          y: n.position.y + nSize.h / 2,
        }

        const dx = nCenter.x - center.x
        const dy = nCenter.y - center.y

        if (Math.abs(dx) <= thresholdFlow) {
          if (!bestV || Math.abs(dx) < Math.abs(bestV.dx))
            bestV = { x: nCenter.x, dx }
        }
        if (Math.abs(dy) <= thresholdFlow) {
          if (!bestH || Math.abs(dy) < Math.abs(bestH.dy))
            bestH = { y: nCenter.y, dy }
        }
      }

      const snapped = { ...topLeft }
      if (bestV) snapped.x = snapped.x + bestV.dx
      if (bestH) snapped.y = snapped.y + bestH.dy

      const finalPos = snapToGridPos(snapped)

      setGuides({
        active: !!(bestV || bestH),
        v: bestV ? bestV.x : undefined,
        h: bestH ? bestH.y : undefined,
      })

      return finalPos
    },
    [nodes, viewport.zoom, getNodeSize, snapToGridPos],
  )

  const createNodeDataFromRegistry = useCallback(
    (type: BuilderNodeType, registryNodeId?: string) => {
      const validated = validateNodeData(type, getDefaultNodeData(type))
      if (!validated.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Workflow Builder] Failed to create node data from builder schema.',
            { type, registryNodeId, errors: validated.errors },
          )
        }
        return null
      }

      const definition = registryNodeId
        ? getWorkflowNodeDefinition(registryNodeId)
        : getWorkflowNodeDefinition(type)
      const registryDefaults = Object.fromEntries(
        (definition?.configFields ?? [])
          .filter((field) => field.defaultValue !== undefined)
          .map((field) => [field.key ?? field.id, field.defaultValue]),
      )

      return {
        ...validated.parsed,
        ...registryDefaults,
        label: definition?.label ?? validated.parsed.label,
        description: definition?.description ?? validated.parsed.description,
        __iconKey: definition?.iconKey,
        __registryNodeId: definition?.id,
      }
    },
    [],
  )

  const findOpenPositionBeforeNode = useCallback(
    (
      type: BuilderNodeType,
      targetNode: RFNode,
      candidateNodes: RFNode[] = nodes,
    ) => {
      const size = getNodeSize(type)
      const targetSize = getMeasuredNodeSize(targetNode)
      const horizontalGap = Math.max(
        WORKFLOW_LAYOUT_SPACING.horizontalGap,
        targetSize.w + 96,
      )
      const verticalGap = Math.max(
        WORKFLOW_LAYOUT_SPACING.verticalGap,
        size.h + 48,
      )
      const baseX = targetNode.position.x - horizontalGap
      const baseY = targetNode.position.y
      const offsets = [
        0,
        -verticalGap,
        verticalGap,
        -verticalGap * 2,
        verticalGap * 2,
        -verticalGap * 3,
        verticalGap * 3,
      ]

      const overlaps = (position: { x: number; y: number }) => {
        const rect = {
          left: position.x,
          right: position.x + size.w,
          top: position.y,
          bottom: position.y + size.h,
        }
        return candidateNodes.some((node) => {
          const nodeSize = getMeasuredNodeSize(node)
          const nodeRect = {
            left: node.position.x,
            right: node.position.x + nodeSize.w,
            top: node.position.y,
            bottom: node.position.y + nodeSize.h,
          }
          return (
            rect.left < nodeRect.right + 24 &&
            rect.right + 24 > nodeRect.left &&
            rect.top < nodeRect.bottom + 24 &&
            rect.bottom + 24 > nodeRect.top
          )
        })
      }

      for (const yOffset of offsets) {
        const candidate = snapToGridPos({ x: baseX, y: baseY + yOffset })
        if (!overlaps(candidate)) return candidate
      }

      let fallbackX = baseX - horizontalGap
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = snapToGridPos({ x: fallbackX, y: baseY })
        if (!overlaps(candidate)) return candidate
        fallbackX -= horizontalGap
      }

      return snapToGridPos({ x: fallbackX, y: baseY })
    },
    [getMeasuredNodeSize, getNodeSize, nodes, snapToGridPos],
  )

  const addNodeFromModal = useCallback(
    (type: BuilderNodeType, registryNodeId?: string) => {
      if (!NODE_DEFINITIONS[type] || !NODE_SCHEMA_MAP[type]) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Workflow Builder] Cannot add node because the builder type is not registered.',
            { type, registryNodeId },
          )
        }
        return
      }

      const sourceNode = addNodeSourceId
        ? nodes.find((node) => node.id === addNodeSourceId)
        : null
      const size = getNodeSize(type)
      const sourceSize = sourceNode ? getMeasuredNodeSize(sourceNode) : null

      let position: { x: number; y: number }
      if (sourceNode && addNodePlacementCenter) {
        position = {
          x: addNodePlacementCenter.x - size.w / 2,
          y: addNodePlacementCenter.y - size.h / 2,
        }
      } else if (sourceNode && sourceSize) {
        const outgoingTargets = edges
          .filter((edge) => edge.source === sourceNode.id)
          .map((edge) => nodes.find((node) => node.id === edge.target))
          .filter(Boolean) as RFNode[]
        const baseX =
          sourceNode.position.x +
          Math.max(sourceSize.w + 96, WORKFLOW_LAYOUT_SPACING.horizontalGap)
        const childX = outgoingTargets.length
          ? Math.max(baseX, ...outgoingTargets.map((node) => node.position.x))
          : baseX
        const occupied = new Set(
          nodes
            .filter((node) => node.id !== sourceNode.id)
            .map(
              (node) =>
                `${Math.round(node.position.x / 16)}:${Math.round(node.position.y / 16)}`,
            ),
        )
        const verticalStep = WORKFLOW_LAYOUT_SPACING.verticalGap
        let slot = outgoingTargets.length
        let nextY =
          outgoingTargets.length === 0
            ? sourceNode.position.y
            : sourceNode.position.y +
              (slot % 2 === 1 ? 1 : -1) * Math.ceil(slot / 2) * verticalStep

        while (
          occupied.has(`${Math.round(childX / 16)}:${Math.round(nextY / 16)}`)
        ) {
          slot += 1
          nextY =
            sourceNode.position.y +
            (slot % 2 === 1 ? 1 : -1) * Math.ceil(slot / 2) * verticalStep
        }

        position = { x: childX, y: nextY }
      } else {
        const vp = reactFlow.getViewport()
        position = {
          x: -vp.x / vp.zoom + window.innerWidth / 2 / vp.zoom - size.w / 2,
          y: -vp.y / vp.zoom + window.innerHeight / 2 / vp.zoom - size.h / 2,
        }
      }

      const nodeData = createNodeDataFromRegistry(type, registryNodeId)
      if (!nodeData) return

      const id = crypto.randomUUID()

      if (addNodeRepairContext?.type === 'missing-trigger') {
        const repairTarget = resolveMissingTriggerRepairTarget({
          nodes,
          edges,
          targetNodeId: addNodeRepairContext.targetNodeId,
        })

        if (repairTarget.status === 'already-triggered') {
          showConnectionWarning('This workflow already has a trigger path.')
          closeAddNodeModal()
          return
        }

        const targetNode = nodes.find(
          (node) => node.id === repairTarget.targetNodeId,
        )
        if (repairTarget.status !== 'insert' || !targetNode) {
          showConnectionWarning('Choose where this trigger should connect.')
          closeAddNodeModal()
          return
        }

        const newNode: RFNode = {
          id,
          type,
          position: findOpenPositionBeforeNode(type, targetNode),
          data: nodeData,
          selected: true,
        }
        const candidateNodes = [...nodes, newNode]
        const edgeSafety = canCreateTriggerRepairEdge({
          nodes: candidateNodes,
          edges,
          sourceNodeId: id,
          targetNodeId: targetNode.id,
        })
        if (!edgeSafety.valid) {
          showConnectionWarning(
            edgeSafety.reason ??
              'This trigger cannot be connected automatically.',
          )
          closeAddNodeModal()
          return
        }

        const connectionSafety = validateWorkflowConnection({
          source: newNode,
          target: targetNode,
          edges,
          sourceHandle: addNodeSourceHandle,
        })
        if (!connectionSafety.valid) {
          showConnectionWarning(
            connectionSafety.reason ??
              'This trigger cannot be connected automatically.',
          )
          closeAddNodeModal()
          return
        }

        const edgeId = `edge-${id}-${targetNode.id}-${Date.now()}`
        commitHistory()
        setNodes((prev) => [
          ...prev.map((node) => ({ ...node, selected: false })),
          newNode,
        ])
        setEdges((prev) => {
          if (
            prev.some(
              (edge) => edge.source === id && edge.target === targetNode.id,
            )
          ) {
            return prev
          }
          return [
            ...prev,
            {
              id: edgeId,
              source: id,
              target: targetNode.id,
              sourceHandle: addNodeSourceHandle,
              type: 'default',
            },
          ]
        })
        selectNode(id)
        setAddNodeDrag(null)
        setAddNodePlacementCenter(null)
        setGhost(null)
        clearGuides()
        setIsShiftSelectMode(false)
        suppressAddNodeClickRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        closeAddNodeModal()
        return
      }

      commitHistory()
      setNodes((prev) => [
        ...prev.map((node) => ({ ...node, selected: false })),
        {
          id,
          type,
          position: snapToGridPos(position),
          data: nodeData,
          selected: true,
        },
      ])
      if (sourceNode) {
        const targetNode: RFNode = {
          id,
          type,
          position: snapToGridPos(position),
          data: nodeData,
          selected: true,
        }
        const safety = validateWorkflowConnection({
          source: sourceNode,
          target: targetNode,
          edges,
          sourceHandle: addNodeSourceHandle,
        })
        if (!safety.valid) {
          showConnectionWarning(
            safety.reason ?? 'This node does not accept this connection.',
          )
        } else {
          setEdges((prev) => [
            ...prev,
            {
              id: `${sourceNode.id}-${id}`,
              source: sourceNode.id,
              target: id,
              sourceHandle: addNodeSourceHandle,
              type: 'default',
            },
          ])
        }
      }
      selectNode(id)
      setRightCollapsed(false)
      closeAddNodeModal()
    },
    [
      addNodePlacementCenter,
      addNodeRepairContext,
      addNodeSourceId,
      addNodeSourceHandle,
      clearGuides,
      closeAddNodeModal,
      commitHistory,
      createNodeDataFromRegistry,
      edges,
      findOpenPositionBeforeNode,
      getNodeSize,
      getMeasuredNodeSize,
      nodes,
      reactFlow,
      selectNode,
      setEdges,
      setGhost,
      setNodes,
      showConnectionWarning,
      snapToGridPos,
    ],
  )

  const addNodeFromPalette = useCallback(
    (type: BuilderNodeType, registryNodeId?: string) => {
      if (!NODE_DEFINITIONS[type] || !NODE_SCHEMA_MAP[type]) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Workflow Builder] Cannot add palette node because the builder type is not registered.',
            { type, registryNodeId },
          )
        }
        return
      }

      const size = getNodeSize(type)
      const vp = reactFlow.getViewport()
      const position = {
        x: -vp.x / vp.zoom + window.innerWidth / 2 / vp.zoom - size.w / 2,
        y: -vp.y / vp.zoom + window.innerHeight / 2 / vp.zoom - size.h / 2,
      }
      const nodeData = createNodeDataFromRegistry(type, registryNodeId)
      if (!nodeData) return
      const id = crypto.randomUUID()
      commitHistory()
      setNodes((prev) => [
        ...prev.map((node) => ({ ...node, selected: false })),
        {
          id,
          type,
          position: snapToGridPos(position),
          data: nodeData,
          selected: true,
        },
      ])
      selectNode(id)
      setRightCollapsed(false)
    },
    [
      commitHistory,
      createNodeDataFromRegistry,
      getNodeSize,
      reactFlow,
      selectNode,
      setNodes,
      snapToGridPos,
    ],
  )

  const applyPreviewDraft = useCallback(
    (kind: BuilderDraftKind) => {
      const draft = createBuilderPreviewDraft(kind)
      commitHistory()
      setWorkflowCategory(draft.category)
      setNodes(draft.nodes as RFNode[])
      setEdges(draft.edges)
      setActiveBuilderPanel(null)
      setAddNodeSourceId(null)
      setAddNodeInitialCategory(undefined)
      setAddNodeHelperText(undefined)
      setAddNodePreferredIds([])
      setAddNodeRepairContext(null)
      setPreviewExecution(null)
      const firstNode = draft.nodes[0]
      if (firstNode) selectNode(firstNode.id)
      setRightCollapsed(false)
      requestAnimationFrame(() =>
        reactFlow.fitView({ padding: 0.3, duration: 450 }),
      )
    },
    [commitHistory, reactFlow, selectNode, setEdges, setNodes],
  )

  const applyStarterPreviewDraft = useCallback(
    (category: string, starter?: string) => {
      const draft = createBuilderStarterPreviewDraft(
        category,
        starter || `${category} workflow`,
      )
      commitHistory()
      setWorkflowCategory(draft.category)
      setNodes(draft.nodes as RFNode[])
      setEdges(draft.edges)
      setActiveBuilderPanel(null)
      setAddNodeSourceId(null)
      setAddNodeInitialCategory(undefined)
      setAddNodeHelperText(undefined)
      setAddNodePreferredIds([])
      setAddNodeRepairContext(null)
      setPreviewExecution(null)
      setStartPanelDismissed(true)
      const firstNode = draft.nodes[0]
      if (firstNode) selectNode(firstNode.id)
      setRightCollapsed(false)
      requestAnimationFrame(() =>
        reactFlow.fitView({ padding: 0.3, duration: 450 }),
      )
    },
    [commitHistory, reactFlow, selectNode, setEdges, setNodes],
  )

  const startWithStarterTrigger = useCallback(
    (starter?: string) => {
      const draft = createBuilderStarterPreviewDraft(
        'CRM',
        starter || 'New Lead',
      )
      const firstNode = draft.nodes[0]
      if (!firstNode) return
      commitHistory()
      setWorkflowCategory('CRM')
      setNodes([{ ...(firstNode as RFNode), selected: true }])
      setEdges([])
      setActiveBuilderPanel(null)
      setAddNodeSourceId(null)
      setAddNodeInitialCategory(undefined)
      setAddNodeHelperText(undefined)
      setAddNodePreferredIds([])
      setAddNodeRepairContext(null)
      setPreviewExecution(null)
      setStartPanelDismissed(true)
      selectNode(firstNode.id)
      setRightCollapsed(false)
      requestAnimationFrame(() =>
        reactFlow.fitView({ padding: 0.4, duration: 450 }),
      )
    },
    [commitHistory, reactFlow, selectNode, setEdges, setNodes],
  )

  const generateFromStarterPanel = useCallback(
    (starter?: string, prompt?: string) => {
      if (workflowCategory === 'Custom') {
        setAiInitialPrompt(prompt?.trim() || undefined)
        setReturnToStarterAfterAi(true)
        setStartPanelDismissed(true)
        setActiveBuilderPanel('ai')
        return
      }
      applyStarterPreviewDraft(workflowCategory, starter)
    },
    [applyStarterPreviewDraft, workflowCategory],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      const type = e.dataTransfer.getData(
        'application/reactflow',
      ) as BuilderNodeType
      if (!type) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Workflow Builder] Drop ignored because no builder node type was provided.',
          )
        }
        return
      }
      const registryNodeId =
        e.dataTransfer.getData('application/workflow-node-id') || undefined
      if (!NODE_DEFINITIONS[type] || !NODE_SCHEMA_MAP[type]) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[Workflow Builder] Drop ignored because the builder node type is not registered.',
            { type, registryNodeId },
          )
        }
        return
      }

      const size = getNodeSize(type)

      const flowPos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const centeredPosition = {
        x: flowPos.x - size.w / 2,
        y: flowPos.y - size.h / 2,
      }

      const magnetPosition = computeMagnetAndGuides(type, centeredPosition)

      const nodeData = createNodeDataFromRegistry(type, registryNodeId)
      if (!nodeData) return

      const id = crypto.randomUUID()
      commitHistory()
      setNodes((prev) => [
        ...prev.map((node) => ({ ...node, selected: false })),
        {
          id,
          type,
          position: magnetPosition,
          data: nodeData,
          selected: true,
        },
      ])
      selectNode(id)
      setRightCollapsed(false)

      setGhost(null)
      clearGuides()
    },
    [
      reactFlow,
      setNodes,
      getNodeSize,
      computeMagnetAndGuides,
      clearGuides,
      commitHistory,
      selectNode,
      createNodeDataFromRegistry,
    ],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      const type = e.dataTransfer.getData(
        'application/reactflow',
      ) as BuilderNodeType
      if (!type) {
        if (ghost) setGhost(null)
        if (guides.active) clearGuides()
        return
      }

      const size = getNodeSize(type)
      const flowPos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const centered = {
        x: flowPos.x - size.w / 2,
        y: flowPos.y - size.h / 2,
      }

      const magnetPosition = computeMagnetAndGuides(type, centered)

      setGhost({
        type,
        position: magnetPosition,
        size,
      })
    },
    [
      reactFlow,
      getNodeSize,
      computeMagnetAndGuides,
      ghost,
      guides.active,
      clearGuides,
    ],
  )

  const onDragLeave = useCallback(() => {
    setGhost(null)
    clearGuides()
  }, [clearGuides])

  /* --------------------------------
        Context Menu (open handlers)
      -------------------------------- */
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Keep click outside and shortcut state predictable.
      clearEditorSelection()

      setCtxMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        target: 'pane',
      })
    },
    [clearEditorSelection],
  )

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode) => {
      e.preventDefault()
      e.stopPropagation()

      // Ensure right-click targets that node for actions
      selectOnlyNode(node.id)
      selectNode(node.id)

      setCtxMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        target: 'node',
        nodeId: node.id,
      })
    },
    [selectOnlyNode, selectNode],
  )

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault()
      e.stopPropagation()
      closeContextMenu()
      setEdgeContextMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        edgeId: edge.id,
      })
    },
    [closeContextMenu],
  )

  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu((current) =>
      current.open
        ? {
            open: false,
            x: 0,
            y: 0,
            edgeId: null,
          }
        : current,
    )
  }, [])

  /* --------------------------------
        Dot Density (Plan-Aware)
    -------------------------------- */
  const dotGap = useMemo(() => {
    if (plan === 'basic') return 24
    if (plan === 'elite') return 32
    return 28
  }, [plan])

  /* --------------------------------
        Performance Optimization
    -------------------------------- */
  const graphSize = nodes.length + edges.length
  const isMassive = graphSize >= 1200
  const shouldRenderBackground =
    viewport.zoom > 0.25 && (!isMassive || viewport.zoom > 0.55)

  /* --------------------------------
        Dynamic Dot Styling
    -------------------------------- */
  const dotOpacity = useMemo(() => {
    if (viewport.zoom < 0.7) return 0.42
    if (viewport.zoom > 1.2) return 0.24
    return 0.32
  }, [viewport.zoom])

  const backgroundLayerOpacity = useMemo(() => {
    if (canvasMode === 'blank') return 0
    if (!shouldRenderBackground) return 0
    if (isMassive && viewport.zoom <= 0.8) return 0.85
    return 1
  }, [canvasMode, shouldRenderBackground, isMassive, viewport.zoom])

  /* --------------------------------
        Ghost node (derived only)
      -------------------------------- */
  const ghostNode = useMemo<RFNode | null>(() => {
    if (!ghost) return null

    const validated = validateNodeData(
      ghost.type,
      getDefaultNodeData(ghost.type),
    )
    if (!validated.ok) return null

    return {
      id: '__ghost__',
      type: ghost.type,
      position: ghost.position,
      data: validated.parsed as any,
      selectable: false,
      draggable: false,
      connectable: false,
      focusable: false,
      style: {
        opacity: 0.35,
        filter: 'grayscale(10%)',
        pointerEvents: 'none',
      },
    }
  }, [ghost])

  const nodesWithGhost = useMemo(() => {
    const base = ghostNode ? [...nodes, ghostNode] : nodes
    const connectedNodeIds = new Set<string>()
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    })
    const selectedDataFlowNodeIds = new Set<string>()
    if (selectedNodeId) {
      for (const input of workflowDataFlow.nodeInputs[selectedNodeId] ?? []) {
        if (input.sourceNodeId) selectedDataFlowNodeIds.add(input.sourceNodeId)
      }
      for (const output of workflowDataFlow.nodeOutputs[selectedNodeId] ?? []) {
        for (const consumer of output.consumers) {
          selectedDataFlowNodeIds.add(consumer.nodeId)
        }
      }
    }
    for (const nodeId of dataFlowHighlight?.nodeIds ?? []) {
      selectedDataFlowNodeIds.add(nodeId)
    }
    const repairNode = connectionRepairMode
      ? (base.find((node) => node.id === connectionRepairMode.nodeId) ?? null)
      : null
    return base.map((n) => {
      const hasRenderer = nodeTypes[n.type as any]
      const validation = builderValidation.nodeResults[n.id]
      const isGhost = n.id === '__ghost__'
      const isConnected = connectedNodeIds.has(n.id)
      const repairCompatibility =
        connectionRepairMode && repairNode && !isGhost && n.id !== repairNode.id
          ? {
              candidateToRepair: validateWorkflowConnection({
                source: n,
                target: repairNode,
                edges,
              }).valid,
              repairToCandidate: validateWorkflowConnection({
                source: repairNode,
                target: n,
                edges,
              }).valid,
            }
          : null
      const isRepairCompatible = Boolean(
        repairCompatibility?.candidateToRepair ||
        repairCompatibility?.repairToCandidate,
      )
      const isRepairSource =
        Boolean(connectionRepairMode) && n.id === connectionRepairMode?.nodeId
      const dataWithValidation = {
        ...(n.data as any),
        __validationState: validation?.state,
        __validationMessages: validation?.messages,
        __disconnected: validation?.disconnected ?? (!isGhost && !isConnected),
        __connectionRepairCompatible: isRepairCompatible,
        __connectionRepairSource: isRepairSource,
        __dataFlowHighlighted: selectedDataFlowNodeIds.has(n.id),
      }
      const isInactive =
        !isGhost &&
        !n.selected &&
        (validation?.state === 'disconnected' ||
          validation?.disconnected ||
          !isConnected)
      const stateClass =
        validation?.state === 'error'
          ? 'workflow-node-error rounded-xl ring-2 ring-rose-500/70 ring-offset-2 ring-offset-slate-950'
          : validation?.state === 'warning'
            ? 'workflow-node-warning rounded-xl ring-2 ring-amber-400/70 ring-offset-2 ring-offset-slate-950'
            : isInactive
              ? 'workflow-node-inactive'
              : isGhost
                ? ''
                : 'workflow-node-active'
      const repairClass = connectionRepairMode
        ? isRepairSource
          ? 'workflow-node-repair-source rounded-xl ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-slate-950'
          : isRepairCompatible
            ? 'workflow-node-repair-compatible rounded-xl ring-2 ring-emerald-300/60 ring-offset-2 ring-offset-slate-950'
            : 'workflow-node-repair-incompatible opacity-45 grayscale'
        : ''
      const dataFlowClass =
        selectedDataFlowNodeIds.has(n.id) && !n.selected && !isGhost
          ? 'workflow-node-data-flow rounded-xl ring-1 ring-sky-300/35 ring-offset-1 ring-offset-slate-950'
          : ''
      return hasRenderer
        ? {
            ...n,
            data: dataWithValidation,
            className: [n.className, stateClass, repairClass, dataFlowClass]
              .filter(Boolean)
              .join(' '),
          }
        : {
            ...n,
            type: 'unknown',
            data: { ...dataWithValidation, nodeType: n.type },
            className: [n.className, stateClass, repairClass, dataFlowClass]
              .filter(Boolean)
              .join(' '),
          }
    })
  }, [
    builderValidation.nodeResults,
    connectionRepairMode,
    dataFlowHighlight?.nodeIds,
    edges,
    nodes,
    ghostNode,
    selectedNodeId,
    workflowDataFlow.nodeInputs,
    workflowDataFlow.nodeOutputs,
  ])

  const edgesWithPreview = useMemo(() => {
    const branchPathStatusByEdge = new Map<string, 'selected' | 'skipped'>()
    for (const step of previewExecution?.steps ?? []) {
      const branchPaths = (step.output as Record<string, unknown> | undefined)
        ?.__branchPaths
      if (!Array.isArray(branchPaths)) continue
      for (const path of branchPaths as Array<{
        pathKey?: string
        status?: string
      }>) {
        if (path.status !== 'selected' && path.status !== 'skipped') continue
        for (const edge of edges) {
          if (
            edge.source === step.nodeId &&
            edge.sourceHandle === path.pathKey
          ) {
            branchPathStatusByEdge.set(edge.id, path.status)
          }
        }
      }
    }
    return edges.map((edge) => {
      const normalizedEdge = {
        ...edge,
        type: 'default',
        pathOptions: undefined,
        style: {
          stroke: 'rgba(148,163,184,0.68)',
          strokeWidth: 2.25,
          ...(edge.style ?? {}),
        },
        interactionWidth: 18,
      }
      const branchStatus = branchPathStatusByEdge.get(edge.id)
      if (branchStatus === 'selected') {
        return {
          ...normalizedEdge,
          animated: true,
          className: [edge.className, 'stroke-cyan-300']
            .filter(Boolean)
            .join(' '),
          style: {
            ...(normalizedEdge.style ?? {}),
            stroke: '#67e8f9',
            strokeWidth: 2.75,
          },
        }
      }
      if (branchStatus === 'skipped') {
        return {
          ...normalizedEdge,
          animated: false,
          style: {
            ...(normalizedEdge.style ?? {}),
            stroke: 'rgba(100,116,139,0.36)',
            strokeWidth: 1.8,
          },
        }
      }
      return previewActiveEdgeIds.includes(edge.id)
        ? {
            ...normalizedEdge,
            animated: true,
            className: [edge.className, 'stroke-cyan-300']
              .filter(Boolean)
              .join(' '),
            style: {
              ...(normalizedEdge.style ?? {}),
              stroke: '#67e8f9',
              strokeWidth: 2.5,
            },
          }
        : normalizedEdge
    })
  }, [edges, previewActiveEdgeIds, previewExecution?.steps])
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'default',
      style: {
        stroke: 'rgba(148,163,184,0.68)',
        strokeWidth: 2.25,
      },
      interactionWidth: 18,
    }),
    [],
  )

  const inspectorTabs = useMemo(() => {
    return getInspectorLayout(selectedNode?.type as BuilderNodeType | undefined)
      .tabs
  }, [selectedNode?.type])

  useEffect(() => {
    const nextTab = inspectorTabs[0] ?? 'config'
    setInspectorTab(nextTab)
  }, [selectedNode?.type, inspectorTabs])

  const inspectorLayout = useMemo<
    'compact' | 'standard' | 'wide' | 'unknown'
  >(() => {
    const t = selectedNode?.type as BuilderNodeType | undefined
    if (!t) return 'standard'
    if (t === 'trigger' || t === 'delay') return 'compact'
    if (t.startsWith('ai-')) return 'wide'
    if (t === 'unknown') return 'unknown'
    return 'standard'
  }, [selectedNode?.type])

  /* --------------------------------
        TODO: AI Coach Overlays (UI scaffolding)
        - Inline callouts
        - Suggestions
        - Annotations tied to nodes/runs
      -------------------------------- */

  /* --------------------------------
        TODO: Run Timeline + Replay System (UI scaffolding)
        - Timeline scrubber
        - Replay controls
        - Frame-by-frame execution
      -------------------------------- */

  /* --------------------------------
        TODO: Execution Logs Panel (UI scaffolding)
        - Timeline-aligned logs
        - Node-level replay
      -------------------------------- */

  /* --------------------------------
        TODO: Automation Versioning (UI scaffolding)
        - Snapshot diffs
        - Restore points
      -------------------------------- */

  /* --------------------------------
        TODO: Collaboration (future scaffolding)
        - Presence cursors
        - Node locks
      -------------------------------- */

  /* --------------------------------
        🔒 ADDITIVE: Feature flags + controllers (read-only)
      -------------------------------- */
  const hasRunTimeline = canUseFeatureUnsafe('run-timeline')
  const hasAICoach =
    canUseFeatureUnsafe('aiCoach') || canUseFeatureUnsafe('ai-coach')
  const hasExecutionLogs = canUseFeatureUnsafe('execution-logs')
  const hasCollaboration = canUseFeatureUnsafe('collaboration')
  const hasCollaborationLocks = canUseFeatureUnsafe('collaboration-locks')
  const hasVersioning = canUseFeatureUnsafe('versioning')
  const hasCollabPreview = canUseFeatureUnsafe('collaboration-preview')
  const hasVersioningPreview = canUseFeatureUnsafe('versioning-preview')
  const hasCollabPresence =
    canUseFeatureUnsafe('collaboration') ||
    canUseFeatureUnsafe('collaboration-presence')
  const hasCollabSoftLocks = canUseFeatureUnsafe('collaboration-locks')
  // Backend-driven, read-only run timeline data.
  const automationRuns = useAutomationRuns(automationId, hasRunTimeline)

  const runtimeTimeline = useMemo<RuntimeRunTimeline>(
    () =>
      automationRuns.timeline ?? {
        events: [],
        startedAt: 0,
        finishedAt: 0,
      },
    [automationRuns.timeline],
  )

  const timelineController = useRunTimelineController(runtimeTimeline, {
    enabled: hasRunTimeline,
  })

  const activeReplayNodes = useMemo(
    () =>
      hasRunTimeline
        ? getReplayActiveNodes(
            timelineController.timeline,
            timelineController.currentTime,
          )
        : new Set<string>(),
    [
      hasRunTimeline,
      timelineController.timeline,
      timelineController.currentTime,
    ],
  )

  // Replay + overlays stay read-only: derive active nodes only and never mutate builder state.
  const executionLogs = useExecutionLogs()

  // Collaboration is visual-only; no mutations to builder state.
  const collabSnapshot = useCollaborationSnapshot({
    enabled: hasCollaboration,
    workspaceId,
    automationId,
  })

  // Versioning is manual and read-only-first; no auto-create.
  const automationVersions = useAutomationVersions(workspaceId, automationId, {
    enabled: hasVersioning,
  })

  // Preview-only (static) collaboration and versioning data; no networking.
  const collabPreview = useCollaborationPreview({
    enabled: hasCollabPreview,
    workspaceId,
    automationId,
  })
  const versionPreview = useVersioningPreview({
    enabled: hasVersioningPreview,
    automationId,
  })

  // Backend-driven presence polling (pointer-events-none overlay only).
  const presencePolling = usePresencePolling({
    workspaceId,
    automationId,
    enabled: hasCollabPresence,
  })
  useCursorBroadcaster({
    workspaceId,
    automationId,
    enabled: hasCollabPresence,
    userId: 'local-user',
    name: 'You',
  })

  const softLocks = useSoftLocks(
    hasCollabSoftLocks ? presencePolling.session : null,
  )
  const softLockDescriptors = useMemo<LockDescriptor[]>(
    () =>
      softLocks.locks.map((lock) => ({
        id: `${lock.nodeId}-${lock.lockedBy}-${lock.since}`,
        workspaceId,
        automationId,
        nodeId: lock.nodeId,
        ownerUserId: lock.lockedBy,
        lockType: 'NODE',
        state: 'SOFT',
        updatedAt: lock.since,
      })),
    [softLocks.locks, workspaceId, automationId],
  )

  /* --------------------------------
        AI Coach (UI only)
      -------------------------------- */
  const aiCoachEnabled = useMemo(
    () => canUseFeatureUnsafe('aiCoach') || canUseFeatureUnsafe('ai-coach'),
    [canUseFeatureUnsafe],
  )

  const aiCallouts = useMemo<AICallout[]>(() => {
    if (!aiCoachEnabled) return []
    return nodes.slice(0, 2).map((n, idx) => ({
      id: n.id,
      targetId: n.id,
      message:
        idx % 2 === 0
          ? 'AI Coach: This node fails frequently'
          : 'AI Coach: Consider retry logic',
      position: n.position,
      kind: idx % 2 === 0 ? 'bottleneck' : 'optimization',
    }))
  }, [aiCoachEnabled, nodes])

  const aiCoach = useAICoach(aiCallouts)
  const setAICoachContext = aiCoach.setContext

  const validationIssueCount = useMemo(() => {
    if (!validationGraph || !validationGraph.nodes?.length) return 0

    return validationGraph.nodes.filter(
      (n) => n.state === 'error' || n.state === 'warn',
    ).length
  }, [validationGraph])

  const aiSuggestionsAvailable = useMemo(
    () => aiCoach.visibleCallouts.length > 0,
    [aiCoach.visibleCallouts],
  )

  const lastRunStatus = useMemo(() => {
    const status = (automationRuns.runs[0] as { status?: string } | undefined)
      ?.status
    if (status === 'success') return 'success'
    if (status === 'failed') return 'failed'
    return 'unknown'
  }, [automationRuns.runs])

  useEffect(() => {
    if (!hasAICoach) return
    // Feature-gated, read-only AI Coach context derived from replay state.
    setAICoachContext({
      currentTime: timelineController.currentTime,
      activeNodeIds: activeReplayNodes,
      inspector: {
        layout: inspectorLayout,
        dock: inspectorDock,
        pinned: inspectorPinned,
        tab: inspectorTab,
        selectedNodeType: selectedNode?.type as BuilderNodeType | undefined,
        widthPreset: inspectorWidthPreset as any,
        followSelection: inspectorFollowsSelection,
      },
    })
  }, [
    hasAICoach,
    setAICoachContext,
    timelineController.currentTime,
    activeReplayNodes,
    inspectorLayout,
    inspectorDock,
    inspectorPinned,
    inspectorTab,
    selectedNode?.type,
    inspectorWidthPreset,
    inspectorFollowsSelection,
  ])

  const setExecutionLogsContext = executionLogs.setContext
  useEffect(() => {
    if (!hasExecutionLogs) return
    // Feature-gated, read-only execution logs filtered by replay state.
    setExecutionLogsContext({
      currentTime: timelineController.currentTime,
      activeNodeIds: activeReplayNodes,
    })
  }, [
    hasExecutionLogs,
    setExecutionLogsContext,
    timelineController.currentTime,
    activeReplayNodes,
  ])

  // Run timeline normalization (multi-run safe)
  const normalizeRunId = useCallback(() => {
    if (automationRuns.selectedRunId) return automationRuns.selectedRunId
    const maybeRunId = (automationRuns.timeline as any)?.runId
    if (maybeRunId) return maybeRunId as string
    return 'run'
  }, [automationRuns.selectedRunId, automationRuns.timeline])

  const runSegments = useMemo(
    () =>
      automationRuns.timeline
        ? automationRuns.timeline.events.map((e) => ({
            id: `${e.nodeId}-${e.timestamp}`,
            start: e.timestamp,
            end: e.timestamp + e.duration,
            status: e.status,
            nodeId: e.nodeId,
          }))
        : [],
    [automationRuns.timeline],
  )

  const timelineRuns = useMemo<RunTimelineData[]>(() => {
    if (automationRuns.runs && automationRuns.runs.length) {
      return automationRuns.runs.map((r, idx) => {
        const runId = r.id ?? (r as any).runId ?? `run-${idx}`
        const isSelected =
          automationRuns.selectedRunId && runId === automationRuns.selectedRunId
        return {
          runId,
          runLabel: (r as any).label ?? (r as any).name ?? `Run ${runId}`,
          segments: isSelected ? runSegments : [],
          runStatus: (r as any).status,
          compareMeta: (r as any).compareMeta,
        }
      })
    }
    if (automationRuns.timeline) {
      return [
        {
          runId: normalizeRunId(),
          segments: runSegments,
        },
      ]
    }
    return []
  }, [
    automationRuns.runs,
    automationRuns.selectedRunId,
    automationRuns.timeline,
    normalizeRunId,
    runSegments,
  ])

  const dotSize = useMemo(() => {
    return isDragging ? 3.4 : 2.8
  }, [isDragging])

  const executionCount = automationRuns.runs.length
  const heatmapExecutionThreshold = 20
  const heatmapAvailable = executionCount >= heatmapExecutionThreshold
  const showFailureHeatmap =
    canUseFeatureUnsafe('heatmaps') &&
    (heatmapMode === 'on' || (heatmapMode === 'auto' && heatmapAvailable))

  /* --------------------------------
        Render
     -------------------------------- */
  const hudCompact = hudDensity === 'compact'
  const hudGap = hudCompact ? 'gap-1.5' : 'gap-2'
  const hudPad = hudCompact ? 'p-1.5' : 'p-2'
  const hudLabelCls = hudCompact ? 'text-[9px]' : 'text-[10px]'
  const hudBtnSize = 'xs'

  const hudMiniActive = hudMiniMode || hudCompact
  const hudEffectivePad = hudMiniActive ? 'p-1' : hudPad
  const hudEffectiveGap = hudMiniActive ? 'gap-1.5' : hudGap

  const hudContainerRect = canvasRef.current?.getBoundingClientRect()
  const hudStyle: React.CSSProperties = {
    position: 'fixed',
    left: (hudContainerRect?.left ?? 0) + renderHudPos.x,
    top: (hudContainerRect?.top ?? 0) + renderHudPos.y,
  }
  const hudDockedStyle: React.CSSProperties = (() => {
    const bounds = getHudBounds()
    const pad = 0
    const left = hudContainerRect?.left ?? 0
    const top = hudContainerRect?.top ?? 0
    if (hudDockMode === 'dock-top-left') {
      return { position: 'fixed', top: top + pad, left: left + bounds.minX }
    }
    if (hudDockMode === 'dock-top-right') {
      return { position: 'fixed', top: top + pad, left: left + bounds.maxX }
    }
    if (hudDockMode === 'dock-bottom-left') {
      return {
        position: 'fixed',
        top: top + bounds.maxY,
        left: left + bounds.minX,
      }
    }
    if (hudDockMode === 'dock-bottom-right') {
      return {
        position: 'fixed',
        top: top + bounds.maxY,
        left: left + bounds.maxX,
      }
    }
    return hudStyle
  })()

  const handleHudKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (hudDockMode !== 'floating') return
      const step = e.shiftKey ? 24 : 8
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else return

      const next = clampHudPosition({
        x: hudPos.x + dx,
        y: hudPos.y + dy,
      })
      setHudPos({ x: next.x, y: next.y })
      setRenderHudPos({ x: next.x, y: next.y })
      setHudMiniMode(false)
      e.preventDefault()
    },
    [clampHudPosition, hudDockMode, hudPos.x, hudPos.y],
  )

  const saveHudPosition = useCallback(() => {
    const name = window.prompt(
      'Name this Canvas Controls position:',
      'Canvas Controls Position',
    )
    if (!name) return
    const entry: HUDSavedPosition = {
      id: crypto.randomUUID(),
      name,
      pos: hudPos,
      dockMode: hudDockMode,
      density: hudDensity,
    }
    setHudSavedPositions((prev) => [entry, ...prev].slice(0, 8))
    setSelectedHudPositionId(entry.id)
  }, [hudDensity, hudDockMode, hudPos])

  const applyHudPosition = useCallback(
    (id: string) => {
      const entry = hudSavedPositions.find((p) => p.id === id)
      if (!entry) return
      setHudDockMode(entry.dockMode)
      applyBuilderDensity(entry.density)
      const bounds = getHudBounds()
      const isOutside =
        entry.pos.x < bounds.minX ||
        entry.pos.x > bounds.maxX ||
        entry.pos.y < bounds.minY ||
        entry.pos.y > bounds.maxY
      const safePos = isOutside ? { x: bounds.minX, y: bounds.minY } : entry.pos
      setHudPos({ x: safePos.x, y: safePos.y })
      setRenderHudPos({ x: safePos.x, y: safePos.y })
    },
    [applyBuilderDensity, getHudBounds, hudSavedPositions],
  )

  useEffect(() => {
    if (!(isCanvasFullscreen && hudFloatingWhenFullscreen)) return
    setHudPos((pos) => {
      const bounds = getHudBounds()
      const clampVal = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v))
      const next = {
        x: clampVal(pos.x, bounds.minX, bounds.maxX),
        y: clampVal(pos.y, bounds.minY, bounds.maxY),
      }
      setRenderHudPos(next)
      return next
    })
  }, [getHudBounds, isCanvasFullscreen, hudFloatingWhenFullscreen])

  useEffect(() => {
    if (isCanvasFullscreen && (viewport.zoom < 0.5 || !hudVisible)) {
      setHudMiniMode(true)
    } else {
      setHudMiniMode(false)
    }
  }, [isCanvasFullscreen, viewport.zoom, hudVisible])

  useEffect(() => {
    if (previousNodeCountRef.current > 0 && nodes.length === 0) {
      setStartPanelDismissed(false)
    }
    previousNodeCountRef.current = nodes.length
  }, [nodes.length])

  const startPanelVisible = nodes.length === 0 && !startPanelDismissed
  const renderAssistantRepairActions = useCallback(
    (issue: BuilderValidationIssue | WorkflowHealthIssue) => {
      const healthIssue =
        'code' in issue ? issue : healthIssueById.get(issue.id)
      if (!healthIssue) {
        if (!issue.nodeId) return null
        const fallbackAction = issue.field
          ? {
              label: 'Open Field',
              run: () => openStepSettingsRepair(issue),
            }
          : {
              label: 'Focus Node',
              run: () => focusValidationIssue({ nodeId: issue.nodeId }),
            }
        return (
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="hover:bg-cyan-300/16 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 transition hover:border-cyan-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              onClick={(event) => {
                event.stopPropagation()
                fallbackAction.run()
              }}
            >
              {fallbackAction.label}
            </button>
          </div>
        )
      }
      const actions = getWorkflowRepairActions(
        healthIssue,
        workflowRepairContext,
      ).slice(0, 3)
      if (!actions.length) return null
      return (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={[
                'rounded-full border px-2 py-0.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                index === 0
                  ? 'bg-cyan-300/14 border-cyan-300/40 text-cyan-50 hover:border-cyan-200/70 hover:bg-cyan-300/20'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
              title={action.description}
              disabled={!action.availability.available}
              onClick={(event) => {
                event.stopPropagation()
                executeWorkflowRepairAction(action)
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )
    },
    [
      executeWorkflowRepairAction,
      focusValidationIssue,
      openStepSettingsRepair,
      healthIssueById,
      workflowRepairContext,
    ],
  )

  return (
    <div
      ref={rootRef}
      className={[
        // When fullscreen, the builder becomes a true “only automation screen” surface
        isCanvasFullscreen ? 'fixed inset-0 z-[60] bg-black' : '',
        'relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-950',
      ].join(' ')}
    >
      <div className="relative z-50 grid min-h-[64px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 text-slate-100 shadow-xl shadow-black/20 backdrop-blur">
        <div className="flex min-w-0 items-center">
          <Button
            size="sm"
            variant="secondary"
            aria-label="Back to Automations"
            onClick={() => requestExitBuilder('automations')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Automations</span>
          </Button>
        </div>

        <div className="min-w-0 text-center">
          <h1 className="truncate text-sm font-semibold text-slate-50 sm:text-base">
            Workflow Builder
          </h1>
          <div className="mt-1 flex min-w-0 flex-wrap items-center justify-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] ${workflowStatusDisplay.className}`}
            >
              {workflowStatusDisplay.label}
            </span>
            <span className="min-w-0 truncate text-xs text-slate-300">
              {workflowName}
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${saveStateDisplay.className}`}
            >
              {saveStateDisplay.label}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="subtle"
            onClick={() => setRunHistoryPanelOpen(true)}
            title="Open preview run history and replay debugger."
          >
            History
          </Button>
          {previewExecution ? (
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                previewFreshness === 'out_of_date'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                  : previewExecution.status === 'succeeded'
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                    : 'border-rose-400/30 bg-rose-400/10 text-rose-100'
              }`}
            >
              {previewFreshness === 'out_of_date'
                ? 'Preview out of date'
                : 'Testing'}{' '}
              · {previewExecution.steps.length} steps
            </span>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={saveNow}
            disabled={savingStatus === 'saving'}
          >
            {savingStatus === 'saving' ? 'Saving' : 'Save'}
          </Button>
          <Button size="sm" variant="secondary" onClick={runSimulation}>
            {previewFreshness === 'out_of_date'
              ? 'Run Preview Again'
              : 'Preview Run'}
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => setPublishDialogOpen(true)}
            title="Validate this workflow before publishing."
          >
            Publish
          </Button>
          <button
            type="button"
            aria-label="Exit Builder"
            title="Exit Builder"
            onClick={() => requestExitBuilder('automations')}
            className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 shadow-lg shadow-black/20 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="relative grid min-h-0 w-full min-w-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${leftW}px minmax(0, 1fr) ${rightW}px`,
          transition: `grid-template-columns ${INSPECTOR_OPEN_MS}ms ${INSPECTOR_EASE_OUT}`,
        }}
      >
        {/* LEFT (palette) */}
        <div
          ref={leftPanelRef}
          className="flex h-full min-h-0 w-full flex-col overflow-hidden"
          onPointerEnter={handleLeftPanelPointerEnter}
          onPointerLeave={handleLeftPanelPointerLeave}
          onPointerDown={stopPanelEventPropagation}
          onMouseDown={stopPanelEventPropagation}
          onClick={stopPanelEventPropagation}
          onWheel={stopPanelEventPropagation}
          style={{
            transform: effectiveLeftOpen ? 'translateX(0)' : 'translateX(-8px)',
            opacity: effectiveLeftOpen ? 1 : 0,
            pointerEvents: effectiveLeftOpen ? 'auto' : 'none',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {inspectorDock === 'left' && (
            <motion.div
              className="relative w-full overflow-hidden rounded-lg border border-slate-800/70 bg-slate-950/95"
              animate={{
                opacity: effectiveRightOpen ? 1 : 0,
                x: prefersReducedMotion ? 0 : effectiveRightOpen ? 0 : -16,
                filter: effectiveRightOpen ? 'blur(0px)' : 'blur(2px)',
              }}
              transition={{
                duration:
                  (effectiveRightOpen
                    ? INSPECTOR_OPEN_MS
                    : INSPECTOR_CLOSE_MS) / 1000,
                ease: prefersReducedMotion
                  ? 'linear'
                  : ((effectiveRightOpen
                      ? INSPECTOR_EASE_OUT
                      : INSPECTOR_EASE_IN) as any),
              }}
              style={{
                pointerEvents: effectiveRightOpen ? 'auto' : 'none',
              }}
            >
              {shouldRenderInspectorContent && (
                <InspectorPanel
                  node={selectedNode}
                  onChangeNode={updateSelectedNodeDataWithHistory}
                  onAiImprove={() => {}}
                  workspaceId={workspaceId}
                  automationId={automationId}
                  planLabel={planLabel}
                  logs={selectedNodeId ? getLogs(selectedNodeId) : []}
                  widthPreset={inspectorWidthPreset}
                  layoutVariant={inspectorLayout}
                  showLayoutBadge
                  pinned={inspectorPinned}
                  onTogglePin={() => setInspectorPinned((v) => !v)}
                  onPreset={(size) =>
                    applyBuilderDensity(size <= 340 ? 'compact' : 'standard')
                  }
                  followsSelection={inspectorFollowsSelection}
                  onToggleFollowsSelection={() =>
                    setInspectorFollowsSelection((v) => !v)
                  }
                  onClose={closeInspectorPanel}
                  dockSide="left"
                  nodes={nodes}
                  edges={edges}
                  nodeValidation={
                    selectedNodeId
                      ? builderValidation.nodeResults[selectedNodeId]
                      : undefined
                  }
                  focusFieldKey={
                    inspectorFieldFocus?.nodeId === selectedNodeId
                      ? inspectorFieldFocus.fieldKey
                      : null
                  }
                  focusFieldKeys={
                    inspectorFieldFocus?.nodeId === selectedNodeId
                      ? inspectorFieldFocus.fieldKeys
                      : []
                  }
                  focusRequestId={inspectorFieldFocus?.requestId}
                  requestedTab={inspectorViewRequest?.tab}
                  requestedScrollTop={inspectorViewRequest?.scrollTop}
                  requestedViewRequestId={inspectorViewRequest?.requestId}
                  dataFlowSummary={selectedNodeDataFlowSummary}
                  onConnectBranchPath={connectBranchPathFromInspector}
                  onInspectorViewChange={handleInspectorViewChange}
                />
              )}
            </motion.div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            <NodePalette
              items={getWorkflowBuilderPaletteItems().map((item) => ({
                ...item,
                locked:
                  (item.requiredPlan === 'Pro' && plan === 'basic') ||
                  (item.requiredPlan === 'Elite' && plan !== 'elite'),
                lockReason: item.requiredPlan
                  ? `Requires ${item.requiredPlan}.`
                  : undefined,
              }))}
              planLabel={planLabel}
              onAddNode={addNodeFromPalette}
              fullscreen={false}
              onToggleFullscreen={() => {}}
              onGroupSelected={() => {}}
              onUndo={undoBuilderEdit}
              onRedo={redoBuilderEdit}
              canUndo={historyRevision >= 0 && undoStackRef.current.length > 0}
              canRedo={historyRevision >= 0 && redoStackRef.current.length > 0}
              canGroup={selectedIds.length >= 2}
              onGenerateWithAi={() => {
                setReturnToStarterAfterAi(false)
                setReturnToStarterAfterTemplates(false)
                setActiveBuilderPanel('ai')
              }}
              onBrowseTemplates={() => {
                setReturnToStarterAfterAi(false)
                setReturnToStarterAfterTemplates(false)
                setActiveBuilderPanel('templates')
              }}
              onAutoLayout={applyAutoLayoutWithHistory}
              templates={getBuilderCRMTemplates().map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                requiredPlan: t.requiredPlan === 'Elite' ? 'Elite' : 'Pro',
                blocked:
                  (t.requiredPlan === 'Elite' && plan !== 'elite') ||
                  (t.requiredPlan === 'Pro' && plan === 'basic'),
                onSelect: () => setPendingTemplate(t),
              }))}
            />
          </div>
        </div>

        {leftCollapsed && (
          <div
            ref={leftHoverRailRef}
            className="absolute inset-y-0 left-0 z-50 w-5"
            onPointerEnter={(event) => openLeftPeek(event.target)}
            onPointerLeave={closeLeftPeek}
            aria-hidden
          >
            <div className="absolute left-1 top-1/2 h-24 w-1 -translate-y-1/2 rounded-full bg-slate-700/35 opacity-70 transition hover:bg-cyan-300/70" />
          </div>
        )}

        {/* 🔼 ADDITION: Left resize handle (between palette and canvas) */}
        {!leftCollapsed && effectiveLeftOpen && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-40 w-[6px]"
            style={{ transform: `translateX(${leftW}px)` }}
            aria-hidden
          >
            <div
              className="pointer-events-auto absolute inset-y-0 right-[-3px] w-[6px] cursor-col-resize bg-transparent"
              onMouseDown={(e) => beginResize('left', e)}
              title="Resize palette"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-700/40" />
            </div>
          </div>
        )}

        {/* CANVAS */}
        <div
          ref={canvasRef}
          className={[
            'relative h-full min-h-0 w-full min-w-0 select-none overflow-hidden border-l border-slate-800/70 bg-slate-950',
            isShiftSelectMode
              ? 'workflow-canvas-selecting cursor-crosshair'
              : 'cursor-grab active:cursor-grabbing',
          ].join(' ')}
          onPointerEnter={handleCanvasPointerEnter}
          onMouseMove={handleCanvasMouseMove}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onMouseDownCapture={handleCanvasMouseDown}
          onMouseUpCapture={handleCanvasMouseUp}
        >
          <div
            className="bg-slate-950/82 pointer-events-auto absolute left-4 top-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-slate-800/70 p-2 text-xs text-slate-300 shadow-2xl shadow-black/30 backdrop-blur"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-400">
              Zoom {(viewport.zoom * 100).toFixed(0)}%
            </span>
            <Button
              size="xs"
              variant="secondary"
              onClick={() =>
                reactFlow.fitView({ padding: 0.28, duration: 350 })
              }
            >
              Auto Fit
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={applyAutoLayoutWithHistory}
            >
              Auto Layout
            </Button>
            <Button
              size="xs"
              variant={showMinimap ? 'primary' : 'secondary'}
              onClick={() => setShowMinimap((v) => !v)}
            >
              Mini Map
            </Button>
            <Button size="xs" variant="secondary" onClick={focusCanvas}>
              Focus
            </Button>
            <Button
              size="xs"
              variant={hudVisible ? 'primary' : 'secondary'}
              data-canvas-controls-trigger="true"
              onClick={() => {
                setHudVisible((visible) => {
                  const next = !visible
                  if (next && hudDensity === 'compact' && hudAutoHideOnIdle) {
                    if (idleTimerRef.current)
                      window.clearTimeout(idleTimerRef.current)
                    idleTimerRef.current = window.setTimeout(() => {
                      setHudVisible(false)
                    }, 2500)
                  }
                  return next
                })
              }}
              aria-pressed={hudVisible}
              title={
                hudVisible ? 'Close Canvas Controls' : 'Open Canvas Controls'
              }
            >
              Canvas Controls
            </Button>
          </div>

          {/* Inline rename input overlay */}
          {renamingId &&
            (() => {
              const n = nodes.find((x) => x.id === renamingId)
              if (!n) return null

              const size = getNodeSize(
                (n.type as BuilderNodeType) || ('trigger' as any),
              )
              const p = flowToCanvasPx({
                x: n.position.x,
                y: n.position.y,
              })

              return (
                <div
                  className="absolute z-[85]"
                  style={{
                    left: p.x,
                    top: p.y - 34,
                    width: Math.max(160, Math.min(320, size.w)),
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                      Rename
                    </div>
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelRename()
                        }
                      }}
                      className="w-full rounded-lg bg-slate-900 px-2 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-800/60 focus:ring-slate-600"
                      placeholder="Node name…"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="xs" onClick={cancelRename}>
                        Cancel
                      </Button>
                      <Button size="xs" onClick={commitRename}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()}

          {/* Edge hover peek zones (only when collapsed) */}
          {rightCollapsed && (
            <div
              ref={rightHoverRailRef}
              className="absolute right-0 top-0 z-30 h-full w-4"
              onPointerEnter={(e) => openRightPeek(e.target)}
              onPointerLeave={closeRightPeek}
              onMouseEnter={(e) => openRightPeek(e.target)}
              onMouseLeave={closeRightPeek}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openRightPeek(e.target)
              }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openRightPeek(e.target)
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openRightPeek(e.target)
              }}
            />
          )}

          {/* Snap guides / alignment lines (overlay) */}
          {guides.active && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {typeof guides.v === 'number' && (
                <div
                  className="absolute top-0 h-full w-px"
                  style={{
                    left: flowToCanvasPx({ x: guides.v, y: 0 }).x,
                    background: 'rgba(148,163,184,0.35)',
                    boxShadow: '0 0 0 1px rgba(15,23,42,0.35)',
                  }}
                />
              )}
              {typeof guides.h === 'number' && (
                <div
                  className="absolute left-0 h-px w-full"
                  style={{
                    top: flowToCanvasPx({ x: 0, y: guides.h }).y,
                    background: 'rgba(148,163,184,0.35)',
                    boxShadow: '0 0 0 1px rgba(15,23,42,0.35)',
                  }}
                />
              )}
            </div>
          )}

          <ReactFlow
            nodes={nodesWithGhost}
            edges={edgesWithPreview}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={handleReactFlowNodesChange}
            onEdgesChange={handleReactFlowEdgesChange}
            onConnect={handleValidatedConnect}
            onConnectStart={handleConnectionStart}
            onConnectEnd={handleConnectionEnd}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={(event, node) => {
              event.preventDefault()
              event.stopPropagation()
              focusNodeInCanvas(node)
            }}
            onSelectionChange={onSelectionChange}
            onPaneClick={() => {
              if (connectionRepairMode) {
                exitConnectionRepairMode(connectionRepairMode)
                return
              }
              clearEditorSelection()
              closeContextMenu()
              closeEdgeContextMenu()
              resetPointerInteractionState()
            }}
            onNodeDragStart={() => {
              dragStartSnapshotRef.current = createHistorySnapshot()
              setIsDragging(true)
            }}
            onNodeDragStop={() => {
              if (
                dragStartSnapshotRef.current &&
                snapshotSignature(dragStartSnapshotRef.current) !==
                  snapshotSignature(createHistorySnapshot())
              ) {
                commitHistory(dragStartSnapshotRef.current)
              }
              dragStartSnapshotRef.current = null
              setIsDragging(false)
            }}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onWheelCapture={handleCanvasWheel}
            snapToGrid={snapToGrid}
            snapGrid={[16, 16]}
            zoomOnScroll
            zoomOnPinch
            panOnScroll={false}
            panOnDrag={!isShiftSelectMode}
            selectionOnDrag={isShiftSelectMode}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            preventScrolling
            connectionLineType={ConnectionLineType.Bezier}
            proOptions={{ hideAttribution: true }}
            onMove={handleMove}
            onlyRenderVisibleElements
            style={{ width: '100%', height: '100%' }}
          >
            <CanvasContextMenu
              state={ctxMenu}
              onClose={closeContextMenu}
              selectedCount={selectedIds.length + selectedEdgeIds.length}
              canGroup={selectedIds.length >= 2}
              nodeLabel={
                ctxMenu.nodeId
                  ? ((nodes.find((n) => n.id === ctxMenu.nodeId)?.data as any)
                      ?.label ??
                    (nodes.find((n) => n.id === ctxMenu.nodeId)?.data as any)
                      ?.name ??
                    '')
                  : undefined
              }
              hasClipboard={
                Boolean(clipboardRef.current) || clipboardRevision > 0
              }
              onAction={(action) => {
                if (action.id === 'fit') {
                  focusCanvas()
                  closeContextMenu()
                  return
                }

                if (action.id === 'auto-layout') {
                  applyAutoLayoutWithHistory()
                  closeContextMenu()
                  return
                }

                if (action.id === 'copy') {
                  copySelectedGraph()
                  closeContextMenu()
                  return
                }

                if (action.id === 'cut') {
                  cutSelectedGraph()
                  closeContextMenu()
                  return
                }

                if (action.id === 'paste') {
                  pasteClipboardGraph()
                  closeContextMenu()
                  return
                }

                if (action.id === 'select-all') {
                  selectAllGraph()
                  closeContextMenu()
                  return
                }

                if (action.id === 'rename') {
                  if (ctxMenu.nodeId) beginRename(ctxMenu.nodeId)
                  closeContextMenu()
                  return
                }

                if (action.id === 'open-settings') {
                  if (ctxMenu.nodeId) {
                    selectNode(ctxMenu.nodeId)
                    setRightCollapsed(false)
                  }
                  closeContextMenu()
                  return
                }

                if (action.id === 'duplicate') {
                  duplicateSelectedNodes()
                  closeContextMenu()
                  return
                }

                if (action.id === 'group') {
                  groupSelectedNodes()
                  closeContextMenu()
                  return
                }

                if (action.id === 'delete') {
                  deleteSelectedNodes()
                  closeContextMenu()
                  return
                }

                if (action.id === 'add') {
                  openAddNodeModal(
                    ctxMenu.target === 'node' ? ctxMenu.nodeId : null,
                  )
                  closeContextMenu()
                  return
                }

                if (action.id === 'toggle-enabled') {
                  if (ctxMenu.nodeId) {
                    commitHistory()
                    setNodes((currentNodes) =>
                      currentNodes.map((node) =>
                        node.id === ctxMenu.nodeId
                          ? {
                              ...node,
                              data: {
                                ...((node.data as
                                  | Record<string, unknown>
                                  | undefined) ?? {}),
                                disabled: !(node.data as any)?.disabled,
                              },
                            }
                          : node,
                      ),
                    )
                  }
                  closeContextMenu()
                  return
                }

                if (action.id === 'save-template') {
                  console.info(
                    '[Workflow Builder] Save as template is preview-only for now.',
                  )
                  closeContextMenu()
                  return
                }
              }}
            />
            {edgeContextMenu.open ? (
              <div
                className="fixed inset-0 z-[90]"
                onMouseDown={closeEdgeContextMenu}
                onContextMenu={(event) => {
                  event.preventDefault()
                  closeEdgeContextMenu()
                }}
              >
                <div
                  className="fixed w-52 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/95 p-1 text-xs text-slate-200 shadow-2xl shadow-black/45 backdrop-blur"
                  style={{
                    left:
                      typeof window === 'undefined'
                        ? edgeContextMenu.x
                        : Math.max(
                            8,
                            Math.min(
                              edgeContextMenu.x,
                              window.innerWidth - 224,
                            ),
                          ),
                    top:
                      typeof window === 'undefined'
                        ? edgeContextMenu.y
                        : Math.max(
                            8,
                            Math.min(
                              edgeContextMenu.y,
                              window.innerHeight - 120,
                            ),
                          ),
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Connection
                  </div>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start rounded-lg px-2 py-2 text-left text-slate-200 transition hover:bg-slate-900/80"
                    onClick={() => {
                      if (edgeContextMenu.edgeId)
                        setMappingEdgeId(edgeContextMenu.edgeId)
                      closeEdgeContextMenu()
                    }}
                  >
                    <span className="font-medium">View Data Mapping</span>
                    <span className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                      {(edgeContextSourceNode?.data as any)?.label ??
                        edgeContextSourceNode?.type ??
                        'Source'}{' '}
                      →{' '}
                      {(edgeContextTargetNode?.data as any)?.label ??
                        edgeContextTargetNode?.type ??
                        'Target'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-slate-200 transition hover:bg-slate-900/80"
                    onClick={() => {
                      if (edgeContextMenu.edgeId) {
                        commitHistory()
                        setEdges((currentEdges) =>
                          currentEdges.filter(
                            (edge) => edge.id !== edgeContextMenu.edgeId,
                          ),
                        )
                      }
                      closeEdgeContextMenu()
                    }}
                  >
                    <span className="font-medium">Delete connection</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-2 py-2 text-left text-slate-500 opacity-60"
                  >
                    <span className="font-medium">Disable connection</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      Soon
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
            {canvasMode === 'dots' && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={dotGap}
                size={dotSize}
                color={`rgba(148,163,184,${dotOpacity})`}
                style={{
                  opacity: backgroundLayerOpacity,
                  transition: 'opacity 220ms ease',
                }}
              />
            )}

            {canvasMode === 'grid' && (
              <Background
                variant={BackgroundVariant.Lines}
                gap={28}
                color="rgba(148,163,184,0.10)"
                style={{
                  opacity: backgroundLayerOpacity,
                  transition: 'opacity 220ms ease',
                }}
              />
            )}

            {showMinimap && (
              <MiniMap
                pannable
                zoomable
                className="!absolute !bottom-4 !right-4 !h-[140px] !w-[220px] !bg-transparent"
                maskColor="transparent"
                nodeStrokeWidth={2}
                nodeBorderRadius={10}
                style={{
                  border: '1px solid rgba(148,163,184,0.25)',
                  borderRadius: 12,
                  pointerEvents: 'auto',
                  right: 16,
                }}
                nodeColor={(node) => node.style?.borderColor || '#38bdf8'}
              />
            )}

            <Controls />
          </ReactFlow>

          {connectionRepairMode ? (
            <div className="pointer-events-none absolute left-1/2 top-24 z-[90] -translate-x-1/2 rounded-2xl border border-cyan-300/45 bg-slate-950/95 px-4 py-3 text-xs font-medium text-cyan-50 shadow-2xl shadow-cyan-950/35">
              <div>Select the step to reconnect this workflow.</div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                Click a compatible node. Esc cancels.
              </div>
            </div>
          ) : null}

          {connectionWarning ? (
            <div
              className="pointer-events-none fixed z-[95] max-w-[260px] rounded-lg border border-amber-400/40 bg-slate-950/95 px-3 py-2 text-[11px] text-amber-100 shadow-2xl shadow-black/40"
              style={{
                left: connectionWarning.x + 12,
                top: connectionWarning.y + 12,
              }}
            >
              {connectionWarning.message}
            </div>
          ) : null}

          {startPanelVisible && (
            <BuilderStartPanel
              selectedCategory={workflowCategory}
              onSelectCategory={setWorkflowCategory}
              onUseTemplate={(starter) =>
                applyStarterPreviewDraft(workflowCategory, starter)
              }
              onGenerateWithAi={() => {
                setReturnToStarterAfterAi(true)
                setReturnToStarterAfterTemplates(false)
                setStartPanelDismissed(true)
                setActiveBuilderPanel('ai')
              }}
              onBrowseTemplates={() => {
                setReturnToStarterAfterAi(false)
                setReturnToStarterAfterTemplates(true)
                setStartPanelDismissed(true)
                setActiveBuilderPanel('templates')
              }}
              onStartBlank={() => setStartPanelDismissed(true)}
              onDismiss={() => setStartPanelDismissed(true)}
            />
          )}

          {nodes.length > 0 && builderAssistantVisible && (
            <div className="bg-slate-950/82 pointer-events-auto absolute left-4 top-16 z-30 flex max-h-[calc(100%-5rem)] w-[280px] flex-col overflow-hidden rounded-2xl border border-slate-800/75 p-3 text-left text-slate-100 shadow-xl shadow-black/30 backdrop-blur transition hover:border-slate-700">
              <button
                type="button"
                className="flex items-start justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                onClick={() => setBuilderAssistantExpanded((v) => !v)}
                aria-expanded={builderAssistantExpanded}
              >
                <div>
                  <p className="text-xs font-semibold">Builder Assistant</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Workflow Health
                  </p>
                </div>
                <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100">
                  {builderValidation.health}%
                </div>
              </button>
              <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('summary')
                  }}
                >
                  <span className="block text-slate-500">Nodes</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.nodes}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('summary')
                  }}
                >
                  <span className="block text-slate-500">Connections</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.connections}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('errors')
                  }}
                >
                  <span className="block text-slate-500">Errors</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.errors}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('warnings')
                  }}
                >
                  <span className="block text-slate-500">Warnings</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.warnings}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('ready')
                  }}
                >
                  <span className="block text-slate-500">Ready</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.ready}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-slate-700"
                  onClick={(event) => {
                    event.stopPropagation()
                    focusBuilderAssistantSection('blocked')
                  }}
                >
                  <span className="block text-slate-500">Blocked</span>
                  <span className="mt-1 block text-slate-200">
                    {builderValidation.blocked}
                  </span>
                </button>
              </div>
              <div
                ref={(node) => {
                  assistantRefs.current.summary = node
                }}
                className={[
                  'mt-3 rounded-lg border bg-slate-900/35 p-2 text-[11px] text-slate-400 transition',
                  assistantFocusTarget === 'summary'
                    ? 'border-cyan-300/50 ring-1 ring-cyan-300/30'
                    : 'border-slate-800/70',
                ].join(' ')}
              >
                {builderValidation.errors > 0
                  ? 'Fix blocking validation issues before publishing this workflow.'
                  : builderValidation.warnings > 0
                    ? 'Setup is close. Review warnings before publishing.'
                    : `Validation progress ${builderValidation.progress}%.`}
              </div>
              <div className="mt-2 rounded-lg border border-slate-800/70 bg-slate-900/35 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-300">
                    Preview Status
                  </span>
                  <span
                    className={[
                      'rounded-full border px-2 py-0.5',
                      previewFreshness === 'out_of_date'
                        ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                        : previewFreshness === 'current'
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                          : 'border-slate-700 bg-slate-950/50 text-slate-400',
                    ].join(' ')}
                  >
                    {previewFreshness === 'none'
                      ? 'Not run'
                      : previewFreshness === 'out_of_date'
                        ? `Out of date — Last preview ${previewExecution?.status ?? 'unknown'}`
                        : `Current — ${previewExecution?.status ?? 'unknown'}`}
                  </span>
                </div>
                {previewFreshness === 'out_of_date' ? (
                  <p className="mt-2 text-slate-500">
                    Last preview belongs to a previous workflow revision.
                  </p>
                ) : null}
              </div>
              {builderAssistantExpanded ? (
                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-slate-800/70 pr-1 pt-3 text-[11px]">
                  {builderValidation.errors > 0 ||
                  builderValidation.missingTrigger ||
                  builderValidation.missingEndPath ? (
                    <BuilderAssistantSection
                      title="Errors"
                      count={builderValidation.errors}
                      autoOpen={builderValidation.errors > 0}
                      expandable={false}
                      highlighted={
                        assistantFocusTarget === 'errors' ||
                        assistantFocusTarget === 'missing-trigger' ||
                        assistantFocusTarget === 'missing-end-path'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current.errors = node
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={[
                            'rounded-lg border bg-slate-950/45 p-2 text-left transition hover:border-slate-700',
                            assistantFocusTarget === 'missing-trigger'
                              ? 'border-cyan-300/50 ring-1 ring-cyan-300/30'
                              : 'border-slate-800',
                          ].join(' ')}
                          ref={(node) => {
                            assistantRefs.current['missing-trigger'] = node
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            focusBuilderAssistantSection('missing-trigger')
                          }}
                        >
                          <span className="block text-slate-500">
                            Missing trigger
                          </span>
                          <span className="mt-1 block font-semibold text-slate-100">
                            {builderValidation.missingTrigger ? 'Yes' : 'No'}
                          </span>
                          {assistantFocusTarget === 'missing-trigger' ? (
                            <span className="mt-1 block">
                              <button
                                type="button"
                                className="hover:bg-cyan-300/16 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 transition hover:border-cyan-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const firstNonTrigger = nodes.find((node) => {
                                    const registryId =
                                      typeof (node.data as any)
                                        ?.__registryNodeId === 'string'
                                        ? String(
                                            (node.data as any).__registryNodeId,
                                          )
                                        : (node.type ?? '')
                                    return !getWorkflowNodeDefinition(
                                      registryId,
                                    )?.canBeTrigger
                                  })
                                  openTriggerRepair(firstNonTrigger?.id)
                                }}
                              >
                                Add Trigger
                              </button>
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className={[
                            'rounded-lg border bg-slate-950/45 p-2 text-left transition hover:border-slate-700',
                            assistantFocusTarget === 'missing-end-path'
                              ? 'border-cyan-300/50 ring-1 ring-cyan-300/30'
                              : 'border-slate-800',
                          ].join(' ')}
                          ref={(node) => {
                            assistantRefs.current['missing-end-path'] = node
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            focusBuilderAssistantSection('missing-end-path')
                          }}
                        >
                          <span className="block text-slate-500">
                            Missing end path
                          </span>
                          <span className="mt-1 block font-semibold text-slate-100">
                            {builderValidation.missingEndPath ? 'Yes' : 'No'}
                          </span>
                          {assistantFocusTarget === 'missing-end-path' ? (
                            <span className="mt-1 block">
                              <button
                                type="button"
                                className="hover:bg-cyan-300/16 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 transition hover:border-cyan-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openNextStepRepair()
                                }}
                              >
                                Add Next Step
                              </button>
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1 text-slate-400">
                        {builderValidation.issues
                          .filter((item) => item.severity === 'error')
                          .slice(0, 6)
                          .map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <p>{item.message}</p>
                              {renderAssistantRepairActions(item)}
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {builderValidation.warnings > 0 ? (
                    <BuilderAssistantSection
                      title="Warnings"
                      count={builderValidation.warnings}
                      autoOpen={builderValidation.warnings > 0}
                      expandable={false}
                      highlighted={assistantFocusTarget === 'warnings'}
                      sectionRef={(node) => {
                        assistantRefs.current.warnings = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {builderValidation.issues
                          .filter((item) => item.severity === 'warning')
                          .slice(0, 7)
                          .map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <p>{item.message}</p>
                              {renderAssistantRepairActions(item)}
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {builderValidation.healthReport.suggestions.length ? (
                    <BuilderAssistantSection
                      title="Suggestions"
                      count={builderValidation.healthReport.suggestions.length}
                      defaultOpen={false}
                      highlighted={assistantFocusTarget === 'suggestions'}
                      sectionRef={(node) => {
                        assistantRefs.current.suggestions = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {builderValidation.healthReport.suggestions
                          .slice(0, 7)
                          .map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <p className="font-medium text-slate-200">
                                • {item.title}
                              </p>
                              <p className="mt-0.5">{item.description}</p>
                              {renderAssistantRepairActions({
                                id: item.id,
                                severity: 'suggestion',
                                message: item.description,
                                nodeId: item.nodeId,
                                field: item.field,
                              })}
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {builderValidation.healthReport.optimizations.length ? (
                    <BuilderAssistantSection
                      title="Optimizations"
                      count={
                        builderValidation.healthReport.optimizations.length
                      }
                      defaultOpen={false}
                      highlighted={assistantFocusTarget === 'optimizations'}
                      sectionRef={(node) => {
                        assistantRefs.current.optimizations = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {builderValidation.healthReport.optimizations
                          .slice(0, 7)
                          .map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <p className="font-medium text-slate-200">
                                • {item.title}
                              </p>
                              <p className="mt-0.5">{item.description}</p>
                              {item.nodeId
                                ? renderAssistantRepairActions({
                                    id: item.id,
                                    severity: 'suggestion',
                                    message: item.description,
                                    nodeId: item.nodeId,
                                  })
                                : null}
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.producedVariables.length ? (
                    <BuilderAssistantSection
                      title="Produced Variables"
                      count={workflowDataFlow.producedVariables.length}
                      defaultOpen={false}
                      highlighted={
                        assistantFocusTarget === 'produced-variables'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['produced-variables'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.producedVariables
                          .slice(0, 8)
                          .map((variable) => (
                            <li key={variable.key}>
                              <button
                                type="button"
                                className="w-full rounded-md border border-slate-800/50 bg-slate-950/35 p-2 text-left transition hover:border-slate-700 hover:text-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowVariable(variable)
                                }}
                              >
                                <span className="block font-medium text-slate-200">
                                  {formatVariableReadableLabel(variable)}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {variable.producerContextLabel} ·{' '}
                                  {variable.type}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.consumedVariables.length ? (
                    <BuilderAssistantSection
                      title="Consumed Variables"
                      count={workflowDataFlow.consumedVariables.length}
                      defaultOpen={false}
                      highlighted={
                        assistantFocusTarget === 'consumed-variables'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['consumed-variables'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.consumedVariables
                          .slice(0, 8)
                          .map((item) => (
                            <li key={item.id}>
                              <div className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2">
                                <button
                                  type="button"
                                  className="w-full text-left transition hover:text-slate-100"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    viewDataFlowConsumption(item)
                                  }}
                                >
                                  <span className="block font-medium text-slate-200">
                                    {item.variableLabel}
                                  </span>
                                  <span className="block text-[10px] text-slate-500">
                                    Used by {item.nodeLabel} → {item.fieldLabel}
                                  </span>
                                </button>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className="rounded-full border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      viewDataFlowConsumption(item)
                                    }}
                                  >
                                    View Data Flow
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100 transition hover:border-cyan-200/60"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      focusDataFlowConsumption(item)
                                    }}
                                  >
                                    Open {item.fieldLabel} Field
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.unusedBusinessVariables.length ? (
                    <BuilderAssistantSection
                      title="Unused Business Data"
                      count={workflowDataFlow.unusedBusinessVariables.length}
                      defaultOpen={false}
                      highlighted={assistantFocusTarget === 'unused-variables'}
                      sectionRef={(node) => {
                        assistantRefs.current['unused-variables'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.unusedBusinessVariables
                          .slice(0, 8)
                          .map((variable) => (
                            <li key={variable.key}>
                              <button
                                type="button"
                                className="w-full rounded-md border border-slate-800/50 bg-slate-950/35 p-2 text-left transition hover:border-slate-700 hover:text-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowVariable(variable)
                                }}
                              >
                                <span className="block font-medium text-slate-200">
                                  {formatVariableReadableLabel(variable)}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {variable.producerContextLabel} · not used
                                  later.
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.unusedRuntimeVariables.length ||
                  workflowDataFlow.unusedTechnicalVariables.length ? (
                    <BuilderAssistantSection
                      title="Runtime / Technical Data"
                      count={
                        workflowDataFlow.unusedRuntimeVariables.length +
                        workflowDataFlow.unusedTechnicalVariables.length
                      }
                      defaultOpen={false}
                      highlighted={assistantFocusTarget === 'unused-variables'}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {[
                          ...workflowDataFlow.unusedRuntimeVariables,
                          ...workflowDataFlow.unusedTechnicalVariables,
                        ]
                          .slice(0, 8)
                          .map((variable) => (
                            <li key={variable.key}>
                              <button
                                type="button"
                                className="w-full rounded-md border border-slate-800/50 bg-slate-950/35 p-2 text-left transition hover:border-slate-700 hover:text-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowVariable(variable)
                                }}
                              >
                                <span className="block font-medium text-slate-200">
                                  {formatVariableReadableLabel(variable)}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {variable.producerContextLabel} ·
                                  informational {variable.dataRole} data
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.overwrittenVariables.length ? (
                    <BuilderAssistantSection
                      title="Overwritten Variables"
                      count={workflowDataFlow.overwrittenVariables.length}
                      defaultOpen={false}
                      highlighted={
                        assistantFocusTarget === 'overwritten-variables'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['overwritten-variables'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.overwrittenVariables
                          .slice(0, 8)
                          .map((variable) => (
                            <li key={variable.key}>
                              <button
                                type="button"
                                className="w-full rounded-md border border-slate-800/50 bg-slate-950/35 p-2 text-left transition hover:border-slate-700 hover:text-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowVariable(variable)
                                }}
                              >
                                <span className="block font-medium text-slate-200">
                                  {formatVariableReadableLabel(variable)}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {variable.overwriteMessage ??
                                    'This value is updated more than once on the same workflow path.'}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.invalidVariables.filter(
                    (item) => item.status !== 'unavailable-upstream',
                  ).length ? (
                    <BuilderAssistantSection
                      title="Broken Variable Flow"
                      count={
                        workflowDataFlow.invalidVariables.filter(
                          (item) => item.status !== 'unavailable-upstream',
                        ).length
                      }
                      autoOpen={workflowDataFlow.invalidVariables.some(
                        (item) => item.status !== 'unavailable-upstream',
                      )}
                      highlighted={
                        assistantFocusTarget === 'broken-variable-flow'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['broken-variable-flow'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.invalidVariables
                          .filter(
                            (item) => item.status !== 'unavailable-upstream',
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="bg-rose-300/8 w-full rounded-md border border-rose-300/20 p-2 text-left text-rose-100 transition hover:border-rose-200/40"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowConsumption(item)
                                }}
                              >
                                <span className="block font-medium">
                                  {item.nodeLabel} · {item.fieldLabel}
                                </span>
                                <span className="block text-[10px] text-rose-100/70">
                                  {item.message ??
                                    `${item.variableLabel} is not available here.`}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowDataFlow.invalidVariables.filter(
                    (item) => item.status === 'unavailable-upstream',
                  ).length ? (
                    <BuilderAssistantSection
                      title="Unavailable Variables"
                      count={
                        workflowDataFlow.invalidVariables.filter(
                          (item) => item.status === 'unavailable-upstream',
                        ).length
                      }
                      autoOpen={workflowDataFlow.invalidVariables.some(
                        (item) => item.status === 'unavailable-upstream',
                      )}
                      highlighted={
                        assistantFocusTarget === 'unavailable-variables'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['unavailable-variables'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowDataFlow.invalidVariables
                          .filter(
                            (item) => item.status === 'unavailable-upstream',
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="bg-amber-300/8 w-full rounded-md border border-amber-300/20 p-2 text-left text-amber-100 transition hover:border-amber-200/40"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusDataFlowConsumption(item)
                                }}
                              >
                                <span className="block font-medium">
                                  {item.nodeLabel} · {item.fieldLabel}
                                </span>
                                <span className="block text-[10px] text-amber-100/70">
                                  {item.message ??
                                    `${item.variableLabel} is not connected before this step.`}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowBranchAnalysis.branchNodes.length ? (
                    <BuilderAssistantSection
                      title="Branch Paths"
                      count={workflowBranchAnalysis.branchPaths.length}
                      defaultOpen={false}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowBranchAnalysis.branchNodes
                          .slice(0, 6)
                          .map((branch) => (
                            <li
                              key={branch.nodeId}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <button
                                type="button"
                                className="w-full text-left transition hover:text-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusValidationIssue({
                                    nodeId: branch.nodeId,
                                  })
                                }}
                              >
                                <span className="block font-medium text-slate-200">
                                  {branch.nodeLabel}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {branch.mode} · selected{' '}
                                  {branch.selectedPathKeys.length} · skipped{' '}
                                  {branch.skippedPathKeys.length}
                                </span>
                              </button>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {branch.paths.slice(0, 5).map((path) => (
                                  <span
                                    key={path.pathKey}
                                    className={[
                                      'rounded-full border px-2 py-0.5 text-[10px]',
                                      branch.selectedPathKeys.includes(
                                        path.pathKey,
                                      )
                                        ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                                        : branch.skippedPathKeys.includes(
                                              path.pathKey,
                                            )
                                          ? 'border-slate-700/70 bg-slate-950/50 text-slate-400'
                                          : path.readiness === 'error'
                                            ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
                                            : path.readiness === 'warning'
                                              ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                                              : 'border-slate-700/70 bg-slate-950/50 text-slate-300',
                                    ].join(' ')}
                                  >
                                    {path.pathLabel}
                                  </span>
                                ))}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowBranchAnalysis.merges.length ? (
                    <BuilderAssistantSection
                      title="Merge Readiness"
                      count={workflowBranchAnalysis.merges.length}
                      defaultOpen={false}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowBranchAnalysis.merges
                          .slice(0, 6)
                          .map((merge) => {
                            const mergeNode = nodes.find(
                              (item) => item.id === merge.mergeNodeId,
                            )
                            return (
                              <li
                                key={`${merge.sourceBranchNodeId}:${merge.mergeNodeId}`}
                                className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                              >
                                <button
                                  type="button"
                                  className="w-full text-left transition hover:text-slate-100"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    focusValidationIssue({
                                      nodeId: merge.mergeNodeId,
                                    })
                                  }}
                                >
                                  <span className="block font-medium text-slate-200">
                                    {String(
                                      (mergeNode?.data as any)?.label ??
                                        mergeNode?.type ??
                                        merge.mergeNodeId,
                                    )}
                                  </span>
                                  <span className="block text-[10px] text-slate-500">
                                    {merge.mergeStatus.replace(/-/g, ' ')} ·
                                    guaranteed{' '}
                                    {merge.guaranteedVariables.length} ·
                                    optional {merge.optionalVariables.length} ·
                                    conflicting{' '}
                                    {merge.conflictingVariables.length}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {workflowBranchAnalysis.issues.length ? (
                    <BuilderAssistantSection
                      title="Branch Review"
                      count={workflowBranchAnalysis.issues.length}
                      defaultOpen={false}
                      autoOpen={
                        workflowBranchAnalysis.graphReadiness !== 'ready'
                      }
                    >
                      <ul className="space-y-1 text-slate-400">
                        {workflowBranchAnalysis.issues
                          .slice(0, 8)
                          .map((issue) => (
                            <li
                              key={issue.id}
                              className="bg-amber-300/8 rounded-md border border-amber-300/20 p-2"
                            >
                              <button
                                type="button"
                                className="w-full text-left transition hover:text-amber-50"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusValidationIssue({ nodeId: issue.nodeId })
                                }}
                              >
                                <span className="block font-medium text-amber-100">
                                  {issue.message}
                                </span>
                                <span className="block text-[10px] capitalize text-amber-100/65">
                                  {issue.severity}
                                </span>
                              </button>
                              {issue.code === 'branch-path-disconnected' &&
                              issue.nodeId &&
                              issue.pathKey ? (
                                <button
                                  type="button"
                                  className="mt-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100 transition hover:border-cyan-200/60"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    const branch =
                                      workflowBranchAnalysis.branchNodes.find(
                                        (item) => item.nodeId === issue.nodeId,
                                      )
                                    const path = branch?.paths.find(
                                      (item) => item.pathKey === issue.pathKey,
                                    )
                                    if (!path || !issue.nodeId) return
                                    focusValidationIssue({
                                      nodeId: issue.nodeId,
                                    })
                                    openAddNodeModal(issue.nodeId, undefined, {
                                      helperText: `Choose the step for the ${path.pathLabel} path.`,
                                      sourceHandle: path.sourceHandle,
                                      insertionContext: 'branch',
                                    })
                                  }}
                                >
                                  Connect{' '}
                                  {workflowBranchAnalysis.branchNodes
                                    .find(
                                      (item) => item.nodeId === issue.nodeId,
                                    )
                                    ?.paths.find(
                                      (item) => item.pathKey === issue.pathKey,
                                    )?.pathLabel ?? 'Branch'}{' '}
                                  Path
                                </button>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  {branchPreviewInputs.some((input) => input.unavailable) ? (
                    <BuilderAssistantSection
                      title="Preview Input Review"
                      count={
                        branchPreviewInputs.filter((input) => input.unavailable)
                          .length
                      }
                      defaultOpen
                    >
                      <ul className="space-y-1 text-slate-400">
                        {branchPreviewInputs
                          .filter((input) => input.unavailable)
                          .map((input) => (
                            <li
                              key={input.id}
                              className="bg-amber-300/8 rounded-md border border-amber-300/20 p-2"
                            >
                              <button
                                type="button"
                                className="w-full text-left transition hover:text-amber-50"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusValidationIssue({ nodeId: input.nodeId })
                                }}
                              >
                                <span className="block font-medium text-amber-100">
                                  {input.expectedLabel} is no longer available
                                  in this workspace.
                                </span>
                                <span className="block text-[10px] text-amber-100/65">
                                  Choose a replacement value before publishing
                                  this branch.
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}

                  <BuilderAssistantSection
                    title="Runtime"
                    defaultOpen={false}
                    highlighted={assistantFocusTarget === 'runtime'}
                    sectionRef={(node) => {
                      assistantRefs.current.runtime = node
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <span>Execution Ready</span>
                      <span className="text-right text-slate-100">
                        {builderValidation.healthReport.executionReadiness.ready
                          ? 'Yes'
                          : 'No'}
                      </span>
                      <span>Publish Ready</span>
                      <span className="text-right text-slate-100">
                        {builderValidation.healthReport.publishReadiness.ready
                          ? 'Yes'
                          : 'No'}
                      </span>
                      <span>Runtime Errors</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.errors ?? 0}
                      </span>
                      <span>Execution Path</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.nodesExecuted ??
                          builderValidation.nodes}
                      </span>
                      <span>Estimated Runtime</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.estimatedRuntimeMs ??
                          builderValidation.healthReport.executionReadiness
                            .estimatedRuntimeMs}
                        ms
                      </span>
                      <span>Dynamic Values Created</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.variablesCreated ??
                          builderValidation.healthReport.executionReadiness
                            .variablesProduced}
                      </span>
                      <span>Dynamic Values Used</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.variablesUsed ??
                          builderValidation.healthReport.executionReadiness
                            .variablesConsumed}
                      </span>
                      <span>Branch Count</span>
                      <span className="text-right text-slate-100">
                        {previewExecution?.summary?.branchCount ??
                          builderValidation.healthReport.executionReadiness
                            .branchCount}
                      </span>
                      <span>Longest Path</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.executionReadiness
                            .longestPath
                        }
                      </span>
                      <span>Connected Groups</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.executionReadiness
                            .connectedComponents
                        }
                      </span>
                      <span>Recent Success Rate</span>
                      <span className="text-right text-slate-100">
                        {runHistoryStats.successRate}%
                      </span>
                      <span>Average Runtime</span>
                      <span className="text-right text-slate-100">
                        {runHistoryStats.averageRuntimeMs}ms
                      </span>
                      <span>Failure Rate</span>
                      <span className="text-right text-slate-100">
                        {runHistoryStats.failureRate}%
                      </span>
                      <span>Runs Today</span>
                      <span className="text-right text-slate-100">
                        {runHistoryStats.runsToday}
                      </span>
                      <span>Runs This Week</span>
                      <span className="text-right text-slate-100">
                        {runHistoryStats.runsThisWeek}
                      </span>
                      <span>Most Common Error</span>
                      <span className="truncate text-right text-slate-100">
                        {runHistoryStats.mostCommonError}
                      </span>
                    </div>
                  </BuilderAssistantSection>

                  <BuilderAssistantSection
                    title="Execution Summary"
                    defaultOpen={false}
                    highlighted={assistantFocusTarget === 'execution-summary'}
                    sectionRef={(node) => {
                      assistantRefs.current['execution-summary'] = node
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <span>Node Count</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.executionReadiness
                            .nodeCount
                        }
                      </span>
                      <span>Connections</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.executionReadiness
                            .connectionCount
                        }
                      </span>
                      <span>Estimated Steps</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.executionReadiness
                            .estimatedSteps
                        }
                      </span>
                      <span>Root Steps</span>
                      <span className="text-right text-slate-100">
                        {builderValidation.healthReport.graph.roots.length}
                      </span>
                      <span>End Paths</span>
                      <span className="text-right text-slate-100">
                        {builderValidation.healthReport.graph.endNodeIds.length}
                      </span>
                      <span>Cycles</span>
                      <span className="text-right text-slate-100">
                        {
                          builderValidation.healthReport.graph.cycleNodeIds
                            .length
                        }
                      </span>
                    </div>
                  </BuilderAssistantSection>

                  {(['ready', 'blocked'] as const).map((state) => {
                    const matchingNodes = Object.values(
                      builderValidation.nodeResults,
                    ).filter((result) =>
                      state === 'ready'
                        ? result.state === 'ready'
                        : result.blocked,
                    )
                    if (state === 'blocked' && !matchingNodes.length)
                      return null
                    return (
                      <BuilderAssistantSection
                        key={state}
                        title={
                          state === 'ready' ? 'Ready Nodes' : 'Blocked Nodes'
                        }
                        count={matchingNodes.length}
                        defaultOpen={false}
                        autoOpen={
                          assistantFocusTarget === state ||
                          (state === 'blocked' && matchingNodes.length > 0)
                        }
                        highlighted={assistantFocusTarget === state}
                        sectionRef={(node) => {
                          assistantRefs.current[state] = node
                        }}
                      >
                        <ul className="space-y-1 text-slate-400">
                          {matchingNodes.length ? (
                            matchingNodes.slice(0, 7).map((result) => {
                              const node = nodes.find(
                                (item) => item.id === result.nodeId,
                              )
                              return (
                                <li key={result.nodeId}>
                                  <button
                                    type="button"
                                    className="text-left transition hover:text-slate-100"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      const firstField = result.messages.find(
                                        (message) => message.field,
                                      )?.field
                                      if (firstField) {
                                        editMappingInStepSettings(
                                          result.nodeId,
                                          firstField,
                                        )
                                        return
                                      }
                                      focusValidationIssue({
                                        nodeId: result.nodeId,
                                      })
                                    }}
                                  >
                                    {String(
                                      (node?.data as any)?.label ??
                                        node?.type ??
                                        result.nodeId,
                                    )}
                                  </button>
                                </li>
                              )
                            })
                          ) : (
                            <li>No ready nodes yet.</li>
                          )}
                        </ul>
                      </BuilderAssistantSection>
                    )
                  })}

                  {builderValidation.healthReport.futureRecommendations
                    .length ? (
                    <BuilderAssistantSection
                      title="Future Recommendations"
                      count={
                        builderValidation.healthReport.futureRecommendations
                          .length
                      }
                      defaultOpen={false}
                      highlighted={
                        assistantFocusTarget === 'future-recommendations'
                      }
                      sectionRef={(node) => {
                        assistantRefs.current['future-recommendations'] = node
                      }}
                    >
                      <ul className="space-y-1 text-slate-400">
                        {builderValidation.healthReport.futureRecommendations.map(
                          (item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-slate-800/50 bg-slate-950/35 p-2"
                            >
                              <p className="font-medium text-slate-200">
                                • {item.title}
                              </p>
                              <p className="mt-0.5">{item.description}</p>
                            </li>
                          ),
                        )}
                      </ul>
                    </BuilderAssistantSection>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {!ctxMenu.open &&
            nodes.filter(shouldShowAddNextAffordance).map((sourceNode) =>
              (() => {
                const size = getMeasuredNodeSize(sourceNode)
                const sourceOnBottom = false
                const outputPoint = sourceOnBottom
                  ? flowToCanvasPx({
                      x: sourceNode.position.x + size.w / 2,
                      y: sourceNode.position.y + size.h,
                    })
                  : flowToCanvasPx({
                      x: sourceNode.position.x + size.w,
                      y: sourceNode.position.y + size.h / 2,
                    })
                const draggingAdd =
                  addNodeDrag?.sourceId === sourceNode.id ? addNodeDrag : null
                const pillWidth = 68
                const pillHeight = 28
                const pillMargin = 12
                const rectsIntersect = (
                  a: {
                    left: number
                    right: number
                    top: number
                    bottom: number
                  },
                  b: {
                    left: number
                    right: number
                    top: number
                    bottom: number
                  },
                ) =>
                  a.left < b.right &&
                  a.right > b.left &&
                  a.top < b.bottom &&
                  a.bottom > b.top
                const pillRect = (center: { x: number; y: number }) => ({
                  left: center.x - pillWidth / 2 - pillMargin,
                  right: center.x + pillWidth / 2 + pillMargin,
                  top: center.y - pillHeight / 2 - pillMargin,
                  bottom: center.y + pillHeight / 2 + pillMargin,
                })
                const nodeCanvasRects = nodes
                  .filter((node) => node.id !== sourceNode.id)
                  .map((node) => {
                    const nodeSize = getMeasuredNodeSize(node)
                    const topLeft = flowToCanvasPx(node.position)
                    const bottomRight = flowToCanvasPx({
                      x: node.position.x + nodeSize.w,
                      y: node.position.y + nodeSize.h,
                    })
                    return {
                      id: node.id,
                      left: topLeft.x,
                      right: bottomRight.x,
                      top: topLeft.y,
                      bottom: bottomRight.y,
                    }
                  })
                const collidesWithNode = (center: { x: number; y: number }) => {
                  const rect = pillRect(center)
                  return nodeCanvasRects.some((nodeRect) =>
                    rectsIntersect(rect, nodeRect),
                  )
                }
                const insideCanvasBounds = (center: {
                  x: number
                  y: number
                }) => {
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (!rect) return true
                  const candidate = pillRect(center)
                  return (
                    candidate.left >= 8 &&
                    candidate.top >= 8 &&
                    candidate.right <= rect.width - 8 &&
                    candidate.bottom <= rect.height - 8
                  )
                }
                const defaultCenter = sourceOnBottom
                  ? { x: outputPoint.x, y: outputPoint.y + 82 }
                  : { x: outputPoint.x + 112, y: outputPoint.y }
                const placementCandidates = [
                  defaultCenter,
                  { x: outputPoint.x + 112, y: outputPoint.y - 64 },
                  { x: outputPoint.x + 112, y: outputPoint.y + 64 },
                  { x: outputPoint.x + 72, y: outputPoint.y - 88 },
                  { x: outputPoint.x + 72, y: outputPoint.y + 88 },
                  { x: outputPoint.x + 164, y: outputPoint.y },
                  { x: outputPoint.x + 212, y: outputPoint.y },
                  { x: outputPoint.x - 84, y: outputPoint.y },
                ]
                const automaticCenter =
                  placementCandidates.find(
                    (center) =>
                      !collidesWithNode(center) && insideCanvasBounds(center),
                  ) ??
                  placementCandidates.find(
                    (center) => !collidesWithNode(center),
                  ) ??
                  defaultCenter
                const dragCenter =
                  draggingAdd && canvasRef.current
                    ? (() => {
                        const rect = canvasRef.current?.getBoundingClientRect()
                        if (!rect) return null
                        return {
                          x: draggingAdd.current.x - rect.left,
                          y: draggingAdd.current.y - rect.top,
                        }
                      })()
                    : null
                const addButtonCanvas = dragCenter ?? automaticCenter
                const overlayLeft =
                  Math.min(outputPoint.x, addButtonCanvas.x - pillWidth / 2) - 8
                const overlayTop =
                  Math.min(outputPoint.y, addButtonCanvas.y - pillHeight / 2) -
                  8
                const edgeWidth =
                  Math.max(outputPoint.x, addButtonCanvas.x + pillWidth / 2) -
                  overlayLeft +
                  8
                const edgeHeight =
                  Math.max(outputPoint.y, addButtonCanvas.y + pillHeight / 2) -
                  overlayTop +
                  8
                const sourceX = outputPoint.x - overlayLeft
                const sourceY = outputPoint.y - overlayTop
                const addButtonX = addButtonCanvas.x - overlayLeft
                const addButtonY = addButtonCanvas.y - overlayTop
                const targetX = addButtonX
                const targetY = addButtonY
                const [edgePath] = getBezierPath({
                  sourceX,
                  sourceY,
                  sourcePosition: sourceOnBottom
                    ? Position.Bottom
                    : Position.Right,
                  targetX,
                  targetY,
                  targetPosition: sourceOnBottom ? Position.Top : Position.Left,
                })
                const overlayStyle = sourceOnBottom
                  ? {
                      left: overlayLeft,
                      top: overlayTop,
                      width: edgeWidth,
                      height: edgeHeight,
                    }
                  : {
                      left: overlayLeft,
                      top: overlayTop,
                      width: edgeWidth,
                      height: edgeHeight,
                    }
                return (
                  <motion.div
                    key={sourceNode.id}
                    className="pointer-events-none absolute z-40"
                    style={overlayStyle}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                  >
                    <svg
                      className="absolute left-0 top-0 overflow-visible"
                      width={edgeWidth}
                      height={edgeHeight}
                      viewBox={`0 0 ${edgeWidth} ${edgeHeight}`}
                      aria-hidden="true"
                    >
                      <path
                        d={edgePath}
                        fill="none"
                        stroke="rgba(125, 211, 252, 0.72)"
                        strokeLinecap="round"
                        strokeWidth="2"
                        strokeDasharray="4 5"
                      />
                    </svg>
                    <button
                      type="button"
                      className={[
                        'pointer-events-auto absolute inline-flex h-7 items-center justify-center gap-1 rounded-full px-2',
                        'border border-sky-300/60 bg-slate-950/95 text-[11px] font-semibold text-sky-100',
                        'shadow-[0_0_0_4px_rgba(56,189,248,0.08),0_10px_24px_rgba(0,0,0,0.35)] ring-1 ring-slate-900/60 transition',
                        'hover:border-sky-100 hover:bg-sky-500 hover:text-white hover:shadow-[0_0_0_7px_rgba(56,189,248,0.16),0_14px_28px_rgba(0,0,0,0.4)]',
                        'focus:outline-none focus:ring-2 focus:ring-sky-400/60',
                      ].join(' ')}
                      style={{
                        left: addButtonX,
                        top: addButtonY,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        event.currentTarget.setPointerCapture(event.pointerId)
                        setAddNodeDrag({
                          sourceId: sourceNode.id,
                          start: { x: event.clientX, y: event.clientY },
                          current: { x: event.clientX, y: event.clientY },
                          moved: false,
                        })
                      }}
                      onPointerMove={(event) => {
                        event.stopPropagation()
                        setAddNodeDrag((drag) => {
                          if (!drag || drag.sourceId !== sourceNode.id)
                            return drag
                          const dx = event.clientX - drag.start.x
                          const dy = event.clientY - drag.start.y
                          return {
                            ...drag,
                            current: { x: event.clientX, y: event.clientY },
                            moved: drag.moved || Math.hypot(dx, dy) > 4,
                          }
                        })
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation()
                        const drag = addNodeDrag
                        setAddNodeDrag(null)
                        try {
                          event.currentTarget.releasePointerCapture(
                            event.pointerId,
                          )
                        } catch {
                          // Pointer capture may already be released by the browser.
                        }
                        if (
                          !drag ||
                          drag.sourceId !== sourceNode.id ||
                          !drag.moved
                        ) {
                          return
                        }
                        event.preventDefault()
                        suppressAddNodeClickRef.current = true
                        window.setTimeout(() => {
                          suppressAddNodeClickRef.current = false
                        }, 0)
                        const flowPoint = reactFlow.screenToFlowPosition({
                          x: event.clientX,
                          y: event.clientY,
                        })
                        setAddNodePlacementCenter(flowPoint)
                        openAddNodeModal(sourceNode.id)
                      }}
                      onPointerCancel={(event) => {
                        event.stopPropagation()
                        setAddNodeDrag(null)
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (suppressAddNodeClickRef.current) return
                        openAddNodeModal(sourceNode.id)
                      }}
                      title="Add next step"
                      aria-label="Add next step after selected node"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                      Add
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  </motion.div>
                )
              })(),
            )}

          {/* HUD snap preview + edge glow (visual only) */}
          {isHudDragging && hudPhysicsEnabled && hudDockMode === 'floating' && (
            <div className="pointer-events-none absolute inset-0">
              {/* Edge glows (visual-only, hinting) */}
              {hudSnapHints.top && (
                <div className="absolute inset-x-4 top-1 h-2 rounded-full bg-sky-400/15 blur-md" />
              )}
              {hudSnapHints.bottom && (
                <div className="absolute inset-x-4 bottom-1 h-2 rounded-full bg-sky-400/15 blur-md" />
              )}
              {hudSnapHints.left && (
                <div className="absolute inset-y-4 left-1 w-2 rounded-full bg-sky-400/15 blur-md" />
              )}
              {hudSnapHints.right && (
                <div className="absolute inset-y-4 right-1 w-2 rounded-full bg-sky-400/15 blur-md" />
              )}

              {/* Soft magnet preview lines (non-committal) */}
              <div
                className="absolute rounded-2xl border border-dashed border-slate-400/40 bg-slate-400/5"
                style={{
                  left: (magnetPreviewPos ?? hudPos).x,
                  top: (magnetPreviewPos ?? hudPos).y,
                  width:
                    magnetPreviewPos?.w ?? hudRef.current?.offsetWidth ?? 180,
                  height:
                    magnetPreviewPos?.h ?? hudRef.current?.offsetHeight ?? 64,
                }}
              />
              {hudSnapHints.top && (
                <div
                  className="absolute h-px w-full bg-sky-300/40"
                  style={{ top: (magnetPreviewPos ?? hudPos).y }}
                />
              )}
              {hudSnapHints.left && (
                <div
                  className="absolute h-full w-px bg-sky-300/40"
                  style={{ left: (magnetPreviewPos ?? hudPos).x }}
                />
              )}
            </div>
          )}

          {/* All additive overlays stay feature-flagged and read-only. */}
          {/* 🔒 ADDITIVE: AI Coach Overlay */}
          {hasAICoach && (
            <AICoachOverlay callouts={aiCoach.visibleCallouts} visible />
          )}

          {/* 🔒 ADDITIVE: Presence Overlay (polling, pointer-events-none) */}
          {hasCollabPresence && (
            <PresenceOverlay
              session={presencePolling.session}
              visible={hasCollabPresence}
              localUserId="local-user"
            />
          )}

          {/* 🔒 ADDITIVE: Presence Cursors (visual only) */}
          {hasCollaboration && (
            <PresenceCursorsOverlay
              presence={collabSnapshot.presence}
              visible={hasCollaboration}
            />
          )}

          {/* Preview-only (static) collaboration overlays */}
          {hasCollabPreview && (
            <PresenceOverlay
              session={collabPreview}
              visible={hasCollabPreview}
            />
          )}

          {/* 🔒 ADDITIVE: Node Locks Overlay (UI-only soft locks) */}
          {hasCollaborationLocks && (
            <LocksOverlay
              presence={collabSnapshot.presence}
              locks={softLockDescriptors}
              visible={hasCollaborationLocks}
            />
          )}

          {/* Preview-only locks (static, non-enforcing) */}
          {hasCollabPreview && (
            <LockOverlay
              session={collabPreview}
              nodes={nodes as any}
              visible={hasCollabPreview}
            />
          )}

          {/* 🔒 ADDITIVE: Run History Overlay */}
          {hasRunTimeline && (
            <RunHistoryOverlay
              runs={automationRuns.runs.map((r) => ({
                id: r.id,
                label: r.id,
                startedAt: r.startedAt,
                finishedAt: r.finishedAt,
              }))}
              selectedRunId={automationRuns.selectedRunId}
              onSelectRun={automationRuns.selectRun}
              visible={false}
            />
          )}

          {/* 🔒 ADDITIVE: Execution Logs Panel */}
          {hasExecutionLogs && (
            <ExecutionLogsPanel
              open={executionLogs.open}
              logs={executionLogs.activeLogs}
              selectedIndex={executionLogs.selectedIndex}
              onSelect={executionLogs.select}
              onClose={executionLogs.toggle}
            />
          )}

          {/* 🔒 ADDITIVE: Versioning Badge */}
          {hasVersioning && <VersionBadge visible={false} />}

          {/* 🔒 ADDITIVE: Version History Panel (manual, read-only) */}
          {hasVersioning && (
            <VersionHistoryPanel
              versions={automationVersions.versions}
              loading={automationVersions.loading}
              error={automationVersions.error}
              onRefresh={automationVersions.refresh}
              onRestore={() => {}}
              visible={false}
            />
          )}

          {/* Preview-only: Version history overlay (no restore) */}
          {hasVersioningPreview && (
            <VersionHistoryOverlay versions={versionPreview} visible={false} />
          )}

          {/* 🔼 ADDITION: Command Palette UI */}
          <CommandPalette
            open={commandOpen}
            onClose={() => setCommandOpen(false)}
            commands={commands}
            onGroupSelected={groupSelectedNodes}
          />

          {/* 🔼 ADDITION: Multi-select action bar */}
          {selectedIds.length >= 2 && !renamingId && (
            <div
              className="absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-slate-800/70 bg-slate-950/80 p-2 text-slate-200 shadow-xl backdrop-blur"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-2 text-xs text-slate-300">
                {selectedIds.length} selected
              </div>

              <Button size="xs" onClick={groupSelectedNodes}>
                Group
              </Button>

              <Button size="xs" onClick={duplicateSelectedNodes}>
                Duplicate
              </Button>

              <div className="h-5 w-px bg-slate-800" />

              <Button
                size="xs"
                variant="secondary"
                onClick={cycleAlignSelectedNodes}
                title={nextAlignTitle()}
              >
                Align
              </Button>

              <Button
                size="xs"
                variant="secondary"
                onClick={cycleArrangeSelectedNodes}
                title={nextArrangeTitle()}
              >
                Arrange
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => spaceSelectedNodes('vertical')}
              >
                Space V
              </Button>
              <Button size="xs" variant="secondary" onClick={mixSelectedNodes}>
                Mix
              </Button>

              <div className="h-5 w-px bg-slate-800" />

              <Button size="xs" onClick={deleteSelectedNodes}>
                Delete
              </Button>
            </div>
          )}

          {/* 🔼 ADDITION: Shortcut Help */}
          <ShortcutHelp
            open={shortcutHelpOpen}
            onClose={() => setShortcutHelpOpen(false)}
          />

          {/* TOP HUD (kept + organized, nothing removed)
              🔼 ADDITIONS:
              - Command Palette button (Cmd+K)
              - HUD density modes (compact/standard)
              - HUD menu (icons, click outside, framer motion)
              - Floating HUD when fullscreen + drag positioning
              - Auto-hide on idle (fullscreen)
              - Per-workspace HUD presets (via HUD menu)
          */}
          <AnimatePresence>
            {hudVisible && !startPanelVisible && (
              <motion.div
                ref={hudRef}
                initial={{ opacity: 0, y: -6, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className={[
                  'z-50 inline-flex w-fit max-w-[calc(100%-24px)] select-none flex-col items-start gap-2 rounded-2xl',
                  'border border-slate-800/70 bg-slate-950/70 shadow-2xl ring-1 ring-slate-800/60 backdrop-blur-md',
                  isHudDragging
                    ? 'pointer-events-none cursor-grabbing opacity-95 shadow-[0_20px_60px_-18px_rgba(0,0,0,0.75)]'
                    : 'cursor-grab transition-[left,top,transform,opacity] duration-200 ease-out',
                  hudEffectivePad,
                  hudEffectiveGap,
                ].join(' ')}
                style={hudDockMode === 'floating' ? hudStyle : hudDockedStyle}
                role="region"
                aria-label="Canvas Controls"
                tabIndex={0}
                onKeyDown={handleHudKeyDown}
                onFocus={() => setHudMiniMode(false)}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  beginHudDrag(e)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex max-w-full select-none items-start justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Canvas Controls
                      </span>
                      <div
                        data-hud-drag-handle="true"
                        className="select-none rounded-md bg-slate-800/70 px-1 py-1 text-[10px] text-slate-200 opacity-60 transition-opacity hover:opacity-100"
                        title="Drag Canvas Controls"
                        aria-label="Drag Canvas Controls"
                        aria-grabbed={isHudDragging}
                        aria-describedby="hud-drag-hint"
                      >
                        ⋮
                      </div>
                    </div>
                    <span id="hud-drag-hint" className="sr-only">
                      Drag the Canvas Controls panel header or move it with
                      arrow keys when focused.
                    </span>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Compact = toolbar only. Standard = toolbar + this panel.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div
                      className="inline-flex overflow-hidden rounded-lg border border-slate-800/70 bg-slate-950/40"
                      aria-label="View Mode"
                    >
                      {(['compact', 'standard'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setBuilderControlMode(mode)}
                          className={[
                            'px-2 py-1 text-[10px] font-semibold capitalize transition',
                            hudDensity === mode
                              ? 'bg-blue-500/20 text-blue-100'
                              : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200',
                          ].join(' ')}
                          aria-pressed={hudDensity === mode}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <button
                        data-builder-settings-trigger="true"
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setHudMenuOpen((v) => !v)
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/30 px-2 py-1 text-xs text-slate-200 hover:bg-slate-900/40"
                        title="Canvas Controls settings"
                      >
                        <Sparkles className="h-4 w-4 text-slate-300" />
                        <span>Settings</span>
                        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid w-full min-w-[260px] gap-2">
                  <section className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      View
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-400">
                        Zoom {(viewport.zoom * 100).toFixed(0)}%
                      </span>
                      <Button
                        size={hudBtnSize as any}
                        variant="secondary"
                        onClick={() =>
                          reactFlow.fitView({ padding: 0.28, duration: 350 })
                        }
                      >
                        Auto Fit
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant={
                          uiProfileId === 'focus' ? 'primary' : 'secondary'
                        }
                        onClick={() =>
                          setUiProfileId((current) =>
                            current === 'focus' ? 'default' : 'focus',
                          )
                        }
                      >
                        Focus : {uiProfileId === 'focus' ? 'On' : 'Off'}
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant="secondary"
                        onClick={toggleCanvasFullscreen}
                      >
                        Fullscreen
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Canvas
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${hudLabelCls} uppercase text-slate-400`}
                      >
                        Background
                      </span>
                      <select
                        className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200"
                        value={canvasMode}
                        onChange={(e) =>
                          setCanvasMode(e.target.value as CanvasMode)
                        }
                      >
                        <option value="blank">Blank</option>
                        <option value="dots">Dots</option>
                        <option value="grid">Grid</option>
                      </select>
                      <Button
                        size={hudBtnSize as any}
                        variant="secondary"
                        onClick={() => setSnapToGrid((v) => !v)}
                      >
                        Snap: {snapToGrid ? 'On' : 'Off'}
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant={showMinimap ? 'primary' : 'secondary'}
                        onClick={() => setShowMinimap((v) => !v)}
                      >
                        Minimap: {showMinimap ? 'On' : 'Off'}
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant={
                          builderAssistantVisible ? 'primary' : 'secondary'
                        }
                        onClick={() => setBuilderAssistantVisible((v) => !v)}
                      >
                        Builder Assistant:{' '}
                        {builderAssistantVisible ? 'On' : 'Off'}
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Workspace
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size={hudBtnSize as any}
                        variant="primary"
                        onClick={saveHudPosition}
                      >
                        Save Layout
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant="secondary"
                        onClick={() => {
                          const bounds = getHudBounds()
                          setHudDockMode('floating')
                          setHudPos({ x: bounds.minX, y: bounds.minY })
                          setRenderHudPos({ x: bounds.minX, y: bounds.minY })
                          reactFlow.fitView({ padding: 0.28, duration: 350 })
                        }}
                      >
                        Reset View
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant="secondary"
                        onClick={() => setLeftCollapsed((v) => !v)}
                      >
                        Library
                      </Button>
                      <Button
                        size={hudBtnSize as any}
                        variant={autosaveEnabled ? 'primary' : 'secondary'}
                        onClick={() => setAutosaveEnabled((v) => !v)}
                      >
                        Autosave: {autosaveEnabled ? 'On' : 'Off'}
                      </Button>
                    </div>
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <HudMenu
            open={hudMenuOpen}
            onClose={() => setHudMenuOpen(false)}
            density={hudDensity}
            setDensity={setBuilderControlMode}
            autoHide={hudAutoHideOnIdle}
            setAutoHide={setHudAutoHideOnIdle}
            visibilityMode={hudVisibilityMode}
            setVisibilityMode={setHudVisibilityMode}
            floatingWhenFullscreen={hudFloatingWhenFullscreen}
            setFloatingWhenFullscreen={setHudFloatingWhenFullscreen}
            profileId={uiProfileId}
            setProfileId={setUiProfileId}
            profiles={profiles}
            onSaveHudPreset={saveHudPreset}
            onApplyHudPreset={applyHudPreset}
            onDeleteHudPreset={deleteHudPreset}
            hudPresets={hudPresets}
            selectedHudPresetId={selectedHudPresetId}
            setSelectedHudPresetId={setSelectedHudPresetId}
            focusPresets={focusPresets}
            selectedFocusPresetId={selectedPresetId}
            onApplyFocusPreset={applyPreset}
            onSaveFocusPreset={savePreset}
            onDeleteFocusPreset={deletePreset}
            onPreviewFocusPreset={previewFocusPreset}
            hudHintPanelOpen={hudHintPanelOpen}
            setHudHintPanelOpen={setHudHintPanelOpen}
            hudSuggestions={hudSuggestions}
            setHudHintsDismissed={setHudHintsDismissed}
            showMinimap={showMinimap}
            setShowMinimap={setShowMinimap}
            heatmapMode={heatmapMode}
            setHeatmapMode={setHeatmapMode}
            canvasMode={canvasMode}
            setCanvasMode={setCanvasMode}
            workspaceId={workspaceId}
            settingsStorageKey={builderSettingsKey}
            autosaveEnabled={autosaveEnabled}
            setAutosaveEnabled={setAutosaveEnabled}
            getSafeBounds={getCanvasBounds}
          />

          {/* 🔒 ADDITIVE: Run Timeline */}
          {hasRunTimeline && (
            <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2">
              <RunTimeline
                runs={timelineRuns}
                selectedRunId={automationRuns.selectedRunId ?? undefined}
                onSelectRun={automationRuns.selectRun}
                currentTime={timelineController.currentTime}
                onSeek={timelineController.setTime}
                aiCoachHasInsights={
                  hasAICoach &&
                  (aiCoach.visibleCallouts.length > 0 || aiCallouts.length > 0)
                }
                workspaceId={workspaceId}
                userId="local-user"
                showExecutiveSummary
                runSettings={{
                  showSummaryDefault: true,
                  allowUserToggleSummary: true,
                  allowCompare: true,
                  allowHeatmap: true,
                }}
                isAdmin={false}
              />
            </div>
          )}

          <div className="absolute right-4 top-4 space-y-2 text-right text-xs text-slate-400">
            <div
              className={`inline-flex rounded-full border px-2 py-0.5 ${saveStateDisplay.className}`}
            >
              {saveStateDisplay.label}
            </div>
            {previewExecution ? (
              <div
                className={`rounded-full border px-3 py-1 shadow-lg backdrop-blur ${
                  previewFreshness === 'out_of_date'
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                    : previewExecution.status === 'succeeded'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-100'
                }`}
              >
                Preview{' '}
                {previewFreshness === 'out_of_date'
                  ? 'out of date'
                  : previewExecution.status}{' '}
                · {previewExecution.steps.length} steps
              </div>
            ) : null}
          </div>

          <HeatmapLegend
            enabled={showFailureHeatmap}
            avoidMinimap={showMinimap}
          />

          <TestWorkflowPanel
            execution={previewExecution}
            freshness={previewFreshness}
            staleState={stalePreviewState}
            currentValidation={{
              label: builderValidation.readinessLabel,
              errors: builderValidation.errors,
              warnings: builderValidation.warnings,
            }}
            dataFlowSummary={{
              created: workflowDataFlow.producedVariables.length,
              consumed: workflowDataFlow.consumedVariables.length,
              remaining: Math.max(
                0,
                workflowDataFlow.producedVariables.length -
                  workflowDataFlow.producedVariables.filter(
                    (variable) => !variable.unused,
                  ).length,
              ),
              unused: workflowDataFlow.orphanVariables.length,
              broken: workflowDataFlow.invalidVariables.length,
              branches: workflowBranchAnalysis.branchNodes.length,
              selectedPaths:
                previewExecution?.summary?.selectedPaths ??
                workflowBranchAnalysis.branchNodes.reduce(
                  (total, branch) => total + branch.selectedPathKeys.length,
                  0,
                ),
              skippedPaths:
                previewExecution?.summary?.skippedPaths ??
                workflowBranchAnalysis.branchNodes.reduce(
                  (total, branch) => total + branch.skippedPathKeys.length,
                  0,
                ),
              fallbackPaths:
                previewExecution?.summary?.fallbackPathsUsed ??
                workflowBranchAnalysis.branchNodes.reduce(
                  (total, branch) =>
                    total +
                    branch.paths.filter(
                      (path) =>
                        path.isFallback &&
                        branch.selectedPathKeys.includes(path.pathKey),
                    ).length,
                  0,
                ),
            }}
            runState={previewRunState}
            runHistoryCount={previewRunHistory.length}
            onPause={pausePreviewRun}
            onResume={resumePreviewRun}
            onStop={stopPreviewRun}
            onRestart={restartPreviewRun}
            onStepClick={(nodeId) => focusValidationIssue({ nodeId })}
            renderIssueActions={(issueId) => {
              const issue = healthIssueById.get(issueId)
              return issue ? renderAssistantRepairActions(issue) : null
            }}
            onClose={() => {
              setPreviewExecution(null)
              resetPointerInteractionState()
            }}
          />

          <RunHistoryDebuggerPanel
            open={runHistoryPanelOpen}
            runs={localRunHistory}
            stats={runHistoryStats}
            replay={replayState}
            onClose={() => setRunHistoryPanelOpen(false)}
            onReplay={startReplay}
            onStep={stepReplay}
            onTogglePlay={toggleReplayPlayback}
            onRestartReplay={restartReplay}
            onSelectNode={selectReplayNode}
            currentNodeCount={nodes.length}
            currentEdgeCount={edges.length}
            currentWorkflowFingerprint={workflowFingerprint}
          />

          {mappingEdge && mappingSourceNode && mappingTargetNode ? (
            <div
              className="bg-slate-950/92 pointer-events-auto absolute top-20 z-40 max-h-[calc(100%-6rem)] w-[min(360px,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-800/80 p-3 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur"
              style={{
                right:
                  inspectorDock === 'overlay' &&
                  effectiveInspectorOpen &&
                  !isNarrowViewport
                    ? Math.min(rightPanelWidth + 24, 456)
                    : 16,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">Data Links</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {(mappingSourceNode.data as any)?.label ??
                      mappingSourceNode.type}{' '}
                    →{' '}
                    {(mappingTargetNode.data as any)?.label ??
                      mappingTargetNode.type}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setMappingEdgeId(null)}
                >
                  Close
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {groupedMappingInputs(
                  getTargetMappingVariables(mappingTargetNode),
                ).map((section) => (
                  <section key={section.title} className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {section.title}
                    </p>
                    {section.inputs.map((input) => {
                      const availableMappingVariables =
                        getAvailableVariablesForNode(mappingTargetNode, {
                          nodes,
                          edges,
                        })
                      const targetData = (mappingTargetNode.data ??
                        {}) as Record<string, unknown>
                      const configValue =
                        targetData[input.path] ?? targetData[input.key] ?? ''
                      const targetRegistryId =
                        typeof (mappingTargetNode.data as any)
                          ?.__registryNodeId === 'string'
                          ? String(
                              (mappingTargetNode.data as any).__registryNodeId,
                            )
                          : (mappingTargetNode.type ?? '')
                      const targetField = getWorkflowNodeDefinition(
                        targetRegistryId,
                      )?.configFields.find(
                        (field) => (field.key ?? field.id) === input.key,
                      )
                      const optionDisplay =
                        targetField?.options?.find(
                          (option) =>
                            option.value === String(configValue ?? '').trim() ||
                            option.value.toLowerCase() ===
                              String(configValue ?? '')
                                .trim()
                                .toLowerCase(),
                        )?.label ?? String(configValue ?? '').trim()
                      const configIssue =
                        validateVariableValueForField({
                          value: configValue,
                          field: {
                            id: input.id,
                            key: input.key,
                            label: input.label,
                            required: !input.nullable,
                            acceptedTypes: [input.type],
                            allowsMixedText: input.type === 'string',
                            options: targetField?.options,
                            requiredMessage: targetField?.requiredMessage,
                          },
                          targetNode: mappingTargetNode,
                          nodes,
                          edges,
                        })[0] ?? null
                      const issue =
                        configIssue ??
                        mappingIssues.find((item) => item.field === input.key)
                      const canonicalToken =
                        typeof configValue === 'string'
                          ? configValue.match(/\{\{[^}]+\}\}/)?.[0]
                          : null
                      const selectedOutput = canonicalToken
                        ? availableMappingVariables.find(
                            (output) =>
                              output.token === canonicalToken ||
                              `{{${output.key}}}` === canonicalToken,
                          )
                        : null
                      const status = mappingIssueDisplay(issue)
                      const primaryValue = selectedOutput
                        ? selectedOutput.label
                        : String(configValue ?? '').trim()
                          ? 'Custom Value'
                          : 'Not configured'
                      const sampleValue = selectedOutput
                        ? `From ${selectedOutput.sourceNodeLabel ?? selectedOutput.origin ?? selectedOutput.category} · ${mappingSampleValue(selectedOutput)}`
                        : optionDisplay || fixedMappingPlaceholder(input)

                      return (
                        <div
                          key={input.key}
                          className="rounded-lg border border-slate-800 bg-slate-900/45 p-2 text-[11px]"
                        >
                          <div className="flex w-full items-start justify-between gap-3 text-left">
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-medium text-slate-200">
                                {input.label}
                                {!input.nullable ? (
                                  <span
                                    className="text-cyan-200"
                                    aria-label="Required"
                                  >
                                    ★
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block truncate text-slate-100">
                                {primaryValue}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                                {sampleValue}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span
                                className={[
                                  'rounded-full border px-1.5 py-0.5 text-[10px]',
                                  status.className,
                                ].join(' ')}
                              >
                                {status.label}
                              </span>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  editMappingInStepSettings(
                                    mappingTargetNode.id,
                                    input.key,
                                  )
                                }
                              >
                                Edit in Step Settings
                              </Button>
                            </span>
                          </div>

                          {status.detail ? (
                            <p
                              className={
                                issue?.severity === 'error'
                                  ? 'mt-1.5 text-rose-300'
                                  : 'mt-1.5 text-amber-300'
                              }
                            >
                              {status.detail}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {nodes.length > 0 && nodes.length <= 2 && (
            <div className="pointer-events-none absolute bottom-20 left-1/2 z-20 max-w-sm -translate-x-1/2 rounded-xl border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-center text-xs text-slate-400 shadow-xl backdrop-blur">
              Add your next step to continue this workflow.
            </div>
          )}

          {branchPreviewInputs.length ? (
            <div
              className="bg-slate-950/88 absolute bottom-[76px] left-1/2 z-30 w-[min(720px,calc(100vw-420px))] min-w-[320px] -translate-x-1/2 rounded-2xl border border-slate-800/70 p-3 text-slate-200 shadow-2xl shadow-black/35 backdrop-blur"
              style={{
                left: `calc(50% + ${bottomActionBarOffset}px)`,
                transition: 'left 220ms ease',
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    Preview Inputs
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Values used to test branch conditions.
                  </p>
                </div>
                {branchPreviewInputs.some((input) => input.unavailable) ? (
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                    Unavailable value
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {branchPreviewInputs.slice(0, 6).map((input) => (
                  <label key={input.id} className="min-w-0 text-[11px]">
                    <span className="mb-1 block truncate text-slate-400">
                      {input.fieldLabel}
                    </span>
                    {input.options.length && input.valueType !== 'number' ? (
                      <select
                        value={input.currentValue}
                        className="h-8 w-full rounded-lg border border-slate-700/80 bg-slate-950 px-2 text-xs text-slate-100 outline-none transition focus:border-cyan-300/60"
                        onChange={(event) => {
                          setBranchPreviewOverrides((current) => ({
                            ...current,
                            [input.id]: event.target.value,
                          }))
                        }}
                      >
                        {input.options.map((option) => (
                          <option
                            key={`${input.id}:${option.value}`}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={input.currentValue}
                        type={input.valueType === 'number' ? 'number' : 'text'}
                        className="h-8 w-full rounded-lg border border-slate-700/80 bg-slate-950 px-2 text-xs text-slate-100 outline-none transition focus:border-cyan-300/60"
                        onChange={(event) => {
                          setBranchPreviewOverrides((current) => ({
                            ...current,
                            [input.id]: event.target.value,
                          }))
                        }}
                      />
                    )}
                    <span className="mt-1 block truncate text-[10px] text-slate-500">
                      Condition: {input.fieldLabel} is {input.expectedLabel}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div
            className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/80 p-2 shadow-2xl shadow-black/35 backdrop-blur"
            style={{
              left: `calc(50% + ${bottomActionBarOffset}px)`,
              transition: 'left 220ms ease',
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {previewRunState === 'running' ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={pausePreviewRun}
                >
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={stopPreviewRun}
                >
                  Stop
                </Button>
              </>
            ) : previewRunState === 'paused' ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={resumePreviewRun}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={stopPreviewRun}
                >
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={() => openAddNodeModal(selectedNodeId)}
                >
                  Add Node
                </Button>
                <Button
                  size="sm"
                  className="min-w-[124px] rounded-xl shadow-lg shadow-blue-950/30"
                  onClick={runSimulation}
                >
                  {previewFreshness === 'out_of_date'
                    ? 'Run Preview Again'
                    : 'Preview Run'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT (Inspector — grid controlled, NOT fixed) */}
        {inspectorDock === 'overlay' && (
          <AnimatePresence>
            {effectiveInspectorOpen && (
              <motion.div
                className="bg-slate-950/98 pointer-events-auto absolute inset-y-0 right-0 z-40 w-[360px] max-w-[90vw] overflow-hidden rounded-l-2xl border border-slate-800/80 shadow-2xl backdrop-blur"
                initial={
                  prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, x: 0, filter: 'blur(0px)' }
                }
                exit={
                  prefersReducedMotion
                    ? {
                        opacity: 0,
                        transition: {
                          duration: INSPECTOR_CLOSE_MS / 1000,
                          ease: INSPECTOR_EASE_IN as any,
                        },
                      }
                    : {
                        opacity: 0,
                        x: 24,
                        transition: {
                          duration: INSPECTOR_CLOSE_MS / 1000,
                          ease: INSPECTOR_EASE_IN as any,
                        },
                      }
                }
                transition={{
                  duration: INSPECTOR_OPEN_MS / 1000,
                  ease: prefersReducedMotion
                    ? 'linear'
                    : (INSPECTOR_EASE_OUT as any),
                }}
              >
                <InspectorPanel
                  node={selectedNode}
                  onChangeNode={updateSelectedNodeDataWithHistory}
                  onAiImprove={() => {}}
                  workspaceId={workspaceId}
                  automationId={automationId}
                  planLabel={planLabel}
                  widthPreset={inspectorWidthPreset}
                  layoutVariant={inspectorLayout}
                  showLayoutBadge
                  logs={selectedNodeId ? getLogs(selectedNodeId) : []}
                  pinned={inspectorPinned}
                  onTogglePin={() => setInspectorPinned((v) => !v)}
                  onPreset={(size) =>
                    applyBuilderDensity(size <= 340 ? 'compact' : 'standard')
                  }
                  followsSelection={inspectorFollowsSelection}
                  onToggleFollowsSelection={() =>
                    setInspectorFollowsSelection((v) => !v)
                  }
                  onClose={closeInspectorPanel}
                  dockSide="overlay"
                  nodes={nodes}
                  edges={edges}
                  nodeValidation={
                    selectedNodeId
                      ? builderValidation.nodeResults[selectedNodeId]
                      : undefined
                  }
                  focusFieldKey={
                    inspectorFieldFocus?.nodeId === selectedNodeId
                      ? inspectorFieldFocus.fieldKey
                      : null
                  }
                  focusFieldKeys={
                    inspectorFieldFocus?.nodeId === selectedNodeId
                      ? inspectorFieldFocus.fieldKeys
                      : []
                  }
                  focusRequestId={inspectorFieldFocus?.requestId}
                  requestedTab={inspectorViewRequest?.tab}
                  requestedScrollTop={inspectorViewRequest?.scrollTop}
                  requestedViewRequestId={inspectorViewRequest?.requestId}
                  dataFlowSummary={selectedNodeDataFlowSummary}
                  onConnectBranchPath={connectBranchPathFromInspector}
                  onInspectorViewChange={handleInspectorViewChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {inspectorDock === 'right' && (
          <motion.div
            ref={rightPanelRef}
            className="relative h-full min-h-0 w-full overflow-hidden border-l border-slate-800/70 bg-slate-950/95"
            onPointerEnter={handleRightPanelPointerEnter}
            onPointerLeave={handleRightPanelPointerLeave}
            onPointerDown={stopPanelEventPropagation}
            onMouseDown={stopPanelEventPropagation}
            onClick={stopPanelEventPropagation}
            onWheel={stopPanelEventPropagation}
            animate={{
              width: effectiveInspectorOpen ? inspectorWidth : 0,
              opacity: effectiveInspectorOpen ? 1 : 0,
              x: prefersReducedMotion ? 0 : effectiveInspectorOpen ? 0 : 24,
              filter: effectiveInspectorOpen ? 'blur(0px)' : 'blur(2px)',
            }}
            transition={{
              duration:
                (effectiveInspectorOpen
                  ? INSPECTOR_OPEN_MS
                  : INSPECTOR_CLOSE_MS) / 1000,
              ease: (effectiveInspectorOpen
                ? INSPECTOR_EASE_OUT
                : INSPECTOR_EASE_IN) as any,
            }}
            style={{
              pointerEvents: effectiveInspectorOpen ? 'auto' : 'none',
            }}
          >
            {shouldRenderInspectorContent && (
              <InspectorPanel
                node={selectedNode}
                onChangeNode={updateSelectedNodeDataWithHistory}
                onAiImprove={() => {}}
                workspaceId={workspaceId}
                automationId={automationId}
                planLabel={planLabel}
                widthPreset={inspectorWidthPreset}
                layoutVariant={inspectorLayout}
                showLayoutBadge
                logs={selectedNodeId ? getLogs(selectedNodeId) : []}
                pinned={inspectorPinned}
                onTogglePin={() => setInspectorPinned((v) => !v)}
                onPreset={(size) =>
                  applyBuilderDensity(size <= 340 ? 'compact' : 'standard')
                }
                followsSelection={inspectorFollowsSelection}
                onToggleFollowsSelection={() =>
                  setInspectorFollowsSelection((v) => !v)
                }
                onClose={closeInspectorPanel}
                dockSide="right"
                nodes={nodes}
                edges={edges}
                nodeValidation={
                  selectedNodeId
                    ? builderValidation.nodeResults[selectedNodeId]
                    : undefined
                }
                focusFieldKey={
                  inspectorFieldFocus?.nodeId === selectedNodeId
                    ? inspectorFieldFocus.fieldKey
                    : null
                }
                focusFieldKeys={
                  inspectorFieldFocus?.nodeId === selectedNodeId
                    ? inspectorFieldFocus.fieldKeys
                    : []
                }
                focusRequestId={inspectorFieldFocus?.requestId}
                requestedTab={inspectorViewRequest?.tab}
                requestedScrollTop={inspectorViewRequest?.scrollTop}
                requestedViewRequestId={inspectorViewRequest?.requestId}
                dataFlowSummary={selectedNodeDataFlowSummary}
                onConnectBranchPath={connectBranchPathFromInspector}
                onInspectorViewChange={handleInspectorViewChange}
              />
            )}
            {isNarrowViewport && effectiveInspectorOpen && (
              <button
                type="button"
                className="absolute left-2 top-2 rounded-md border border-slate-800/70 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200"
                onClick={closeInspectorPanel}
              >
                Close
              </button>
            )}
          </motion.div>
        )}

        {/* 🔼 ADDITION: Right resize handle (between canvas and inspector) */}
        {inspectorDock === 'right' &&
          effectiveInspectorOpen &&
          !isNarrowViewport && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-40 w-[14px]"
              style={{ transform: `translateX(-${rightW}px)` }}
              aria-hidden
            >
              <div
                className={[
                  'group pointer-events-auto absolute inset-y-0 left-[-7px] w-[14px] cursor-col-resize bg-transparent',
                  activeResizeSide === 'right' ? 'bg-cyan-300/5' : '',
                ].join(' ')}
                onMouseDown={(e) => beginResize('right', e)}
                title="Drag to resize"
              >
                <div className="absolute left-1/2 top-1/2 flex h-10 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-slate-700/30 bg-slate-950/70 px-1.5 opacity-70 transition group-hover:border-cyan-300/35 group-hover:opacity-100">
                  <span
                    className={[
                      'h-5 w-px rounded-full transition',
                      activeResizeSide === 'right'
                        ? 'bg-cyan-200'
                        : 'bg-slate-500 group-hover:bg-slate-300',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'h-5 w-px rounded-full transition',
                      activeResizeSide === 'right'
                        ? 'bg-cyan-200'
                        : 'bg-slate-500 group-hover:bg-slate-300',
                    ].join(' ')}
                  />
                </div>
              </div>
            </div>
          )}
        {inspectorDock === 'left' && leftInspectorOpen && !isNarrowViewport && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-40 w-[6px]"
            style={{ transform: `translateX(${leftW}px)` }}
            aria-hidden
          >
            <div
              className={[
                'group pointer-events-auto absolute inset-y-0 right-[-7px] w-[14px] cursor-col-resize bg-transparent',
                activeResizeSide === 'inspector-left' ? 'bg-cyan-300/5' : '',
              ].join(' ')}
              onMouseDown={(e) => beginResize('inspector-left', e)}
              title="Drag to resize"
            >
              <div className="absolute left-1/2 top-1/2 flex h-10 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-slate-700/30 bg-slate-950/70 px-1.5 opacity-70 transition group-hover:border-cyan-300/35 group-hover:opacity-100">
                <span
                  className={[
                    'h-5 w-px rounded-full transition',
                    activeResizeSide === 'inspector-left'
                      ? 'bg-cyan-200'
                      : 'bg-slate-500 group-hover:bg-slate-300',
                  ].join(' ')}
                />
                <span
                  className={[
                    'h-5 w-px rounded-full transition',
                    activeResizeSide === 'inspector-left'
                      ? 'bg-cyan-200'
                      : 'bg-slate-500 group-hover:bg-slate-300',
                  ].join(' ')}
                />
              </div>
            </div>
          </div>
        )}

        <TemplateSetupModal
          open={!!pendingTemplate}
          template={pendingTemplate}
          plan={plan}
          workspaceId={workspaceId}
          onCancel={() => setPendingTemplate(null)}
          onConfirm={() => setPendingTemplate(null)}
        />

        <UpsellDFYModal
          open={false}
          onClose={() => {}}
          workspaceId={workspaceId}
          automationId={automationId}
          feature="builder-dfy"
        />

        <AIWorkflowGeneratorModal
          open={aiGeneratorOpen}
          initialPrompt={aiInitialPrompt}
          onClose={() => {
            setAiInitialPrompt(undefined)
            if (returnToStarterAfterAi && nodes.length === 0) {
              setStartPanelDismissed(false)
            }
            setReturnToStarterAfterAi(false)
            setActiveBuilderPanel(null)
            resetPointerInteractionState()
          }}
          onGenerate={(prompt) => {
            setAiInitialPrompt(undefined)
            setReturnToStarterAfterAi(false)
            applyStarterPreviewDraft('Custom', prompt)
          }}
        />

        <WorkflowTemplateGalleryModal
          open={templateGalleryOpen}
          category={workflowCategory}
          onCategoryChange={(category) => {
            if (category !== 'Saved') setWorkflowCategory(category)
          }}
          onClose={() => {
            if (returnToStarterAfterTemplates && nodes.length === 0) {
              setStartPanelDismissed(false)
            }
            setReturnToStarterAfterTemplates(false)
            setActiveBuilderPanel(null)
            resetPointerInteractionState()
          }}
          onUseTemplate={(category, starter) => {
            setReturnToStarterAfterTemplates(false)
            applyStarterPreviewDraft(category, starter)
          }}
        />

        <AddNodeModal
          open={addNodeModalOpen}
          plan={plan}
          initialCategory={addNodeInitialCategory}
          helperText={addNodeHelperText}
          preferredNodeIds={addNodePreferredIds}
          insertionContext={addNodeInsertionContext}
          sourceLabel={
            addNodeSource
              ? ((addNodeSource.data as any)?.label ??
                NODE_DEFINITIONS[addNodeSource.type as BuilderNodeType]?.label)
              : undefined
          }
          sourceNode={addNodeSource}
          onClose={closeAddNodeModal}
          onAddNode={addNodeFromModal}
          onGenerateWithAi={() => {
            closeAddNodeModal()
            setReturnToStarterAfterAi(false)
            setReturnToStarterAfterTemplates(false)
            setActiveBuilderPanel('ai')
          }}
          onBrowseTemplates={() => {
            closeAddNodeModal()
            setReturnToStarterAfterAi(false)
            setReturnToStarterAfterTemplates(false)
            setActiveBuilderPanel('templates')
          }}
        />

        {publishDialogOpen ? (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/95 p-5 text-slate-100 shadow-2xl shadow-black/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">
                    {!builderValidation.canPublish
                      ? 'Cannot Publish'
                      : builderValidation.requiresWarningConfirmation
                        ? 'Ready with Warnings'
                        : 'Workflow Ready'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {!builderValidation.canPublish
                      ? 'Resolve these errors before publishing this workflow.'
                      : builderValidation.requiresWarningConfirmation
                        ? 'No blocking errors were found. Review these warnings before publishing.'
                        : 'No blocking validation issues were found.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
                  onClick={() => {
                    setPublishDialogOpen(false)
                    resetPointerInteractionState()
                  }}
                  aria-label="Close publish validation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!builderValidation.canPublish ? (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200">
                    Errors
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-rose-100">
                    {(builderValidation.publishErrors.length
                      ? builderValidation.publishErrors
                      : builderValidation.issues.filter(
                          (item) => item.severity === 'error',
                        )
                    ).map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-rose-400/20 bg-slate-950/35 p-2"
                      >
                        <button
                          type="button"
                          className="text-left transition hover:text-rose-50"
                          onClick={() => {
                            focusValidationIssue(item)
                            setPublishDialogOpen(false)
                            resetPointerInteractionState()
                          }}
                        >
                          {item.message}
                        </button>
                        {renderAssistantRepairActions(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : builderValidation.requiresWarningConfirmation ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Workflow health {builderValidation.health}% · publish is
                    allowed after confirming {builderValidation.warnings}{' '}
                    warning{builderValidation.warnings === 1 ? '' : 's'}.
                  </div>
                  <div className="rounded-xl border border-amber-500/25 bg-slate-950/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                      Warnings
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-amber-50">
                      {builderValidation.issues
                        .filter((item) => item.severity === 'warning')
                        .slice(0, 5)
                        .map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-amber-400/15 bg-slate-950/35 p-2"
                          >
                            <button
                              type="button"
                              className="text-left transition hover:text-amber-100"
                              onClick={() => {
                                focusValidationIssue(item)
                                setPublishDialogOpen(false)
                                resetPointerInteractionState()
                              }}
                            >
                              {item.message}
                            </button>
                            {renderAssistantRepairActions(item)}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Workflow health {builderValidation.health}% ·{' '}
                  {builderValidation.ready} ready nodes
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPublishDialogOpen(false)
                    resetPointerInteractionState()
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingGroupDelete ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setPendingGroupDelete(null)
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="builder-group-delete-title"
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/95 p-5 text-slate-100 shadow-2xl shadow-black/50"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="builder-group-delete-title"
                    className="text-base font-semibold text-slate-50"
                  >
                    Delete selected group?
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Choose whether to remove only the group wrapper or remove
                    the contained steps too.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
                  onClick={() => setPendingGroupDelete(null)}
                  aria-label="Cancel group delete"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPendingGroupDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    performDeleteSelection(
                      pendingGroupDelete.nodeIds,
                      pendingGroupDelete.edgeIds,
                    )
                    setPendingGroupDelete(null)
                  }}
                >
                  Delete group only
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    performDeleteSelection(
                      pendingGroupDelete.nodeIds,
                      pendingGroupDelete.edgeIds,
                      { includeGroupChildren: true },
                    )
                    setPendingGroupDelete(null)
                  }}
                >
                  Delete entire group
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        <UnsavedExitDialog
          open={exitDialogOpen}
          saving={exitSaving}
          onCancel={() => setExitDialogOpen(false)}
          onDiscard={() => {
            clearLocalPreviewDraft()
            setExitDialogOpen(false)
            exitBuilderNow('automations')
          }}
          onSave={saveAndExitBuilder}
        />
      </div>
    </div>
  )
}
