import type { RouterNodeConfig, RouterOutcome, RouterLabel } from './types'

export type RouterEvaluator = (
  input: Record<string, any>,
  labels: RouterLabel[],
  prompt: string,
) => { matched: string[]; explanation: string }

/**
 * Deterministic routing across predefined labels.
 * - No dynamic labels or edges.
 * - Multiple labels may be matched; each is logged.
 */
export function evaluateRouter(params: {
  config: RouterNodeConfig
  input: Record<string, any>
  evaluator: RouterEvaluator
}): RouterOutcome {
  const result = params.evaluator(
    params.input,
    params.config.allowedLabels,
    params.config.prompt,
  )
  const matched = result.matched.filter((m) =>
    params.config.allowedLabels.some((l) => l.key === m),
  )
  return {
    matchedLabels: matched,
    explanation: result.explanation,
  }
}
