import { prisma } from '@/lib/db'
import type {
  KnowledgeEffectivenessMetric,
  OperationalHealthSignal,
  OperationalInsight,
  OperationalIntelligenceSnapshot,
} from '@/lib/ai/operational/operationalIntelligence'
import {
  buildOperationalHistoryInspection,
  createOperationalFingerprint,
  detectOperationalTrends,
  type OperationalHistorySnapshot,
  type OperationalInsightLifecycleStatus,
  type OperationalKnowledgeEffectivenessRecord,
  type OperationalMetricPoint,
  type OperationalRecommendationOutcomeRecord,
} from '@/lib/ai/operational/operationalHistory'

export type PersistOperationalIntelligenceResult = {
  workspaceId: string
  snapshotId: string
  insightIds: string[]
  evidenceIds: string[]
  recommendationHistoryIds: string[]
  explanationIds: string[]
  decisionIds: string[]
  signalIds: string[]
  metricHistoryIds: string[]
  knowledgeEffectivenessIds: string[]
  healthSnapshotId: string
  dashboardSignalIds: string[]
}

export type RecordOperationalRecommendationOutcomeInput = {
  workspaceId: string
  recommendationId: string
  outcome:
    | 'approved'
    | 'executed'
    | 'ignored'
    | 'expired'
    | 'successful'
    | 'unsuccessful'
    | 'partiallySuccessful'
  actorUserId?: string
  sourceDomain?: string
  targetRecordType?: string
  targetRecordId?: string
  evidenceIds?: string[]
  reason?: string
  metadata?: Record<string, unknown>
  occurredAt?: Date
}

export async function persistOperationalIntelligenceSnapshot({
  snapshot,
}: {
  snapshot: OperationalIntelligenceSnapshot
}): Promise<PersistOperationalIntelligenceResult> {
  const persist = async (client: typeof prisma) => {
    const evidenceIds = await persistOperationalEvidence(snapshot, client)
    const insightIds = await persistOperationalInsights(snapshot, client)
    const recommendationHistoryIds = await persistRecommendationHistory(
      snapshot,
      client,
    )
    const explanationIds = await persistOperationalExplanations(
      snapshot,
      client,
    )
    const decisionIds = await persistOperationalDecisions(snapshot, client)
    const signalIds = await persistOperationalSignals(snapshot, client)
    const metricHistoryIds = await persistMetricHistory(snapshot, client)
    const knowledgeEffectivenessIds = await persistKnowledgeEffectiveness(
      snapshot,
      client,
    )
    const healthSnapshotId = await persistHealthSnapshot(snapshot, client)
    const dashboardSignalIds = await persistDashboardSignals(snapshot, client)

    return {
      workspaceId: snapshot.workspaceId,
      snapshotId: snapshot.id,
      insightIds,
      evidenceIds,
      recommendationHistoryIds,
      explanationIds,
      decisionIds,
      signalIds,
      metricHistoryIds,
      knowledgeEffectivenessIds,
      healthSnapshotId,
      dashboardSignalIds,
    }
  }

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction((client) => persist(client as typeof prisma))
  }
  return persist(prisma)
}

export async function getOperationalHistory({
  workspaceId,
  limit = 100,
}: {
  workspaceId: string
  limit?: number
}): Promise<OperationalHistorySnapshot> {
  const [
    insights,
    metrics,
    recommendationOutcomes,
    knowledgeEffectiveness,
    dashboardSignals,
  ] = await Promise.all([
    prisma.operationalInsight.findMany({
      where: { workspaceId },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
    }),
    prisma.operationalMetricHistory.findMany({
      where: { workspaceId },
      orderBy: { measuredAt: 'desc' },
      take: limit,
    }),
    prisma.operationalRecommendationOutcome.findMany({
      where: { workspaceId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    }),
    prisma.operationalKnowledgeEffectiveness.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.operationalDashboardSignal.findMany({
      where: { workspaceId, visible: true },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    }),
  ])
  const metricPoints: OperationalMetricPoint[] = metrics.map((metric) => ({
    metricKey: metric.metricKey,
    domain: metric.domain,
    metric: metric.metric,
    value: metric.value,
    measuredAt: metric.measuredAt.toISOString(),
  }))
  return {
    workspaceId,
    createdAt: new Date().toISOString(),
    insights: insights.map((insight) => ({
      id: insight.id,
      workspaceId: insight.workspaceId,
      fingerprint: insight.fingerprint,
      domain: insight.domain,
      title: insight.title,
      summary: insight.summary,
      status: insight.status,
      severity: insight.severity,
      confidence: insight.confidence,
      firstSeenAt: insight.firstSeenAt.toISOString(),
      lastSeenAt: insight.lastSeenAt.toISOString(),
      occurrenceCount: insight.occurrenceCount,
      linkedEvidenceIds: insight.linkedEvidenceIds,
      linkedRecommendationIds: insight.linkedRecommendationIds,
    })),
    trends: detectOperationalTrends(metricPoints),
    recommendationOutcomes: recommendationOutcomes.map((outcome) => ({
      recommendationId: outcome.recommendationId,
      status: outcome.outcome,
      occurredAt: outcome.occurredAt.toISOString(),
      sourceDomain: outcome.sourceDomain ?? undefined,
    })),
    knowledgeEffectiveness: knowledgeEffectiveness.map((item) => ({
      knowledgeKey: item.knowledgeKey,
      label: item.label,
      timesUsed: item.timesUsed,
      positiveOutcomes: item.positiveOutcomes,
      negativeOutcomes: item.negativeOutcomes,
      neutralOutcomes: item.neutralOutcomes,
      conflictsGenerated: item.conflictsGenerated,
      recommendationsGenerated: item.recommendationsGenerated,
      confidence: lowerConfidence(item.confidence),
      lastUsedAt: item.lastUsedAt?.toISOString(),
    })),
    dashboardSignals: dashboardSignals.map(mapDashboardSignal),
  }
}

export async function buildPersistedOperationalInspection({
  snapshot,
}: {
  snapshot: OperationalIntelligenceSnapshot
}) {
  const persistedHistory = await getOperationalHistory({
    workspaceId: snapshot.workspaceId,
  })
  return buildOperationalHistoryInspection({
    currentSnapshot: snapshot,
    persistedHistory,
  })
}

export async function recordOperationalRecommendationOutcome({
  workspaceId,
  recommendationId,
  outcome,
  actorUserId,
  sourceDomain,
  targetRecordType,
  targetRecordId,
  evidenceIds = [],
  reason,
  metadata,
  occurredAt,
}: RecordOperationalRecommendationOutcomeInput) {
  return prisma.operationalRecommendationOutcome.create({
    data: {
      workspaceId,
      recommendationId,
      outcome: normalizeRecommendationOutcome(outcome),
      actorUserId,
      sourceDomain,
      targetRecordType,
      targetRecordId,
      evidenceIds,
      reason: normalizeOptionalText(reason),
      metadata: metadata ? toJson(metadata) : undefined,
      occurredAt,
    },
  })
}

async function persistOperationalEvidence(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const evidence of snapshot.evidenceRanking) {
    const row = await client.operationalEvidence.upsert({
      where: {
        workspaceId_evidenceKey: {
          workspaceId: snapshot.workspaceId,
          evidenceKey: evidence.evidenceId,
        },
      },
      update: {
        domain: evidence.domain,
        label: evidence.label,
        confidence: upperConfidence(evidence.confidence),
        verified: evidence.verified,
        sourceResponseId: snapshot.responseId,
        payload: toJson(evidence),
      },
      create: {
        workspaceId: snapshot.workspaceId,
        evidenceKey: evidence.evidenceId,
        sourceResponseId: snapshot.responseId,
        domain: evidence.domain,
        label: evidence.label,
        source: 'workspace-reasoning-engine',
        confidence: upperConfidence(evidence.confidence),
        verified: evidence.verified,
        referenceId: evidence.evidenceId,
        payload: toJson(evidence),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistOperationalInsights(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const insight of snapshot.operationalInsights) {
    const fingerprint = createOperationalFingerprint({
      domain: insight.domain,
      title: insight.title,
      summary: insight.summary,
    })
    const existing = await client.operationalInsight.findUnique({
      where: {
        workspaceId_fingerprint: {
          workspaceId: snapshot.workspaceId,
          fingerprint,
        },
      },
    })
    const isRetry =
      existing?.sourceRuntimeRequestId === snapshot.runtimeRequestId
    const occurrenceCount = isRetry
      ? existing.occurrenceCount
      : (existing?.occurrenceCount ?? 0) + 1
    const status = nextLifecycleStatus(existing?.status, occurrenceCount)
    const row = existing
      ? await client.operationalInsight.update({
          where: { id: existing.id },
          data: {
            title: insight.title,
            summary: insight.summary,
            status,
            severity: upperSeverity(insight.severity),
            confidence: upperConfidence(insight.confidence),
            lastSeenAt: new Date(insight.generatedAt),
            occurrenceCount,
            linkedEvidenceIds: insight.evidenceIds,
            linkedRecommendationIds: snapshot.recommendationJustifications.map(
              (item) => item.recommendationId,
            ),
            currentVersion: isRetry
              ? existing.currentVersion
              : { increment: 1 },
            sourceResponseId: snapshot.responseId,
            sourceRuntimeRequestId: snapshot.runtimeRequestId,
            metadata: toJson({
              deterministic: true,
              sourceSnapshotId: snapshot.id,
            }),
          },
        })
      : await client.operationalInsight.create({
          data: {
            workspaceId: snapshot.workspaceId,
            fingerprint,
            domain: insight.domain,
            title: insight.title,
            summary: insight.summary,
            status,
            severity: upperSeverity(insight.severity),
            confidence: upperConfidence(insight.confidence),
            firstSeenAt: new Date(insight.generatedAt),
            lastSeenAt: new Date(insight.generatedAt),
            occurrenceCount,
            linkedEvidenceIds: insight.evidenceIds,
            linkedRecommendationIds: snapshot.recommendationJustifications.map(
              (item) => item.recommendationId,
            ),
            sourceResponseId: snapshot.responseId,
            sourceRuntimeRequestId: snapshot.runtimeRequestId,
            metadata: toJson({
              deterministic: true,
              sourceSnapshotId: snapshot.id,
            }),
          },
        })
    await client.operationalInsightRevision.upsert({
      where: {
        id: revisionObservationId(row.id, row.currentVersion, snapshot),
      },
      update: {
        status: row.status,
        severity: row.severity,
        confidence: row.confidence,
        title: row.title,
        summary: row.summary,
        evidenceIds: row.linkedEvidenceIds,
        recommendationIds: row.linkedRecommendationIds,
        metadata: toJson({ sourceSnapshotId: snapshot.id, retry: isRetry }),
      },
      create: {
        id: revisionObservationId(row.id, row.currentVersion, snapshot),
        workspaceId: snapshot.workspaceId,
        insightId: row.id,
        version: row.currentVersion,
        status: row.status,
        severity: row.severity,
        confidence: row.confidence,
        title: row.title,
        summary: row.summary,
        evidenceIds: row.linkedEvidenceIds,
        recommendationIds: row.linkedRecommendationIds,
        metadata: toJson({ sourceSnapshotId: snapshot.id, retry: isRetry }),
      },
    })
    await client.operationalInsightAudit.upsert({
      where: {
        id: auditObservationId(
          row.id,
          existing ? 'RECURRED' : 'CREATED',
          snapshot,
        ),
      },
      update: {
        summary: existing
          ? `Operational insight recurred: ${row.title}`
          : `Operational insight created: ${row.title}`,
        metadata: toJson({
          sourceSnapshotId: snapshot.id,
          occurrenceCount,
          retry: isRetry,
        }),
      },
      create: {
        id: auditObservationId(
          row.id,
          existing ? 'RECURRED' : 'CREATED',
          snapshot,
        ),
        workspaceId: snapshot.workspaceId,
        insightId: row.id,
        action: existing ? 'RECURRED' : 'CREATED',
        source: 'operational-intelligence',
        summary: existing
          ? `Operational insight recurred: ${row.title}`
          : `Operational insight created: ${row.title}`,
        metadata: toJson({
          sourceSnapshotId: snapshot.id,
          occurrenceCount,
          retry: isRetry,
        }),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistRecommendationHistory(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const explanation of snapshot.decisionExplanations) {
    const row = await client.operationalRecommendationHistory.upsert({
      where: {
        id: recommendationObservationId(explanation.recommendationId, snapshot),
      },
      update: {
        recommendationType: 'workspace-ai',
        recommendationTitle: explanation.recommendation,
        status: 'GENERATED',
        sourceResponseId: snapshot.responseId,
        confidenceAtGeneration: upperConfidence(explanation.confidence),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        metadata: toJson({
          explanationId: explanation.id,
          proposalOnly: true,
          reasoningSummary: explanation.reasoningSummary,
          sourceSnapshotId: snapshot.id,
        }),
      },
      create: {
        id: recommendationObservationId(explanation.recommendationId, snapshot),
        workspaceId: snapshot.workspaceId,
        recommendationId: explanation.recommendationId,
        recommendationType: 'workspace-ai',
        recommendationTitle: explanation.recommendation,
        status: 'GENERATED',
        sourceResponseId: snapshot.responseId,
        confidenceAtGeneration: upperConfidence(explanation.confidence),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        metadata: toJson({
          explanationId: explanation.id,
          proposalOnly: true,
          reasoningSummary: explanation.reasoningSummary,
        }),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistOperationalExplanations(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const explanation of snapshot.decisionExplanations) {
    const row = await client.operationalExplanation.upsert({
      where: {
        workspaceId_explanationKey: {
          workspaceId: snapshot.workspaceId,
          explanationKey: explanation.id,
        },
      },
      update: {
        recommendationId: explanation.recommendationId,
        sourceResponseId: snapshot.responseId,
        title: explanation.recommendation,
        summary: explanation.reasoningSummary,
        confidence: upperConfidence(explanation.confidence),
        businessRuleIds: explanation.businessRulesApplied.map(
          (rule) => rule.id,
        ),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        rejectedAlternativeIds: explanation.rejectedCandidates.map(
          (item) => item.id,
        ),
        knowledgeUsed: toJson(explanation.knowledgeUsed),
        metadata: toJson({ proposalOnly: true, sourceSnapshotId: snapshot.id }),
      },
      create: {
        workspaceId: snapshot.workspaceId,
        explanationKey: explanation.id,
        recommendationId: explanation.recommendationId,
        sourceResponseId: snapshot.responseId,
        title: explanation.recommendation,
        summary: explanation.reasoningSummary,
        confidence: upperConfidence(explanation.confidence),
        businessRuleIds: explanation.businessRulesApplied.map(
          (rule) => rule.id,
        ),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        rejectedAlternativeIds: explanation.rejectedCandidates.map(
          (item) => item.id,
        ),
        knowledgeUsed: toJson(explanation.knowledgeUsed),
        metadata: toJson({ proposalOnly: true, sourceSnapshotId: snapshot.id }),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistOperationalDecisions(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const explanation of snapshot.decisionExplanations) {
    const row = await client.operationalDecision.upsert({
      where: {
        workspaceId_decisionKey: {
          workspaceId: snapshot.workspaceId,
          decisionKey: explanation.id,
        },
      },
      update: {
        recommendationId: explanation.recommendationId,
        recommendation: explanation.recommendation,
        decisionType: 'recommendation-generated',
        confidence: upperConfidence(explanation.confidence),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        businessRuleIds: explanation.businessRulesApplied.map(
          (rule) => rule.id,
        ),
        rejectedAlternativeIds: explanation.rejectedCandidates.map(
          (item) => item.id,
        ),
        proposalOnly: true,
        metadata: toJson({ sourceSnapshotId: snapshot.id }),
        decidedAt: new Date(snapshot.createdAt),
      },
      create: {
        workspaceId: snapshot.workspaceId,
        decisionKey: explanation.id,
        recommendationId: explanation.recommendationId,
        recommendation: explanation.recommendation,
        decisionType: 'recommendation-generated',
        confidence: upperConfidence(explanation.confidence),
        evidenceIds: explanation.evidence.map((item) => item.evidenceId),
        businessRuleIds: explanation.businessRulesApplied.map(
          (rule) => rule.id,
        ),
        rejectedAlternativeIds: explanation.rejectedCandidates.map(
          (item) => item.id,
        ),
        proposalOnly: true,
        metadata: toJson({ sourceSnapshotId: snapshot.id }),
        decidedAt: new Date(snapshot.createdAt),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistOperationalSignals(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const signal of snapshot.operationalHealth) {
    const signalKey = `${signal.key}:${normalizeKey(signal.summary)}`
    const existing = await client.operationalSignal.findUnique({
      where: {
        workspaceId_signalKey: {
          workspaceId: snapshot.workspaceId,
          signalKey,
        },
      },
    })
    const row = existing
      ? await client.operationalSignal.update({
          where: { id: existing.id },
          data: {
            label: signal.label,
            summary: signal.summary,
            severity: severityForHealthSignal(signal),
            confidence: upperConfidence(signal.confidence),
            evidenceIds: signal.evidenceIds,
            lastSeenAt: new Date(snapshot.createdAt),
            occurrenceCount: { increment: 1 },
            sourceResponseId: snapshot.responseId,
            history: toJson({ lastSourceResponseId: snapshot.responseId }),
          },
        })
      : await client.operationalSignal.create({
          data: {
            workspaceId: snapshot.workspaceId,
            signalKey,
            sourceResponseId: snapshot.responseId,
            domain: domainFromSignal(signal),
            label: signal.label,
            summary: signal.summary,
            severity: severityForHealthSignal(signal),
            confidence: upperConfidence(signal.confidence),
            evidenceIds: signal.evidenceIds,
            firstSeenAt: new Date(snapshot.createdAt),
            lastSeenAt: new Date(snapshot.createdAt),
            history: toJson({ firstSourceResponseId: snapshot.responseId }),
          },
        })
    ids.push(row.id)
  }
  return ids
}

async function persistMetricHistory(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const signal of snapshot.operationalHealth) {
    const row = await client.operationalMetricHistory.upsert({
      where: { id: metricObservationId(signal.key, snapshot) },
      update: {
        domain: domainFromSignal(signal),
        metric: signal.label,
        value: metricValueForSignal(signal),
        unit: 'health-score',
        direction: 'UNKNOWN',
        evidenceIds: signal.evidenceIds,
        metadata: toJson({
          sourceSnapshotId: snapshot.id,
          summary: signal.summary,
        }),
        measuredAt: new Date(snapshot.createdAt),
      },
      create: {
        id: metricObservationId(signal.key, snapshot),
        workspaceId: snapshot.workspaceId,
        metricKey: signal.key,
        domain: domainFromSignal(signal),
        metric: signal.label,
        value: metricValueForSignal(signal),
        unit: 'health-score',
        direction: 'UNKNOWN',
        evidenceIds: signal.evidenceIds,
        metadata: toJson({
          sourceSnapshotId: snapshot.id,
          summary: signal.summary,
        }),
        measuredAt: new Date(snapshot.createdAt),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistKnowledgeEffectiveness(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const metric of snapshot.knowledgeEffectiveness) {
    const knowledgeKey = knowledgeEffectivenessKey(metric)
    const row = await client.operationalKnowledgeEffectiveness.upsert({
      where: {
        workspaceId_knowledgeKey: {
          workspaceId: snapshot.workspaceId,
          knowledgeKey,
        },
      },
      update: {
        label: metric.label,
        timesUsed: { increment: metric.timesUsed },
        lastUsedAt: new Date(metric.lastUsedAt),
        affectedModules: metric.affectedModules.map(String),
        positiveOutcomes: { increment: metric.positiveOutcomes },
        negativeOutcomes: { increment: metric.negativeOutcomes },
        conflictsGenerated: { increment: metric.conflictsGenerated },
        recommendationsGenerated: {
          increment: metric.recommendationsGenerated,
        },
        operationalImpact: metric.operationalImpact,
        confidence: upperConfidence(
          metric.operationalImpact === 'high' ? 'high' : 'medium',
        ),
        metadata: toJson({ source: metric.source }),
      },
      create: {
        workspaceId: snapshot.workspaceId,
        knowledgeKey,
        label: metric.label,
        timesUsed: metric.timesUsed,
        lastUsedAt: new Date(metric.lastUsedAt),
        affectedModules: metric.affectedModules.map(String),
        positiveOutcomes: metric.positiveOutcomes,
        negativeOutcomes: metric.negativeOutcomes,
        neutralOutcomes: 0,
        conflictsGenerated: metric.conflictsGenerated,
        recommendationsGenerated: metric.recommendationsGenerated,
        operationalImpact: metric.operationalImpact,
        confidence: upperConfidence(
          metric.operationalImpact === 'high' ? 'high' : 'medium',
        ),
        metadata: toJson({ source: metric.source }),
      },
    })
    await client.operationalKnowledgeUsage.upsert({
      where: { id: knowledgeUsageObservationId(metric.id, snapshot) },
      update: {
        source: metric.source,
        label: metric.label,
        outcome: 'APPLIED',
        sourceResponseId: snapshot.responseId,
        affectedModules: metric.affectedModules.map(String),
        evidenceIds: [],
        metadata: toJson({
          operationalImpact: metric.operationalImpact,
          sourceSnapshotId: snapshot.id,
        }),
        usedAt: new Date(metric.lastUsedAt),
      },
      create: {
        id: knowledgeUsageObservationId(metric.id, snapshot),
        workspaceId: snapshot.workspaceId,
        knowledgeReferenceId: metric.id,
        source: metric.source,
        label: metric.label,
        outcome: 'APPLIED',
        sourceResponseId: snapshot.responseId,
        affectedModules: metric.affectedModules.map(String),
        evidenceIds: [],
        metadata: toJson({
          operationalImpact: metric.operationalImpact,
          sourceSnapshotId: snapshot.id,
        }),
        usedAt: new Date(metric.lastUsedAt),
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistHealthSnapshot(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const row = await client.operationalHealthSnapshot.upsert({
    where: {
      workspaceId_snapshotKey: {
        workspaceId: snapshot.workspaceId,
        snapshotKey: `${snapshot.id}:health`,
      },
    },
    update: {
      sourceResponseId: snapshot.responseId,
      overallStatus: snapshot.futureDashboardSignals.businessRisk.status,
      confidence: upperConfidence(
        snapshot.futureDashboardSignals.aiConfidence.confidence,
      ),
      signalCount: snapshot.operationalHealth.length,
      riskCount: snapshot.operationalInsights.filter((insight) =>
        ['warning', 'critical'].includes(insight.severity),
      ).length,
      trendDirection: 'UNKNOWN',
      signals: toJson(snapshot.operationalHealth),
      metadata: toJson({ sourceSnapshotId: snapshot.id }),
      capturedAt: new Date(snapshot.createdAt),
    },
    create: {
      workspaceId: snapshot.workspaceId,
      snapshotKey: `${snapshot.id}:health`,
      sourceResponseId: snapshot.responseId,
      overallStatus: snapshot.futureDashboardSignals.businessRisk.status,
      confidence: upperConfidence(
        snapshot.futureDashboardSignals.aiConfidence.confidence,
      ),
      signalCount: snapshot.operationalHealth.length,
      riskCount: snapshot.operationalInsights.filter((insight) =>
        ['warning', 'critical'].includes(insight.severity),
      ).length,
      trendDirection: 'UNKNOWN',
      signals: toJson(snapshot.operationalHealth),
      metadata: toJson({ sourceSnapshotId: snapshot.id }),
      capturedAt: new Date(snapshot.createdAt),
    },
  })
  return row.id
}

async function persistDashboardSignals(
  snapshot: OperationalIntelligenceSnapshot,
  client: typeof prisma = prisma,
) {
  const ids: string[] = []
  for (const signal of snapshot.operationalHealth) {
    const signalKey = `${signal.key}:${normalizeKey(signal.summary)}`
    const row = await client.operationalDashboardSignal.upsert({
      where: {
        workspaceId_signalKey: {
          workspaceId: snapshot.workspaceId,
          signalKey,
        },
      },
      update: {
        label: signal.label,
        summary: signal.summary,
        severity: severityForHealthSignal(signal),
        confidence: upperConfidence(signal.confidence),
        evidenceIds: signal.evidenceIds,
        history: toJson({ lastSourceResponseId: snapshot.responseId }),
        generatedAt: new Date(snapshot.createdAt),
      },
      create: {
        workspaceId: snapshot.workspaceId,
        signalKey,
        label: signal.label,
        summary: signal.summary,
        severity: severityForHealthSignal(signal),
        confidence: upperConfidence(signal.confidence),
        evidenceIds: signal.evidenceIds,
        history: toJson({ firstSourceResponseId: snapshot.responseId }),
        generatedAt: new Date(snapshot.createdAt),
      },
    })
    ids.push(row.id)
  }
  return ids
}

function mapDashboardSignal(signal: any): OperationalHealthSignal {
  return {
    key: signal.signalKey.split(':')[0] as OperationalHealthSignal['key'],
    label: signal.label,
    status:
      signal.severity === 'CRITICAL'
        ? 'risk'
        : signal.severity === 'WARNING' || signal.severity === 'NOTICE'
          ? 'watch'
          : 'healthy',
    summary: signal.summary,
    confidence: lowerConfidence(signal.confidence),
    evidenceIds: signal.evidenceIds ?? [],
  }
}

function nextLifecycleStatus(
  currentStatus: OperationalInsightLifecycleStatus | undefined,
  occurrenceCount: number,
): OperationalInsightLifecycleStatus {
  if (
    currentStatus &&
    ['RESOLVED', 'DISMISSED', 'ARCHIVED', 'SUPERSEDED'].includes(currentStatus)
  ) {
    return 'ACTIVE'
  }
  if (occurrenceCount > 1) return 'RECURRING'
  return currentStatus ?? 'NEW'
}

function normalizeRecommendationOutcome(
  outcome: RecordOperationalRecommendationOutcomeInput['outcome'],
):
  | 'APPROVED'
  | 'EXECUTED'
  | 'IGNORED'
  | 'EXPIRED'
  | 'SUCCESSFUL'
  | 'UNSUCCESSFUL'
  | 'PARTIALLY_SUCCESSFUL' {
  switch (outcome) {
    case 'approved':
      return 'APPROVED'
    case 'executed':
      return 'EXECUTED'
    case 'expired':
      return 'EXPIRED'
    case 'successful':
      return 'SUCCESSFUL'
    case 'unsuccessful':
      return 'UNSUCCESSFUL'
    case 'partiallySuccessful':
      return 'PARTIALLY_SUCCESSFUL'
    case 'ignored':
    default:
      return 'IGNORED'
  }
}

function knowledgeEffectivenessKey(metric: KnowledgeEffectivenessMetric) {
  return `${normalizeKey(metric.source)}:${normalizeKey(metric.id)}`
}

function revisionObservationId(
  insightId: string,
  version: number,
  snapshot: OperationalIntelligenceSnapshot,
) {
  return observationId('revision', snapshot, insightId, String(version))
}

function auditObservationId(
  insightId: string,
  action: string,
  snapshot: OperationalIntelligenceSnapshot,
) {
  return observationId('audit', snapshot, insightId, action)
}

function recommendationObservationId(
  recommendationId: string,
  snapshot: OperationalIntelligenceSnapshot,
) {
  return observationId('recommendation', snapshot, recommendationId)
}

function metricObservationId(
  metricKey: string,
  snapshot: OperationalIntelligenceSnapshot,
) {
  return observationId('metric', snapshot, metricKey)
}

function knowledgeUsageObservationId(
  knowledgeReferenceId: string,
  snapshot: OperationalIntelligenceSnapshot,
) {
  return observationId('knowledge-usage', snapshot, knowledgeReferenceId)
}

function observationId(
  kind: string,
  snapshot: OperationalIntelligenceSnapshot,
  ...parts: string[]
) {
  return [
    'oi',
    kind,
    normalizeKey(snapshot.workspaceId),
    normalizeKey(snapshot.runtimeRequestId || snapshot.id),
    ...parts.map(normalizeKey),
  ]
    .join(':')
    .slice(0, 240)
}

function severityForHealthSignal(
  signal: OperationalHealthSignal,
): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (signal.status === 'risk') return 'CRITICAL'
  if (signal.status === 'watch') return 'WARNING'
  return 'INFO'
}

function domainFromSignal(signal: OperationalHealthSignal) {
  if (signal.key === 'schedulingHealth') return 'scheduling'
  if (signal.key === 'crmHealth') return 'crm'
  if (signal.key === 'automationHealth') return 'automation'
  if (signal.key === 'marketingHealth') return 'marketing'
  if (signal.key === 'financeHealth') return 'finance'
  if (signal.key === 'knowledgeHealth') return 'workspaceKnowledge'
  return 'operations'
}

function metricValueForSignal(signal: OperationalHealthSignal) {
  if (signal.status === 'healthy') return 100
  if (signal.status === 'watch') return 60
  if (signal.status === 'risk') return 25
  return 0
}

function upperSeverity(
  value: OperationalInsight['severity'],
): 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL' {
  if (value === 'critical') return 'CRITICAL'
  if (value === 'warning') return 'WARNING'
  if (value === 'notice') return 'NOTICE'
  return 'INFO'
}

function upperConfidence(value: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  const normalized = value.toUpperCase()
  if (
    normalized === 'LOW' ||
    normalized === 'MEDIUM' ||
    normalized === 'HIGH'
  ) {
    return normalized
  }
  return 'UNKNOWN'
}

function lowerConfidence(
  value: string,
): OperationalKnowledgeEffectivenessRecord['confidence'] {
  const normalized = value.toLowerCase()
  if (['low', 'medium', 'high', 'unknown'].includes(normalized)) {
    return normalized as OperationalKnowledgeEffectivenessRecord['confidence']
  }
  return 'unknown'
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
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

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}
