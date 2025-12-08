'use client'

import { useEffect, useState, useCallback } from 'react'

type PlanId = 'basic' | 'pro' | 'elite'

type FeatureKey =
  | 'aiNodes'
  | 'groupNodes'
  | 'autoLayout'
  | 'templates'
  | 'heatmaps'
  | 'liveLogs'
  | 'replay'
  | 'runCompare'
  | 'aiCoach'

const PLAN_FEATURES: Record<PlanId, FeatureKey[]> = {
  basic: ['autoLayout'],
  pro: ['aiNodes', 'groupNodes', 'autoLayout', 'templates', 'aiCoach'],
  elite: [
    'aiNodes',
    'groupNodes',
    'autoLayout',
    'templates',
    'aiCoach',
    'heatmaps',
    'liveLogs',
    'replay',
    'runCompare',
  ],
}

function normalizePlan(plan: string | null | undefined): PlanId {
  const value = (plan ?? '').toLowerCase()
  if (value === 'elite') return 'elite'
  if (value === 'pro') return 'pro'
  return 'basic'
}

export function usePermissions() {
  const [plan, setPlan] = useState<PlanId>('basic')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadPlan() {
      try {
        const res = await fetch('/api/auth/plan')
        if (!res.ok) throw new Error('Failed to load plan')
        const json = await res.json()
        if (cancelled) return
        setPlan(normalizePlan(json.plan))
      } catch {
        if (!cancelled) setPlan('basic')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPlan()
    return () => {
      cancelled = true
    }
  }, [])

  const canUseFeature = useCallback(
    (feature: FeatureKey) => {
      const features = PLAN_FEATURES[plan]
      return features.includes(feature)
    },
    [plan],
  )

  const planLabel =
    plan === 'elite' ? 'Elite' : plan === 'pro' ? 'Pro' : 'Basic'

  return {
    plan,
    planLabel,
    loading,
    canUseFeature,
  }
}
