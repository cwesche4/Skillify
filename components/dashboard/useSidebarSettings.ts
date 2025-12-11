// components/dashboard/useSidebarSettings.ts
'use client'

import { useEffect, useState } from 'react'

export function useSidebarSettings() {
  const [compact, setCompact] = useState(false)
  const [isAutoCompact, setIsAutoCompact] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mq = window.matchMedia('(max-width: 1024px)')

    const handleChange = (event: MediaQueryListEvent) => {
      setCompact(event.matches)
      setIsAutoCompact(event.matches)
    }

    // initial
    setCompact(mq.matches)
    setIsAutoCompact(mq.matches)

    mq.addEventListener('change', handleChange)
    return () => {
      mq.removeEventListener('change', handleChange)
    }
  }, [])

  const toggleCompact = () => {
    setCompact((c) => {
      // when user manually toggles, no longer "auto"
      setIsAutoCompact(false)
      return !c
    })
  }

  return { compact, toggleCompact, isAutoCompact }
}
