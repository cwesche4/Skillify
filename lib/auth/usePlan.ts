'use client'

import { useEffect, useState } from 'react'

export type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('Free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/plan')
      .then((r) => r.json())
      .then((d) => setPlan(d.plan ?? 'Free'))
      .finally(() => setLoading(false))
  }, [])

  return { plan, loading }
}
