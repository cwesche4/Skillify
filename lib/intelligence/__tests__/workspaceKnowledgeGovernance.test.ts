import { describe, expect, it } from 'vitest'

import {
  buildGovernedLearningRecommendations,
  buildStructuredKnowledgeProposal,
  buildWorkspaceKnowledgeQuality,
  detectWorkspaceKnowledgeConflicts,
  formatAutomationGuardrails,
  getRuntimeUsageForKnowledge,
  getWorkspaceKnowledgeDependencies,
  translateWorkspaceAISettingToKnowledge,
} from '@/lib/intelligence/workspaceKnowledgeGovernance'

describe('workspace knowledge governance helpers', () => {
  it('builds structured AI knowledge proposals instead of one giant paragraph', () => {
    const proposal = buildStructuredKnowledgeProposal({
      title: 'Prefer assigning technicians from the same business location.',
      summary:
        'Prefer technicians located at the same business location whenever assignment quality is otherwise equal.',
      reasoning: ['reduces travel time', 'reduces mileage'],
      evidence: [
        'Derived from owner instruction',
        'Derived from scheduling investigation',
      ],
      confidence: 'high',
      sourceLabel: 'AI Proposal',
    })

    expect(proposal).toEqual({
      title: 'Prefer assigning technicians from the same business location',
      summary:
        'Prefer technicians located at the same business location whenever assignment quality is otherwise equal.',
      reasoning: ['reduces travel time', 'reduces mileage'],
      evidence: [
        'Derived from owner instruction',
        'Derived from scheduling investigation',
      ],
      confidence: 'high',
      sourceLabel: 'AI Proposal',
    })
  })

  it('detects warning-only policy conflicts against approved knowledge', () => {
    const conflicts = detectWorkspaceKnowledgeConflicts({
      proposed: {
        id: 'proposed',
        category: 'Dispatch Rule',
        title: 'Always assign Corbin to VIP dispatch',
        structuredValue: null,
      },
      approved: [
        {
          id: 'approved-1',
          category: 'Dispatch Rule',
          title: 'Prefer closest technician',
          approvalStatus: 'APPROVED',
          isArchived: false,
        },
      ],
    })

    expect(conflicts).toEqual([
      expect.objectContaining({
        existingPolicy: 'Prefer closest technician',
        proposedPolicy: 'Always assign Corbin to VIP dispatch',
        potentialImpact:
          'May affect travel time, workload balance, or assignment quality.',
      }),
    ])
  })

  it('translates Workspace AI settings into readable business knowledge', () => {
    const proposal = translateWorkspaceAISettingToKnowledge({
      field: 'operatingGuidelines',
      value: 'We never schedule after 5pm.',
    })

    expect(proposal).toMatchObject({
      category: 'Operating Guideline',
      title: 'We never schedule after 5pm',
      summary: 'We never schedule after 5pm.',
      relatedModule: 'Team Operations',
    })
  })

  it('formats automation settings as readable policy rather than raw JSON', () => {
    expect(
      formatAutomationGuardrails({
        allowAdvice: true,
        allowDrafting: true,
        allowActionProposals: true,
        requireApprovalForActions: true,
      }),
    ).toContain('Workspace AI may draft automations.')
    expect(
      formatAutomationGuardrails({
        allowAdvice: true,
        allowDrafting: true,
        allowActionProposals: true,
        requireApprovalForActions: true,
      }),
    ).toContain('Approval is required before execution.')
  })

  it('derives dependencies, runtime usage, and quality score signals', () => {
    const item = {
      id: 'knowledge-1',
      category: 'Scheduling Preference',
      title: 'Prefer local technicians',
      confidence: 'high',
      approvalStatus: 'APPROVED',
      isArchived: false,
      structuredValue: {
        proposal: {
          title: 'Prefer local technicians',
          summary: 'Prefer local technicians when quality is equal.',
          evidence: ['Owner instruction', 'Scheduling investigation'],
          confidence: 'high',
        },
      },
    }

    expect(getWorkspaceKnowledgeDependencies(item)).toEqual([
      'Business Locations',
      'Team availability',
      'Dispatch rules',
    ])
    expect(getRuntimeUsageForKnowledge(item)).toContain('Assignments')
    expect(
      buildWorkspaceKnowledgeQuality({
        item,
        approvedItems: [item],
      }),
    ).toMatchObject({
      confidence: 'high',
      evidenceCount: 2,
      conflictCount: 0,
    })
  })

  it('recommends governed improvements without mutating knowledge', () => {
    const recommendations = buildGovernedLearningRecommendations([
      {
        id: 'knowledge-1',
        category: 'Business Fact',
        title: 'Weekend appointments are disabled',
        approvalStatus: 'APPROVED',
        isArchived: false,
      },
      {
        id: 'knowledge-2',
        category: 'Business Fact',
        title: 'Weekend appointments are disabled',
        approvalStatus: 'APPROVED',
        isArchived: false,
      },
    ])

    expect(
      recommendations.map((recommendation) => recommendation.title),
    ).toContain('Consider merging duplicate policies')
  })
})
