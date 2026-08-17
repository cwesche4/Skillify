'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Edge, Node } from 'reactflow'
import { useRouter } from 'next/navigation'

import {
  InspectorAIStrip,
  InspectorDiffSection,
  InspectorFooter,
  InspectorHeader,
  InspectorLogsSection,
  InspectorPresetsSection,
  InspectorTabs,
  InspectorTelemetryDevPanel,
  InspectorValidationSection,
} from '@/lib/builder/inspector/components'
import { FeatureLockOverlay } from '@/components/upsell/FeatureLockOverlay'
import { LockedFeatureTooltip } from '@/components/upsell/LockedFeatureTooltip'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { NodeConfigPanelRenderer } from './NodeConfigPanels'
import {
  type BuilderNodeType,
  NODE_DEFINITIONS,
  type NodeData,
} from '@/lib/builder/node-types'
import {
  getInspectorLayout,
  type InspectorLayoutConfig,
  type InspectorTabId,
} from '@/lib/builder/inspector/layouts'
import { useInspectorSettings } from '@/lib/builder/inspector/hooks/useInspectorSettings'
import { useInspectorWorkMode } from '@/lib/builder/inspector/hooks/useInspectorWorkMode'
import { useInspectorPresets } from '@/lib/builder/inspector/hooks/useInspectorPresets'
import { useInspectorTelemetry } from '@/lib/builder/inspector/hooks/useInspectorTelemetry'
import { useInspectorAI } from '@/lib/builder/inspector/hooks/useInspectorAI'
import { useInspectorValidation } from '@/lib/builder/inspector/hooks/useInspectorValidation'
import { useInspectorWalkthrough } from '@/lib/builder/inspector/hooks/useInspectorWalkthrough'
import { INSPECTOR_WORK_MODES } from '@/lib/inspector/workModes'
import { resolveWorkModePolicy } from '@/lib/inspector/workModePolicy'
import { renderOverlays } from '@/lib/inspector/overlays/engine'
import { buildHeatmapOverlay } from '@/lib/inspector/overlays/heatmap'
import type { InspectorOverlay } from '@/lib/inspector/overlays/types'
import { featureFlags } from '@/lib/config/featureFlags'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { BuilderNodeValidation } from '@/lib/workflows/builderValidation'
import {
  type NodeValidationStatus,
  validateWorkflowNodeConfig,
} from '@/lib/workflows/nodeValidation'
import { validateNodeConfigVariables } from '@/lib/workflows/dataMapping'
import {
  formatVariableReadableLabel,
  getAvailableVariablesForNode,
  getNodeInputVariables,
  getNodeOutputVariables,
  resolveVariablePreviewText,
  type WorkflowVariableDefinition,
} from '@/lib/workflows/variableRegistry'
import type {
  WorkflowDataFlowConsumption,
  WorkflowDataFlowVariable,
} from '@/lib/workflows/workflowDataFlow'
import type {
  WorkflowBranchNodeAnalysis,
  WorkflowBranchAnalysisReport,
} from '@/lib/workflows/workflowBranches'

type PlanLabel = 'Basic' | 'Pro' | 'Elite' | string

export interface InspectorPanelProps {
  node: Node<NodeData> | null
  onChangeNode: (nodeId: string, data: Partial<NodeData>) => void
  onAiImprove: () => Promise<void> | void
  workspaceId: string
  automationId: string
  planLabel: PlanLabel
  logs?: { ts: number; level: 'info' | 'error'; message: string }[]
  layoutVariant?: 'compact' | 'standard' | 'wide' | 'unknown'
  widthPreset?: 'compact' | 'standard' | 'wide'
  pinned?: boolean
  onTogglePin?: () => void
  onPreset?: (size: number) => void
  showLayoutBadge?: boolean
  inspectorTabs?: InspectorTabId[]
  layoutConfig?: InspectorLayoutConfig
  followsSelection?: boolean
  onToggleFollowsSelection?: () => void
  onClose?: () => void
  dockSide?: 'left' | 'right' | 'overlay'
  nodes?: Node[]
  edges?: Edge[]
  nodeValidation?: BuilderNodeValidation
  focusFieldKey?: string | null
  focusFieldKeys?: string[]
  focusRequestId?: number
  requestedTab?: InspectorTabId | null
  requestedScrollTop?: number | null
  requestedViewRequestId?: number
  dataFlowSummary?: {
    available: WorkflowDataFlowVariable[]
    produces: WorkflowDataFlowVariable[]
    consumes: WorkflowDataFlowConsumption[]
    branchNode?: WorkflowBranchNodeAnalysis
    pathContext?: WorkflowBranchAnalysisReport['pathByNodeId'][string]
    mergePoints?: WorkflowBranchAnalysisReport['merges']
  } | null
  onConnectBranchPath?: (
    nodeId: string,
    sourceHandle: string,
    pathLabel: string,
  ) => void
  onInspectorViewChange?: (state: {
    tab: InspectorTabId
    scrollTop: number
  }) => void
  onFocusHandled?: () => void
}

function hasPro(plan: PlanLabel) {
  return plan === 'Pro' || plan === 'Elite'
}

function hasElite(plan: PlanLabel) {
  return plan === 'Elite'
}

function getAiImproveLabel(
  definition: ReturnType<typeof getWorkflowNodeDefinition> | null,
) {
  if (definition?.category === 'AI') return 'Improve AI Prompt'
  return 'Improve with AI'
}

function fieldKey(field: { key?: string; id: string }) {
  return field.key ?? field.id
}

function previewValueForField({
  value,
  fallback,
  variables,
}: {
  value: unknown
  fallback?: unknown
  variables: WorkflowVariableDefinition[]
}) {
  const raw = value ?? fallback ?? ''
  const preview = resolveVariablePreviewText(raw, variables)
  if (typeof preview === 'string') return preview
  if (preview === undefined || preview === null) return ''
  if (typeof preview === 'object') return JSON.stringify(preview)
  return String(preview)
}

export default function InspectorPanel({
  node,
  onChangeNode,
  onAiImprove,
  workspaceId,
  automationId,
  planLabel,
  logs = [],
  layoutVariant = 'standard',
  widthPreset,
  pinned = false,
  onTogglePin,
  onPreset,
  showLayoutBadge = false,
  inspectorTabs,
  layoutConfig,
  followsSelection,
  onToggleFollowsSelection,
  onClose,
  dockSide,
  nodes = [],
  edges = [],
  nodeValidation,
  focusFieldKey,
  focusFieldKeys,
  focusRequestId,
  requestedTab,
  requestedScrollTop,
  requestedViewRequestId,
  dataFlowSummary,
  onConnectBranchPath,
  onInspectorViewChange,
  onFocusHandled,
}: InspectorPanelProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<InspectorTabId>('config')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string>('')
  const [showRawAdvancedJson, setShowRawAdvancedJson] = useState(false)
  const [localLogs] = useState<
    { ts: number; level: 'info' | 'error'; message: string }[]
  >(logs ?? [])
  const [hintDismissed, setHintDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return (
        window.localStorage.getItem('skillify.inspectorHint.dismissed') ===
        'true'
      )
    } catch {
      return false
    }
  })
  const [hintVisible, setHintVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focusFieldKey) return
    setActiveTab('config')
  }, [focusFieldKey, focusRequestId])

  useEffect(() => {
    if (!requestedTab) return
    setActiveTab(requestedTab)
  }, [requestedTab, requestedViewRequestId])

  useEffect(() => {
    if (typeof requestedScrollTop !== 'number') return
    window.requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({
        top: Math.max(0, requestedScrollTop),
        behavior: 'auto',
      })
    })
  }, [requestedScrollTop, requestedViewRequestId])

  useEffect(() => {
    onInspectorViewChange?.({
      tab: activeTab,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    })
  }, [activeTab, onInspectorViewChange])

  const registryDefinition = useMemo(() => {
    if (!node) return null
    const registryNodeId =
      typeof (node.data as any)?.__registryNodeId === 'string'
        ? (node.data as any).__registryNodeId
        : undefined
    return (
      getWorkflowNodeDefinition(registryNodeId ?? node.type ?? '') ??
      getWorkflowNodeDefinition(node.type ?? '') ??
      null
    )
  }, [node])

  const meta = useMemo(() => {
    if (!node) return null
    const fallback = NODE_DEFINITIONS[node.type as BuilderNodeType] ?? null
    if (!registryDefinition) return fallback
    return {
      type: node.type as BuilderNodeType,
      label: registryDefinition.label,
      category: registryDefinition.category,
      description: registryDefinition.description,
      defaultData: fallback?.defaultData,
      proFeature: registryDefinition.planRequirement === 'pro',
      enterpriseFeature: registryDefinition.planRequirement === 'elite',
    }
  }, [node, registryDefinition])

  const derivedLayout = useMemo(
    () => layoutConfig ?? getInspectorLayout(node?.type as BuilderNodeType),
    [layoutConfig, node?.type],
  )

  const activeTabs = useMemo(
    () =>
      (inspectorTabs ?? derivedLayout.tabs).filter(
        (tab) => tab !== 'ai' || registryDefinition?.category === 'AI',
      ),
    [derivedLayout.tabs, inspectorTabs, registryDefinition?.category],
  )
  const tabLabels: Record<InspectorTabId, string> = useMemo(
    () => ({
      config: 'Setup',
      data: 'Input/Output',
      logs: 'History',
      ai: 'AI',
      tests: 'Tests',
      schedule: 'Schedule',
      inputs: 'Inputs',
      outputs: 'Outputs',
    }),
    [],
  )

  const { settings, toggleSetting } = useInspectorSettings(workspaceId)
  const { workMode, updateWorkMode, applyExpertPreset, restoreFromBackup } =
    useInspectorWorkMode(workspaceId)
  const policy = useMemo(
    () => resolveWorkModePolicy(workMode, settings),
    [workMode, settings],
  )
  const effectiveSettings = useMemo(
    () => ({
      ...settings,
      // User settings are the source of truth; work mode can only restrict.
      enableInspectorAI: settings.enableInspectorAI && policy.aiEnabled,
      enableSuggestions:
        settings.enableSuggestions && policy.suggestionsEnabled,
      enableAutoFix: settings.enableAutoFix && policy.autoFixEnabled,
      enableWalkthroughs:
        settings.enableWalkthroughs && policy.walkthroughsEnabled,
    }),
    [settings, policy],
  )
  const telemetryAllowed =
    !!effectiveSettings.enableTelemetry && policy.telemetryLevel !== 'silent'
  const {
    presets,
    presetName,
    setPresetName,
    savePreset,
    applyPreset,
    deletePreset,
  } = useInspectorPresets(workspaceId, node?.type)
  const { logEvent, trackOnce, getBuffer } =
    useInspectorTelemetry(telemetryAllowed)
  const allowPresetTelemetry = telemetryAllowed && !!workspaceId && !!node?.type

  const data: NodeData = useMemo(
    () => (node?.data as NodeData | undefined) ?? {},
    [node?.data],
  )
  const { result: validationResult, graph: validationGraph } =
    useInspectorValidation(node?.type as BuilderNodeType | undefined, data, {
      workspaceId,
      automationId,
      enableTelemetry: settings.enableTelemetry,
    })
  const registryValidation = useMemo(() => {
    const base = validateWorkflowNodeConfig(
      typeof data.__registryNodeId === 'string'
        ? data.__registryNodeId
        : node?.type,
      data,
    )
    if (!node) return base
    const variableMessages = validateNodeConfigVariables({
      node,
      nodes,
      edges,
    }).map((issue) => ({
      field: issue.field,
      severity: issue.severity,
      message: issue.message,
    }))
    if (!variableMessages.length) return base
    const messages = [...base.messages, ...variableMessages].filter(
      (message, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.field === message.field &&
            candidate.severity === message.severity &&
            candidate.message === message.message,
        ) === index,
    )
    const status: NodeValidationStatus = messages.some(
      (message) => message.severity === 'error',
    )
      ? 'error'
      : messages.some((message) => message.severity === 'warning')
        ? 'warning'
        : 'ready'
    return {
      status,
      messages,
    }
  }, [data, edges, node, nodes])
  const inputPreview = useMemo(
    () => (node ? getNodeInputVariables(node) : []),
    [node],
  )
  const outputPreview = useMemo(
    () => (node ? getNodeOutputVariables(node) : []),
    [node],
  )
  const availableUpstreamVariables = useMemo(
    () => (node ? getAvailableVariablesForNode(node, { nodes, edges }) : []),
    [edges, node, nodes],
  )
  const setupInputPreview = useMemo(() => {
    if (!registryDefinition) return inputPreview
    const fields = registryDefinition.configFields.filter(
      (field) => field.supportsVariables || field.required,
    )
    return fields.map((field) => {
      const key = fieldKey(field)
      return {
        key,
        label: field.mappingLabel ?? field.label,
        type: field.acceptedTypes?.[0] ?? 'string',
        previewValue: previewValueForField({
          value: data[key],
          fallback: field.defaultValue ?? field.placeholder,
          variables: availableUpstreamVariables,
        }),
      }
    })
  }, [availableUpstreamVariables, data, inputPreview, registryDefinition])
  const groupedDataFlowAvailable = useMemo(() => {
    const sourceGroup = (variable: WorkflowDataFlowVariable) => {
      if (variable.sourceNodeId) return 'Workflow Data'
      if (
        variable.category === 'Workspace Variables' ||
        variable.key.startsWith('workspace.') ||
        variable.key.startsWith('owner.')
      )
        return 'Workspace Data'
      if (variable.category === 'CRM') return 'CRM Data'
      if (
        variable.dataRole === 'runtime' ||
        variable.category === 'Automation'
      ) {
        return 'Runtime Data'
      }
      return variable.category || 'Workflow Data'
    }
    const order = [
      'Workflow Data',
      'Workspace Data',
      'CRM Data',
      'Runtime Data',
    ]
    const groups = (dataFlowSummary?.available ?? []).reduce<
      Record<string, WorkflowDataFlowVariable[]>
    >((acc, variable) => {
      const group = sourceGroup(variable)
      acc[group] = acc[group] ?? []
      acc[group].push(variable)
      return acc
    }, {})
    return [
      ...order
        .filter((group) => groups[group]?.length)
        .map((group) => ({ group, variables: groups[group] })),
      ...Object.entries(groups)
        .filter(([group]) => !order.includes(group))
        .map(([group, variables]) => ({ group, variables })),
    ]
  }, [dataFlowSummary?.available])
  const walkthrough = useInspectorWalkthrough({
    workspaceId,
    nodeType: node?.type,
    tab: activeTab,
    enableAI: effectiveSettings.enableInspectorAI,
    enableWalkthroughs: effectiveSettings.enableWalkthroughs,
    logEvent,
  })

  const {
    score,
    aiTone,
    suggestion,
    aiSuggestionError,
    dismissSuggestion,
    applyAutoFix,
    diffPanel,
    showDiff,
    setShowDiff,
  } = useInspectorAI({
    node,
    data,
    activeTab,
    layoutVariant,
    dockSide,
    widthPreset,
    pinned,
    followsSelection,
    settings: effectiveSettings,
    workMode,
    enableTelemetry: settings.enableTelemetry,
    logEvent,
    trackOnce,
    workspaceId,
    automationId,
    metaLabel: meta?.label,
  })

  const handleFieldChange = (key: string, value: any) => {
    if (!node) return
    onChangeNode(node.id, {
      ...data,
      [key]: value,
    })
  }

  const canAiImprove = hasPro(planLabel)
  const currentVariant = layoutVariant ?? derivedLayout.variant
  const layoutClass =
    currentVariant === 'compact'
      ? 'px-3 py-2 text-[12px] gap-1.5'
      : currentVariant === 'wide'
        ? 'px-5 py-4 text-[13px] gap-3'
        : 'px-4 py-3'

  const bodyPadding =
    currentVariant === 'compact'
      ? 'px-3 py-2'
      : currentVariant === 'wide'
        ? 'px-5 py-4'
        : 'px-4 py-3'

  const heatmapEnabled = useMemo(
    () =>
      Boolean(
        settings.enableHeatmap &&
        featureFlags.inspectorHeatmaps &&
        policy.telemetryLevel !== 'silent',
      ),
    [policy.telemetryLevel, settings.enableHeatmap],
  )

  const overlays = useMemo<InspectorOverlay[]>(
    () => (heatmapEnabled ? [buildHeatmapOverlay([], heatmapEnabled)] : []),
    [heatmapEnabled],
  )

  const overlayElements = useMemo(
    () => renderOverlays(overlays).map((o) => o.element),
    [overlays],
  )

  useEffect(() => {
    if (activeTabs.length && !activeTabs.includes(activeTab)) {
      setActiveTab(activeTabs[0])
    }
  }, [activeTabs, activeTab])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (!hintDismissed && node && !hintVisible) {
        setHintVisible(true)
      }
    } else {
      if (!hintDismissed && node && !hintVisible) {
        setHintVisible(true)
      }
    }
  }, [hintDismissed, node, hintVisible])

  useEffect(() => {
    logEvent('inspector_tab_changed', {
      workspaceId,
      automationId,
      nodeType: node?.type,
      tab: activeTab,
      dockSide,
      widthPreset,
    })
  }, [
    activeTab,
    automationId,
    dockSide,
    node?.type,
    widthPreset,
    workspaceId,
    logEvent,
  ])
  const prevTab = useRef<InspectorTabId | null>(null)
  useEffect(() => {
    if (!node) return
    if (prevTab.current === activeTab) return
    logEvent('inspector_tab_viewed', {
      workspaceId,
      automationId,
      nodeType: node.type,
      tab: activeTab,
      previousTab: prevTab.current,
    })
    prevTab.current = activeTab
  }, [activeTab, automationId, node, workspaceId, logEvent])

  useEffect(() => {
    logEvent('inspector_opened', {
      workspaceId,
      automationId,
      dockSide,
      widthPreset,
      pinned,
    })
    return () => {
      logEvent('inspector_closed', {
        workspaceId,
        automationId,
        dockSide,
        widthPreset,
        pinned,
      })
    }
  }, [automationId, dockSide, pinned, widthPreset, workspaceId, logEvent])

  if (!node || !meta) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 bg-slate-950/95 px-4">
        {onClose && (
          <button
            type="button"
            aria-label="Close step settings"
            className="absolute right-3 top-3 rounded-md border border-slate-800/70 bg-slate-900 px-2 py-1 text-[12px] text-slate-300 hover:border-slate-700 hover:text-slate-100"
            onClick={onClose}
          >
            ×
          </button>
        )}
        <p className="text-xs font-medium text-slate-400">
          {pinned ? 'Step Settings pinned' : 'No step selected'}
        </p>
        <p className="max-w-[240px] text-center text-[11px] text-slate-500">
          {pinned
            ? 'Step Settings stays open. Select a step to edit it or unpin to auto-close.'
            : 'Click any step on the canvas to edit its settings.'}
        </p>
        {onTogglePin && (
          <Button size="xs" variant="secondary" onClick={onTogglePin}>
            {pinned ? 'Unpin' : 'Pin Step Settings'}
          </Button>
        )}
      </div>
    )
  }

  const statusMessages = nodeValidation?.messages ?? registryValidation.messages
  const hasErrors =
    nodeValidation?.state === 'error' || registryValidation.status === 'error'
  const hasWarnings =
    !hasErrors &&
    (nodeValidation?.state === 'warning' ||
      nodeValidation?.state === 'disconnected' ||
      registryValidation.status === 'warning')
  const registryIssueCount = statusMessages.length
  const proLocked = !!meta.proFeature && !hasPro(planLabel)
  const eliteLocked = !!meta.enterpriseFeature && !hasElite(planLabel)
  const lockMessage = eliteLocked
    ? 'This node is available on the Elite plan.'
    : proLocked
      ? 'This node is available on Pro & Elite plans.'
      : undefined

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-800/80 bg-slate-950/95 ${
        currentVariant !== 'standard'
          ? 'ring-1 ring-sky-500/20 transition-shadow duration-200'
          : ''
      }`}
      data-testid="inspector-root"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        {overlayElements}
      </div>
      <InspectorHeader
        meta={{
          label: meta.label,
          category: meta.category,
          description: meta.description,
          icon: registryDefinition?.iconKey ?? registryDefinition?.ui?.icon,
          planLabel:
            registryDefinition?.planRequirement === 'elite'
              ? 'Elite'
              : registryDefinition?.planRequirement === 'pro'
                ? 'Pro'
                : 'Free',
          canBeTrigger: registryDefinition?.canBeTrigger,
          canBeAction: registryDefinition?.canBeAction,
        }}
        planLabel={planLabel}
        hasErrors={hasErrors}
        hasWarnings={hasWarnings}
        warningCount={hasWarnings ? registryIssueCount : 0}
        layoutBadge={derivedLayout.badge}
        layoutVariant={derivedLayout.variant}
        showLayoutBadge={showLayoutBadge}
        workMode={workMode}
        onWorkModeChange={(mode) => {
          const prev = { ...settings }
          updateWorkMode(mode)
          if (mode === 'expert') {
            applyExpertPreset(prev, toggleSetting)
          } else {
            restoreFromBackup(toggleSetting)
          }
          logEvent('inspector_work_mode_changed', {
            workspaceId,
            automationId,
            nodeType: node.type,
            mode,
          })
          const nextDefault =
            resolveWorkModePolicy(mode, settings).defaultTab ||
            INSPECTOR_WORK_MODES[mode]?.defaultTab
          if (nextDefault) {
            setActiveTab((nextDefault as InspectorTabId) ?? 'config')
          }
        }}
        settings={settings as any}
        onToggleSetting={(key, next) => {
          toggleSetting(key as any, next)
        }}
        followsSelection={followsSelection}
        onToggleFollowsSelection={() => {
          onToggleFollowsSelection?.()
          logEvent('inspector_follow_toggle', {
            workspaceId,
            automationId,
            nodeType: node.type,
            dockSide,
            widthPreset,
          })
        }}
        widthPreset={widthPreset}
        onPreset={
          onPreset
            ? (size) => {
                onPreset(size)
                const presetKey =
                  size === 320 ? 'compact' : size === 560 ? 'wide' : 'standard'
                logEvent('inspector_width_preset', {
                  workspaceId,
                  automationId,
                  widthPreset: presetKey,
                })
              }
            : undefined
        }
        onTogglePin={
          onTogglePin
            ? () => {
                onTogglePin()
                logEvent('inspector_pin_toggle', {
                  workspaceId,
                  automationId,
                  nodeType: node.type,
                  dockSide,
                  widthPreset,
                })
              }
            : undefined
        }
        pinned={pinned}
        onClose={onClose}
      />

      {hasWarnings ? (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-100">
          {registryIssueCount === 1
            ? '1 item needs review.'
            : `${registryIssueCount} items need review.`}{' '}
          Review this step before publishing.
        </div>
      ) : null}

      {!hintDismissed && hintVisible && (
        <details className="border-b border-slate-800/70 bg-slate-900/35 px-3 py-1.5 text-[11px] text-slate-300">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Tip
          </summary>
          <div className="mt-1 flex items-start gap-2">
            <span className="flex-1">
              Press ] to toggle. Pin keeps it open. Presets resize quickly.
            </span>
            <button
              className="text-[10px] text-slate-500 hover:text-slate-200"
              onClick={() => {
                try {
                  window.localStorage.setItem(
                    'skillify.inspectorHint.dismissed',
                    'true',
                  )
                } catch {
                  // ignore unavailable storage
                }
                setHintDismissed(true)
                setHintVisible(false)
              }}
            >
              Dismiss
            </button>
          </div>
        </details>
      )}

      {walkthrough.isActive && walkthrough.currentStep && (
        <div className="border-b border-slate-800/80 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-200">
          <div className="flex items-start gap-2">
            <div className="min-w-[120px] text-[11px] font-semibold text-slate-100">
              {walkthrough.currentStep.title}
            </div>
            <div className="flex-1 text-[11px] text-slate-300">
              {walkthrough.currentStep.description}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="secondary"
                onClick={() => walkthrough.next()}
              >
                Next
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => walkthrough.dismiss()}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      <InspectorTabs
        activeTabs={activeTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabLabels={tabLabels}
        bodyPadding={`${bodyPadding}`}
      />

      <div
        ref={scrollContainerRef}
        data-inspector-scroll="true"
        className={`flex-1 space-y-4 overflow-y-auto ${bodyPadding}`}
        onScroll={(event) => {
          onInspectorViewChange?.({
            tab: activeTab,
            scrollTop: event.currentTarget.scrollTop,
          })
        }}
      >
        {(proLocked || eliteLocked) && lockMessage && (
          <LockedFeatureTooltip
            planLabel={planLabel}
            requiredPlan={eliteLocked ? 'Elite' : 'Pro'}
            message={lockMessage}
          />
        )}

        <InspectorAIStrip
          scoreVisible={effectiveSettings.enableInspectorAI}
          scoreValue={score ?? 0}
          scoreReason={aiSuggestionError ?? suggestion ?? 'Setup score'}
          suggestion={suggestion}
          canAiImprove={canAiImprove}
          onDismissSuggestion={() => {
            dismissSuggestion()
          }}
          onApplyFix={
            effectiveSettings.enableAutoFix
              ? () => applyAutoFix(onChangeNode)
              : undefined
          }
        />

        {activeTab === 'config' && (
          <FeatureLockOverlay
            planLabel={planLabel}
            requiredPlan={eliteLocked ? 'Elite' : proLocked ? 'Pro' : undefined}
            onUpgradeClick={() => router.push('/marketing/pricing')}
            className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3"
          >
            <InspectorPresetsSection
              presetName={presetName}
              onPresetNameChange={setPresetName}
              presets={presets}
              onSavePreset={() => {
                const saved = savePreset(data)
                if (allowPresetTelemetry && saved) {
                  logEvent('inspector_preset_saved', {
                    workspaceId,
                    automationId,
                    nodeType: node.type,
                    presetName,
                  })
                }
              }}
              onApplyPreset={(name) => {
                const preset = applyPreset(name)
                if (!preset) return
                onChangeNode(node.id, preset)
                if (allowPresetTelemetry) {
                  logEvent('inspector_preset_applied', {
                    workspaceId,
                    automationId,
                    nodeType: node.type,
                    presetName: name,
                  })
                }
              }}
              onDeletePreset={(name) => {
                const existed = !!presets[name]
                const deleted = deletePreset(name)
                if (allowPresetTelemetry && existed && deleted) {
                  logEvent('inspector_preset_deleted', {
                    workspaceId,
                    automationId,
                    nodeType: node.type,
                    presetName: name,
                  })
                }
              }}
            />

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">
                Step name
              </label>
              <Input
                value={data.label ?? meta.label}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>

            <div
              className={`rounded-xl border p-3 text-[11px] ${
                hasErrors
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                  : hasWarnings
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              {hasErrors
                ? registryIssueCount === 1
                  ? '1 setup issue'
                  : `${registryIssueCount} setup issues`
                : hasWarnings
                  ? registryIssueCount === 1
                    ? '1 setup warning'
                    : `${registryIssueCount} setup warnings`
                  : 'Ready'}
              {statusMessages.length ? (
                <ul className="mt-2 space-y-1">
                  {statusMessages.map((message, index) => (
                    <li
                      key={`${message.field ?? 'step'}:${message.message}:${index}`}
                    >
                      • {message.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <NodeConfigPanelRenderer
              definition={registryDefinition}
              config={data}
              validation={registryValidation}
              onChange={handleFieldChange}
              node={node}
              nodes={nodes}
              edges={edges}
              focusFieldKey={focusFieldKey}
              focusFieldKeys={focusFieldKeys}
              focusRequestId={focusRequestId}
              onFocusHandled={onFocusHandled}
            />

            {canAiImprove && (
              <div className="space-y-2 pt-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={aiLoading}
                  onClick={async () => {
                    try {
                      setAiLoading(true)
                      setAiError(null)
                      const res = await fetch('/api/ai/node-improve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          data,
                          type: node.type,
                          workspaceId,
                          automationId,
                          nodeId: node.id,
                        }),
                      })
                      if (!res.ok) throw new Error('AI configuration failed')
                      const patch = await res.json()
                      const merged = { ...data, ...(patch ?? {}) }
                      const validation = validateWorkflowNodeConfig(
                        typeof data.__registryNodeId === 'string'
                          ? data.__registryNodeId
                          : node.type,
                        merged,
                      )
                      if (validation.status === 'error') {
                        setAiError(
                          validation.messages
                            .map((message) => message.message)
                            .join(', '),
                        )
                        return
                      }
                      onChangeNode(node.id, merged)
                      setAiNote('Applied AI suggestions')
                    } catch (err: any) {
                      setAiError(err?.message ?? 'AI configuration failed')
                    } finally {
                      setAiLoading(false)
                    }
                  }}
                >
                  {aiLoading
                    ? 'Improving...'
                    : getAiImproveLabel(registryDefinition)}
                </Button>
                {aiError && (
                  <p className="text-[11px] text-rose-400">{aiError}</p>
                )}
                {aiNote && (
                  <p className="text-[11px] text-emerald-400">{aiNote}</p>
                )}
              </div>
            )}
          </FeatureLockOverlay>
        )}

        {activeTab === 'data' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
              <p className="mb-3 text-[11px] font-semibold text-slate-100">
                {data.__replayMode ? 'Replay Mode' : 'Last Preview Run'}
              </p>
              {data.__lastPreviewStatus ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <span className="text-slate-400">Status</span>
                    <span className="capitalize text-slate-100">
                      {String(data.__lastPreviewStatus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <span className="text-slate-400">Duration</span>
                    <span className="text-slate-100">
                      {String(data.__lastPreviewDurationMs ?? 0)}ms
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <p className="text-slate-400">Dynamic Values Created</p>
                    <p className="mt-1 break-words text-slate-100">
                      {Object.keys(
                        (data.__lastPreviewOutput ?? {}) as Record<
                          string,
                          unknown
                        >,
                      )
                        .filter((key) => !key.startsWith('__'))
                        .join(', ') || 'None'}
                    </p>
                  </div>
                  {Array.isArray(data.__lastPreviewWarnings) &&
                  data.__lastPreviewWarnings.length ? (
                    <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-amber-100">
                      {data.__lastPreviewWarnings.join(', ')}
                    </div>
                  ) : null}
                  {Array.isArray(data.__lastPreviewErrors) &&
                  data.__lastPreviewErrors.length ? (
                    <div className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-rose-100">
                      {data.__lastPreviewErrors.join(', ')}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-slate-500">
                  Run Preview to see execution output, duration, dynamic values,
                  warnings, and errors for this step.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
              <p className="mb-3 text-[11px] font-semibold text-slate-100">
                Input Preview
              </p>
              <div className="space-y-2">
                {(setupInputPreview.length ? setupInputPreview : []).map(
                  (input) => (
                    <div
                      key={input.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2"
                    >
                      <div>
                        <p className="text-slate-200">{input.label}</p>
                        <p className="text-[10px] text-slate-500">
                          {input.type}
                        </p>
                      </div>
                      <p className="max-w-[160px] truncate text-right text-slate-400">
                        {String(input.previewValue)}
                      </p>
                    </div>
                  ),
                )}
                {!setupInputPreview.length ? (
                  <p className="text-slate-500">
                    This step does not require previous step data. If it uses
                    dynamic values, they appear below.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
              <p className="mb-3 text-[11px] font-semibold text-slate-100">
                Data Flow Summary
              </p>
              <div className="space-y-3">
                <section className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {registryDefinition?.canBeTrigger
                      ? 'Available Context'
                      : 'Inputs Available'}
                  </p>
                  <div className="space-y-2">
                    {groupedDataFlowAvailable.slice(0, 4).map((group) => (
                      <div key={group.group}>
                        <p className="mb-1 text-[10px] font-medium text-slate-500">
                          {group.group}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.variables.slice(0, 6).map((variable) => (
                            <span
                              key={variable.key}
                              className="rounded-full border border-slate-700/70 bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-300"
                              title={variable.token}
                            >
                              {formatVariableReadableLabel(variable)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!groupedDataFlowAvailable.length ? (
                      <p className="text-slate-500">
                        {registryDefinition?.canBeTrigger
                          ? 'Workspace and workflow runtime context will be available when this trigger runs.'
                          : 'Connect a previous step to make workflow data available here.'}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Data Used by This Step
                  </p>
                  <div className="space-y-1.5">
                    {(dataFlowSummary?.consumes ?? [])
                      .slice(0, 6)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-slate-200">
                              {item.variableLabel}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {item.sourceNodeLabel
                                ? `From ${item.sourceNodeLabel}`
                                : 'Workflow data'}{' '}
                              → {item.fieldLabel}
                            </p>
                          </div>
                          <p className="shrink-0 text-slate-400">
                            {item.variableType}
                          </p>
                        </div>
                      ))}
                    {!(dataFlowSummary?.consumes ?? []).length ? (
                      <p className="text-slate-500">
                        No workflow data consumed yet.
                      </p>
                    ) : null}
                  </div>
                </section>

                {dataFlowSummary?.branchNode ||
                dataFlowSummary?.pathContext ||
                dataFlowSummary?.mergePoints?.length ? (
                  <section className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Branch Context
                    </p>
                    <div className="space-y-2">
                      {dataFlowSummary?.branchNode ? (
                        <div className="rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5">
                          <p className="text-slate-200">
                            {dataFlowSummary.branchNode.mode.replace(/-/g, ' ')}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {dataFlowSummary.branchNode.selectedPathKeys.length}{' '}
                            selected ·{' '}
                            {dataFlowSummary.branchNode.skippedPathKeys.length}{' '}
                            skipped · {dataFlowSummary.branchNode.readiness}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {dataFlowSummary.branchNode.paths
                              .slice(0, 5)
                              .map((path) => (
                                <span
                                  key={path.pathKey}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  <span
                                    className={[
                                      'rounded-full border px-2 py-0.5 text-[10px]',
                                      dataFlowSummary.branchNode?.selectedPathKeys.includes(
                                        path.pathKey,
                                      )
                                        ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                                        : dataFlowSummary.branchNode?.skippedPathKeys.includes(
                                              path.pathKey,
                                            )
                                          ? 'border-slate-700/70 bg-slate-950/50 text-slate-400'
                                          : path.readiness === 'error'
                                            ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
                                            : path.readiness === 'warning'
                                              ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                                              : 'border-slate-700/70 bg-slate-950/50 text-slate-300',
                                    ].join(' ')}
                                    title={
                                      path.connectedNodeIds.length
                                        ? `Connected to ${path.connectedNodeIds.join(', ')}`
                                        : 'Connected to: Not connected'
                                    }
                                  >
                                    {path.pathLabel}
                                  </span>
                                </span>
                              ))}
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {dataFlowSummary.branchNode.paths
                              .slice(0, 5)
                              .map((path) => {
                                const connectedLabels =
                                  path.connectedNodeIds.map((nodeId) => {
                                    const connectedNode = nodes.find(
                                      (item) => item.id === nodeId,
                                    )
                                    return connectedNode
                                      ? String(
                                          (connectedNode.data as any)?.label ??
                                            connectedNode.type ??
                                            nodeId,
                                        )
                                      : nodeId
                                  })
                                return (
                                  <div
                                    key={`${path.pathKey}:summary`}
                                    className="rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-medium text-slate-200">
                                        {path.pathLabel}
                                      </p>
                                      {!path.connectedNodeIds.length ? (
                                        <button
                                          type="button"
                                          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100 transition hover:border-cyan-200/60"
                                          onClick={() => {
                                            if (node) {
                                              onConnectBranchPath?.(
                                                node.id,
                                                path.sourceHandle,
                                                path.pathLabel,
                                              )
                                            }
                                          }}
                                        >
                                          Connect {path.pathLabel}
                                        </button>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500">
                                      Runs when:{' '}
                                      {path.isFallback
                                        ? 'the condition does not match'
                                        : path.conditionSummary ||
                                          'the condition matches'}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-slate-500">
                                      Connected to:{' '}
                                      {connectedLabels.length
                                        ? connectedLabels.join(', ')
                                        : 'Not connected'}
                                    </p>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      ) : null}

                      {dataFlowSummary?.pathContext ? (
                        <div className="rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5">
                          <p className="text-slate-200">
                            Runs on {dataFlowSummary.pathContext.pathLabel}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Branch data is available only while this path runs.
                          </p>
                        </div>
                      ) : null}

                      {(dataFlowSummary?.mergePoints ?? []).map((merge) => (
                        <div
                          key={`${merge.sourceBranchNodeId}:${merge.mergeNodeId}`}
                          className="rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5"
                        >
                          <p className="text-slate-200">
                            Merge readiness:{' '}
                            {merge.mergeStatus.replace(/-/g, ' ')}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Guaranteed {merge.guaranteedVariables.length} ·
                            optional {merge.optionalVariables.length} ·
                            conflicting {merge.conflictingVariables.length}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {registryDefinition?.canBeTrigger
                      ? 'Trigger Outputs'
                      : 'Outputs Produced'}
                  </p>
                  <div className="space-y-1.5">
                    {(dataFlowSummary?.produces ?? [])
                      .slice(0, 7)
                      .map((variable) => (
                        <div
                          key={variable.key}
                          className="flex items-start justify-between gap-3 rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-slate-200">
                              {formatVariableReadableLabel(variable)}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              Sample:{' '}
                              {String(
                                variable.sampleValue ??
                                  variable.previewValue ??
                                  'Preview value pending',
                              )}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-slate-400">{variable.type}</p>
                            {variable.dataRole !== 'business' ? (
                              <p className="text-[10px] capitalize text-slate-600">
                                {variable.dataRole}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    {!(dataFlowSummary?.produces ?? []).length ? (
                      <p className="text-slate-500">No registered outputs.</p>
                    ) : null}
                  </div>
                </section>

                {(dataFlowSummary?.produces ?? []).length ? (
                  <section className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Downstream Use
                    </p>
                    <div className="space-y-1.5">
                      {(dataFlowSummary?.produces ?? [])
                        .slice(0, 7)
                        .map((variable) => (
                          <div
                            key={variable.key}
                            className="rounded-md border border-slate-800/60 bg-slate-950/35 px-2 py-1.5"
                          >
                            <p className="truncate text-slate-200">
                              {formatVariableReadableLabel(variable)}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {variable.consumers.length
                                ? variable.consumers
                                    .slice(0, 2)
                                    .map(
                                      (consumer) =>
                                        `${consumer.nodeLabel} → ${consumer.fieldLabel}`,
                                    )
                                    .join(', ')
                                : 'Not used downstream'}
                            </p>
                          </div>
                        ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
              <p className="mb-3 text-[11px] font-semibold text-slate-100">
                Advanced Details
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <span className="text-slate-400">Node Type</span>
                  <span className="text-right text-slate-100">
                    {registryDefinition?.category ??
                      meta?.category ??
                      'Workflow Step'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <span className="text-slate-400">Registry ID</span>
                  <span className="text-right text-slate-100">
                    {registryDefinition?.id ??
                      String(data.__registryNodeId ?? node?.type ?? 'Unknown')}
                  </span>
                </div>
                {typeof data.method === 'string' ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <span className="text-slate-400">Method</span>
                    <span className="text-right text-slate-100">
                      {data.method}
                    </span>
                  </div>
                ) : null}
                {typeof data.url === 'string' ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <span className="text-slate-400">Endpoint</span>
                    <span className="max-w-[170px] truncate text-right text-slate-100">
                      {data.url || 'Not configured'}
                    </span>
                  </div>
                ) : null}
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                  <p className="text-slate-400">Produces</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {outputPreview.length ? (
                      outputPreview.map((output) => (
                        <span
                          key={output.key}
                          className="rounded-full border border-slate-700/70 bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-200"
                        >
                          {output.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">
                        No registered outputs
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowRawAdvancedJson((value) => !value)}
                >
                  {showRawAdvancedJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                </Button>
                {showRawAdvancedJson ? (
                  <pre className="max-h-56 overflow-auto rounded-lg border border-slate-800/70 bg-slate-950/80 p-2 text-[11px] text-slate-300">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-3">
            {localLogs.length ? (
              <InspectorLogsSection
                logs={localLogs}
                workspaceId={workspaceId}
                automationId={automationId}
                onReplay={() => {
                  if (!workspaceId || !automationId) return
                  const url = new URL(
                    `/dashboard/${workspaceId}/automations/${automationId}/replay`,
                    window.location.origin,
                  )
                  if (node?.id) url.searchParams.set('nodeId', node.id)
                  if (node?.type) url.searchParams.set('nodeType', node.type)
                  router.push(url.pathname + url.search)
                  logEvent('inspector_replay_deeplink_clicked', {
                    workspaceId,
                    automationId,
                    nodeType: node.type,
                    nodeId: node.id,
                    tab: activeTab,
                  })
                }}
              />
            ) : (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-400">
                History is preview-only for now. Preview runs and future
                executions will appear here for this step.
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
            <p className="mb-2 text-[11px] font-semibold text-slate-100">
              AI Coach
            </p>
            <p className="text-[11px] text-slate-300">{aiTone}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              AI suggestions are preview-only and use the registry config for
              this node.
            </p>
          </div>
        )}

        {activeTab !== 'config' &&
          activeTab !== 'logs' &&
          activeTab !== 'data' &&
          activeTab !== 'ai' && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-300">
              <p className="text-[11px] text-slate-400">
                {tabLabels[activeTab]} coming soon for this node type.
              </p>
            </div>
          )}

        {activeTab !== 'config' && validationResult && !validationResult.ok ? (
          <InspectorValidationSection validationGraph={validationGraph} />
        ) : null}

        <InspectorTelemetryDevPanel
          entries={getBuffer()}
          visible={settings.enableTelemetry}
        />

        <InspectorDiffSection
          diffPanel={diffPanel}
          showDiff={showDiff}
          onToggleDiff={() => setShowDiff((v: any) => !v)}
        />
      </div>

      <InspectorFooter workspaceId={workspaceId} automationId={automationId} />
    </div>
  )
}
