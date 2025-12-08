// components/onboarding/FirstAutomationTour.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function FirstAutomationTour() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = 'skillify-first-automation-tour-dismissed'
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    const key = 'skillify-first-automation-tour-dismissed'
    window.localStorage.setItem(key, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="card border-brand-primary/30 bg-brand-primary/5 mb-4 flex items-center justify-between gap-3 border px-4 py-3 text-xs">
      <div className="space-y-1">
        <p className="text-neutral-text-primary font-medium">
          Welcome to your first automation
        </p>
        <p className="text-neutral-text-secondary">
          Start by creating a simple flow. You can refine it later using the AI
          Coach and analytics.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/automations"
            className="text-[11px] text-brand-primary underline"
          >
            Learn how automations work →
          </Link>
          <Link
            href="/onboarding"
            className="text-neutral-text-secondary text-[11px] underline"
          >
            View full onboarding
          </Link>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-neutral-text-secondary hover:text-neutral-text-primary text-[10px]"
      >
        Dismiss
      </button>
    </div>
  )
}
