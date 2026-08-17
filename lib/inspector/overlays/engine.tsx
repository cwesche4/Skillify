import React from 'react'

import { InspectorOverlay, OverlayRenderResult } from './types'

const DEFAULT_OPACITY = 0.2
const DEFAULT_Z = 10

/**
 * Pure overlay renderer that consumes overlay definitions and returns inert render results.
 * Rendering is read-only; no state mutation or side effects.
 */
export function renderOverlays(
  overlays: InspectorOverlay[],
): OverlayRenderResult[] {
  if (!Array.isArray(overlays) || !overlays.length) return []

  const enabled = overlays.filter(
    (o) => o && o.enabled && typeof o.id === 'string',
  )
  if (!enabled.length) return []

  const sorted = [...enabled].sort((a, b) => {
    const za = a.zIndex ?? 0
    const zb = b.zIndex ?? 0
    if (za !== zb) return za - zb
    return String(a.id).localeCompare(String(b.id))
  })

  const rendered = sorted
    .map((overlay) => {
      if (!isKnownOverlayType(overlay.type)) return null
      const element = renderOverlayElement(overlay)
      if (!element) return null
      return {
        id: overlay.id,
        zIndex: overlay.zIndex ?? DEFAULT_Z,
        opacity: overlay.opacity ?? DEFAULT_OPACITY,
        element,
      }
    })
    .filter(Boolean) as OverlayRenderResult[]

  return rendered
}

// Placeholder renderer; future overlay types can switch here.
function renderOverlayElement(overlay: InspectorOverlay): React.ReactNode {
  return (
    <div
      style={{
        pointerEvents: 'none',
        opacity: overlay.opacity ?? DEFAULT_OPACITY,
        position: 'absolute',
        inset: 0,
        zIndex: overlay.zIndex ?? DEFAULT_Z,
      }}
      data-overlay-id={overlay.id}
      data-overlay-type={overlay.type}
    />
  )
}

function isKnownOverlayType(
  type: InspectorOverlay['type'],
): type is InspectorOverlay['type'] {
  return type === 'heatmap' || type === 'validation' || type === 'ai'
}
