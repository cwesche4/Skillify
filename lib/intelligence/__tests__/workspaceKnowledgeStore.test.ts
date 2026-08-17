import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  const prisma: any = {
    workspaceKnowledgeItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceKnowledgeRevision: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    workspaceKnowledgeApproval: {
      create: vi.fn(),
    },
    workspaceKnowledgeGap: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceKnowledgeCorrection: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceRecommendationOutcome: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceConfidenceAssessment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceKnowledgeSource: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceLearningEvent: {
      create: vi.fn(),
    },
    platformLearningSignal: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: any) => unknown) => callback(prisma)),
  }
  return prisma
})

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import {
  approveWorkspaceKnowledgeItem,
  acceptWorkspaceKnowledgeCorrection,
  canApproveWorkspaceKnowledge,
  canManageWorkspaceKnowledge,
  createAggregateOnlyPlatformLearningSignal,
  createWorkspaceKnowledgeCorrection,
  createWorkspaceKnowledgeItem,
  getRuntimeWorkspaceKnowledgeFingerprint,
  rejectWorkspaceKnowledgeCorrection,
  restoreWorkspaceKnowledgeItem,
  updateWorkspaceKnowledgeItem,
  loadApprovedWorkspaceKnowledgeForAI,
  loadPersistedWorkspaceKnowledgeSnapshot,
  recordWorkspaceRecommendationOutcome,
  rollbackWorkspaceKnowledgeItemToRevision,
  upsertPlatformLearningSignal,
  upsertWorkspaceKnowledgeGap,
  WorkspaceKnowledgePermissionError,
} from '@/lib/intelligence/workspaceKnowledgeStore'

const workspaceId = 'workspace-knowledge'
const ownerActor = { workspaceId, userId: 'user-owner', role: 'owner' as const }
const managerActor = {
  workspaceId,
  userId: 'user-manager',
  role: 'manager' as const,
}
const memberActor = {
  workspaceId,
  userId: 'user-member',
  role: 'member' as const,
}
const createdAt = new Date('2026-08-04T12:00:00.000Z')

function knowledgeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'knowledge-1',
    workspaceId,
    sourceId: null,
    category: 'assignmentPreferences',
    title: 'VIP jobs require senior technicians',
    description: 'Owner-approved scheduling policy.',
    structuredValue: { rule: 'senior-technician' },
    sourceSummary: 'Owner setup',
    confidence: 'high',
    approvalStatus: 'APPROVED',
    createdById: 'user-owner',
    approvedById: 'user-owner',
    approvedAt: createdAt,
    version: 1,
    isArchived: false,
    supersededById: null,
    reason: null,
    tags: ['scheduling'],
    visibility: 'WORKSPACE',
    status: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
    source: null,
    ...overrides,
  }
}

describe('persistent Workspace Knowledge store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enforces manager and approver permissions separately', () => {
    expect(canManageWorkspaceKnowledge(managerActor)).toBe(true)
    expect(canApproveWorkspaceKnowledge(managerActor)).toBe(false)
    expect(canApproveWorkspaceKnowledge(ownerActor)).toBe(true)
  })

  it('creates member suggestions as pending review knowledge', async () => {
    mockPrisma.workspaceKnowledgeItem.create.mockResolvedValueOnce(
      knowledgeRow({
        approvalStatus: 'PENDING_REVIEW',
        approvedById: null,
        approvedAt: null,
      }),
    )

    await createWorkspaceKnowledgeItem({
      actor: memberActor,
      input: {
        category: 'schedulingPreferences',
        title: 'Do not schedule installs after 4 PM',
        value: { latestInstallStart: '16:00' },
      },
    })

    expect(mockPrisma.workspaceKnowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId,
          approvalStatus: 'PENDING_REVIEW',
          approvedById: null,
          approvedAt: null,
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeApproval.create).not.toHaveBeenCalled()
  })

  it('allows owners to create approved deterministic knowledge with an approval audit record', async () => {
    mockPrisma.workspaceKnowledgeItem.create.mockResolvedValueOnce(
      knowledgeRow(),
    )

    await createWorkspaceKnowledgeItem({
      actor: ownerActor,
      input: {
        category: 'assignmentPreferences',
        title: 'VIP jobs require senior technicians',
        value: { rule: 'senior-technician' },
        approvalStatus: 'APPROVED',
        confidence: 'high',
      },
    })

    expect(mockPrisma.workspaceKnowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'APPROVED',
          approvedById: ownerActor.userId,
          confidence: 'high',
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'APPROVED',
          actorUserId: ownerActor.userId,
        }),
      }),
    )
  })

  it('rejects exact active duplicates within the same category and scope', async () => {
    mockPrisma.workspaceKnowledgeItem.findFirst.mockResolvedValueOnce(
      knowledgeRow({
        title: 'VIP jobs require senior technicians',
        structuredValue: {
          scope: { type: 'scheduling', label: 'Scheduling' },
        },
      }),
    )

    await expect(
      createWorkspaceKnowledgeItem({
        actor: ownerActor,
        input: {
          category: 'Assignment Rule',
          title: 'VIP jobs require senior technicians',
          value: { rule: 'senior-technician' },
          scope: { type: 'scheduling', label: 'Scheduling' },
        },
      }),
    ).rejects.toMatchObject({
      name: 'WorkspaceKnowledgeValidationError',
    })
    expect(mockPrisma.workspaceKnowledgeItem.create).not.toHaveBeenCalled()
  })

  it('creates a pending replacement when editing approved knowledge', async () => {
    mockPrisma.workspaceKnowledgeItem.findFirst
      .mockResolvedValueOnce(
        knowledgeRow({
          id: 'approved-original',
          approvalStatus: 'APPROVED',
          isArchived: false,
          structuredValue: {
            statement: 'VIP jobs require senior technicians',
            scope: { type: 'scheduling', label: 'Scheduling' },
          },
        }),
      )
      .mockResolvedValueOnce(null)
    mockPrisma.workspaceKnowledgeItem.create.mockResolvedValueOnce(
      knowledgeRow({
        id: 'replacement-1',
        approvalStatus: 'PENDING_REVIEW',
        approvedById: null,
        approvedAt: null,
      }),
    )

    await updateWorkspaceKnowledgeItem({
      actor: ownerActor,
      knowledgeItemId: 'approved-original',
      input: {
        title: 'VIP jobs require senior or owner-approved technicians',
        reason: 'Tighten assignment policy.',
      },
    })

    expect(mockPrisma.workspaceKnowledgeItem.update).not.toHaveBeenCalled()
    expect(mockPrisma.workspaceKnowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'PENDING_REVIEW',
          structuredValue: expect.objectContaining({
            governance: {
              replacesKnowledgeItemId: 'approved-original',
            },
          }),
        }),
      }),
    )
  })

  it('approving a replacement supersedes the prior approved item without deleting history', async () => {
    mockPrisma.workspaceKnowledgeItem.findFirst
      .mockResolvedValueOnce(
        knowledgeRow({
          id: 'replacement-1',
          approvalStatus: 'PENDING_REVIEW',
          structuredValue: {
            statement: 'Updated assignment rule',
            governance: { replacesKnowledgeItemId: 'approved-original' },
          },
        }),
      )
      .mockResolvedValueOnce(
        knowledgeRow({
          id: 'approved-original',
          approvalStatus: 'APPROVED',
          isArchived: false,
        }),
      )
    mockPrisma.workspaceKnowledgeItem.update
      .mockResolvedValueOnce(
        knowledgeRow({
          id: 'replacement-1',
          approvalStatus: 'APPROVED',
          structuredValue: {
            statement: 'Updated assignment rule',
            governance: { replacesKnowledgeItemId: 'approved-original' },
          },
        }),
      )
      .mockResolvedValueOnce(
        knowledgeRow({
          id: 'approved-original',
          approvalStatus: 'SUPERSEDED',
          isArchived: true,
          supersededById: 'replacement-1',
        }),
      )

    await approveWorkspaceKnowledgeItem({
      actor: ownerActor,
      knowledgeItemId: 'replacement-1',
      reason: 'Approved replacement.',
    })

    expect(mockPrisma.workspaceKnowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'approved-original' },
        data: expect.objectContaining({
          approvalStatus: 'SUPERSEDED',
          isArchived: true,
          supersededById: 'replacement-1',
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revisionType: 'SUPERSEDED',
        }),
      }),
    )
  })

  it('prevents managers from approving knowledge', async () => {
    await expect(
      approveWorkspaceKnowledgeItem({
        actor: managerActor,
        knowledgeItemId: 'knowledge-1',
      }),
    ).rejects.toBeInstanceOf(WorkspaceKnowledgePermissionError)
  })

  it('rolls back to a stored revision through an audited restore action', async () => {
    mockPrisma.workspaceKnowledgeRevision.findFirst.mockResolvedValueOnce({
      id: 'revision-1',
      workspaceId,
      knowledgeItemId: 'knowledge-1',
      version: 1,
      revisionType: 'APPROVED',
      category: 'assignmentPreferences',
      title: 'Original assignment policy',
      description: 'Prior approved rule.',
      structuredValue: { rule: 'original' },
      confidence: 'high',
      approvalStatus: 'APPROVED',
      changedById: 'user-owner',
      createdAt,
    })
    mockPrisma.workspaceKnowledgeItem.update.mockResolvedValueOnce(
      knowledgeRow({
        title: 'Original assignment policy',
        structuredValue: { rule: 'original' },
      }),
    )

    await rollbackWorkspaceKnowledgeItemToRevision({
      actor: ownerActor,
      knowledgeItemId: 'knowledge-1',
      revisionId: 'revision-1',
      reason: 'Restore previous owner-approved policy.',
    })

    expect(mockPrisma.workspaceKnowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'assignmentPreferences',
          title: 'Original assignment policy',
          structuredValue: { rule: 'original' },
          approvalStatus: 'APPROVED',
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RESTORED',
          metadata: {
            restoredRevisionId: 'revision-1',
            restoredRevisionVersion: 1,
          },
        }),
      }),
    )
  })

  it('restores archived knowledge as approved runtime-eligible knowledge', async () => {
    mockPrisma.workspaceKnowledgeItem.findFirst.mockResolvedValueOnce(
      knowledgeRow({
        approvalStatus: 'ARCHIVED',
        isArchived: true,
      }),
    )
    mockPrisma.workspaceKnowledgeItem.update.mockResolvedValueOnce(
      knowledgeRow({
        approvalStatus: 'APPROVED',
        isArchived: false,
      }),
    )

    await restoreWorkspaceKnowledgeItem({
      actor: ownerActor,
      knowledgeItemId: 'knowledge-1',
      reason: 'Restore owner-approved policy.',
    })

    expect(mockPrisma.workspaceKnowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'APPROVED',
          isArchived: false,
          approvedById: ownerActor.userId,
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RESTORED',
        }),
      }),
    )
  })

  it('loads only approved active non-superseded knowledge for AI context', async () => {
    mockPrisma.workspaceKnowledgeItem.findMany.mockResolvedValueOnce([
      knowledgeRow({
        id: 'approved-1',
        approvalStatus: 'APPROVED',
        isArchived: false,
      }),
      knowledgeRow({
        id: 'archived-1',
        approvalStatus: 'APPROVED',
        isArchived: true,
      }),
      knowledgeRow({
        id: 'superseded-1',
        approvalStatus: 'APPROVED',
        isArchived: false,
        supersededById: 'approved-1',
      }),
      knowledgeRow({
        id: 'pending-1',
        approvalStatus: 'PENDING_REVIEW',
        isArchived: false,
      }),
    ])

    const approved = await loadApprovedWorkspaceKnowledgeForAI(workspaceId)

    expect(approved).toHaveLength(1)
    expect(approved[0]).toMatchObject({
      id: 'approved-1',
      approvalStatus: 'approved',
      isArchived: false,
    })
    expect(mockPrisma.workspaceKnowledgeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId,
          approvalStatus: 'APPROVED',
          isArchived: false,
        }),
      }),
    )
  })

  it('creates a deterministic runtime knowledge fingerprint from active approved items', () => {
    const fingerprint = getRuntimeWorkspaceKnowledgeFingerprint([
      { id: 'knowledge-b', version: 2, updatedAt: '2026-08-04T12:00:00.000Z' },
      { id: 'knowledge-a', version: 1, updatedAt: '2026-08-03T12:00:00.000Z' },
    ])

    expect(fingerprint).toBe(
      'workspace-knowledge:2:knowledge-a:1:2026-08-03T12:00:00.000Z|knowledge-b:2:2026-08-04T12:00:00.000Z',
    )
  })

  it('keeps pending and rejected knowledge inspectable but outside approved AI knowledge', async () => {
    mockPrisma.workspaceKnowledgeItem.findMany
      .mockResolvedValueOnce([
        knowledgeRow({ id: 'approved-1', approvalStatus: 'APPROVED' }),
      ])
      .mockResolvedValueOnce([
        knowledgeRow({ id: 'pending-1', approvalStatus: 'PENDING_REVIEW' }),
      ])
      .mockResolvedValueOnce([
        knowledgeRow({ id: 'rejected-1', approvalStatus: 'REJECTED' }),
      ])
    mockPrisma.workspaceKnowledgeSource.findMany.mockResolvedValueOnce([])
    mockPrisma.workspaceKnowledgeGap.findMany.mockResolvedValueOnce([])
    mockPrisma.workspaceRecommendationOutcome.findMany.mockResolvedValueOnce([])
    mockPrisma.workspaceConfidenceAssessment.findMany.mockResolvedValueOnce([])
    mockPrisma.workspaceKnowledgeCorrection.findMany.mockResolvedValueOnce([])

    const snapshot = await loadPersistedWorkspaceKnowledgeSnapshot({
      workspaceId,
    })

    expect(snapshot.approvedKnowledge.map((item) => item.id)).toEqual([
      'approved-1',
    ])
    expect(
      snapshot.pendingKnowledge.map((item) => item.proposedKnowledge.id),
    ).toEqual(['pending-1'])
    expect(
      snapshot.rejectedKnowledge.map((item) => item.proposedKnowledge.id),
    ).toEqual(['rejected-1'])
  })

  it('upserts repeated knowledge gaps by incrementing frequency', async () => {
    mockPrisma.workspaceKnowledgeGap.findFirst.mockResolvedValueOnce({
      id: 'gap-1',
      workspaceId,
      category: 'integrationReadiness',
      title: 'Calendar sync disconnected',
      frequency: 2,
    })
    mockPrisma.workspaceKnowledgeGap.update.mockResolvedValueOnce({
      id: 'gap-1',
      frequency: 3,
    })

    const gap = await upsertWorkspaceKnowledgeGap({
      workspaceId,
      category: 'integrationReadiness',
      title: 'Calendar sync disconnected',
      description: 'External availability cannot be confirmed.',
      severity: 'medium',
      affectedDomains: ['scheduling'],
    })

    expect(gap.frequency).toBe(3)
    expect(mockPrisma.workspaceKnowledgeGap.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gap-1' },
        data: expect.objectContaining({ frequency: { increment: 1 } }),
      }),
    )
  })

  it('stores corrections as reviewable learning metadata', async () => {
    mockPrisma.workspaceKnowledgeCorrection.create.mockResolvedValueOnce({
      id: 'correction-1',
      correctionText: 'Use Office Team for commercial work.',
      status: 'QUEUED_FOR_REVIEW',
    })

    await createWorkspaceKnowledgeCorrection({
      actor: memberActor,
      correctionText: 'Use Office Team for commercial work.',
      sourceDomain: 'scheduling',
      targetCategory: 'assignmentPreferences',
    })

    expect(mockPrisma.workspaceKnowledgeCorrection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId,
          submittedById: memberActor.userId,
          status: 'QUEUED_FOR_REVIEW',
        }),
      }),
    )
  })

  it('accepts a correction by creating a pending replacement proposal', async () => {
    mockPrisma.workspaceKnowledgeCorrection.findFirst.mockResolvedValueOnce({
      id: 'correction-1',
      workspaceId,
      knowledgeItemId: 'knowledge-1',
      correctionText: 'VIP jobs require the commercial crew.',
      correctedValue: { statement: 'VIP jobs require the commercial crew.' },
      sourceDomain: 'scheduling',
      targetCategory: 'Assignment Rule',
      submittedById: memberActor.userId,
      status: 'QUEUED_FOR_REVIEW',
      metadata: null,
      knowledgeItem: knowledgeRow({
        id: 'knowledge-1',
        structuredValue: {
          scope: { type: 'scheduling', label: 'Scheduling' },
        },
      }),
    })
    mockPrisma.workspaceKnowledgeItem.findFirst.mockResolvedValueOnce(null)
    mockPrisma.workspaceKnowledgeItem.create.mockResolvedValueOnce(
      knowledgeRow({
        id: 'replacement-from-correction',
        approvalStatus: 'PENDING_REVIEW',
        approvedById: null,
        approvedAt: null,
      }),
    )
    mockPrisma.workspaceKnowledgeCorrection.update.mockResolvedValueOnce({
      id: 'correction-1',
      status: 'DISMISSED',
      proposedKnowledgeId: 'replacement-from-correction',
    })

    await acceptWorkspaceKnowledgeCorrection({
      actor: ownerActor,
      correctionId: 'correction-1',
      reason: 'Correction is valid.',
    })

    expect(mockPrisma.workspaceKnowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'PENDING_REVIEW',
          structuredValue: expect.objectContaining({
            governance: {
              replacesKnowledgeItemId: 'knowledge-1',
            },
          }),
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeCorrection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposedKnowledgeId: 'replacement-from-correction',
        }),
      }),
    )
  })

  it('rejects a correction with an audited reason', async () => {
    mockPrisma.workspaceKnowledgeCorrection.findFirst.mockResolvedValueOnce({
      id: 'correction-1',
      workspaceId,
      knowledgeItemId: 'knowledge-1',
      correctionText: 'Use Office Team for every request.',
      submittedById: memberActor.userId,
      status: 'QUEUED_FOR_REVIEW',
      metadata: null,
    })
    mockPrisma.workspaceKnowledgeCorrection.update.mockResolvedValueOnce({
      id: 'correction-1',
      status: 'DISMISSED',
    })

    await rejectWorkspaceKnowledgeCorrection({
      actor: ownerActor,
      correctionId: 'correction-1',
      reason: 'Too broad for all service requests.',
    })

    expect(mockPrisma.workspaceKnowledgeCorrection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            review: expect.objectContaining({
              action: 'rejected',
              reason: 'Too broad for all service requests.',
            }),
          }),
        }),
      }),
    )
  })

  it('records recommendation outcomes without changing approved knowledge', async () => {
    mockPrisma.workspaceRecommendationOutcome.create.mockResolvedValueOnce({
      id: 'outcome-1',
    })

    await recordWorkspaceRecommendationOutcome({
      actor: ownerActor,
      recommendationId: 'recommendation-1',
      recommendationType: 'scheduling.findBestMember',
      recommendationTitle: 'Assign Corbin',
      outcome: 'accepted',
      sourceDomain: 'scheduling',
    })

    expect(
      mockPrisma.workspaceRecommendationOutcome.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recommendationId: 'recommendation-1',
          outcome: 'ACCEPTED',
        }),
      }),
    )
    expect(mockPrisma.workspaceKnowledgeItem.update).not.toHaveBeenCalled()
  })

  it('persists only aggregate platform learning signals', async () => {
    const signal = createAggregateOnlyPlatformLearningSignal({
      category: 'commonKnowledgeGap',
      label: 'Missing calendar provider',
      count: 4,
    })
    mockPrisma.platformLearningSignal.upsert.mockResolvedValueOnce({
      id: 'platform-signal-1',
    })

    await upsertPlatformLearningSignal(signal)

    expect(signal.containsTenantData).toBe(false)
    expect(mockPrisma.platformLearningSignal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          category_label: {
            category: 'commonKnowledgeGap',
            label: 'Missing calendar provider',
          },
        },
        create: expect.objectContaining({
          metadata: {
            source: 'aggregateOnly',
            containsTenantData: false,
          },
        }),
      }),
    )
  })
})
