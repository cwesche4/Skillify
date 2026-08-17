export type ValidationNode = {
  id: string
  state: 'ok' | 'warn' | 'error'
  message?: string
}

export type ValidationGraph = {
  nodes: ValidationNode[]
  edges: Array<{ from: string; to: string }>
}
