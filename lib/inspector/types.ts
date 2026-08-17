export type InspectorContext = {
  workspaceId?: string
  automationId?: string
  nodeId?: string
  nodeType?: string
  tab: string
  dockSide: 'left' | 'right' | 'overlay'
  widthPreset: 'compact' | 'standard' | 'wide'
  pinned: boolean
  followSelection: boolean
  workMode: string
}
