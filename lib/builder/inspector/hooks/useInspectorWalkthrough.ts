'use client'

import { useCallback, useMemo, useState } from 'react'

import {
  INSPECTOR_WALKTHROUGH_STEPS,
  type WalkthroughStep,
} from '@/lib/builder/inspector/walkthrough/steps'
import { useEffect, useRef } from 'react'

const dismissedKey = (workspaceId: string | undefined) =>
  workspaceId ? `skillify.inspector.walkthrough.${workspaceId}` : null

function loadDismissed(workspaceId: string | undefined) {
  const key = dismissedKey(workspaceId)
  if (!key) return new Set<string>()
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set<string>()
  }
}

function saveDismissed(
  workspaceId: string | undefined,
  dismissed: Set<string>,
) {
  const key = dismissedKey(workspaceId)
  if (!key) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(dismissed)))
  } catch {
    /* ignore */
  }
}

type Args = {
  workspaceId?: string
  nodeType?: string
  tab?: string
  enableAI?: boolean
  enableWalkthroughs?: boolean
  logEvent?: (event: string, payload: Record<string, any>) => void
}

export function useInspectorWalkthrough({
  workspaceId,
  nodeType,
  tab,
  enableAI,
  enableWalkthroughs,
  logEvent,
}: Args) {
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    loadDismissed(workspaceId),
  )
  const viewedRef = useRef<Set<string>>(new Set())

  const steps = useMemo(() => {
    if (!enableWalkthroughs) return []
    return INSPECTOR_WALKTHROUGH_STEPS.filter((step) => {
      if (dismissed.has(step.id)) return false
      if (step.tab && step.tab !== tab) return false
      if (step.nodeTypes && nodeType && !step.nodeTypes.includes(nodeType))
        return false
      if (step.id === 'ai-suggestions' && !enableAI) return false
      return true
    })
  }, [dismissed, enableWalkthroughs, tab, nodeType, enableAI])

  const [index, setIndex] = useState(0)

  const currentStep: WalkthroughStep | undefined = steps[index]

  useEffect(() => {
    if (!currentStep || !logEvent) return
    if (viewedRef.current.has(currentStep.id)) return
    viewedRef.current.add(currentStep.id)
    logEvent('inspector_walkthrough_step_viewed', {
      workspaceId,
      nodeType,
      tab,
      step: currentStep.id,
    })
  }, [currentStep, logEvent, nodeType, tab, workspaceId])

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, steps.length - 1))
  }, [steps.length])

  const dismiss = useCallback(() => {
    if (!currentStep) return
    setDismissed((prev) => {
      const nextSet = new Set(prev)
      nextSet.add(currentStep.id)
      saveDismissed(workspaceId, nextSet)
      return nextSet
    })
    if (logEvent) {
      logEvent('inspector_walkthrough_dismissed', {
        workspaceId,
        nodeType,
        tab,
        step: currentStep.id,
      })
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1))
  }, [currentStep, logEvent, nodeType, steps.length, tab, workspaceId])

  const isActive = enableWalkthroughs === true && !!currentStep

  return { currentStep, next, dismiss, isActive }
}
