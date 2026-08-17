export type PatternSnapshot = {
  nodes: any[]
  edges: any[]
  version: number
  hints?: {
    inputs?: Array<{ key: string; description?: string }>
    outputs?: Array<{ key: string; description?: string }>
  }
}
