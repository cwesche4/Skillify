export type InspectorHeatSample = {
  field: string
  count: number
  errors?: number
}

export type InspectorHeatmap = {
  samples: InspectorHeatSample[]
}
