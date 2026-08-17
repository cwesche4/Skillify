export type InspectorOverlayType = 'heatmap' | 'validation' | 'ai'

export type InspectorOverlay = {
  id: string
  type: InspectorOverlayType
  data: unknown
  opacity?: number
  enabled: boolean
  zIndex?: number
}

export type OverlayRenderResult = {
  id: string
  zIndex: number
  opacity: number
  element: React.ReactNode
}
