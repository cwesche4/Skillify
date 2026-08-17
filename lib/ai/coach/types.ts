export type AICalloutKind = 'bottleneck' | 'failure' | 'optimization'

export type AICallout = {
  id: string
  targetId: string
  position: { x: number; y: number }
  kind: AICalloutKind
  message: string
}
