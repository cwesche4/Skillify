import type { AIDecisionData } from '@/lib/builder/schema/ai'

export type DecisionInput = Record<string, any>

export type DecisionEvaluation = {
  branchKey: string
  confidence: number
  explanation: string
}

export interface DecisionEvaluator {
  (
    input: DecisionInput,
    branch: { key: string; label?: string },
  ): DecisionEvaluation
}

export type DecisionResult = DecisionEvaluation & {
  fallbackUsed: boolean
  log: DecisionExecutionLog
}

export type DecisionExecutionLog = {
  inputSummary: string
  decision: string
  confidence: number
  explanation: string
  fallbackUsed: boolean
}

/**
 * Deterministic decision across predefined branches.
 * - No hidden prompts or dynamic branches.
 * - Falls back if confidence below threshold.
 */
export function runDeterministicDecision(params: {
  data: AIDecisionData
  input: DecisionInput
  evaluator: DecisionEvaluator
}): DecisionResult {
  const { data, input, evaluator } = params
  const results = data.branches.map((b) => evaluator(input, b))

  const sorted = results.sort((a, b) => b.confidence - a.confidence)
  const top = sorted[0]
  const fallbackKey = data.fallbackKey || data.branches[0]?.key
  const threshold = data.confidenceThreshold ?? 0.5

  const selected =
    top && top.confidence >= threshold
      ? top
      : {
          branchKey: fallbackKey,
          confidence: top?.confidence ?? 0,
          explanation: top?.explanation ?? 'Below threshold; fallback used.',
        }

  const fallbackUsed =
    selected.branchKey === fallbackKey && top?.branchKey !== fallbackKey

  return {
    ...selected,
    fallbackUsed,
    log: {
      inputSummary: Object.keys(input || {}).join(', ') || 'No input fields',
      decision: selected.branchKey,
      confidence: selected.confidence,
      explanation: selected.explanation,
      fallbackUsed,
    },
  }
}

/**
 * Static preview: list possible branches and threshold.
 */
export function previewDecision(data: AIDecisionData) {
  return {
    branches: data.branches,
    threshold: data.confidenceThreshold,
    fallbackKey: data.fallbackKey,
  }
}
