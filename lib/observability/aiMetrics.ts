type Metric = {
  name:
    | 'ai_action_attempted'
    | 'ai_action_applied'
    | 'ai_action_denied'
    | 'ai_action_undone'
    | 'ai_action_rate_limited'
  workspaceId: string
  action: string
  result: 'applied' | 'denied' | 'undone'
  reason?: string
  timestamp: string
}

/**
 * Lightweight in-memory emitter stub.
 * Replace with real metrics pipeline (StatsD/OTLP) in production.
 */
export function emitAiMetric(metric: Metric) {
  // eslint-disable-next-line no-console
  console.log('[ai-metric]', JSON.stringify(metric))
}

export function buildAiMetric(input: Omit<Metric, 'timestamp'>): Metric {
  return {
    ...input,
    timestamp: new Date().toISOString(),
  }
}
