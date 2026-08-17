'use client'

import { useState, useCallback, useMemo } from 'react'
import type { AICallout } from '@/lib/ai/coach/types'

type CoachContext = {
  currentTime?: number
  activeNodeIds?: Set<string>
  inspector?: {
    layout: string
    dock?: string
    pinned?: boolean
    tab?: string
    selectedNodeType?: string
    widthPreset?: string
    followSelection?: boolean
  }
}

export function useAICoach(initial: AICallout[] = []) {
  const [enabled, setEnabled] = useState(false)
  const [callouts, setCallouts] = useState<AICallout[]>(initial)
  const [context, setContext] = useState<CoachContext>({})

  const toggle = useCallback(() => setEnabled((v) => !v), [])
  const set = useCallback((next: AICallout[]) => setCallouts(next), [])

  const visibleCallouts = useMemo(() => {
    if (!context.activeNodeIds || context.activeNodeIds.size === 0)
      return callouts
    return callouts.filter((c) => context.activeNodeIds?.has(c.targetId))
  }, [callouts, context.activeNodeIds])

  return {
    enabled,
    toggle,
    callouts,
    setCallouts: set,
    setContext,
    visibleCallouts,
  }
}
