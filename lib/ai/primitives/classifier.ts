export type ClassifierInput = Record<string, any>

export type ClassifierCategory = {
  key: string
  description?: string
}

export type ClassifierResult = {
  categoryKey: string
  confidence: number
  explanation: string
  fallbackUsed: boolean
}

/**
 * Deterministic classifier across predefined categories.
 * - No dynamic categories
 * - Exactly one category selected
 * - Fallback if confidence below threshold
 */
export function runClassifier(params: {
  categories: ClassifierCategory[]
  threshold: number
  fallbackKey: string
  evaluate: (
    input: ClassifierInput,
    category: ClassifierCategory,
  ) => { confidence: number; explanation: string }
  input: ClassifierInput
}): ClassifierResult {
  const { categories, threshold, fallbackKey, evaluate, input } = params
  const results = categories.map((c) => ({
    category: c.key,
    ...evaluate(input, c),
  }))
  const sorted = results.sort((a, b) => b.confidence - a.confidence)
  const top = sorted[0]
  const selected =
    top && top.confidence >= threshold
      ? top
      : {
          category: fallbackKey,
          confidence: top?.confidence ?? 0,
          explanation: top?.explanation ?? 'Below threshold; fallback used.',
        }
  const fallbackUsed =
    selected.category === fallbackKey && top?.category !== fallbackKey
  return {
    categoryKey: selected.category,
    confidence: selected.confidence,
    explanation: selected.explanation,
    fallbackUsed,
  }
}
