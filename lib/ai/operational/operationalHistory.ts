import type {
  OperationalHealthSignal,
  OperationalInsight,
  OperationalIntelligenceSnapshot,
  OperationalRecommendationJustification,
} from '@/lib/ai/operational/operationalIntelligence'

export type OperationalInsightLifecycleStatus =
  | 'NEW'
  | 'ACTIVE'
  | 'RECURRING'
  | 'RESOLVED'
  | 'SUPERSEDED'
  | 'DISMISSED'
  | 'ARCHIVED'

export type OperationalTrendDirection =
  | 'IMPROVING'
  | 'STABLE'
  | 'DECLINING'
  | 'UNKNOWN'

export type OperationalHistoryRecord = {
  id: string
  workspaceId: string
  fingerprint: string
  domain: string
  title: string
  summary: string
  status: OperationalInsightLifecycleStatus
  severity: string
  confidence: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  linkedEvidenceIds: string[]
  linkedRecommendationIds: string[]
  resolution?: {
    resolvedAt: string
    summary: string
    resolutionType: string
  }
}

export type OperationalMetricPoint = {
  metricKey: string
  domain: string
  metric: string
  value: number
  measuredAt: string
}

export type OperationalTrend = {
  key: string
  domain: string
  metric: string
  direction: OperationalTrendDirection
  currentValue?: number
  previousValue?: number
  confidence: 'low' | 'medium' | 'high' | 'unknown'
  evidenceIds: string[]
}

export type OperationalRecommendationOutcomeRecord = {
  recommendationId: string
  status:
    | 'GENERATED'
    | 'APPROVED'
    | 'EXECUTED'
    | 'IGNORED'
    | 'EXPIRED'
    | 'SUCCESSFUL'
    | 'UNSUCCESSFUL'
    | 'PARTIALLY_SUCCESSFUL'
  occurredAt: string
  sourceDomain?: string
}

export type OperationalKnowledgeEffectivenessRecord = {
  knowledgeKey: string
  label: string
  timesUsed: number
  positiveOutcomes: number
  negativeOutcomes: number
  neutralOutcomes: number
  conflictsGenerated: number
  recommendationsGenerated: number
  confidence: 'low' | 'medium' | 'high' | 'unknown'
  lastUsedAt?: string
}

export type OperationalHistorySnapshot = {
  workspaceId: string
  createdAt: string
  insights: OperationalHistoryRecord[]
  trends: OperationalTrend[]
  recommendationOutcomes: OperationalRecommendationOutcomeRecord[]
  knowledgeEffectiveness: OperationalKnowledgeEffectivenessRecord[]
  dashboardSignals: OperationalHealthSignal[]
}

export type OperationalHistoryInspection = {
  operationalHistory: {
    workspaceId: string
    sourceResponseId?: string
    persisted: boolean
    insightCount: number
    generatedAt: string
  }
  operationalTrends: OperationalTrend[]
  insightLifecycle: Array<{
    id: string
    title: string
    status: OperationalInsightLifecycleStatus
    firstSeenAt: string
    lastSeenAt: string
    occurrenceCount: number
    severity: string
    confidence: string
  }>
  recurringRisks: OperationalHistoryRecord[]
  recommendationOutcomes: OperationalRecommendationOutcomeRecord[]
  dashboardSignals: OperationalHealthSignal[]
  operationalTimeline: Array<{
    id: string
    at: string
    event: string
    summary: string
  }>
  healthEvolution: {
    current: OperationalHealthSignal[]
    trendDirection: OperationalTrendDirection
  }
  trendGraphData: Array<{
    key: string
    points: Array<{
      at: string
      value: number
    }>
  }>
  operationalConfidence: {
    level: 'low' | 'medium' | 'high' | 'unknown'
    evidenceCount: number
    trendCount: number
    recurringRiskCount: number
  }
}

export function deriveOperationalInsightLifecycle({
  existing,
  incoming,
  now,
}: {
  existing?: Pick<
    OperationalHistoryRecord,
    'status' | 'occurrenceCount' | 'firstSeenAt'
  >
  incoming: Pick<
    OperationalInsight,
    | 'id'
    | 'title'
    | 'summary'
    | 'severity'
    | 'confidence'
    | 'domain'
    | 'evidenceIds'
  >
  now: string
}): OperationalHistoryRecord {
  const occurrenceCount = (existing?.occurrenceCount ?? 0) + 1
  const status = existing
    ? occurrenceCount > 1
      ? 'RECURRING'
      : 'ACTIVE'
    : 'NEW'
  return {
    id: incoming.id,
    workspaceId: '',
    fingerprint: createOperationalFingerprint({
      domain: incoming.domain,
      title: incoming.title,
      summary: incoming.summary,
    }),
    domain: incoming.domain,
    title: incoming.title,
    summary: incoming.summary,
    status,
    severity: incoming.severity.toUpperCase(),
    confidence: incoming.confidence.toUpperCase(),
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    occurrenceCount,
    linkedEvidenceIds: incoming.evidenceIds,
    linkedRecommendationIds: [],
  }
}

export function createOperationalFingerprint({
  domain,
  title,
  summary,
}: {
  domain: string
  title: string
  summary: string
}) {
  return `${normalizeKey(domain)}:${normalizeKey(title)}:${normalizeKey(summary).slice(0, 80)}`
}

export function detectOperationalTrends(
  points: OperationalMetricPoint[],
): OperationalTrend[] {
  const grouped = new Map<string, OperationalMetricPoint[]>()
  for (const point of points) {
    const key = `${point.domain}:${point.metricKey}`
    grouped.set(key, [...(grouped.get(key) ?? []), point])
  }
  return Array.from(grouped.entries()).map(([key, values]) => {
    const sorted = [...values].sort(
      (a, b) =>
        new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    )
    const previous = sorted.at(-2)
    const current = sorted.at(-1)
    const direction =
      !previous || !current
        ? 'UNKNOWN'
        : current.value > previous.value
          ? 'IMPROVING'
          : current.value < previous.value
            ? 'DECLINING'
            : 'STABLE'
    return {
      key,
      domain: current?.domain ?? values[0]?.domain ?? 'operations',
      metric: current?.metric ?? values[0]?.metric ?? key,
      direction,
      currentValue: current?.value,
      previousValue: previous?.value,
      confidence: sorted.length >= 2 ? 'medium' : 'unknown',
      evidenceIds: [],
    }
  })
}

export function aggregateSchedulingHealth(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
) {
  return aggregateDomainHealth(history, 'scheduling')
}

export function aggregateAutomationHealth(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
) {
  return aggregateDomainHealth(history, 'automation')
}

export function aggregateCRMHealth(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
) {
  return aggregateDomainHealth(history, 'crm')
}

export function aggregateKnowledgeHealth(
  history: Pick<
    OperationalHistorySnapshot,
    'insights' | 'trends' | 'knowledgeEffectiveness'
  >,
) {
  const knowledgeIssues = history.insights.filter(
    (insight) =>
      insight.domain === 'workspaceKnowledge' ||
      insight.summary.toLowerCase().includes('knowledge'),
  )
  const negativeOutcomes = history.knowledgeEffectiveness.reduce(
    (sum, item) => sum + item.negativeOutcomes,
    0,
  )
  return {
    domain: 'workspaceKnowledge',
    status: knowledgeIssues.length || negativeOutcomes ? 'watch' : 'healthy',
    activeRiskCount: knowledgeIssues.length,
    trendDirection: trendForDomain(history.trends, 'workspaceKnowledge'),
  }
}

export function aggregateOperationalHealth(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
): {
  status: 'watch' | 'healthy'
  activeRiskCount: number
  recurringRiskCount: number
  trendDirection: OperationalTrendDirection
} {
  const activeRiskCount = history.insights.filter(
    (insight) =>
      ['ACTIVE', 'RECURRING', 'NEW'].includes(insight.status) &&
      ['WARNING', 'CRITICAL'].includes(insight.severity),
  ).length
  return {
    status: activeRiskCount > 0 ? 'watch' : 'healthy',
    activeRiskCount,
    recurringRiskCount: history.insights.filter(
      (insight) => insight.status === 'RECURRING',
    ).length,
    trendDirection: history.trends.some(
      (trend) => trend.direction === 'DECLINING',
    )
      ? 'DECLINING'
      : history.trends.some((trend) => trend.direction === 'IMPROVING')
        ? 'IMPROVING'
        : 'STABLE',
  }
}

export function aggregateRiskHistory(
  history: Pick<OperationalHistorySnapshot, 'insights'>,
) {
  return history.insights
    .filter((insight) => ['WARNING', 'CRITICAL'].includes(insight.severity))
    .sort(
      (a, b) =>
        new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
    )
}

export function aggregateRecommendationHistory(
  history: Pick<OperationalHistorySnapshot, 'recommendationOutcomes'>,
) {
  const counts = new Map<string, number>()
  for (const outcome of history.recommendationOutcomes) {
    counts.set(outcome.status, (counts.get(outcome.status) ?? 0) + 1)
  }
  return {
    total: history.recommendationOutcomes.length,
    counts: Object.fromEntries(counts.entries()),
  }
}

export function aggregateDashboardSignals(
  history: Pick<
    OperationalHistorySnapshot,
    'dashboardSignals' | 'insights' | 'trends'
  >,
) {
  return history.dashboardSignals.length
    ? history.dashboardSignals
    : fallbackDashboardSignals(history)
}

export function buildOperationalHistoryInspection({
  currentSnapshot,
  persistedHistory,
}: {
  currentSnapshot: OperationalIntelligenceSnapshot
  persistedHistory?: OperationalHistorySnapshot
}): OperationalHistoryInspection {
  const createdAt = currentSnapshot.createdAt
  const insights =
    persistedHistory?.insights ??
    currentSnapshot.operationalInsights.map((insight) => ({
      ...deriveOperationalInsightLifecycle({
        incoming: insight,
        now: createdAt,
      }),
      workspaceId: currentSnapshot.workspaceId,
      linkedRecommendationIds: currentSnapshot.recommendationJustifications.map(
        (item: OperationalRecommendationJustification) => item.recommendationId,
      ),
    }))
  const trends =
    persistedHistory?.trends ??
    detectOperationalTrends(
      currentSnapshot.operationalHealth.map((signal, index) => ({
        metricKey: signal.key,
        domain:
          signal.key.replace(/Health|Confidence|Risk|Priority|Focus/g, '') ||
          'operations',
        metric: signal.label,
        value: index + 1,
        measuredAt: createdAt,
      })),
    )
  const recommendationOutcomes = persistedHistory?.recommendationOutcomes ?? []
  const dashboardSignals =
    persistedHistory?.dashboardSignals ?? currentSnapshot.operationalHealth
  const recurringRisks = insights.filter(
    (insight) =>
      insight.status === 'RECURRING' || insight.severity === 'CRITICAL',
  )

  return {
    operationalHistory: {
      workspaceId: currentSnapshot.workspaceId,
      sourceResponseId: currentSnapshot.responseId,
      persisted: Boolean(persistedHistory),
      insightCount: insights.length,
      generatedAt: createdAt,
    },
    operationalTrends: trends,
    insightLifecycle: insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      status: insight.status,
      firstSeenAt: insight.firstSeenAt,
      lastSeenAt: insight.lastSeenAt,
      occurrenceCount: insight.occurrenceCount,
      severity: insight.severity,
      confidence: insight.confidence,
    })),
    recurringRisks,
    recommendationOutcomes,
    dashboardSignals,
    operationalTimeline: insights
      .map((insight) => ({
        id: insight.id,
        at: insight.lastSeenAt,
        event: insight.status,
        summary: insight.summary,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    healthEvolution: {
      current: dashboardSignals,
      trendDirection: aggregateOperationalHealth({ insights, trends })
        .trendDirection,
    },
    trendGraphData: trends.map((trend) => ({
      key: trend.key,
      points: [
        ...(typeof trend.previousValue === 'number'
          ? [{ at: currentSnapshot.createdAt, value: trend.previousValue }]
          : []),
        ...(typeof trend.currentValue === 'number'
          ? [{ at: currentSnapshot.createdAt, value: trend.currentValue }]
          : []),
      ],
    })),
    operationalConfidence: {
      level: currentSnapshot.futureDashboardSignals.aiConfidence.confidence,
      evidenceCount: currentSnapshot.evidenceRanking.length,
      trendCount: trends.length,
      recurringRiskCount: recurringRisks.length,
    },
  }
}

function aggregateDomainHealth(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
  domain: string,
) {
  const domainInsights = history.insights.filter(
    (insight) => insight.domain === domain,
  )
  const activeRiskCount = domainInsights.filter(
    (insight) =>
      ['ACTIVE', 'RECURRING', 'NEW'].includes(insight.status) &&
      ['WARNING', 'CRITICAL'].includes(insight.severity),
  ).length
  return {
    domain,
    status: activeRiskCount > 0 ? 'watch' : 'healthy',
    activeRiskCount,
    recurringRiskCount: domainInsights.filter(
      (insight) => insight.status === 'RECURRING',
    ).length,
    trendDirection: trendForDomain(history.trends, domain),
  }
}

function trendForDomain(
  trends: OperationalTrend[],
  domain: string,
): OperationalTrendDirection {
  const domainTrends = trends.filter((trend) => trend.domain === domain)
  if (domainTrends.some((trend) => trend.direction === 'DECLINING'))
    return 'DECLINING'
  if (domainTrends.some((trend) => trend.direction === 'IMPROVING'))
    return 'IMPROVING'
  if (domainTrends.some((trend) => trend.direction === 'STABLE'))
    return 'STABLE'
  return 'UNKNOWN'
}

function fallbackDashboardSignals(
  history: Pick<OperationalHistorySnapshot, 'insights' | 'trends'>,
): OperationalHealthSignal[] {
  return history.insights.slice(0, 5).map((insight) => ({
    key: 'businessRisk',
    label: insight.title,
    status: insight.severity === 'CRITICAL' ? 'risk' : 'watch',
    summary: insight.summary,
    confidence:
      insight.confidence.toLowerCase() as OperationalHealthSignal['confidence'],
    evidenceIds: insight.linkedEvidenceIds,
  }))
}

function normalizeKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  )
}
