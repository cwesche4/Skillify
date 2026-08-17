import type {
  DecisionCategory,
  DecisionNodeConfig,
  DecisionOutcome,
} from './types'

export type DecisionEvaluator = (
  input: Record<string, any>,
  category: DecisionCategory,
  prompt: string,
) => { confidence: number; explanation: string }

/**
 * Deterministic decision based on predefined categories and static prompt.
 * - No hidden prompts or dynamic categories.
 * - Returns category, confidence, explanation, input summary.
 */
export function evaluateDecision(params: {
  config: DecisionNodeConfig
  input: Record<string, any>
  evaluator: DecisionEvaluator
}): DecisionOutcome {
  const results = params.config.categories.map((cat) => {
    const res = params.evaluator(params.input, cat, params.config.prompt)
    return { category: cat.key, ...res }
  })

  results.sort((a, b) => b.confidence - a.confidence)
  const top = results[0]

  return {
    category: top?.category ?? params.config.categories[0]?.key,
    confidence: top?.confidence ?? 0,
    explanation: top?.explanation ?? 'No explanation provided.',
    inputSummary:
      Object.keys(params.input ?? {}).join(', ') || 'No input fields',
  }
}
