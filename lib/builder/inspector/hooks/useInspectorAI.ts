// lib/builder/inspector/hooks/useInspectorAI.ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Node } from 'reactflow'

import { explainInspector } from '@/lib/ai/coach/inspectorExplainers'
import { requireAiActionConfirmation } from '@/lib/builder/ai/actions/confirmAction'
import { logAiAction } from '@/lib/builder/history/actionHistory'
import { scoreNodeConfiguration } from '@/lib/inspector/aiScoring'
import { buildBasicSuggestions } from '@/lib/inspector/suggestions'
import { validateNodeData } from '@/lib/builder/node-schemas'
import { type BuilderNodeType, type NodeData } from '@/lib/builder/node-types'
import {
  type InspectorTabId,
  getInspectorLayout,
} from '@/lib/builder/inspector/layouts'
import { type InspectorAISettings } from '@/lib/inspector/settings'
import { type InspectorWorkMode } from '@/lib/inspector/workModes'
import { resolveWorkModePolicy } from '@/lib/inspector/workModePolicy'

type Args = {
  node: Node<NodeData> | null
  data: NodeData
  activeTab: InspectorTabId
  layoutVariant?: string
  dockSide?: 'left' | 'right' | 'overlay'
  widthPreset?: 'compact' | 'standard' | 'wide'
  pinned?: boolean
  followsSelection?: boolean
  settings: InspectorAISettings
  workMode: InspectorWorkMode
  logEvent: (event: string, payload: Record<string, any>) => void
  trackOnce: (key: string, fn: () => void) => void
  workspaceId: string
  automationId: string
  enableTelemetry?: boolean
  metaLabel?: string
}

export type DiffPanel = { summary: string; before: any; after: any }

type UseInspectorAIResult = {
  score: number | null
  aiTone: string
  suggestion: string | null
  aiSuggestionError: string | null
  dismissSuggestion: () => void
  applyAutoFix: (
    onChangeNode: (nodeId: string, data: Partial<NodeData>) => void,
  ) => void
  diffPanel: DiffPanel | null
  showDiff: boolean
  setShowDiff: React.Dispatch<React.SetStateAction<boolean>>
}

export function useInspectorAI({
  node,
  data,
  activeTab,
  layoutVariant,
  dockSide,
  widthPreset,
  pinned,
  followsSelection,
  settings,
  workMode: _workMode,
  logEvent,
  trackOnce,
  workspaceId,
  automationId,
  metaLabel,
}: Args): UseInspectorAIResult {
  const policy = useMemo(
    () => resolveWorkModePolicy(_workMode, settings),
    [_workMode, settings],
  )

  const [aiSuggestionDismissed, setAiSuggestionDismissed] = useState(false)
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(
    null,
  )
  const [diffPanel] = useState<DiffPanel | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  const nodeScore = useMemo(() => scoreNodeConfiguration(node), [node])
  const score = nodeScore?.score ?? null

  const derivedLayout = useMemo(
    () => getInspectorLayout(node?.type as BuilderNodeType),
    [node?.type],
  )

  const appliedWidthPreset =
    widthPreset ??
    (layoutVariant === 'compact'
      ? 'compact'
      : layoutVariant === 'wide'
        ? 'wide'
        : 'standard')

  const aiTone = useMemo(() => {
    return explainInspector(
      (node?.type as BuilderNodeType) || 'unknown',
      activeTab,
      data,
      {
        layout: derivedLayout.variant,
        tab: activeTab,
        pinned,
        dock: dockSide ?? 'right',
        widthPreset: appliedWidthPreset,
        followSelection: followsSelection,
      },
    )
  }, [
    node?.type,
    activeTab,
    data,
    derivedLayout.variant,
    pinned,
    dockSide,
    appliedWidthPreset,
    followsSelection,
  ])

  const aiMode: 'off' | 'assist' | 'improve' | 'review' = useMemo(() => {
    if (!policy.aiEnabled || !settings.enableInspectorAI) return 'off'
    if (policy.autoFixEnabled && settings.enableAutoFix) return 'improve'
    if (policy.suggestionsEnabled && settings.enableSuggestions) return 'assist'
    return 'review'
  }, [
    policy.aiEnabled,
    policy.autoFixEnabled,
    policy.suggestionsEnabled,
    settings.enableAutoFix,
    settings.enableInspectorAI,
    settings.enableSuggestions,
  ])

  const suggestion = useMemo(() => {
    if (aiMode === 'off' || !policy.suggestionsEnabled) return null

    const minimal =
      node &&
      (!data ||
        Object.keys(data || {}).length <= 1 ||
        !data.label ||
        data.label === metaLabel)

    if (!minimal || aiSuggestionDismissed) return null

    const baseline = buildBasicSuggestions(node)[0]
    const text = baseline?.text || aiTone

    if (baseline?.id) {
      trackOnce(`ai-suggestion:${node.id}:${baseline.id}`, () =>
        logEvent('inspector_ai_suggestion_shown', {
          workspaceId,
          automationId,
          nodeType: node.type,
          tab: activeTab,
        }),
      )
    }

    return text
  }, [
    aiMode,
    policy.suggestionsEnabled,
    node,
    data,
    metaLabel,
    aiSuggestionDismissed,
    aiTone,
    activeTab,
    logEvent,
    trackOnce,
    workspaceId,
    automationId,
  ])

  useEffect(() => {
    if (aiMode === 'off' || !policy.aiEnabled || !node) return

    trackOnce(`ai-score:${node.id}`, () =>
      logEvent('inspector_ai_score_computed', {
        workspaceId,
        automationId,
        nodeType: node.type,
        tab: activeTab,
      }),
    )
  }, [
    aiMode,
    policy.aiEnabled,
    node,
    logEvent,
    trackOnce,
    workspaceId,
    automationId,
    activeTab,
  ])

  const dismissSuggestion = useCallback(() => {
    setAiSuggestionDismissed(true)

    if (node) {
      logEvent('inspector_ai_suggestion_dismissed', {
        workspaceId,
        automationId,
        nodeType: node.type,
        tab: activeTab,
      })
    }
  }, [node, logEvent, workspaceId, automationId, activeTab])

  const applyAutoFix = useCallback(
    (onChangeNode: (nodeId: string, data: Partial<NodeData>) => void) => {
      if (!node || !policy.autoFixEnabled) return

      const confirmed = requireAiActionConfirmation(
        'Apply this suggested change to your node?',
      )
      if (!confirmed) {
        logEvent('inspector_ai_action_cancelled', {
          workspaceId,
          automationId,
          nodeType: node.type,
          tab: activeTab,
        })
        return
      }

      try {
        const before = { ...data }

        const after = {
          ...before,
          label: before.label || (node.data as any)?.label || node.type,
        }

        const validation = validateNodeData(node.type as BuilderNodeType, after)

        if (!validation.ok) {
          setAiSuggestionError(validation.errors.join(', '))
          logEvent('inspector_ai_action_failed', {
            workspaceId,
            automationId,
            nodeType: node.type,
            tab: activeTab,
          })
          return
        }

        // ✅ ENTERPRISE AUDIT + ONE-STEP UNDO (explicit)
        logAiAction('Suggested change applied', () =>
          onChangeNode(node.id, before),
        )

        onChangeNode(node.id, validation.parsed)
        setAiSuggestionError(null)

        logEvent('inspector_ai_action_applied', {
          workspaceId,
          automationId,
          nodeType: node.type,
          tab: activeTab,
        })
      } catch (err: any) {
        setAiSuggestionError(err?.message ?? 'Suggested change failed')
        logEvent('inspector_ai_action_failed', {
          workspaceId,
          automationId,
          nodeType: node?.type,
          tab: activeTab,
        })
      }
    },
    [
      node,
      data,
      policy.autoFixEnabled,
      logEvent,
      workspaceId,
      automationId,
      activeTab,
    ],
  )

  return {
    score,
    aiTone,
    suggestion,
    aiSuggestionError,
    dismissSuggestion,
    applyAutoFix,
    diffPanel,
    showDiff,
    setShowDiff,
  }
}
