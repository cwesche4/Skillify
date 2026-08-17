import { describe, expect, it } from 'vitest'

import {
  approveWorkspaceLearningItem,
  buildWorkspaceConfidenceAssessment,
  captureUserCorrectionAsLearning,
  createKnowledgeGap,
  createPlatformLearningSignal,
  createWorkspaceKnowledgeGrowthSnapshot,
  createWorkspaceKnowledgeProfileItem,
  createWorkspaceKnowledgeSource,
  recordRecommendationOutcome,
} from '@/lib/intelligence/workspaceKnowledgeGrowth'
import type { WorkspaceKnowledgeReference } from '@/lib/intelligence/workspaceIntelligence'

const workspaceId = 'workspace-growth'
const now = '2026-08-04T14:00:00.000Z'

const reference: WorkspaceKnowledgeReference = {
  id: 'workspace-knowledge-reference:scheduling:assignment-policy',
  providerId: 'scheduling',
  domain: 'scheduling',
  kind: 'metadata',
  label: 'Scheduling assignment policy',
  scope: 'workspace',
}

describe('Workspace Knowledge Growth foundation', () => {
  it('creates governed workspace knowledge with inspectable source and provenance', () => {
    const source = createWorkspaceKnowledgeSource({
      workspaceId,
      type: 'workspaceSetup',
      label: 'Workspace setup',
      domain: 'workspace',
      reference,
      inspectedAt: now,
    })
    const item = createWorkspaceKnowledgeProfileItem({
      workspaceId,
      category: 'assignmentPreferences',
      title: 'Commercial jobs get senior technicians',
      description: 'Owner-approved assignment preference.',
      value: { priority: 'commercial-first' },
      source,
      confidence: 'high',
      approvalStatus: 'approved',
      createdBy: 'user-owner',
      approvedBy: 'user-owner',
      createdAt: now,
      approvedAt: now,
    })

    expect(item).toMatchObject({
      workspaceId,
      approvalStatus: 'approved',
      approvedBy: 'user-owner',
      version: 1,
      isArchived: false,
      provenance: {
        sourceIds: [source.id],
        referenceIds: [reference.id],
        deterministic: true,
      },
    })
  })

  it('turns user corrections into pending learning queue items, not approved knowledge', () => {
    const { correction, queueItem } = captureUserCorrectionAsLearning({
      workspaceId,
      correctionText: 'We never assign Mike on Fridays.',
      submittedBy: 'user-owner',
      submittedAt: now,
      targetResponseId: 'ai-response-1',
      category: 'assignmentPreferences',
      sourceDomain: 'scheduling',
    })

    expect(correction.status).toBe('queuedForReview')
    expect(queueItem.status).toBe('pendingReview')
    expect('approvalStatus' in queueItem.proposedKnowledge).toBe(false)
    expect(queueItem.proposedKnowledge.value).toBe(
      'We never assign Mike on Fridays.',
    )
  })

  it('requires explicit approval before pending knowledge becomes approved workspace knowledge', () => {
    const { queueItem } = captureUserCorrectionAsLearning({
      workspaceId,
      correctionText: 'Emergency calls override maintenance.',
      submittedBy: 'user-owner',
      submittedAt: now,
      category: 'priorityRules',
    })

    const approval = approveWorkspaceLearningItem({
      item: queueItem,
      approvedBy: 'user-admin',
      approvedAt: '2026-08-04T15:00:00.000Z',
      editedKnowledge: {
        title: 'Emergency calls override maintenance',
      },
      reviewNotes: 'Matches owner policy.',
    })

    expect(approval.queueItem.status).toBe('editedThenApproved')
    expect(approval.approvedKnowledge).toMatchObject({
      approvalStatus: 'approved',
      approvedBy: 'user-admin',
      title: 'Emergency calls override maintenance',
    })
    expect(approval.revision).toMatchObject({
      changeType: 'edited',
      changedBy: 'user-admin',
      reason: 'Matches owner policy.',
    })
  })

  it('records knowledge gaps with frequency and recommended authoritative sources', () => {
    const first = createKnowledgeGap({
      workspaceId,
      category: 'financialAssumptions',
      title: 'Missing profitability data',
      description: 'No accounting integration is connected.',
      severity: 'high',
      seenAt: now,
      affectedDomains: ['finance'],
      possibleIntegrations: ['Accounting integration'],
      recommendedConfiguration: ['Connect margin source'],
      sourceReferenceIds: [reference.id],
    })
    const second = createKnowledgeGap({
      workspaceId,
      category: 'financialAssumptions',
      title: 'Missing profitability data',
      description: 'No accounting integration is connected.',
      severity: 'high',
      seenAt: '2026-08-05T14:00:00.000Z',
      affectedDomains: ['finance'],
      existing: first,
    })

    expect(second.frequency).toBe(2)
    expect(second.firstSeen).toBe(now)
    expect(second.lastSeen).toBe('2026-08-05T14:00:00.000Z')
    expect(second.resolved).toBe(false)
  })

  it('tracks recommendation outcomes as evidence without approving new knowledge', () => {
    const outcome = recordRecommendationOutcome({
      workspaceId,
      recommendationId: 'recommendation-1',
      intent: 'scheduling.findBestMember',
      status: 'rejected',
      actorId: 'user-owner',
      occurredAt: now,
      sourceReferenceIds: [reference.id],
      notes: 'Owner chose a different technician.',
    })

    expect(outcome).toMatchObject({
      status: 'rejected',
      sourceReferenceIds: [reference.id],
    })
    expect(outcome).not.toHaveProperty('approvedKnowledge')
  })

  it('explains confidence from deterministic factors instead of arbitrary percentages', () => {
    const gap = createKnowledgeGap({
      workspaceId,
      category: 'marketingPreferences',
      title: 'No marketing attribution',
      description: 'Ad attribution is not connected.',
      severity: 'medium',
      seenAt: now,
      affectedDomains: ['marketing'],
      possibleIntegrations: ['Marketing attribution integration'],
      recommendedConfiguration: ['Connect ad attribution'],
    })
    const confidence = buildWorkspaceConfidenceAssessment({
      knowledgeGaps: [gap],
      missingData: ['connected advertising spend and attribution data'],
      partialDomains: ['operations'],
      unavailableDomains: ['marketing'],
      references: [reference],
      assumptions: [
        'CRM revenue is treated as incomplete without attribution.',
      ],
    })

    expect(confidence.score).toBeGreaterThanOrEqual(0)
    expect(confidence.score).toBeLessThanOrEqual(100)
    expect(confidence.level).toBe('low')
    expect(confidence.factors.map((factor) => factor.type)).toEqual(
      expect.arrayContaining([
        'authoritativeRecords',
        'missingIntegration',
        'dataCompleteness',
      ]),
    )
    expect(confidence.recommendedNextIntegrations).toEqual([
      'Marketing attribution integration',
    ])
  })

  it('keeps growth snapshots workspace scoped and approval-state separated', () => {
    const source = createWorkspaceKnowledgeSource({
      workspaceId,
      type: 'manualAdminEntry',
      label: 'Owner policy',
      domain: 'workspace',
      inspectedAt: now,
    })
    const approvedKnowledge = createWorkspaceKnowledgeProfileItem({
      workspaceId,
      category: 'businessObjectives',
      title: 'Improve first response time',
      value: 'Prioritize faster first response.',
      source,
      confidence: 'medium',
      approvalStatus: 'approved',
      createdBy: 'user-owner',
      approvedBy: 'user-owner',
      createdAt: now,
      approvedAt: now,
    })
    const foreignKnowledge = createWorkspaceKnowledgeProfileItem({
      workspaceId: 'other-workspace',
      category: 'businessObjectives',
      title: 'Foreign policy',
      value: 'Should not leak.',
      source: { ...source, workspaceId: 'other-workspace' },
      confidence: 'medium',
      approvalStatus: 'approved',
      createdBy: 'user-owner',
      createdAt: now,
    })
    const confidence = buildWorkspaceConfidenceAssessment({
      approvedKnowledge: [approvedKnowledge],
      references: [reference],
    })
    const snapshot = createWorkspaceKnowledgeGrowthSnapshot({
      workspaceId,
      createdAt: now,
      approvedKnowledge: [approvedKnowledge, foreignKnowledge],
      knowledgeSources: [source],
      confidence,
    })

    expect(snapshot.approvedKnowledge.map((item) => item.id)).toEqual([
      approvedKnowledge.id,
    ])
    expect(snapshot.pendingKnowledge).toEqual([])
    expect(snapshot.rejectedKnowledge).toEqual([])
  })

  it('creates platform learning signals without tenant data', () => {
    const signal = createPlatformLearningSignal({
      category: 'commonMissingIntegration',
      label: 'Marketing attribution integration',
      count: 12,
    })

    expect(signal).toEqual({
      id: 'platform-learning:commonMissingIntegration:marketing-attribution-integration',
      category: 'commonMissingIntegration',
      label: 'Marketing attribution integration',
      count: 12,
      source: 'aggregateOnly',
      containsTenantData: false,
    })
  })
})
