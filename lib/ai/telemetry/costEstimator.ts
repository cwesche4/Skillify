export type TokenEstimate = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type CostEstimate = TokenEstimate & {
  estimatedCostRange: [number, number] // non-binding, observational only
}

/**
 * Deterministic token/cost estimator (placeholder, read-only).
 * - No pricing exposed; ranges are relative/observational.
 * - Does not block execution.
 */
export function estimateTokens(params: {
  model: string
  promptLength: number
  expectedOutputLength: number
}): TokenEstimate {
  const inputTokens = Math.max(1, Math.floor(params.promptLength / 4))
  const outputTokens = Math.max(1, Math.floor(params.expectedOutputLength / 4))
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

export function estimateCostRange(
  tokens: TokenEstimate,
  perTokenLow = 0.000001,
  perTokenHigh = 0.000005,
): CostEstimate {
  const low = tokens.totalTokens * perTokenLow
  const high = tokens.totalTokens * perTokenHigh
  return {
    ...tokens,
    estimatedCostRange: [low, high],
  }
}
