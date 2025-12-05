// lib/analytics/aiAnnotations.ts

export type TrendAnalysisInput = {
  successRate: number // percentage 0–100
  trend: number // positive = increasing, negative = decreasing
}

export type TrendInsight = string

/**
 * AI Coach Insight Generator
 * Produces human-friendly insights based on automation trends.
 */
export function analyzeTrends({
  successRate,
  trend,
}: TrendAnalysisInput): TrendInsight[] {
  const insights: TrendInsight[] = []

  // Reliability warnings
  if (successRate < 60) {
    insights.push("🚨 Critical reliability drop — urgent investigation recommended.")
  } else if (successRate < 80) {
    insights.push("⚠️ Reliability is trending below recommended thresholds.")
  }

  // Trend direction
  if (trend < -0.1) {
    insights.push("📉 Success trend is declining over time.")
  } else if (trend > 0.1) {
    insights.push("📈 Success trend shows steady improvement.")
  }

  // High performance
  if (successRate > 95 && trend > 0.1) {
    insights.push("🚀 Automations running exceptionally well — no major issues detected.")
  }

  // Fallback if no insights were generated
  if (insights.length === 0) {
    insights.push("All systems stable — no anomalies detected.")
  }

  return insights
}
