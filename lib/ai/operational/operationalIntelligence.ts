import type {
  AIRuntimeResponse,
  ActionProposal,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import type {
  WorkspaceReasoningBusinessRule,
  WorkspaceReasoningEvidence,
  WorkspaceReasoningRecommendation,
  WorkspaceReasoningSnapshot,
} from '@/lib/ai/reasoning/workspaceReasoningEngine'
import type {
  NormalizedWorkspaceRecommendation,
  WorkspaceKnowledgeDomain,
  WorkspaceKnowledgeReference,
} from '@/lib/intelligence/workspaceIntelligence'
import { normalizeWorkspaceRecommendations } from '@/lib/intelligence/workspaceIntelligence'

export type OperationalInsightDomain =
  | WorkspaceKnowledgeDomain
  | 'workspaceKnowledge'
  | 'operations'
  | 'automation'

export type OperationalInsightSeverity =
  | 'info'
  | 'notice'
  | 'warning'
  | 'critical'

export type OperationalHealthStatus = 'healthy' | 'watch' | 'risk' | 'unknown'

export type OperationalInsight = {
  id: string
  domain: OperationalInsightDomain
  title: string
  summary: string
  severity: OperationalInsightSeverity
  priority: 'low' | 'medium' | 'high'
  confidence: WorkspaceReasoningEvidence['confidence']
  evidenceIds: string[]
  generatedAt: string
  deterministic: true
}

export type OperationalRejectedAlternative = {
  id: string
  recommendationId?: string
  candidate: string
  reason: string
  evidenceIds: string[]
  confidence: WorkspaceReasoningEvidence['confidence']
}

export type OperationalEvidenceRanking = {
  rank: number
  evidenceId: string
  label: string
  domain: OperationalInsightDomain
  confidence: WorkspaceReasoningEvidence['confidence']
  verified: boolean
  reason: string
}

export type KnowledgeEffectivenessMetric = {
  id: string
  source: string
  label: string
  timesUsed: number
  lastUsedAt: string
  affectedModules: OperationalInsightDomain[]
  positiveOutcomes: number
  negativeOutcomes: number
  conflictsGenerated: number
  recommendationsGenerated: number
  operationalImpact: 'low' | 'medium' | 'high'
}

export type OperationalDecisionExplanation = {
  id: string
  recommendationId: string
  recommendation: string
  confidence: WorkspaceReasoningEvidence['confidence']
  businessRulesApplied: WorkspaceReasoningBusinessRule[]
  rejectedCandidates: OperationalRejectedAlternative[]
  evidence: OperationalEvidenceRanking[]
  knowledgeUsed: Array<{
    id: string
    label: string
    source: string
  }>
  reasoningSummary: string
}

export type OperationalRecommendationJustification = {
  recommendationId: string
  summary: string
  evidenceIds: string[]
  businessRuleIds: string[]
  rejectedAlternativeIds: string[]
  proposalOnly: true
}

export type OperationalHealthSignal = {
  key:
    | 'topPriority'
    | 'ownerFocus'
    | 'businessRisk'
    | 'schedulingHealth'
    | 'crmHealth'
    | 'automationHealth'
    | 'marketingHealth'
    | 'financeHealth'
    | 'knowledgeHealth'
    | 'aiConfidence'
  label: string
  status: OperationalHealthStatus
  summary: string
  confidence: WorkspaceReasoningEvidence['confidence']
  evidenceIds: string[]
}

export type FutureDashboardSignals = {
  topPriority: OperationalHealthSignal
  ownerFocus: OperationalHealthSignal
  businessRisk: OperationalHealthSignal
  schedulingHealth: OperationalHealthSignal
  crmHealth: OperationalHealthSignal
  automationHealth: OperationalHealthSignal
  marketingHealth: OperationalHealthSignal
  financeHealth: OperationalHealthSignal
  knowledgeHealth: OperationalHealthSignal
  aiConfidence: OperationalHealthSignal
}

export type OperationalInsightGenerationReport = {
  generatedCount: number
  sourceDomains: OperationalInsightDomain[]
  skippedDomains: Array<{
    domain: OperationalInsightDomain
    reason: string
  }>
  rules: string[]
  proposalOnly: true
  executedActions: 0
  knowledgeMutations: 0
}

export type OperationalIntelligenceSnapshot = {
  id: string
  workspaceId: string
  responseId: string
  runtimeRequestId: string
  createdAt: string
  layer: 'operational-intelligence'
  deterministic: true
  proposalOnly: true
  operationalInsights: OperationalInsight[]
  decisionExplanations: OperationalDecisionExplanation[]
  businessRulesApplied: WorkspaceReasoningBusinessRule[]
  rejectedAlternatives: OperationalRejectedAlternative[]
  evidenceRanking: OperationalEvidenceRanking[]
  knowledgeEffectiveness: KnowledgeEffectivenessMetric[]
  insightGeneration: OperationalInsightGenerationReport
  recommendationJustifications: OperationalRecommendationJustification[]
  operationalHealth: OperationalHealthSignal[]
  futureDashboardSignals: FutureDashboardSignals
  audit: {
    executedActions: 0
    knowledgeMutations: 0
    approvalsCreated: 0
  }
}

export type BuildOperationalIntelligenceInput = {
  workspaceId: string
  responseId: string
  runtimeResponse: AIRuntimeResponse
  recommendations?: NormalizedWorkspaceRecommendation[]
  actionProposals?: ActionProposal[]
  now?: Date
}

export function buildOperationalIntelligenceSnapshot({
  workspaceId,
  responseId,
  runtimeResponse,
  recommendations,
  actionProposals = runtimeResponse.recommendedActions,
  now,
}: BuildOperationalIntelligenceInput): OperationalIntelligenceSnapshot {
  const createdAt = (now ?? new Date()).toISOString()
  const reasoningSnapshot = normalizeReasoningSnapshot({
    snapshot: runtimeResponse.reasoningSnapshot,
    requestId: runtimeResponse.requestId,
    createdAt,
  })
  const normalizedRecommendations = normalizeWorkspaceRecommendations({
    recommendations:
      recommendations ?? runtimeResponse.structuredResponse.recommendations,
    requestId: runtimeResponse.requestId,
    producer: 'operational-intelligence',
    fallbackIntent: runtimeResponse.intent,
    fallbackProviderId: runtimeResponse.providerUsage.knowledgeProviderIds[0],
  }).recommendations
  const evidenceRanking = rankEvidence(reasoningSnapshot.evidence)
  const rejectedAlternatives = buildRejectedAlternatives({
    recommendations: normalizedRecommendations,
    actionProposals,
    runtimeResponse,
  })
  const operationalInsights = buildOperationalInsights({
    reasoningSnapshot,
    runtimeResponse,
    evidenceRanking,
    createdAt,
  })
  const businessRulesApplied = reasoningSnapshot.businessRulesApplied
  const decisionExplanations = buildDecisionExplanations({
    recommendations: normalizedRecommendations,
    actionProposals,
    reasoningSnapshot,
    evidenceRanking,
    rejectedAlternatives,
  })
  const recommendationJustifications = decisionExplanations.map(
    (explanation) => ({
      recommendationId: explanation.recommendationId,
      summary: explanation.reasoningSummary,
      evidenceIds: explanation.evidence.map((evidence) => evidence.evidenceId),
      businessRuleIds: explanation.businessRulesApplied.map((rule) => rule.id),
      rejectedAlternativeIds: explanation.rejectedCandidates.map(
        (candidate) => candidate.id,
      ),
      proposalOnly: true as const,
    }),
  )
  const knowledgeEffectiveness = buildKnowledgeEffectiveness({
    reasoningSnapshot,
    recommendationCount:
      normalizedRecommendations.length + actionProposals.length,
    createdAt,
  })
  const futureDashboardSignals = buildFutureDashboardSignals({
    reasoningSnapshot,
    operationalInsights,
    evidenceRanking,
  })
  const operationalHealth = Object.values(futureDashboardSignals)

  return {
    id: `operational-intelligence:${responseId}`,
    workspaceId,
    responseId,
    runtimeRequestId: runtimeResponse.requestId,
    createdAt,
    layer: 'operational-intelligence',
    deterministic: true,
    proposalOnly: true,
    operationalInsights,
    decisionExplanations,
    businessRulesApplied,
    rejectedAlternatives,
    evidenceRanking,
    knowledgeEffectiveness,
    insightGeneration: {
      generatedCount: operationalInsights.length,
      sourceDomains: unique(
        operationalInsights.map((insight) => insight.domain),
      ),
      skippedDomains: buildSkippedDomains(reasoningSnapshot),
      rules: [
        'Use verified workspace evidence only.',
        'Generate observations without executing actions.',
        'Preserve workspace-scoped knowledge as read-only input.',
        'Expose rejected alternatives and confidence for inspection.',
      ],
      proposalOnly: true,
      executedActions: 0,
      knowledgeMutations: 0,
    },
    recommendationJustifications,
    operationalHealth,
    futureDashboardSignals,
    audit: {
      executedActions: 0,
      knowledgeMutations: 0,
      approvalsCreated: 0,
    },
  }
}

function buildOperationalInsights({
  reasoningSnapshot,
  runtimeResponse,
  evidenceRanking,
  createdAt,
}: {
  reasoningSnapshot: WorkspaceReasoningSnapshot
  runtimeResponse: AIRuntimeResponse
  evidenceRanking: OperationalEvidenceRanking[]
  createdAt: string
}): OperationalInsight[] {
  const insights: OperationalInsight[] = []
  for (const group of reasoningSnapshot.evidenceGroups) {
    insights.push({
      id: `operational-insight:${reasoningSnapshot.requestId}:${group.domain}`,
      domain: group.domain,
      title: `${formatDomainLabel(group.domain)} signal detected`,
      summary: group.summary,
      severity: group.confidence === 'low' ? 'notice' : 'info',
      priority: group.confidence === 'high' ? 'medium' : 'low',
      confidence: group.confidence,
      evidenceIds: group.evidenceIds,
      generatedAt: createdAt,
      deterministic: true,
    })
  }
  for (const contradiction of reasoningSnapshot.contradictions) {
    insights.push({
      id: `operational-insight:${contradiction.id}`,
      domain: domainForEvidence(evidenceRanking, contradiction.evidenceIds),
      title: 'Conflicting workspace evidence requires review',
      summary: contradiction.summary,
      severity: contradiction.severity === 'high' ? 'critical' : 'warning',
      priority: contradiction.severity === 'high' ? 'high' : 'medium',
      confidence: 'medium',
      evidenceIds: contradiction.evidenceIds,
      generatedAt: createdAt,
      deterministic: true,
    })
  }
  for (const missing of reasoningSnapshot.missingInformation) {
    insights.push({
      id: `operational-insight:${missing.id}`,
      domain: missing.domain ?? 'workspaceKnowledge',
      title: 'Missing information limits operational confidence',
      summary: `${missing.label}: ${missing.whyItMatters}`,
      severity: missing.confidenceImpact === 'high' ? 'warning' : 'notice',
      priority: missing.confidenceImpact === 'high' ? 'high' : 'medium',
      confidence: missing.confidenceImpact === 'high' ? 'medium' : 'low',
      evidenceIds: [],
      generatedAt: createdAt,
      deterministic: true,
    })
  }
  for (const warning of runtimeResponse.warnings) {
    insights.push({
      id: `operational-insight:runtime-warning:${warning.code}`,
      domain: 'operations',
      title: 'Runtime warning affects operational confidence',
      summary: warning.message,
      severity: warning.severity === 'blocking' ? 'critical' : 'warning',
      priority: warning.severity === 'blocking' ? 'high' : 'medium',
      confidence: 'medium',
      evidenceIds: [],
      generatedAt: createdAt,
      deterministic: true,
    })
  }
  return insights
}

function normalizeReasoningSnapshot({
  snapshot,
  requestId,
  createdAt,
}: {
  snapshot: Partial<WorkspaceReasoningSnapshot> | null | undefined
  requestId: string
  createdAt: string
}): WorkspaceReasoningSnapshot {
  const candidate = snapshot && typeof snapshot === 'object' ? snapshot : {}
  return {
    id:
      typeof candidate.id === 'string'
        ? candidate.id
        : `reasoning-snapshot:${requestId}`,
    requestId:
      typeof candidate.requestId === 'string' ? candidate.requestId : requestId,
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : createdAt,
    immutable: true,
    investigationGoal:
      typeof candidate.investigationGoal === 'string'
        ? candidate.investigationGoal
        : 'Determine the safest response using deterministic workspace evidence.',
    investigationPlan: Array.isArray(candidate.investigationPlan)
      ? candidate.investigationPlan
      : [],
    evidence: Array.isArray(candidate.evidence) ? candidate.evidence : [],
    evidenceGroups: Array.isArray(candidate.evidenceGroups)
      ? candidate.evidenceGroups
      : [],
    contradictions: Array.isArray(candidate.contradictions)
      ? candidate.contradictions
      : [],
    missingInformation: Array.isArray(candidate.missingInformation)
      ? candidate.missingInformation
      : [],
    businessRulesApplied: Array.isArray(candidate.businessRulesApplied)
      ? candidate.businessRulesApplied
      : [],
    reasoningChain: Array.isArray(candidate.reasoningChain)
      ? candidate.reasoningChain
      : [],
    rootCauseRanking: Array.isArray(candidate.rootCauseRanking)
      ? candidate.rootCauseRanking
      : [],
    recommendationRanking: Array.isArray(candidate.recommendationRanking)
      ? candidate.recommendationRanking
      : [],
    proposalCandidates: Array.isArray(candidate.proposalCandidates)
      ? candidate.proposalCandidates
      : [],
    confidenceReport: candidate.confidenceReport ?? {
      overall: 'unknown',
      score: 0,
      investigation: 'unknown',
      perDomain: [],
      perRecommendation: [],
      perProposal: [],
      rationale: ['Reasoning snapshot was incomplete.'],
    },
    coverageReport: candidate.coverageReport ?? {
      inspectedDomains: [],
      skippedDomains: [],
      couldNotInspect: [],
    },
    learningOpportunities: Array.isArray(candidate.learningOpportunities)
      ? candidate.learningOpportunities
      : [],
    providerInstructions: Array.isArray(candidate.providerInstructions)
      ? candidate.providerInstructions
      : [],
  }
}

function rankEvidence(
  evidence: WorkspaceReasoningEvidence[],
): OperationalEvidenceRanking[] {
  return [...evidence]
    .sort(
      (a, b) => evidenceScore(b) - evidenceScore(a) || a.id.localeCompare(b.id),
    )
    .map((item, index) => ({
      rank: index + 1,
      evidenceId: item.id,
      label: item.label,
      domain: item.domain,
      confidence: item.confidence,
      verified: item.verified,
      reason: item.verified
        ? 'Verified workspace evidence is ranked ahead of unverified or lower-confidence signals.'
        : 'Unverified evidence is retained for transparency but ranked lower.',
    }))
}

function buildRejectedAlternatives({
  recommendations,
  actionProposals,
  runtimeResponse,
}: {
  recommendations: NormalizedWorkspaceRecommendation[]
  actionProposals: ActionProposal[]
  runtimeResponse: AIRuntimeResponse
}): OperationalRejectedAlternative[] {
  const rejectedFromValidation =
    runtimeResponse.validation.rejectedActionProposals.map(
      (proposal, index): OperationalRejectedAlternative => ({
        id: `rejected-alternative:validation:${proposal.id || index}`,
        candidate: proposal.label,
        reason:
          proposal.validation?.message ??
          'Runtime validation rejected this action proposal.',
        evidenceIds: (proposal.references ?? []).map(
          (reference) => reference.id,
        ),
        confidence: proposal.confidence,
      }),
    )
  const rejectedFromWarnings = recommendations.flatMap((recommendation) =>
    (recommendation.warnings ?? []).map(
      (warning, index): OperationalRejectedAlternative => ({
        id: `rejected-alternative:${recommendation.id}:warning:${index}`,
        recommendationId: recommendation.id,
        candidate: recommendation.subject.label,
        reason: warning.label,
        evidenceIds: (recommendation.references ?? []).map(
          (reference) => reference.id,
        ),
        confidence: recommendation.confidence,
      }),
    ),
  )
  const rejectedActionWarnings = actionProposals.flatMap((proposal) =>
    (proposal.warnings ?? []).map(
      (warning, index): OperationalRejectedAlternative => ({
        id: `rejected-alternative:${proposal.id}:warning:${index}`,
        recommendationId: proposal.id,
        candidate: proposal.label,
        reason: warning,
        evidenceIds: (proposal.references ?? []).map(
          (reference) => reference.id,
        ),
        confidence: proposal.confidence,
      }),
    ),
  )
  return [
    ...rejectedFromValidation,
    ...rejectedFromWarnings,
    ...rejectedActionWarnings,
  ]
}

function buildDecisionExplanations({
  recommendations,
  actionProposals,
  reasoningSnapshot,
  evidenceRanking,
  rejectedAlternatives,
}: {
  recommendations: NormalizedWorkspaceRecommendation[]
  actionProposals: ActionProposal[]
  reasoningSnapshot: WorkspaceReasoningSnapshot
  evidenceRanking: OperationalEvidenceRanking[]
  rejectedAlternatives: OperationalRejectedAlternative[]
}): OperationalDecisionExplanation[] {
  const explanations = recommendations.map(
    (recommendation): OperationalDecisionExplanation => {
      const references = recommendation.references ?? []
      const reasons = recommendation.reasons ?? []
      const evidenceIds = new Set(references.map((reference) => reference.id))
      const evidence = evidenceRanking.filter(
        (ranked) =>
          evidenceIds.size === 0 || evidenceIds.has(ranked.evidenceId),
      )
      return {
        id: `decision-explanation:${recommendation.id}`,
        recommendationId: recommendation.id,
        recommendation: recommendation.subject.label,
        confidence: recommendation.confidence,
        businessRulesApplied: reasoningSnapshot.businessRulesApplied,
        rejectedCandidates: rejectedAlternatives.filter(
          (candidate) => candidate.recommendationId === recommendation.id,
        ),
        evidence: evidence.slice(0, 5),
        knowledgeUsed: toKnowledgeUsed(references),
        reasoningSummary: reasons.length
          ? reasons.map((reason) => reason.label).join(' ')
          : 'Recommendation is based on deterministic workspace evidence and current provider output.',
      }
    },
  )
  const proposalExplanations = actionProposals.map(
    (proposal): OperationalDecisionExplanation => {
      const references = proposal.references ?? []
      const evidenceIds = new Set(references.map((reference) => reference.id))
      const evidence = evidenceRanking.filter(
        (ranked) =>
          evidenceIds.size === 0 || evidenceIds.has(ranked.evidenceId),
      )
      return {
        id: `decision-explanation:${proposal.id}`,
        recommendationId: proposal.id,
        recommendation: proposal.label,
        confidence: proposal.confidence,
        businessRulesApplied: reasoningSnapshot.businessRulesApplied,
        rejectedCandidates: rejectedAlternatives.filter(
          (candidate) => candidate.recommendationId === proposal.id,
        ),
        evidence: evidence.slice(0, 5),
        knowledgeUsed: toKnowledgeUsed(references),
        reasoningSummary:
          proposal.explanation ??
          proposal.summary ??
          'Action proposal remains proposal-only and is supported by deterministic workspace evidence.',
      }
    },
  )
  if (explanations.length || proposalExplanations.length) {
    return [...explanations, ...proposalExplanations]
  }
  return reasoningSnapshot.recommendationRanking
    .slice(0, 3)
    .map((recommendation) =>
      reasoningRecommendationToExplanation({
        recommendation,
        reasoningSnapshot,
        evidenceRanking,
      }),
    )
}

function reasoningRecommendationToExplanation({
  recommendation,
  reasoningSnapshot,
  evidenceRanking,
}: {
  recommendation: WorkspaceReasoningRecommendation
  reasoningSnapshot: WorkspaceReasoningSnapshot
  evidenceRanking: OperationalEvidenceRanking[]
}): OperationalDecisionExplanation {
  const evidenceIds = new Set(recommendation.evidenceIds)
  return {
    id: `decision-explanation:reasoning:${recommendation.rank}`,
    recommendationId: `reasoning:${recommendation.rank}`,
    recommendation: recommendation.recommendation,
    confidence: recommendation.confidence,
    businessRulesApplied: reasoningSnapshot.businessRulesApplied,
    rejectedCandidates: [],
    evidence: evidenceRanking
      .filter((ranked) => evidenceIds.has(ranked.evidenceId))
      .slice(0, 5),
    knowledgeUsed: [],
    reasoningSummary: recommendation.businessImpact,
  }
}

function buildKnowledgeEffectiveness({
  reasoningSnapshot,
  recommendationCount,
  createdAt,
}: {
  reasoningSnapshot: WorkspaceReasoningSnapshot
  recommendationCount: number
  createdAt: string
}): KnowledgeEffectivenessMetric[] {
  const affectedModules = unique(
    reasoningSnapshot.evidenceGroups.map((group) => group.domain),
  )
  return reasoningSnapshot.businessRulesApplied.map((rule) => ({
    id: `knowledge-effectiveness:${rule.id}`,
    source: rule.source,
    label: rule.rule,
    timesUsed: 1,
    lastUsedAt: createdAt,
    affectedModules,
    positiveOutcomes: recommendationCount,
    negativeOutcomes: 0,
    conflictsGenerated: reasoningSnapshot.contradictions.length,
    recommendationsGenerated: recommendationCount,
    operationalImpact:
      recommendationCount > 0 || rule.confidence === 'high' ? 'medium' : 'low',
  }))
}

function buildFutureDashboardSignals({
  reasoningSnapshot,
  operationalInsights,
  evidenceRanking,
}: {
  reasoningSnapshot: WorkspaceReasoningSnapshot
  operationalInsights: OperationalInsight[]
  evidenceRanking: OperationalEvidenceRanking[]
}): FutureDashboardSignals {
  const missingCount = reasoningSnapshot.missingInformation.length
  const contradictionCount = reasoningSnapshot.contradictions.length
  const topInsight = [...operationalInsights].sort(
    (a, b) => priorityScore(b.priority) - priorityScore(a.priority),
  )[0]
  const defaultEvidenceIds = evidenceRanking
    .slice(0, 3)
    .map((evidence) => evidence.evidenceId)
  return {
    topPriority: signal({
      key: 'topPriority',
      label: 'Top Priority',
      status: topInsight ? statusFromSeverity(topInsight.severity) : 'unknown',
      summary:
        topInsight?.summary ?? 'No deterministic top priority was identified.',
      confidence:
        topInsight?.confidence ?? reasoningSnapshot.confidenceReport.overall,
      evidenceIds: topInsight?.evidenceIds ?? defaultEvidenceIds,
    }),
    ownerFocus: signal({
      key: 'ownerFocus',
      label: 'Owner Focus',
      status: missingCount > 0 ? 'watch' : 'healthy',
      summary:
        missingCount > 0
          ? `${missingCount} missing information item${missingCount === 1 ? '' : 's'} should be reviewed.`
          : 'No missing information was detected in the inspected context.',
      confidence: reasoningSnapshot.confidenceReport.overall,
      evidenceIds: defaultEvidenceIds,
    }),
    businessRisk: signal({
      key: 'businessRisk',
      label: 'Business Risk',
      status: contradictionCount > 0 ? 'risk' : 'healthy',
      summary:
        contradictionCount > 0
          ? `${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} may affect business confidence.`
          : 'No deterministic contradictions were detected.',
      confidence: reasoningSnapshot.confidenceReport.overall,
      evidenceIds: reasoningSnapshot.contradictions.flatMap(
        (item) => item.evidenceIds,
      ),
    }),
    schedulingHealth: domainSignal('scheduling', reasoningSnapshot),
    crmHealth: domainSignal('crm', reasoningSnapshot),
    automationHealth: domainSignal('automation', reasoningSnapshot),
    marketingHealth: domainSignal('marketing', reasoningSnapshot),
    financeHealth: domainSignal('finance', reasoningSnapshot),
    knowledgeHealth: signal({
      key: 'knowledgeHealth',
      label: 'Knowledge Health',
      status: reasoningSnapshot.businessRulesApplied.length
        ? 'healthy'
        : 'watch',
      summary: reasoningSnapshot.businessRulesApplied.length
        ? `${reasoningSnapshot.businessRulesApplied.length} governed business rule${reasoningSnapshot.businessRulesApplied.length === 1 ? '' : 's'} applied.`
        : 'No governed workspace business rules were applied.',
      confidence: reasoningSnapshot.confidenceReport.overall,
      evidenceIds: defaultEvidenceIds,
    }),
    aiConfidence: signal({
      key: 'aiConfidence',
      label: 'AI Confidence',
      status:
        reasoningSnapshot.confidenceReport.overall === 'high'
          ? 'healthy'
          : reasoningSnapshot.confidenceReport.overall === 'unknown'
            ? 'unknown'
            : 'watch',
      summary: `Reasoning confidence is ${reasoningSnapshot.confidenceReport.overall} (${reasoningSnapshot.confidenceReport.score}/100).`,
      confidence: reasoningSnapshot.confidenceReport.overall,
      evidenceIds: defaultEvidenceIds,
    }),
  }
}

function domainSignal(
  domain: OperationalInsightDomain,
  reasoningSnapshot: WorkspaceReasoningSnapshot,
): OperationalHealthSignal {
  const group = reasoningSnapshot.evidenceGroups.find(
    (item) => item.domain === domain,
  )
  return signal({
    key:
      domain === 'scheduling'
        ? 'schedulingHealth'
        : domain === 'crm'
          ? 'crmHealth'
          : domain === 'automation'
            ? 'automationHealth'
            : domain === 'marketing'
              ? 'marketingHealth'
              : 'financeHealth',
    label: `${formatDomainLabel(domain)} Health`,
    status: group ? 'healthy' : 'unknown',
    summary:
      group?.summary ??
      `${formatDomainLabel(domain)} was not inspected in this response.`,
    confidence: group?.confidence ?? 'unknown',
    evidenceIds: group?.evidenceIds ?? [],
  })
}

function signal(signalValue: OperationalHealthSignal): OperationalHealthSignal {
  return signalValue
}

function buildSkippedDomains(
  reasoningSnapshot: WorkspaceReasoningSnapshot,
): OperationalInsightGenerationReport['skippedDomains'] {
  const covered = new Set(
    reasoningSnapshot.evidenceGroups.map((group) => group.domain),
  )
  return (
    [
      'scheduling',
      'crm',
      'tasks',
      'automation',
      'marketing',
      'finance',
    ] as OperationalInsightDomain[]
  )
    .filter((domain) => !covered.has(domain))
    .map((domain) => ({
      domain,
      reason: `${formatDomainLabel(domain)} was not present in the selected workspace context.`,
    }))
}

function toKnowledgeUsed(references: WorkspaceKnowledgeReference[]) {
  return references.map((reference) => ({
    id: reference.id,
    label: reference.label,
    source: reference.providerId,
  }))
}

function domainForEvidence(
  evidenceRanking: OperationalEvidenceRanking[],
  evidenceIds: string[],
): OperationalInsightDomain {
  return (
    evidenceRanking.find((evidence) =>
      evidenceIds.includes(evidence.evidenceId),
    )?.domain ?? 'operations'
  )
}

function evidenceScore(evidence: WorkspaceReasoningEvidence) {
  return (evidence.verified ? 10 : 0) + confidenceScore(evidence.confidence)
}

function confidenceScore(confidence: WorkspaceReasoningEvidence['confidence']) {
  switch (confidence) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function priorityScore(priority: OperationalInsight['priority']) {
  switch (priority) {
    case 'high':
      return 3
    case 'medium':
      return 2
    default:
      return 1
  }
}

function statusFromSeverity(
  severity: OperationalInsightSeverity,
): OperationalHealthStatus {
  if (severity === 'critical') return 'risk'
  if (severity === 'warning' || severity === 'notice') return 'watch'
  return 'healthy'
}

function formatDomainLabel(domain: OperationalInsightDomain) {
  if (domain === 'crm') return 'CRM'
  if (domain === 'workspaceKnowledge') return 'Workspace Knowledge'
  return String(domain)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}
