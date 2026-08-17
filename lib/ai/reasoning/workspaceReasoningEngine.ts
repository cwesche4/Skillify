import type {
  KnowledgeProviderMetadata,
  WorkspaceContextAssemblerResult,
  WorkspaceIntelligenceIntent,
  WorkspaceKnowledgeDomain,
  WorkspaceKnowledgeProviderId,
  WorkspaceKnowledgeReference,
  WorkspaceToolMetadata,
} from '@/lib/intelligence/workspaceIntelligence'

export type WorkspaceReasoningConfidence = 'low' | 'medium' | 'high' | 'unknown'

export type WorkspaceReasoningEvidence = {
  id: string
  label: string
  source: string
  provider: WorkspaceKnowledgeProviderId | 'workspace-knowledge' | 'runtime'
  domain: WorkspaceKnowledgeDomain | 'workspaceKnowledge'
  confidence: WorkspaceReasoningConfidence
  verified: boolean
  timestamp: string
  type:
    | 'context'
    | 'snapshot'
    | 'reference'
    | 'business-rule'
    | 'warning'
    | 'tool'
    | 'runtime'
  referenceId?: string
}

export type WorkspaceReasoningEvidenceGroup = {
  domain: WorkspaceReasoningEvidence['domain']
  evidenceIds: string[]
  confidence: WorkspaceReasoningConfidence
  summary: string
}

export type WorkspaceReasoningContradiction = {
  id: string
  summary: string
  evidenceIds: string[]
  severity: 'low' | 'medium' | 'high'
  confidenceImpact: 'none' | 'low' | 'medium' | 'high'
}

export type WorkspaceReasoningMissingInformation = {
  id: string
  label: string
  whyItMatters: string
  confidenceImpact: 'low' | 'medium' | 'high'
  domain?: WorkspaceKnowledgeDomain
}

export type WorkspaceReasoningBusinessRule = {
  id: string
  rule: string
  source: string
  confidence: WorkspaceReasoningConfidence
  referenceId?: string
}

export type WorkspaceReasoningChainItem = {
  id: string
  finding: string
  relationship: 'supports' | 'contradicts' | 'dependsOn'
  targetFindingId?: string
  because: string
  evidenceIds: string[]
  confidence: WorkspaceReasoningConfidence
}

export type WorkspaceReasoningRootCause = {
  rank: number
  cause: string
  score: number
  confidence: WorkspaceReasoningConfidence
  evidenceIds: string[]
  rationale: string
}

export type WorkspaceReasoningRecommendation = {
  rank: number
  recommendation: string
  priority: 'low' | 'medium' | 'high'
  businessImpact: string
  risk: string
  confidence: WorkspaceReasoningConfidence
  dependencies: string[]
  requiredApprovals: string[]
  estimatedEffort: string
  evidenceIds: string[]
}

export type WorkspaceReasoningProposalCandidate = {
  id: string
  title: string
  target: string
  expectedOutcome: string
  businessReasoning: string
  requiredApprovals: string[]
  risks: string[]
  rollbackPossibility: string
  dependencies: string[]
  missingInformation: string[]
  confidence: WorkspaceReasoningConfidence
}

export type WorkspaceReasoningConfidenceReport = {
  overall: WorkspaceReasoningConfidence
  score: number
  investigation: WorkspaceReasoningConfidence
  perDomain: Array<{
    domain: WorkspaceReasoningEvidence['domain']
    confidence: WorkspaceReasoningConfidence
    evidenceCount: number
  }>
  perRecommendation: Array<{
    rank: number
    confidence: WorkspaceReasoningConfidence
  }>
  perProposal: Array<{
    id: string
    confidence: WorkspaceReasoningConfidence
  }>
  rationale: string[]
}

export type WorkspaceReasoningCoverageReport = {
  inspectedDomains: WorkspaceKnowledgeDomain[]
  skippedDomains: Array<{
    domain: WorkspaceKnowledgeDomain
    reason: string
  }>
  couldNotInspect: Array<{
    providerId: string
    reason: string
  }>
}

export type WorkspaceReasoningLearningOpportunity = {
  id: string
  title: string
  reason: string
  sourcePattern: string
  approvalRequired: true
}

export type WorkspaceReasoningInvestigationPlanStep = {
  order: number
  title: string
  providerIds: WorkspaceKnowledgeProviderId[]
  toolIds: string[]
  status: 'ready' | 'skipped' | 'blocked'
}

export type WorkspaceReasoningSnapshot = {
  id: string
  requestId: string
  createdAt: string
  immutable: true
  investigationGoal: string
  investigationPlan: WorkspaceReasoningInvestigationPlanStep[]
  evidence: WorkspaceReasoningEvidence[]
  evidenceGroups: WorkspaceReasoningEvidenceGroup[]
  contradictions: WorkspaceReasoningContradiction[]
  missingInformation: WorkspaceReasoningMissingInformation[]
  businessRulesApplied: WorkspaceReasoningBusinessRule[]
  reasoningChain: WorkspaceReasoningChainItem[]
  rootCauseRanking: WorkspaceReasoningRootCause[]
  recommendationRanking: WorkspaceReasoningRecommendation[]
  proposalCandidates: WorkspaceReasoningProposalCandidate[]
  confidenceReport: WorkspaceReasoningConfidenceReport
  coverageReport: WorkspaceReasoningCoverageReport
  learningOpportunities: WorkspaceReasoningLearningOpportunity[]
  providerInstructions: string[]
}

export type WorkspaceReasoningEngineInput = {
  requestId: string
  intent: WorkspaceIntelligenceIntent
  outputType: string
  assembled: WorkspaceContextAssemblerResult
  selectedTools: WorkspaceToolMetadata[]
  selectedProviderMetadata: KnowledgeProviderMetadata[]
  missingRequestedProviderIds?: string[]
  allowedActionTypes?: string[]
  governedKnowledge?: {
    approvedKnowledge?: unknown[]
    knowledgeGaps?: unknown[]
    confidence?: unknown
    correctionsMetadata?: unknown[]
    recommendationHistory?: unknown[]
  }
  constraints?: string[]
  now?: Date
}

export function buildWorkspaceReasoningSnapshot({
  requestId,
  intent,
  outputType,
  assembled,
  selectedTools,
  selectedProviderMetadata,
  missingRequestedProviderIds = [],
  allowedActionTypes = [],
  governedKnowledge,
  constraints = [],
  now,
}: WorkspaceReasoningEngineInput): WorkspaceReasoningSnapshot {
  const createdAt = (now ?? new Date()).toISOString()
  const evidence = buildEvidence({
    assembled,
    selectedTools,
    governedKnowledge,
    warnings: assembled.warnings,
    createdAt,
  })
  const evidenceGroups = groupEvidence(evidence)
  const missingInformation = buildMissingInformation({
    assembled,
    missingRequestedProviderIds,
    selectedProviderMetadata,
    governedKnowledge,
  })
  const contradictions = detectContradictions(evidence)
  const businessRulesApplied = buildBusinessRules({
    governedKnowledge,
    createdAt,
  })
  const confidenceScore = calculateConfidenceScore({
    evidenceCount: evidence.length,
    missingCount: missingInformation.length,
    contradictionCount: contradictions.length,
    warningCount: assembled.warnings.length,
  })
  const recommendationRanking = buildRecommendationRanking({
    selectedTools,
    evidence,
    confidence: confidenceFromScore(confidenceScore),
  })
  const proposalCandidates = buildProposalCandidates({
    allowedActionTypes,
    outputType,
    evidence,
    missingInformation,
    confidence: confidenceFromScore(confidenceScore),
  })
  const reasoningChain = buildReasoningChain({
    evidence,
    contradictions,
    missingInformation,
  })
  const rootCauseRanking = buildRootCauseRanking({
    contradictions,
    missingInformation,
    evidence,
  })
  const confidenceReport = buildConfidenceReport({
    score: confidenceScore,
    evidenceGroups,
    recommendationRanking,
    proposalCandidates,
    missingInformation,
    contradictions,
  })

  return {
    id: `reasoning-snapshot:${requestId}`,
    requestId,
    createdAt,
    immutable: true,
    investigationGoal: buildInvestigationGoal({ intent, constraints }),
    investigationPlan: buildInvestigationPlan({
      intent,
      selectedProviderMetadata,
      selectedTools,
      missingRequestedProviderIds,
    }),
    evidence,
    evidenceGroups,
    contradictions,
    missingInformation,
    businessRulesApplied,
    reasoningChain,
    rootCauseRanking,
    recommendationRanking,
    proposalCandidates,
    confidenceReport,
    coverageReport: buildCoverageReport({
      assembled,
      selectedProviderMetadata,
      missingRequestedProviderIds,
    }),
    learningOpportunities: buildLearningOpportunities({
      governedKnowledge,
      missingInformation,
      contradictions,
    }),
    providerInstructions: [
      'Explain only the verified facts, reasoning chain, business rules, evidence, confidence, unknowns, coverage, contradictions, recommendations, and proposal previews in this snapshot.',
      'Never invent facts.',
      'Never ignore contradictions.',
      'Clearly distinguish Verified, Likely, Unknown, Recommendation, and Proposal.',
      'Do not execute actions or mutate workspace knowledge.',
    ],
  }
}

function buildInvestigationGoal({
  intent,
  constraints,
}: {
  intent: WorkspaceIntelligenceIntent
  constraints: string[]
}) {
  const userRequest = constraints
    .find((constraint) => constraint.startsWith('User request: '))
    ?.replace('User request: ', '')
  if (userRequest) {
    return `Determine the best answer for: "${userRequest}" using deterministic workspace evidence.`
  }
  return `Determine the safest ${intent} response using deterministic workspace evidence.`
}

function buildInvestigationPlan({
  intent,
  selectedProviderMetadata,
  selectedTools,
  missingRequestedProviderIds,
}: {
  intent: WorkspaceIntelligenceIntent
  selectedProviderMetadata: KnowledgeProviderMetadata[]
  selectedTools: WorkspaceToolMetadata[]
  missingRequestedProviderIds: string[]
}): WorkspaceReasoningInvestigationPlanStep[] {
  const steps: WorkspaceReasoningInvestigationPlanStep[] =
    selectedProviderMetadata.map((provider, index) => ({
      order: index + 1,
      title: `Review ${provider.label} evidence for ${intent}.`,
      providerIds: [provider.id],
      toolIds: selectedTools
        .filter((tool) => tool.supportedProviderIds.includes(provider.id))
        .map((tool) => tool.id),
      status: 'ready',
    }))
  for (const providerId of missingRequestedProviderIds) {
    steps.push({
      order: steps.length + 1,
      title: `Requested provider ${providerId} could not be inspected.`,
      providerIds: [],
      toolIds: [],
      status: 'blocked',
    })
  }
  if (steps.length === 0) {
    steps.push({
      order: 1,
      title:
        'Review available workspace context and identify missing provider evidence.',
      providerIds: [],
      toolIds: [],
      status: 'blocked',
    })
  }
  return steps
}

function buildEvidence({
  assembled,
  selectedTools,
  governedKnowledge,
  warnings,
  createdAt,
}: {
  assembled: WorkspaceContextAssemblerResult
  selectedTools: WorkspaceToolMetadata[]
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge']
  warnings: string[]
  createdAt: string
}): WorkspaceReasoningEvidence[] {
  const evidence: WorkspaceReasoningEvidence[] = []
  for (const providerContext of assembled.providerContexts) {
    evidence.push({
      id: `evidence:context:${providerContext.providerId}`,
      label: `${titleCase(providerContext.domain)} context assembled.`,
      source: providerContext.reference.label,
      provider: providerContext.providerId,
      domain: providerContext.domain,
      confidence: 'high',
      verified: true,
      timestamp: providerContext.reference.createdAt ?? createdAt,
      type: 'context',
      referenceId: providerContext.reference.id,
    })
  }
  for (const providerSnapshot of assembled.providerSnapshots) {
    evidence.push({
      id: `evidence:snapshot:${providerSnapshot.providerId}`,
      label: `${titleCase(providerSnapshot.domain)} snapshot assembled.`,
      source: providerSnapshot.reference.label,
      provider: providerSnapshot.providerId,
      domain: providerSnapshot.domain,
      confidence: 'high',
      verified: true,
      timestamp: providerSnapshot.reference.createdAt ?? createdAt,
      type: 'snapshot',
      referenceId: providerSnapshot.reference.id,
    })
  }
  for (const reference of assembled.references) {
    evidence.push(referenceEvidence(reference, createdAt))
  }
  for (const tool of selectedTools) {
    evidence.push({
      id: `evidence:tool:${tool.id}`,
      label: `${tool.label} selected as read-only reasoning support.`,
      source: tool.id,
      provider: tool.supportedProviderIds[0] ?? 'runtime',
      domain: domainForTool(tool),
      confidence: 'medium',
      verified: true,
      timestamp: createdAt,
      type: 'tool',
    })
  }
  for (const [index, rule] of readApprovedKnowledge(
    governedKnowledge,
  ).entries()) {
    evidence.push({
      id: `evidence:business-rule:${index + 1}`,
      label: rule,
      source: 'Approved Workspace Knowledge',
      provider: 'workspace-knowledge',
      domain: 'workspaceKnowledge',
      confidence: 'high',
      verified: true,
      timestamp: createdAt,
      type: 'business-rule',
    })
  }
  for (const [index, warning] of warnings.entries()) {
    evidence.push({
      id: `evidence:warning:${index + 1}`,
      label: warning,
      source: 'Workspace Context Assembler',
      provider: 'runtime',
      domain: 'workspace',
      confidence: 'medium',
      verified: true,
      timestamp: createdAt,
      type: 'warning',
    })
  }
  return dedupeById(evidence)
}

function referenceEvidence(
  reference: WorkspaceKnowledgeReference,
  createdAt: string,
): WorkspaceReasoningEvidence {
  return {
    id: `evidence:reference:${reference.id}`,
    label: reference.label,
    source: reference.kind,
    provider: reference.providerId,
    domain: reference.domain,
    confidence:
      reference.kind === 'snapshot' || reference.kind === 'context'
        ? 'high'
        : 'medium',
    verified: true,
    timestamp: reference.createdAt ?? createdAt,
    type: 'reference',
    referenceId: reference.id,
  }
}

function groupEvidence(
  evidence: WorkspaceReasoningEvidence[],
): WorkspaceReasoningEvidenceGroup[] {
  const groups = new Map<
    WorkspaceReasoningEvidence['domain'],
    WorkspaceReasoningEvidence[]
  >()
  for (const item of evidence) {
    groups.set(item.domain, [...(groups.get(item.domain) ?? []), item])
  }
  return [...groups.entries()]
    .sort(([first], [second]) => String(first).localeCompare(String(second)))
    .map(([domain, items]) => ({
      domain,
      evidenceIds: items.map((item) => item.id),
      confidence: combineConfidence(items.map((item) => item.confidence)),
      summary: `${items.length} verified ${String(domain)} evidence item${items.length === 1 ? '' : 's'} collected.`,
    }))
}

function buildMissingInformation({
  assembled,
  missingRequestedProviderIds,
  selectedProviderMetadata,
  governedKnowledge,
}: {
  assembled: WorkspaceContextAssemblerResult
  missingRequestedProviderIds: string[]
  selectedProviderMetadata: KnowledgeProviderMetadata[]
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge']
}): WorkspaceReasoningMissingInformation[] {
  const missing: WorkspaceReasoningMissingInformation[] =
    assembled.warnings.map((warning, index) => ({
      id: `missing:assembler:${index + 1}`,
      label: warning,
      whyItMatters:
        'The reasoning package cannot verify this portion of workspace context.',
      confidenceImpact: 'medium' as const,
    }))
  for (const providerId of missingRequestedProviderIds) {
    missing.push({
      id: `missing:provider:${providerId}`,
      label: `Knowledge provider ${providerId} is not registered.`,
      whyItMatters:
        'A requested deterministic source could not contribute evidence.',
      confidenceImpact: 'high',
    })
  }
  for (const provider of selectedProviderMetadata) {
    if (
      provider.sourceAvailability === 'source-required' &&
      !assembled.providerContexts.some(
        (context) => context.providerId === provider.id,
      )
    ) {
      missing.push({
        id: `missing:source:${provider.id}`,
        label: `${provider.label} source data was not available.`,
        whyItMatters: `The ${provider.domain} domain could not be fully inspected.`,
        confidenceImpact: 'high',
        domain: provider.domain,
      })
    }
  }
  for (const [index, gap] of readKnowledgeGaps(governedKnowledge).entries()) {
    missing.push({
      id: `missing:knowledge-gap:${index + 1}`,
      label: gap,
      whyItMatters:
        'Approved workspace knowledge does not yet cover this recurring question.',
      confidenceImpact: 'medium',
    })
  }
  return dedupeById(missing)
}

function detectContradictions(
  evidence: WorkspaceReasoningEvidence[],
): WorkspaceReasoningContradiction[] {
  const contradictions: WorkspaceReasoningContradiction[] = []
  const byDomain = groupEvidence(evidence)
  for (const group of byDomain) {
    const labels = group.evidenceIds.map(
      (id) =>
        evidence.find((item) => item.id === id)?.label.toLowerCase() ?? '',
    )
    const mentionsAvailable = labels.some((label) =>
      /\bavailable\b/.test(label),
    )
    const mentionsUnavailable = labels.some((label) =>
      /\bunavailable|busy|conflict\b/.test(label),
    )
    if (mentionsAvailable && mentionsUnavailable) {
      contradictions.push({
        id: `contradiction:${group.domain}:availability`,
        summary: `${titleCase(String(group.domain))} evidence contains both availability and conflict signals.`,
        evidenceIds: group.evidenceIds,
        severity: 'medium',
        confidenceImpact: 'medium',
      })
    }
  }
  return contradictions
}

function buildBusinessRules({
  governedKnowledge,
  createdAt: _createdAt,
}: {
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge']
  createdAt: string
}): WorkspaceReasoningBusinessRule[] {
  return readApprovedKnowledge(governedKnowledge).map((rule, index) => ({
    id: `business-rule:${index + 1}`,
    rule,
    source: 'Approved Workspace Knowledge',
    confidence: 'high',
  }))
}

function buildReasoningChain({
  evidence,
  contradictions,
  missingInformation,
}: {
  evidence: WorkspaceReasoningEvidence[]
  contradictions: WorkspaceReasoningContradiction[]
  missingInformation: WorkspaceReasoningMissingInformation[]
}): WorkspaceReasoningChainItem[] {
  const chain: WorkspaceReasoningChainItem[] = []
  const verifiedEvidence = evidence.filter((item) => item.verified)
  if (verifiedEvidence.length) {
    chain.push({
      id: 'reasoning-chain:verified-evidence',
      finding: `${verifiedEvidence.length} verified evidence item${verifiedEvidence.length === 1 ? '' : 's'} support the response.`,
      relationship: 'supports',
      because:
        'Workspace Intelligence assembled provider-filtered context before the model call.',
      evidenceIds: verifiedEvidence.map((item) => item.id).slice(0, 10),
      confidence: combineConfidence(
        verifiedEvidence.map((item) => item.confidence),
      ),
    })
  }
  for (const contradiction of contradictions) {
    chain.push({
      id: `reasoning-chain:${contradiction.id}`,
      finding: contradiction.summary,
      relationship: 'contradicts',
      targetFindingId: chain[0]?.id,
      because:
        'Conflicting deterministic evidence must be surfaced instead of ignored.',
      evidenceIds: contradiction.evidenceIds,
      confidence: 'medium',
    })
  }
  for (const item of missingInformation) {
    chain.push({
      id: `reasoning-chain:${item.id}`,
      finding: item.label,
      relationship: 'dependsOn',
      targetFindingId: chain[0]?.id,
      because: item.whyItMatters,
      evidenceIds: [],
      confidence: 'medium',
    })
  }
  return chain
}

function buildRootCauseRanking({
  contradictions,
  missingInformation,
  evidence,
}: {
  contradictions: WorkspaceReasoningContradiction[]
  missingInformation: WorkspaceReasoningMissingInformation[]
  evidence: WorkspaceReasoningEvidence[]
}): WorkspaceReasoningRootCause[] {
  const causes: WorkspaceReasoningRootCause[] = [
    ...contradictions.map((contradiction, index) => ({
      rank: index + 1,
      cause: contradiction.summary,
      score: contradiction.severity === 'high' ? 90 : 76,
      confidence: 'medium' as const,
      evidenceIds: contradiction.evidenceIds,
      rationale:
        'Contradictory verified evidence reduces certainty and may explain the issue.',
    })),
    ...missingInformation.map((missing, index) => ({
      rank: contradictions.length + index + 1,
      cause: missing.label,
      score: missing.confidenceImpact === 'high' ? 82 : 64,
      confidence:
        missing.confidenceImpact === 'high'
          ? ('medium' as const)
          : ('low' as const),
      evidenceIds: [],
      rationale: missing.whyItMatters,
    })),
  ]
  if (causes.length === 0 && evidence.length > 0) {
    causes.push({
      rank: 1,
      cause:
        'No deterministic contradiction or missing-information blocker was found.',
      score: 70,
      confidence: 'medium',
      evidenceIds: evidence.slice(0, 5).map((item) => item.id),
      rationale: 'The response can proceed from verified provider evidence.',
    })
  }
  return causes
    .sort((first, second) => second.score - first.score)
    .map((cause, index) => ({ ...cause, rank: index + 1 }))
}

function buildRecommendationRanking({
  selectedTools,
  evidence,
  confidence,
}: {
  selectedTools: WorkspaceToolMetadata[]
  evidence: WorkspaceReasoningEvidence[]
  confidence: WorkspaceReasoningConfidence
}): WorkspaceReasoningRecommendation[] {
  const base = selectedTools.length
    ? selectedTools.map((tool, index) => ({
        rank: index + 1,
        recommendation: `Use ${tool.label} to explain the validated workspace evidence.`,
        priority: index === 0 ? ('high' as const) : ('medium' as const),
        businessImpact:
          'Improves answer grounding and makes the response traceable.',
        risk: 'Low; this is read-only reasoning and does not execute changes.',
        confidence,
        dependencies: tool.requiredCapabilities,
        requiredApprovals: [],
        estimatedEffort: 'Immediate',
        evidenceIds: evidence.slice(0, 5).map((item) => item.id),
      }))
    : []
  if (base.length === 0) {
    base.push({
      rank: 1,
      recommendation:
        'Answer cautiously from available workspace context and clearly state unknowns.',
      priority: 'medium',
      businessImpact:
        'Prevents unsupported conclusions when provider coverage is incomplete.',
      risk: 'Medium; the answer may be less specific.',
      confidence,
      dependencies: [],
      requiredApprovals: [],
      estimatedEffort: 'Immediate',
      evidenceIds: evidence.slice(0, 5).map((item) => item.id),
    })
  }
  return base
}

function buildProposalCandidates({
  allowedActionTypes,
  outputType,
  evidence,
  missingInformation,
  confidence,
}: {
  allowedActionTypes: string[]
  outputType: string
  evidence: WorkspaceReasoningEvidence[]
  missingInformation: WorkspaceReasoningMissingInformation[]
  confidence: WorkspaceReasoningConfidence
}): WorkspaceReasoningProposalCandidate[] {
  if (
    allowedActionTypes.length === 0 ||
    outputType === 'answer' ||
    outputType === 'summary'
  ) {
    return []
  }
  return [...new Set(allowedActionTypes)].map((actionType) => ({
    id: `proposal-candidate:${actionType}`,
    title: `Prepare ${humanize(actionType)} proposal`,
    target: 'Workspace-scoped record selected by the final validated proposal.',
    expectedOutcome: 'A proposal preview can be reviewed without execution.',
    businessReasoning:
      'The action type was explicitly allowed for this request.',
    requiredApprovals: ['Workspace approval policy'],
    risks: missingInformation.length
      ? ['Missing information may make this proposal incomplete.']
      : ['No execution occurs until explicitly approved.'],
    rollbackPossibility: 'Not applicable until an approved action is executed.',
    dependencies: evidence.slice(0, 3).map((item) => item.id),
    missingInformation: missingInformation.map((item) => item.label),
    confidence,
  }))
}

function buildConfidenceReport({
  score,
  evidenceGroups,
  recommendationRanking,
  proposalCandidates,
  missingInformation,
  contradictions,
}: {
  score: number
  evidenceGroups: WorkspaceReasoningEvidenceGroup[]
  recommendationRanking: WorkspaceReasoningRecommendation[]
  proposalCandidates: WorkspaceReasoningProposalCandidate[]
  missingInformation: WorkspaceReasoningMissingInformation[]
  contradictions: WorkspaceReasoningContradiction[]
}): WorkspaceReasoningConfidenceReport {
  const overall = confidenceFromScore(score)
  return {
    overall,
    score,
    investigation: overall,
    perDomain: evidenceGroups.map((group) => ({
      domain: group.domain,
      confidence: group.confidence,
      evidenceCount: group.evidenceIds.length,
    })),
    perRecommendation: recommendationRanking.map((recommendation) => ({
      rank: recommendation.rank,
      confidence: recommendation.confidence,
    })),
    perProposal: proposalCandidates.map((proposal) => ({
      id: proposal.id,
      confidence: proposal.confidence,
    })),
    rationale: [
      `${evidenceGroups.reduce((total, group) => total + group.evidenceIds.length, 0)} verified evidence items were collected.`,
      `${missingInformation.length} missing information item${missingInformation.length === 1 ? '' : 's'} affected confidence.`,
      `${contradictions.length} contradiction${contradictions.length === 1 ? '' : 's'} affected confidence.`,
    ],
  }
}

function buildCoverageReport({
  assembled,
  selectedProviderMetadata,
  missingRequestedProviderIds,
}: {
  assembled: WorkspaceContextAssemblerResult
  selectedProviderMetadata: KnowledgeProviderMetadata[]
  missingRequestedProviderIds: string[]
}): WorkspaceReasoningCoverageReport {
  const inspectedDomains = [
    ...new Set(assembled.providerContexts.map((context) => context.domain)),
  ]
  const inspectedProviderIds = new Set(
    assembled.providerContexts.map((context) => context.providerId),
  )
  return {
    inspectedDomains,
    skippedDomains: selectedProviderMetadata
      .filter((provider) => !inspectedProviderIds.has(provider.id))
      .map((provider) => ({
        domain: provider.domain,
        reason: 'Provider did not return context for this request.',
      })),
    couldNotInspect: missingRequestedProviderIds.map((providerId) => ({
      providerId,
      reason: 'Provider is not registered in the runtime registry.',
    })),
  }
}

function buildLearningOpportunities({
  governedKnowledge,
  missingInformation,
  contradictions,
}: {
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge']
  missingInformation: WorkspaceReasoningMissingInformation[]
  contradictions: WorkspaceReasoningContradiction[]
}): WorkspaceReasoningLearningOpportunity[] {
  const opportunities: WorkspaceReasoningLearningOpportunity[] = []
  if ((governedKnowledge?.recommendationHistory ?? []).length >= 3) {
    opportunities.push({
      id: 'learning:recurring-recommendation-history',
      title:
        'Review recurring recommendation patterns as governed workspace knowledge.',
      reason:
        'Repeated recommendation history can indicate a stable owner preference or operating rule.',
      sourcePattern: 'recommendationHistory',
      approvalRequired: true,
    })
  }
  if (missingInformation.length > 0) {
    opportunities.push({
      id: 'learning:missing-information',
      title: 'Document missing information as a knowledge gap.',
      reason:
        'Repeated missing data should become an explicit governed knowledge gap.',
      sourcePattern: 'missingInformation',
      approvalRequired: true,
    })
  }
  if (contradictions.length > 0) {
    opportunities.push({
      id: 'learning:contradiction-review',
      title:
        'Ask an owner or manager to resolve contradictory workspace rules.',
      reason:
        'Conflicting evidence should be reviewed before becoming durable guidance.',
      sourcePattern: 'contradictions',
      approvalRequired: true,
    })
  }
  return opportunities
}

function readApprovedKnowledge(
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge'],
): string[] {
  return (
    Array.isArray(governedKnowledge?.approvedKnowledge)
      ? governedKnowledge.approvedKnowledge
      : []
  )
    .map(readKnowledgeLabel)
    .filter((value): value is string => Boolean(value))
}

function readKnowledgeGaps(
  governedKnowledge?: WorkspaceReasoningEngineInput['governedKnowledge'],
): string[] {
  return (
    Array.isArray(governedKnowledge?.knowledgeGaps)
      ? governedKnowledge.knowledgeGaps
      : []
  )
    .map(readKnowledgeLabel)
    .filter((value): value is string => Boolean(value))
}

function readKnowledgeLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  const record = value as Record<string, unknown>
  for (const key of ['statement', 'title', 'description', 'label', 'summary']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim())
      return candidate.trim()
  }
  const structured = record.structuredValue
  if (structured && typeof structured === 'object') {
    return readKnowledgeLabel(structured)
  }
  return null
}

function domainForTool(
  tool: WorkspaceToolMetadata,
): WorkspaceReasoningEvidence['domain'] {
  const providerId = tool.supportedProviderIds[0]
  if (providerId === 'crm') return 'crm'
  if (providerId === 'scheduling') return 'scheduling'
  return 'workspace'
}

function calculateConfidenceScore({
  evidenceCount,
  missingCount,
  contradictionCount,
  warningCount,
}: {
  evidenceCount: number
  missingCount: number
  contradictionCount: number
  warningCount: number
}) {
  const startingScore = evidenceCount > 0 ? 92 : 55
  return clamp(
    startingScore -
      missingCount * 10 -
      contradictionCount * 14 -
      warningCount * 6,
    5,
    99,
  )
}

function confidenceFromScore(score: number): WorkspaceReasoningConfidence {
  if (score >= 80) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

function combineConfidence(values: WorkspaceReasoningConfidence[]) {
  if (values.length === 0) return 'unknown'
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  if (values.every((value) => value === 'high')) return 'high'
  return 'medium'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function humanize(value: string) {
  return titleCase(value)
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}
