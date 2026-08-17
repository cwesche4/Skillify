'use client'

import type { AICallout } from '@/lib/ai/coach/types'
import AICalloutItem from './AICallout'

interface AICoachOverlayProps {
  callouts: AICallout[]
  visible: boolean
  className?: string
}

export default function AICoachOverlay({
  callouts,
  visible,
  className,
}: AICoachOverlayProps) {
  if (!visible || !callouts.length) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 ${className ?? ''}`}
      aria-label="AI Coach Overlay"
    >
      {callouts.map((c) => (
        <AICalloutItem key={c.id} callout={c} />
      ))}
    </div>
  )
}
