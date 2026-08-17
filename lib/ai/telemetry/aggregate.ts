import type { FlowCostAggregate, RunCostAggregate, TokenUsage } from './types'

export function aggregateRunCosts(usages: TokenUsage[]): RunCostAggregate {
  const runId = usages[0]?.runId ?? ''
  const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0)
  const totalCostLow = usages.reduce((sum, u) => sum + u.estimatedCostLow, 0)
  const totalCostHigh = usages.reduce((sum, u) => sum + u.estimatedCostHigh, 0)
  return { runId, totalTokens, totalCostLow, totalCostHigh }
}

export function aggregateFlowCosts(
  usages: TokenUsage[],
  automationId: string,
): FlowCostAggregate {
  const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0)
  const totalCostLow = usages.reduce((sum, u) => sum + u.estimatedCostLow, 0)
  const totalCostHigh = usages.reduce((sum, u) => sum + u.estimatedCostHigh, 0)
  return { automationId, totalTokens, totalCostLow, totalCostHigh }
}
