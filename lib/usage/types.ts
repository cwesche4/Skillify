export type UsageMetric = 'runs' | 'ai-nodes' | 'tokens'

export interface UsageSample {
  date: string // ISO date (YYYY-MM-DD)
  runs: number
  aiNodes: number
  tokens: number
}

export interface UsageThresholds {
  runs?: number
  aiNodes?: number
  tokens?: number
}

export interface UsageWarning {
  metric: UsageMetric
  threshold: number
  value: number
  date: string
  message: string
}

export interface UsageAggregate {
  totals: {
    runs: number
    aiNodes: number
    tokens: number
  }
  samples: UsageSample[]
  warnings: UsageWarning[]
}
