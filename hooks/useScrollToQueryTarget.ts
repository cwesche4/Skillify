'use client'

import { useEffect, useRef } from 'react'

export function useScrollToQueryTarget(
  targetId: string | null,
  dependencyKey = '',
) {
  const lastScrollKey = useRef<string | null>(null)

  useEffect(() => {
    const hashTarget = window.location.hash
      ? window.location.hash.slice(1)
      : null
    const resolvedTargetId = targetId ?? hashTarget
    if (!resolvedTargetId) return

    const scrollKey = `${resolvedTargetId}:${window.location.pathname}${window.location.search}${window.location.hash}`
    if (lastScrollKey.current === scrollKey) return

    lastScrollKey.current = scrollKey
    const timeout = window.setTimeout(() => {
      document.getElementById(resolvedTargetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 120)

    return () => window.clearTimeout(timeout)
  }, [dependencyKey, targetId])
}
