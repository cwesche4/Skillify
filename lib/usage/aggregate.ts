import type {
  UsageAggregate,
  UsageSample,
  UsageThresholds,
  UsageWarning,
} from './types'

const defaultThresholds: UsageThresholds = {
  runs: 500,
  aiNodes: 2000,
  tokens: 5_000_000,
}

export function aggregateUsage(
  samples: UsageSample[],
  thresholds: UsageThresholds = defaultThresholds,
): UsageAggregate {
  const totals = samples.reduce(
    (acc, sample) => ({
      runs: acc.runs + sample.runs,
      aiNodes: acc.aiNodes + sample.aiNodes,
      tokens: acc.tokens + sample.tokens,
    }),
    { runs: 0, aiNodes: 0, tokens: 0 },
  )

  const warnings: UsageWarning[] = []
  for (const sample of samples) {
    if (thresholds.runs && sample.runs >= thresholds.runs) {
      warnings.push({
        metric: 'runs',
        threshold: thresholds.runs,
        value: sample.runs,
        date: sample.date,
        message: `Runs exceeded soft threshold (${sample.runs}/${thresholds.runs})`,
      })
    }
    if (thresholds.aiNodes && sample.aiNodes >= thresholds.aiNodes) {
      warnings.push({
        metric: 'ai-nodes',
        threshold: thresholds.aiNodes,
        value: sample.aiNodes,
        date: sample.date,
        message: `AI node executions exceeded soft threshold (${sample.aiNodes}/${thresholds.aiNodes})`,
      })
    }
    if (thresholds.tokens && sample.tokens >= thresholds.tokens) {
      warnings.push({
        metric: 'tokens',
        threshold: thresholds.tokens,
        value: sample.tokens,
        date: sample.date,
        message: `Token usage exceeded soft threshold (${sample.tokens}/${thresholds.tokens})`,
      })
    }
  }

  return { totals, samples, warnings }
}
