import type {
  WorkspaceIntelligenceIntent,
  WorkspaceKnowledgeDomain,
  WorkspaceKnowledgeReference,
} from '@/lib/intelligence/workspaceIntelligence'

export type WorkspaceKnowledgeCategory =
  | 'businessTerminology'
  | 'services'
  | 'products'
  | 'schedulingPreferences'
  | 'assignmentPreferences'
  | 'priorityRules'
  | 'escalationRules'
  | 'communicationPreferences'
  | 'operatingGuidelines'
  | 'safetyRequirements'
  | 'approvalPolicies'
  | 'businessObjectives'
  | 'customerExpectations'
  | 'salesPreferences'
  | 'marketingPreferences'
  | 'financialAssumptions'
  | 'reportingPreferences'
  | 'automationPreferences'
  | 'dataQuality'
  | 'integrationReadiness'
  | 'other'

export type WorkspaceKnowledgeSourceType =
  | 'workspaceSetup'
  | 'workspaceAIConfiguration'
  | 'settings'
  | 'importedIntegration'
  | 'connectedProvider'
  | 'crm'
  | 'scheduling'
  | 'serviceRequests'
  | 'tasks'
  | 'automationDefinition'
  | 'ownerCorrection'
  | 'approvedAIProposal'
  | 'importedDocument'
  | 'futureConnector'
  | 'manualAdminEntry'

export type WorkspaceKnowledgeApprovalStatus =
  | 'pendingReview'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'superseded'

export type WorkspaceKnowledgeConfidence = 'low' | 'medium' | 'high'

export type WorkspaceKnowledgeSource = {
  id: string
  workspaceId: string
  type: WorkspaceKnowledgeSourceType
  label: string
  domain: WorkspaceKnowledgeDomain
  recordType?: string
  recordId?: string
  referenceId?: string
  inspectedAt: string
  metadata?: Record<string, unknown>
}

export type WorkspaceKnowledgeProfileItem = {
  id: string
  workspaceId: string
  category: WorkspaceKnowledgeCategory
  title: string
  description?: string
  value: unknown
  source: WorkspaceKnowledgeSource
  confidence: WorkspaceKnowledgeConfidence
  approvalStatus: WorkspaceKnowledgeApprovalStatus
  createdBy: string
  approvedBy?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  version: number
  supersededBy?: string
  isArchived: boolean
  provenance: WorkspaceKnowledgeProvenance
}

export type WorkspaceKnowledgeRevision = {
  id: string
  knowledgeItemId: string
  workspaceId: string
  version: number
  changedBy: string
  changedAt: string
  changeType:
    | 'created'
    | 'edited'
    | 'approved'
    | 'rejected'
    | 'archived'
    | 'superseded'
  previousValue?: unknown
  nextValue?: unknown
  reason?: string
}

export type WorkspaceKnowledgeProvenance = {
  sourceIds: string[]
  referenceIds: string[]
  evidenceSummary: string
  deterministic: true
}

export type WorkspaceKnowledgeGapSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'blocking'

export type WorkspaceKnowledgeGap = {
  id: string
  workspaceId: string
  category: WorkspaceKnowledgeCategory
  title: string
  description: string
  severity: WorkspaceKnowledgeGapSeverity
  frequency: number
  firstSeen: string
  lastSeen: string
  affectedDomains: WorkspaceKnowledgeDomain[]
  possibleIntegrations: string[]
  recommendedConfiguration: string[]
  resolved: boolean
  resolvedAt?: string
  sourceReferenceIds: string[]
}

export type WorkspaceLearningQueueStatus =
  | 'pendingReview'
  | 'approved'
  | 'rejected'
  | 'editedThenApproved'
  | 'archived'

export type WorkspaceLearningQueueItem = {
  id: string
  workspaceId: string
  proposedKnowledge: Omit<
    WorkspaceKnowledgeProfileItem,
    'approvalStatus' | 'approvedBy' | 'approvedAt' | 'isArchived'
  >
  status: WorkspaceLearningQueueStatus
  proposedBy: string
  reviewedBy?: string
  createdAt: string
  updatedAt: string
  reviewedAt?: string
  reviewNotes?: string
}

export type WorkspaceRecommendationOutcomeStatus =
  | 'accepted'
  | 'rejected'
  | 'edited'
  | 'executed'
  | 'ignored'
  | 'reversedLater'
  | 'cancelled'
  | 'executionFailed'

export type WorkspaceRecommendationOutcome = {
  id: string
  workspaceId: string
  recommendationId: string
  intent: WorkspaceIntelligenceIntent
  status: WorkspaceRecommendationOutcomeStatus
  actorId: string
  occurredAt: string
  sourceReferenceIds: string[]
  notes?: string
  metadata?: Record<string, unknown>
}

export type WorkspaceUserCorrection = {
  id: string
  workspaceId: string
  correctionText: string
  submittedBy: string
  submittedAt: string
  targetResponseId?: string
  proposedKnowledgeId?: string
  status: 'captured' | 'queuedForReview' | 'dismissed'
}

export type WorkspaceConfidenceFactorType =
  | 'authoritativeRecords'
  | 'crossDomainAgreement'
  | 'approvedKnowledge'
  | 'missingIntegration'
  | 'dataFreshness'
  | 'dataCompleteness'
  | 'contradiction'
  | 'workspacePolicy'

export type WorkspaceConfidenceFactor = {
  type: WorkspaceConfidenceFactorType
  label: string
  impact: 'raises' | 'lowers' | 'neutral'
  weight: number
  explanation: string
  referenceIds: string[]
}

export type WorkspaceConfidenceAssessment = {
  level: WorkspaceKnowledgeConfidence
  score: number
  factors: WorkspaceConfidenceFactor[]
  known: string[]
  unknown: string[]
  assumptions: string[]
  missingData: string[]
  whyConfidenceChanged: string[]
  recommendedNextIntegrations: string[]
  expectedImprovement: string
}

export type WorkspaceDataQualityFinding = {
  id: string
  workspaceId: string
  category:
    | 'conflictingPolicies'
    | 'duplicateBusinessRules'
    | 'staleConfiguration'
    | 'unusedIntegration'
    | 'brokenMapping'
    | 'outdatedTerminology'
    | 'missingRequiredConfiguration'
    | 'orphanedRecord'
    | 'crossDomainInconsistency'
  severity: WorkspaceKnowledgeGapSeverity
  title: string
  description: string
  recommendedAction: string
  sourceReferenceIds: string[]
  detectedAt: string
}

export type WorkspaceKnowledgeGrowthSnapshot = {
  workspaceId: string
  createdAt: string
  approvedKnowledge: WorkspaceKnowledgeProfileItem[]
  pendingKnowledge: WorkspaceLearningQueueItem[]
  rejectedKnowledge: WorkspaceLearningQueueItem[]
  knowledgeSources: WorkspaceKnowledgeSource[]
  knowledgeGaps: WorkspaceKnowledgeGap[]
  recommendationHistory: WorkspaceRecommendationOutcome[]
  confidence: WorkspaceConfidenceAssessment
  dataQualityFindings: WorkspaceDataQualityFinding[]
}

export type PlatformLearningSignal = {
  id: string
  category:
    | 'commonMissingIntegration'
    | 'commonKnowledgeGap'
    | 'commonRejectedRecommendationType'
    | 'commonConfigurationIssue'
    | 'commonInvestigationRequest'
  label: string
  count: number
  source: 'aggregateOnly'
  containsTenantData: false
}

export function createWorkspaceKnowledgeSource({
  workspaceId,
  type,
  label,
  domain,
  recordType,
  recordId,
  reference,
  inspectedAt,
  metadata,
}: {
  workspaceId: string
  type: WorkspaceKnowledgeSourceType
  label: string
  domain: WorkspaceKnowledgeDomain
  recordType?: string
  recordId?: string
  reference?: WorkspaceKnowledgeReference
  inspectedAt: string
  metadata?: Record<string, unknown>
}): WorkspaceKnowledgeSource {
  const stableIdParts = [
    workspaceId,
    type,
    domain,
    recordType,
    recordId,
    reference?.id,
    label,
  ].filter(Boolean)
  return {
    id: `knowledge-source:${stableKey(stableIdParts.join(':'))}`,
    workspaceId,
    type,
    label: label.trim(),
    domain,
    recordType,
    recordId,
    referenceId: reference?.id,
    inspectedAt,
    metadata,
  }
}

export function createWorkspaceKnowledgeProfileItem({
  workspaceId,
  category,
  title,
  description,
  value,
  source,
  confidence,
  createdBy,
  createdAt,
  approvalStatus = 'pendingReview',
  approvedBy,
  approvedAt,
  version = 1,
  supersededBy,
}: {
  workspaceId: string
  category: WorkspaceKnowledgeCategory
  title: string
  description?: string
  value: unknown
  source: WorkspaceKnowledgeSource
  confidence: WorkspaceKnowledgeConfidence
  createdBy: string
  createdAt: string
  approvalStatus?: WorkspaceKnowledgeApprovalStatus
  approvedBy?: string
  approvedAt?: string
  version?: number
  supersededBy?: string
}): WorkspaceKnowledgeProfileItem {
  const normalizedTitle = title.trim()
  const id = `knowledge-item:${workspaceId}:${stableKey(`${category}:${normalizedTitle}:${version}`)}`
  return {
    id,
    workspaceId,
    category,
    title: normalizedTitle,
    description: description?.trim(),
    value,
    source,
    confidence,
    approvalStatus,
    createdBy,
    approvedBy,
    createdAt,
    updatedAt: approvedAt ?? createdAt,
    approvedAt,
    version,
    supersededBy,
    isArchived: approvalStatus === 'archived',
    provenance: {
      sourceIds: [source.id],
      referenceIds: source.referenceId ? [source.referenceId] : [],
      evidenceSummary: `Created from ${source.label}.`,
      deterministic: true,
    },
  }
}

export function enqueueWorkspaceLearningItem({
  proposedKnowledge,
  proposedBy,
  createdAt,
}: {
  proposedKnowledge: Omit<
    WorkspaceKnowledgeProfileItem,
    'approvalStatus' | 'approvedBy' | 'approvedAt' | 'isArchived'
  >
  proposedBy: string
  createdAt: string
}): WorkspaceLearningQueueItem {
  const {
    approvalStatus: _approvalStatus,
    approvedBy: _approvedBy,
    approvedAt: _approvedAt,
    isArchived: _isArchived,
    ...pendingKnowledge
  } = proposedKnowledge as WorkspaceKnowledgeProfileItem
  return {
    id: `learning-item:${pendingKnowledge.workspaceId}:${stableKey(pendingKnowledge.id)}`,
    workspaceId: pendingKnowledge.workspaceId,
    proposedKnowledge: pendingKnowledge,
    status: 'pendingReview',
    proposedBy,
    createdAt,
    updatedAt: createdAt,
  }
}

export function approveWorkspaceLearningItem({
  item,
  approvedBy,
  approvedAt,
  editedKnowledge,
  reviewNotes,
}: {
  item: WorkspaceLearningQueueItem
  approvedBy: string
  approvedAt: string
  editedKnowledge?: Partial<
    Pick<
      WorkspaceKnowledgeProfileItem,
      'title' | 'description' | 'value' | 'confidence' | 'category'
    >
  >
  reviewNotes?: string
}): {
  queueItem: WorkspaceLearningQueueItem
  approvedKnowledge: WorkspaceKnowledgeProfileItem
  revision: WorkspaceKnowledgeRevision
} {
  const approvedKnowledge: WorkspaceKnowledgeProfileItem = {
    ...item.proposedKnowledge,
    ...editedKnowledge,
    approvalStatus: 'approved',
    approvedBy,
    approvedAt,
    updatedAt: approvedAt,
    isArchived: false,
  }
  return {
    queueItem: {
      ...item,
      status: editedKnowledge ? 'editedThenApproved' : 'approved',
      reviewedBy: approvedBy,
      reviewedAt: approvedAt,
      updatedAt: approvedAt,
      reviewNotes,
    },
    approvedKnowledge,
    revision: {
      id: `knowledge-revision:${stableKey(`${approvedKnowledge.id}:approved:${approvedAt}`)}`,
      knowledgeItemId: approvedKnowledge.id,
      workspaceId: approvedKnowledge.workspaceId,
      version: approvedKnowledge.version,
      changedBy: approvedBy,
      changedAt: approvedAt,
      changeType: editedKnowledge ? 'edited' : 'approved',
      previousValue: item.proposedKnowledge.value,
      nextValue: approvedKnowledge.value,
      reason: reviewNotes,
    },
  }
}

export function rejectWorkspaceLearningItem({
  item,
  rejectedBy,
  rejectedAt,
  reviewNotes,
}: {
  item: WorkspaceLearningQueueItem
  rejectedBy: string
  rejectedAt: string
  reviewNotes?: string
}): WorkspaceLearningQueueItem {
  return {
    ...item,
    status: 'rejected',
    reviewedBy: rejectedBy,
    reviewedAt: rejectedAt,
    updatedAt: rejectedAt,
    reviewNotes,
  }
}

export function createKnowledgeGap({
  workspaceId,
  category,
  title,
  description,
  severity,
  seenAt,
  affectedDomains,
  possibleIntegrations = [],
  recommendedConfiguration = [],
  sourceReferenceIds = [],
  existing,
}: {
  workspaceId: string
  category: WorkspaceKnowledgeCategory
  title: string
  description: string
  severity: WorkspaceKnowledgeGapSeverity
  seenAt: string
  affectedDomains: WorkspaceKnowledgeDomain[]
  possibleIntegrations?: string[]
  recommendedConfiguration?: string[]
  sourceReferenceIds?: string[]
  existing?: WorkspaceKnowledgeGap
}): WorkspaceKnowledgeGap {
  const id =
    existing?.id ??
    `knowledge-gap:${workspaceId}:${stableKey(`${category}:${title}`)}`
  return {
    id,
    workspaceId,
    category,
    title: title.trim(),
    description: description.trim(),
    severity,
    frequency: (existing?.frequency ?? 0) + 1,
    firstSeen: existing?.firstSeen ?? seenAt,
    lastSeen: seenAt,
    affectedDomains: unique(affectedDomains),
    possibleIntegrations: unique(possibleIntegrations),
    recommendedConfiguration: unique(recommendedConfiguration),
    resolved: false,
    sourceReferenceIds: unique([
      ...(existing?.sourceReferenceIds ?? []),
      ...sourceReferenceIds,
    ]),
  }
}

export function recordRecommendationOutcome({
  workspaceId,
  recommendationId,
  intent,
  status,
  actorId,
  occurredAt,
  sourceReferenceIds = [],
  notes,
  metadata,
}: Omit<WorkspaceRecommendationOutcome, 'id'>): WorkspaceRecommendationOutcome {
  return {
    id: `recommendation-outcome:${workspaceId}:${stableKey(`${recommendationId}:${status}:${occurredAt}`)}`,
    workspaceId,
    recommendationId,
    intent,
    status,
    actorId,
    occurredAt,
    sourceReferenceIds: unique(sourceReferenceIds),
    notes,
    metadata,
  }
}

export function captureUserCorrectionAsLearning({
  workspaceId,
  correctionText,
  submittedBy,
  submittedAt,
  targetResponseId,
  category = 'operatingGuidelines',
  sourceDomain = 'workspace',
}: {
  workspaceId: string
  correctionText: string
  submittedBy: string
  submittedAt: string
  targetResponseId?: string
  category?: WorkspaceKnowledgeCategory
  sourceDomain?: WorkspaceKnowledgeDomain
}): {
  correction: WorkspaceUserCorrection
  queueItem: WorkspaceLearningQueueItem
} {
  const source = createWorkspaceKnowledgeSource({
    workspaceId,
    type: 'ownerCorrection',
    label: 'Owner correction',
    domain: sourceDomain,
    recordType: 'aiResponse',
    recordId: targetResponseId,
    inspectedAt: submittedAt,
  })
  const proposedKnowledge = createWorkspaceKnowledgeProfileItem({
    workspaceId,
    category,
    title: correctionText.slice(0, 80),
    description:
      'Proposed from an owner correction. Requires approval before use.',
    value: correctionText,
    source,
    confidence: 'medium',
    createdBy: submittedBy,
    createdAt: submittedAt,
  })
  const queueItem = enqueueWorkspaceLearningItem({
    proposedKnowledge,
    proposedBy: submittedBy,
    createdAt: submittedAt,
  })
  return {
    correction: {
      id: `user-correction:${workspaceId}:${stableKey(`${submittedBy}:${submittedAt}:${correctionText}`)}`,
      workspaceId,
      correctionText,
      submittedBy,
      submittedAt,
      targetResponseId,
      proposedKnowledgeId: proposedKnowledge.id,
      status: 'queuedForReview',
    },
    queueItem,
  }
}

export function buildWorkspaceConfidenceAssessment({
  approvedKnowledge = [],
  knowledgeGaps = [],
  missingData = [],
  partialDomains = [],
  unavailableDomains = [],
  references = [],
  assumptions = [],
}: {
  approvedKnowledge?: WorkspaceKnowledgeProfileItem[]
  knowledgeGaps?: WorkspaceKnowledgeGap[]
  missingData?: string[]
  partialDomains?: WorkspaceKnowledgeDomain[]
  unavailableDomains?: WorkspaceKnowledgeDomain[]
  references?: WorkspaceKnowledgeReference[]
  assumptions?: string[]
}): WorkspaceConfidenceAssessment {
  const factors: WorkspaceConfidenceFactor[] = [
    {
      type: 'authoritativeRecords',
      label: 'Authoritative records',
      impact: references.length ? 'raises' : 'neutral',
      weight: Math.min(25, references.length * 5),
      explanation: references.length
        ? `${references.length} deterministic references are available.`
        : 'No deterministic references were supplied to this assessment.',
      referenceIds: references.map((reference) => reference.id),
    },
    {
      type: 'approvedKnowledge',
      label: 'Approved workspace knowledge',
      impact: approvedKnowledge.length ? 'raises' : 'neutral',
      weight: Math.min(20, approvedKnowledge.length * 4),
      explanation: approvedKnowledge.length
        ? `${approvedKnowledge.length} approved workspace knowledge item(s) can guide interpretation.`
        : 'No approved workspace-specific knowledge is available yet.',
      referenceIds: approvedKnowledge.flatMap(
        (item) => item.provenance.referenceIds,
      ),
    },
    {
      type: 'missingIntegration',
      label: 'Missing integrations',
      impact: unavailableDomains.length ? 'lowers' : 'neutral',
      weight: unavailableDomains.length * -12,
      explanation: unavailableDomains.length
        ? `Unavailable domains: ${unavailableDomains.join(', ')}.`
        : 'No unavailable domain was required for this question.',
      referenceIds: [],
    },
    {
      type: 'dataCompleteness',
      label: 'Data completeness',
      impact: missingData.length || partialDomains.length ? 'lowers' : 'raises',
      weight:
        missingData.length || partialDomains.length
          ? -(missingData.length * 8 + partialDomains.length * 5)
          : 15,
      explanation:
        missingData.length || partialDomains.length
          ? 'Some requested domains are partial or missing required configuration.'
          : 'No missing data was identified for the requested scope.',
      referenceIds: [],
    },
    {
      type: 'contradiction',
      label: 'Contradictions',
      impact: knowledgeGaps.some((gap) => gap.category === 'dataQuality')
        ? 'lowers'
        : 'neutral',
      weight: knowledgeGaps.some((gap) => gap.category === 'dataQuality')
        ? -15
        : 0,
      explanation: knowledgeGaps.some((gap) => gap.category === 'dataQuality')
        ? 'Data-quality gaps may indicate contradictory or stale workspace facts.'
        : 'No contradictory approved knowledge was identified.',
      referenceIds: [],
    },
  ]

  const score = clamp(
    50 + factors.reduce((total, factor) => total + factor.weight, 0),
    0,
    100,
  )
  return {
    level: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low',
    score,
    factors,
    known: [
      ...approvedKnowledge.map((item) => item.title),
      references.length
        ? `${references.length} deterministic reference(s)`
        : '',
    ].filter(Boolean),
    unknown: unique([
      ...missingData,
      ...knowledgeGaps.filter((gap) => !gap.resolved).map((gap) => gap.title),
    ]),
    assumptions,
    missingData: unique(missingData),
    whyConfidenceChanged: factors
      .filter((factor) => factor.weight !== 0)
      .map((factor) => `${factor.label}: ${factor.explanation}`),
    recommendedNextIntegrations: unique(
      knowledgeGaps.flatMap((gap) => gap.possibleIntegrations),
    ),
    expectedImprovement:
      unavailableDomains.length || missingData.length
        ? 'Confidence should improve after the missing authoritative sources are connected or configured.'
        : 'Confidence can improve as approved workspace knowledge accumulates.',
  }
}

export function createWorkspaceKnowledgeGrowthSnapshot({
  workspaceId,
  createdAt,
  approvedKnowledge = [],
  pendingKnowledge = [],
  rejectedKnowledge = [],
  knowledgeSources = [],
  knowledgeGaps = [],
  recommendationHistory = [],
  confidence,
  dataQualityFindings = [],
}: {
  workspaceId: string
  createdAt: string
  approvedKnowledge?: WorkspaceKnowledgeProfileItem[]
  pendingKnowledge?: WorkspaceLearningQueueItem[]
  rejectedKnowledge?: WorkspaceLearningQueueItem[]
  knowledgeSources?: WorkspaceKnowledgeSource[]
  knowledgeGaps?: WorkspaceKnowledgeGap[]
  recommendationHistory?: WorkspaceRecommendationOutcome[]
  confidence: WorkspaceConfidenceAssessment
  dataQualityFindings?: WorkspaceDataQualityFinding[]
}): WorkspaceKnowledgeGrowthSnapshot {
  return {
    workspaceId,
    createdAt,
    approvedKnowledge: approvedKnowledge.filter(
      (item) =>
        item.workspaceId === workspaceId &&
        item.approvalStatus === 'approved' &&
        !item.isArchived,
    ),
    pendingKnowledge: pendingKnowledge.filter(
      (item) =>
        item.workspaceId === workspaceId && item.status === 'pendingReview',
    ),
    rejectedKnowledge: rejectedKnowledge.filter(
      (item) => item.workspaceId === workspaceId && item.status === 'rejected',
    ),
    knowledgeSources: knowledgeSources.filter(
      (source) => source.workspaceId === workspaceId,
    ),
    knowledgeGaps: knowledgeGaps.filter(
      (gap) => gap.workspaceId === workspaceId,
    ),
    recommendationHistory: recommendationHistory.filter(
      (outcome) => outcome.workspaceId === workspaceId,
    ),
    confidence,
    dataQualityFindings: dataQualityFindings.filter(
      (finding) => finding.workspaceId === workspaceId,
    ),
  }
}

export function createPlatformLearningSignal({
  category,
  label,
  count,
}: {
  category: PlatformLearningSignal['category']
  label: string
  count: number
}): PlatformLearningSignal {
  return {
    id: `platform-learning:${category}:${stableKey(label)}`,
    category,
    label: label.trim(),
    count: Math.max(0, Math.trunc(count)),
    source: 'aggregateOnly',
    containsTenantData: false,
  }
}

function stableKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 96) || 'item'
  )
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
