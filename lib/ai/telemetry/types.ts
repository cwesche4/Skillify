export type TokenUsage = {
  nodeId: string
  runId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostLow: number
  estimatedCostHigh: number
  timestamp: string
}

export type RunCostAggregate = {
  runId: string
  totalTokens: number
  totalCostLow: number
  totalCostHigh: number
}

export type FlowCostAggregate = {
  automationId: string
  totalTokens: number
  totalCostLow: number
  totalCostHigh: number
}
