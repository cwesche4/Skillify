import { prisma } from '@/lib/db'
import {
  buildWorkspaceConfidenceAssessment,
  createPlatformLearningSignal,
  createWorkspaceKnowledgeGrowthSnapshot,
  type PlatformLearningSignal,
  type WorkspaceConfidenceAssessment,
  type WorkspaceKnowledgeCategory,
  type WorkspaceKnowledgeConfidence,
  type WorkspaceKnowledgeGap,
  type WorkspaceKnowledgeGrowthSnapshot,
  type WorkspaceKnowledgeProfileItem,
  type WorkspaceKnowledgeSource,
  type WorkspaceLearningQueueItem,
  type WorkspaceRecommendationOutcome,
  type WorkspaceRecommendationOutcomeStatus,
  type WorkspaceUserCorrection,
} from '@/lib/intelligence/workspaceKnowledgeGrowth'
import type {
  WorkspaceIntelligenceIntent,
  WorkspaceKnowledgeDomain,
} from '@/lib/intelligence/workspaceIntelligence'

export type GovernedKnowledgeRole = 'owner' | 'admin' | 'manager' | 'member'

export type WorkspaceKnowledgeActor = {
  workspaceId: string
  userId: string
  role: GovernedKnowledgeRole | Uppercase<GovernedKnowledgeRole>
}

export type WorkspaceKnowledgeCreateInput = {
  category: WorkspaceKnowledgeCategory | string
  title: string
  description?: string
  value: unknown
  scope?: WorkspaceKnowledgeScopeInput
  source?: WorkspaceKnowledgeSourceInput
  effectiveDate?: string
  reviewNotes?: string
  relatedModule?: string
  replacesKnowledgeItemId?: string
  sourceId?: string
  sourceSummary?: string
  confidence?: WorkspaceKnowledgeConfidence | string
  approvalStatus?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED'
  tags?: string[]
  reason?: string
  visibility?: 'WORKSPACE' | 'ADMINS_ONLY'
}

export type WorkspaceKnowledgeUpdateInput = Partial<
  Pick<
    WorkspaceKnowledgeCreateInput,
    | 'category'
    | 'title'
    | 'description'
    | 'value'
    | 'scope'
    | 'source'
    | 'effectiveDate'
    | 'reviewNotes'
    | 'relatedModule'
    | 'confidence'
    | 'tags'
    | 'reason'
  >
>

export type WorkspaceKnowledgeScopeInput = {
  type: string
  label: string
  targetType?: 'team' | 'location' | 'serviceType' | 'customerSegment'
  targetId?: string
  targetLabel?: string
}

export type WorkspaceKnowledgeSourceInput = {
  type: string
  label: string
  customLabel?: string
  domain?: WorkspaceKnowledgeDomain | string
  recordType?: string
  recordId?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}

export type WorkspaceKnowledgeListFilters = {
  workspaceId: string
  approvalStatus?:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'ARCHIVED'
    | 'SUPERSEDED'
  category?: string
  query?: string
  includeArchived?: boolean
  limit?: number
}

export type PersistedWorkspaceKnowledgeSnapshot =
  WorkspaceKnowledgeGrowthSnapshot & {
    corrections: WorkspaceUserCorrection[]
    confidenceAssessments: WorkspaceConfidenceAssessment[]
  }

type PrismaLike = typeof prisma & Record<string, any>

const db = prisma as PrismaLike

const governableApprovalStatuses = new Set([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
])
const APPROVER_ROLES = new Set<GovernedKnowledgeRole>(['owner', 'admin'])
const MANAGER_ROLES = new Set<GovernedKnowledgeRole>([
  'owner',
  'admin',
  'manager',
])

export function normalizeGovernedKnowledgeRole(
  role: WorkspaceKnowledgeActor['role'],
): GovernedKnowledgeRole {
  return role.toLowerCase() as GovernedKnowledgeRole
}

export function canReadWorkspaceKnowledge() {
  return true
}

export function canSuggestWorkspaceKnowledge() {
  return true
}

export function canManageWorkspaceKnowledge(
  actor: Pick<WorkspaceKnowledgeActor, 'role'>,
) {
  return MANAGER_ROLES.has(normalizeGovernedKnowledgeRole(actor.role))
}

export function canApproveWorkspaceKnowledge(
  actor: Pick<WorkspaceKnowledgeActor, 'role'>,
) {
  return APPROVER_ROLES.has(normalizeGovernedKnowledgeRole(actor.role))
}

export function assertCanManageWorkspaceKnowledge(
  actor: WorkspaceKnowledgeActor,
) {
  if (!canManageWorkspaceKnowledge(actor)) {
    throw new WorkspaceKnowledgePermissionError(
      'Only workspace managers, admins, and owners can manage workspace knowledge.',
    )
  }
}

export function assertCanApproveWorkspaceKnowledge(
  actor: WorkspaceKnowledgeActor,
) {
  if (!canApproveWorkspaceKnowledge(actor)) {
    throw new WorkspaceKnowledgePermissionError(
      'Only workspace owners and authorized admins can approve or reject workspace knowledge.',
    )
  }
}

export class WorkspaceKnowledgePermissionError extends Error {
  status = 403

  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceKnowledgePermissionError'
  }
}

export class WorkspaceKnowledgeValidationError extends Error {
  status = 400

  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceKnowledgeValidationError'
  }
}

export async function listWorkspaceKnowledgeItems(
  filters: WorkspaceKnowledgeListFilters,
) {
  const where: Record<string, unknown> = {
    workspaceId: filters.workspaceId,
    isArchived: filters.includeArchived ? undefined : false,
  }

  if (filters.approvalStatus) {
    where.approvalStatus = filters.approvalStatus
  }

  if (filters.category) {
    where.category = filters.category
  }

  if (filters.query?.trim()) {
    const query = filters.query.trim()
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { sourceSummary: { contains: query, mode: 'insensitive' } },
    ]
  }

  return db.workspaceKnowledgeItem.findMany({
    where,
    include: { source: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: filters.limit ?? 100,
  })
}

export async function getWorkspaceKnowledgeItem({
  workspaceId,
  knowledgeItemId,
}: {
  workspaceId: string
  knowledgeItemId: string
}) {
  return db.workspaceKnowledgeItem.findFirst({
    where: { id: knowledgeItemId, workspaceId },
    include: {
      source: true,
      revisions: { orderBy: { version: 'desc' } },
      approvals: { orderBy: { createdAt: 'desc' } },
      corrections: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export async function createWorkspaceKnowledgeItem({
  actor,
  input,
}: {
  actor: WorkspaceKnowledgeActor
  input: WorkspaceKnowledgeCreateInput
}) {
  if (!canSuggestWorkspaceKnowledge()) {
    throw new WorkspaceKnowledgePermissionError(
      'You do not have permission to suggest workspace knowledge.',
    )
  }

  const title = normalizeKnowledgeStatement(input.title)
  const category = normalizeRequiredText(
    String(input.category),
    'Knowledge category',
  )
  const role = normalizeGovernedKnowledgeRole(actor.role)
  const requestedStatus = input.approvalStatus ?? 'PENDING_REVIEW'

  if (!governableApprovalStatuses.has(requestedStatus)) {
    throw new WorkspaceKnowledgeValidationError(
      'Unsupported knowledge approval status.',
    )
  }

  if (requestedStatus === 'APPROVED' && !canApproveWorkspaceKnowledge(actor)) {
    throw new WorkspaceKnowledgePermissionError(
      'Only workspace owners and authorized admins can create approved workspace knowledge.',
    )
  }

  await assertNoExactDuplicateKnowledge({
    workspaceId: actor.workspaceId,
    category,
    title,
    scope: input.scope,
    excludeKnowledgeItemId: input.replacesKnowledgeItemId,
  })

  const now = new Date()
  const created = await (db.$transaction as any)(async (tx: PrismaLike) => {
    const source = input.sourceId
      ? null
      : await tx.workspaceKnowledgeSource.create({
          data: {
            workspaceId: actor.workspaceId,
            type: input.source?.type ?? sourceTypeForRole(role),
            label: normalizeSourceLabel(input.source, role),
            domain: String(input.source?.domain ?? domainForScope(input.scope)),
            actorUserId: actor.userId,
            confidence: normalizeConfidence(input.confidence),
            recordType: input.source?.recordType,
            recordId: input.source?.recordId,
            referenceId: input.source?.referenceId,
            metadata: toJsonValue({
              ...(input.source?.metadata ?? {}),
              scope: input.scope,
              effectiveDate: input.effectiveDate ?? null,
              relatedModule: input.relatedModule ?? null,
            }),
          },
        })
    const structuredValue = buildStructuredKnowledgeValue(input)
    const item = await tx.workspaceKnowledgeItem.create({
      data: {
        workspaceId: actor.workspaceId,
        sourceId: input.sourceId ?? source?.id,
        category,
        title,
        description: normalizeOptionalText(input.description),
        structuredValue: toJsonValue(structuredValue),
        sourceSummary: normalizeOptionalText(input.sourceSummary),
        confidence: normalizeConfidence(input.confidence),
        approvalStatus: requestedStatus,
        createdById: actor.userId,
        approvedById: requestedStatus === 'APPROVED' ? actor.userId : null,
        approvedAt: requestedStatus === 'APPROVED' ? now : null,
        reason: normalizeOptionalText(input.reason ?? input.reviewNotes),
        tags: normalizeTags(input.tags),
        visibility: input.visibility ?? 'WORKSPACE',
        status: 'ACTIVE',
      },
      include: { source: true },
    })

    await tx.workspaceKnowledgeRevision.create({
      data: revisionDataForItem({
        item,
        revisionType: requestedStatus === 'APPROVED' ? 'APPROVED' : 'CREATED',
        actorUserId: actor.userId,
        changeSummary:
          requestedStatus === 'APPROVED'
            ? 'Created as approved workspace knowledge.'
            : 'Created as a governed workspace knowledge proposal.',
      }),
    })

    if (requestedStatus === 'APPROVED') {
      await tx.workspaceKnowledgeApproval.create({
        data: {
          workspaceId: actor.workspaceId,
          knowledgeItemId: item.id,
          action: 'APPROVED',
          actorUserId: actor.userId,
          actorRole: toPrismaWorkspaceMemberRole(role),
          reason: normalizeOptionalText(input.reason),
        },
      })
    }

    await tx.workspaceLearningEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: item.id,
        eventType:
          requestedStatus === 'APPROVED'
            ? 'knowledge.approved.created'
            : 'knowledge.proposed.created',
        actorUserId: actor.userId,
        source: 'workspaceKnowledge',
        summary:
          requestedStatus === 'APPROVED'
            ? `Approved knowledge created: ${item.title}`
            : `Knowledge proposal created: ${item.title}`,
      },
    })

    return item
  })

  return created
}

export async function updateWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  input,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  input: WorkspaceKnowledgeUpdateInput
}) {
  assertCanManageWorkspaceKnowledge(actor)
  const existing = await getWorkspaceKnowledgeItem({
    workspaceId: actor.workspaceId,
    knowledgeItemId,
  })

  if (!existing) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge item was not found.',
    )
  }

  if (existing.approvalStatus === 'APPROVED' && !existing.isArchived) {
    return createWorkspaceKnowledgeItem({
      actor,
      input: {
        category: input.category ?? existing.category,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description ?? undefined,
        value: input.value ?? {
          statement: existing.title,
          value: existing.structuredValue,
          governance: {
            replacesKnowledgeItemId: existing.id,
          },
        },
        scope:
          input.scope ?? getScopeFromStructuredValue(existing.structuredValue),
        source: input.source ?? {
          type: 'manualAdminEntry',
          label: 'Proposed revision',
          domain: domainForScope(
            getScopeFromStructuredValue(existing.structuredValue),
          ),
          recordType: 'workspaceKnowledgeItem',
          recordId: existing.id,
        },
        effectiveDate:
          input.effectiveDate ??
          getMetadataString(existing.structuredValue, 'effectiveDate'),
        reviewNotes:
          input.reviewNotes ??
          input.reason ??
          'Proposed revision to approved knowledge.',
        relatedModule:
          input.relatedModule ??
          getMetadataString(existing.structuredValue, 'relatedModule'),
        confidence: input.confidence ?? existing.confidence,
        tags: input.tags ?? existing.tags,
        reason: input.reason,
        replacesKnowledgeItemId: existing.id,
      },
    })
  }

  return (db.$transaction as any)(async (tx: PrismaLike) => {
    const updated = await tx.workspaceKnowledgeItem.update({
      where: { id: existing.id },
      data: {
        category: input.category
          ? normalizeRequiredText(String(input.category), 'Knowledge category')
          : undefined,
        title: input.title
          ? normalizeKnowledgeStatement(input.title)
          : undefined,
        description:
          input.description === undefined
            ? undefined
            : normalizeOptionalText(input.description),
        structuredValue:
          input.value === undefined &&
          input.scope === undefined &&
          input.effectiveDate === undefined &&
          input.relatedModule === undefined
            ? undefined
            : toJsonValue(
                buildStructuredKnowledgeValue({
                  category: input.category ?? existing.category,
                  title: input.title ?? existing.title,
                  description:
                    input.description ?? existing.description ?? undefined,
                  value:
                    input.value ??
                    getKnowledgePayload(existing.structuredValue),
                  scope:
                    input.scope ??
                    getScopeFromStructuredValue(existing.structuredValue),
                  effectiveDate:
                    input.effectiveDate ??
                    getMetadataString(
                      existing.structuredValue,
                      'effectiveDate',
                    ),
                  relatedModule:
                    input.relatedModule ??
                    getMetadataString(
                      existing.structuredValue,
                      'relatedModule',
                    ),
                  reviewNotes:
                    input.reviewNotes ??
                    input.reason ??
                    existing.reason ??
                    undefined,
                }),
              ),
        confidence:
          input.confidence === undefined
            ? undefined
            : normalizeConfidence(input.confidence),
        tags: input.tags === undefined ? undefined : normalizeTags(input.tags),
        reason:
          input.reason === undefined
            ? undefined
            : normalizeOptionalText(input.reason),
        version: { increment: 1 },
      },
      include: { source: true },
    })

    await tx.workspaceKnowledgeRevision.create({
      data: revisionDataForItem({
        item: updated,
        revisionType: 'UPDATED',
        actorUserId: actor.userId,
        changeSummary: 'Workspace knowledge item edited and queued for review.',
      }),
    })

    await tx.workspaceLearningEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: updated.id,
        eventType: 'knowledge.updated',
        actorUserId: actor.userId,
        source: 'workspaceKnowledge',
        summary: `Knowledge item updated: ${updated.title}`,
      },
    })

    return updated
  })
}

export async function approveWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  return transitionWorkspaceKnowledgeItem({
    actor,
    knowledgeItemId,
    nextStatus: 'APPROVED',
    revisionType: 'APPROVED',
    approvalAction: 'APPROVED',
    reason,
    summaryPrefix: 'Approved workspace knowledge',
  })
}

export async function rejectWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  return transitionWorkspaceKnowledgeItem({
    actor,
    knowledgeItemId,
    nextStatus: 'REJECTED',
    revisionType: 'REJECTED',
    approvalAction: 'REJECTED',
    reason,
    summaryPrefix: 'Rejected workspace knowledge',
  })
}

export async function archiveWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  return transitionWorkspaceKnowledgeItem({
    actor,
    knowledgeItemId,
    nextStatus: 'ARCHIVED',
    revisionType: 'ARCHIVED',
    approvalAction: 'ARCHIVED',
    reason,
    summaryPrefix: 'Archived workspace knowledge',
    archive: true,
  })
}

export async function restoreWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  const existing = await getWorkspaceKnowledgeItem({
    workspaceId: actor.workspaceId,
    knowledgeItemId,
  })

  if (!existing) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge item was not found.',
    )
  }

  const role = normalizeGovernedKnowledgeRole(actor.role)
  return (db.$transaction as any)(async (tx: PrismaLike) => {
    const restored = await tx.workspaceKnowledgeItem.update({
      where: { id: existing.id },
      data: {
        approvalStatus: 'APPROVED',
        isArchived: false,
        approvedById: actor.userId,
        approvedAt: new Date(),
        reason: normalizeOptionalText(reason),
        version: { increment: 1 },
      },
      include: { source: true },
    })

    await tx.workspaceKnowledgeRevision.create({
      data: revisionDataForItem({
        item: restored,
        revisionType: 'APPROVED',
        actorUserId: actor.userId,
        changeSummary:
          reason ?? `Restored workspace knowledge: ${restored.title}`,
      }),
    })

    await tx.workspaceKnowledgeApproval.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: restored.id,
        action: 'RESTORED',
        actorUserId: actor.userId,
        actorRole: toPrismaWorkspaceMemberRole(role),
        reason: normalizeOptionalText(reason),
      },
    })

    await tx.workspaceLearningEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: restored.id,
        eventType: 'knowledge.restored',
        actorUserId: actor.userId,
        source: 'workspaceKnowledge',
        summary: `Workspace knowledge restored: ${restored.title}`,
      },
    })

    return restored
  })
}

export async function listWorkspaceKnowledgeHistory({
  workspaceId,
  knowledgeItemId,
}: {
  workspaceId: string
  knowledgeItemId: string
}) {
  return db.workspaceKnowledgeRevision.findMany({
    where: { workspaceId, knowledgeItemId },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function rollbackWorkspaceKnowledgeItemToRevision({
  actor,
  knowledgeItemId,
  revisionId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  revisionId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  const revision = await db.workspaceKnowledgeRevision.findFirst({
    where: {
      id: revisionId,
      workspaceId: actor.workspaceId,
      knowledgeItemId,
    },
  })

  if (!revision) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge revision was not found.',
    )
  }

  const role = normalizeGovernedKnowledgeRole(actor.role)
  return (db.$transaction as any)(async (tx: PrismaLike) => {
    const updated = await tx.workspaceKnowledgeItem.update({
      where: { id: knowledgeItemId },
      data: {
        category: revision.category,
        title: revision.title,
        description: revision.description,
        structuredValue: toJsonValue(revision.structuredValue),
        confidence: revision.confidence,
        approvalStatus:
          revision.approvalStatus === 'APPROVED'
            ? 'APPROVED'
            : 'PENDING_REVIEW',
        approvedById:
          revision.approvalStatus === 'APPROVED' ? actor.userId : null,
        approvedAt: revision.approvalStatus === 'APPROVED' ? new Date() : null,
        version: { increment: 1 },
        isArchived: false,
        reason: normalizeOptionalText(reason),
      },
      include: { source: true },
    })

    await tx.workspaceKnowledgeRevision.create({
      data: revisionDataForItem({
        item: updated,
        revisionType: 'ROLLBACK_CANDIDATE',
        actorUserId: actor.userId,
        changeSummary: reason ?? `Rolled back to revision ${revision.version}.`,
      }),
    })

    await tx.workspaceKnowledgeApproval.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: updated.id,
        action: 'RESTORED',
        actorUserId: actor.userId,
        actorRole: toPrismaWorkspaceMemberRole(role),
        reason: normalizeOptionalText(reason),
        metadata: {
          restoredRevisionId: revision.id,
          restoredRevisionVersion: revision.version,
        },
      },
    })

    await tx.workspaceLearningEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: updated.id,
        eventType: 'knowledge.restored',
        actorUserId: actor.userId,
        source: 'workspaceKnowledge',
        summary: `Workspace knowledge restored: ${updated.title}`,
        metadata: {
          restoredRevisionId: revision.id,
          restoredRevisionVersion: revision.version,
        },
      },
    })

    return updated
  })
}

export async function upsertWorkspaceKnowledgeGap({
  workspaceId,
  category,
  title,
  description,
  severity,
  affectedDomains,
  source,
  metadata,
}: {
  workspaceId: string
  category: WorkspaceKnowledgeCategory | string
  title: string
  description: string
  severity: string
  affectedDomains: Array<WorkspaceKnowledgeDomain | string>
  source?: string
  metadata?: Record<string, unknown>
}) {
  const normalizedTitle = normalizeRequiredText(title, 'Knowledge gap title')
  const normalizedCategory = normalizeRequiredText(
    String(category),
    'Knowledge gap category',
  )
  const existing = await db.workspaceKnowledgeGap.findFirst({
    where: {
      workspaceId,
      category: normalizedCategory,
      title: normalizedTitle,
      isResolved: false,
    },
  })

  if (existing) {
    return db.workspaceKnowledgeGap.update({
      where: { id: existing.id },
      data: {
        description: normalizeRequiredText(
          description,
          'Knowledge gap description',
        ),
        severity,
        affectedDomains: normalizeTags(affectedDomains.map(String)),
        frequency: { increment: 1 },
        lastDetectedAt: new Date(),
        source,
        metadata: metadata ? toJsonValue(metadata) : undefined,
      },
    })
  }

  return db.workspaceKnowledgeGap.create({
    data: {
      workspaceId,
      category: normalizedCategory,
      title: normalizedTitle,
      description: normalizeRequiredText(
        description,
        'Knowledge gap description',
      ),
      severity,
      affectedDomains: normalizeTags(affectedDomains.map(String)),
      source,
      metadata: metadata ? toJsonValue(metadata) : undefined,
    },
  })
}

export async function createWorkspaceKnowledgeCorrection({
  actor,
  correctionText,
  knowledgeItemId,
  correctedValue,
  sourceDomain,
  targetCategory,
}: {
  actor: WorkspaceKnowledgeActor
  correctionText: string
  knowledgeItemId?: string
  correctedValue?: unknown
  sourceDomain?: WorkspaceKnowledgeDomain | string
  targetCategory?: WorkspaceKnowledgeCategory | string
}) {
  if (!canSuggestWorkspaceKnowledge()) {
    throw new WorkspaceKnowledgePermissionError(
      'You do not have permission to submit a correction.',
    )
  }

  const correction = await db.workspaceKnowledgeCorrection.create({
    data: {
      workspaceId: actor.workspaceId,
      knowledgeItemId,
      correctionText: normalizeRequiredText(correctionText, 'Correction'),
      correctedValue:
        correctedValue === undefined ? undefined : toJsonValue(correctedValue),
      sourceDomain: sourceDomain ? String(sourceDomain) : undefined,
      targetCategory: targetCategory ? String(targetCategory) : undefined,
      submittedById: actor.userId,
      status: 'QUEUED_FOR_REVIEW',
    },
  })

  await db.workspaceLearningEvent.create({
    data: {
      workspaceId: actor.workspaceId,
      knowledgeItemId,
      eventType: 'knowledge.correction.submitted',
      actorUserId: actor.userId,
      source: 'workspaceKnowledgeCorrection',
      summary: `Knowledge correction submitted: ${correction.correctionText.slice(0, 80)}`,
    },
  })

  return correction
}

export async function acceptWorkspaceKnowledgeCorrection({
  actor,
  correctionId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  correctionId: string
  reason?: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  const correction = await db.workspaceKnowledgeCorrection.findFirst({
    where: { id: correctionId, workspaceId: actor.workspaceId },
    include: { knowledgeItem: true },
  })

  if (!correction) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge correction was not found.',
    )
  }

  const target = correction.knowledgeItem
  const proposed = target
    ? await createWorkspaceKnowledgeItem({
        actor,
        input: {
          category: correction.targetCategory ?? target.category,
          title: correction.correctionText,
          description: reason ?? `Correction proposed for ${target.title}`,
          value: correction.correctedValue ?? {
            statement: correction.correctionText,
            correctionId: correction.id,
          },
          scope: getScopeFromStructuredValue(target.structuredValue),
          source: {
            type: 'Correction',
            label: 'Correction',
            domain:
              correction.sourceDomain ??
              domainForScope(
                getScopeFromStructuredValue(target.structuredValue),
              ),
            recordType: 'workspaceKnowledgeCorrection',
            recordId: correction.id,
          },
          reviewNotes: reason,
          tags: target.tags,
          replacesKnowledgeItemId: target.id,
        },
      })
    : null

  const updated = await db.workspaceKnowledgeCorrection.update({
    where: { id: correction.id },
    data: {
      status: 'DISMISSED',
      proposedKnowledgeId: proposed?.id ?? correction.proposedKnowledgeId,
      metadata: {
        ...(isRecord(correction.metadata) ? correction.metadata : {}),
        review: {
          action: 'accepted',
          reviewedBy: actor.userId,
          reviewedAt: new Date().toISOString(),
          reason: reason ?? null,
          proposedKnowledgeId: proposed?.id ?? null,
        },
      },
    },
  })

  await db.workspaceLearningEvent.create({
    data: {
      workspaceId: actor.workspaceId,
      knowledgeItemId: target?.id,
      eventType: 'knowledge.correction.accepted',
      actorUserId: actor.userId,
      source: 'workspaceKnowledgeCorrection',
      summary: `Knowledge correction accepted: ${correction.correctionText.slice(0, 80)}`,
      metadata: {
        correctionId: correction.id,
        proposedKnowledgeId: proposed?.id ?? null,
      },
    },
  })

  return { correction: updated, proposedKnowledge: proposed }
}

export async function rejectWorkspaceKnowledgeCorrection({
  actor,
  correctionId,
  reason,
}: {
  actor: WorkspaceKnowledgeActor
  correctionId: string
  reason: string
}) {
  assertCanApproveWorkspaceKnowledge(actor)
  const normalizedReason = normalizeRequiredText(
    reason,
    'Correction rejection reason',
  )
  const correction = await db.workspaceKnowledgeCorrection.findFirst({
    where: { id: correctionId, workspaceId: actor.workspaceId },
  })

  if (!correction) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge correction was not found.',
    )
  }

  const updated = await db.workspaceKnowledgeCorrection.update({
    where: { id: correction.id },
    data: {
      status: 'DISMISSED',
      metadata: {
        ...(isRecord(correction.metadata) ? correction.metadata : {}),
        review: {
          action: 'rejected',
          reviewedBy: actor.userId,
          reviewedAt: new Date().toISOString(),
          reason: normalizedReason,
        },
      },
    },
  })

  await db.workspaceLearningEvent.create({
    data: {
      workspaceId: actor.workspaceId,
      knowledgeItemId: correction.knowledgeItemId,
      eventType: 'knowledge.correction.rejected',
      actorUserId: actor.userId,
      source: 'workspaceKnowledgeCorrection',
      summary: `Knowledge correction rejected: ${correction.correctionText.slice(0, 80)}`,
      metadata: {
        correctionId: correction.id,
        reason: normalizedReason,
      },
    },
  })

  return updated
}

export async function recordWorkspaceRecommendationOutcome({
  actor,
  recommendationId,
  recommendationType,
  recommendationTitle,
  outcome,
  sourceDomain,
  targetRecordType,
  targetRecordId,
  confidenceAtDecision,
  reason,
  metadata,
  occurredAt,
}: {
  actor: WorkspaceKnowledgeActor
  recommendationId: string
  recommendationType: WorkspaceIntelligenceIntent | string
  recommendationTitle: string
  outcome: WorkspaceRecommendationOutcomeStatus | string
  sourceDomain?: WorkspaceKnowledgeDomain | string
  targetRecordType?: string
  targetRecordId?: string
  confidenceAtDecision?: WorkspaceKnowledgeConfidence | string
  reason?: string
  metadata?: Record<string, unknown>
  occurredAt?: Date
}) {
  return db.workspaceRecommendationOutcome.create({
    data: {
      workspaceId: actor.workspaceId,
      recommendationId: normalizeRequiredText(
        recommendationId,
        'Recommendation ID',
      ),
      recommendationType: String(recommendationType),
      recommendationTitle: normalizeRequiredText(
        recommendationTitle,
        'Recommendation title',
      ),
      outcome: normalizeRecommendationOutcome(outcome),
      actorUserId: actor.userId,
      sourceDomain: sourceDomain ? String(sourceDomain) : undefined,
      targetRecordType,
      targetRecordId,
      confidenceAtDecision,
      reason: normalizeOptionalText(reason),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      occurredAt,
    },
  })
}

export async function persistWorkspaceConfidenceAssessment({
  workspaceId,
  scope,
  assessment,
  metadata,
}: {
  workspaceId: string
  scope: string
  assessment: WorkspaceConfidenceAssessment
  metadata?: Record<string, unknown>
}) {
  return db.workspaceConfidenceAssessment.create({
    data: {
      workspaceId,
      scope: normalizeRequiredText(scope, 'Confidence assessment scope'),
      level: assessment.level,
      score: assessment.score,
      supportingFactors: assessment.factors
        .filter((factor) => factor.impact === 'raises')
        .map((factor) => factor.label),
      limitingFactors: assessment.factors
        .filter((factor) => factor.impact === 'lowers')
        .map((factor) => factor.label),
      missingData: assessment.missingData,
      recommendedActions: assessment.recommendedNextIntegrations,
      metadata: metadata ? toJsonValue(metadata) : undefined,
    },
  })
}

export async function loadApprovedWorkspaceKnowledgeForAI(workspaceId: string) {
  const items = await listWorkspaceKnowledgeItems({
    workspaceId,
    approvalStatus: 'APPROVED',
    limit: 100,
  })
  return items
    .filter(isRuntimeApprovedWorkspaceKnowledgeItem)
    .map(mapDbKnowledgeItemToProfileItem)
}

export function isRuntimeApprovedWorkspaceKnowledgeItem(item: {
  approvalStatus?: string | null
  isArchived?: boolean | null
  supersededById?: string | null
}) {
  return (
    item.approvalStatus === 'APPROVED' &&
    !item.isArchived &&
    !item.supersededById
  )
}

export function getRuntimeWorkspaceKnowledgeFingerprint(
  items: Array<
    Pick<WorkspaceKnowledgeProfileItem, 'id' | 'version' | 'updatedAt'>
  >,
) {
  const parts = items
    .map((item) => `${item.id}:${item.version}:${item.updatedAt}`)
    .sort()
  return `workspace-knowledge:${parts.length}:${parts.join('|')}`
}

export async function loadPersistedWorkspaceKnowledgeSnapshot({
  workspaceId,
  createdAt = new Date().toISOString(),
}: {
  workspaceId: string
  createdAt?: string
}): Promise<PersistedWorkspaceKnowledgeSnapshot> {
  const [
    approvedRows,
    pendingRows,
    rejectedRows,
    sourceRows,
    gapRows,
    outcomeRows,
    confidenceRows,
    correctionRows,
  ] = await Promise.all([
    db.workspaceKnowledgeItem.findMany({
      where: {
        workspaceId,
        approvalStatus: 'APPROVED',
        isArchived: false,
        supersededById: null,
      },
      include: { source: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    db.workspaceKnowledgeItem.findMany({
      where: {
        workspaceId,
        approvalStatus: { in: ['DRAFT', 'PENDING_REVIEW'] },
        isArchived: false,
      },
      include: { source: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    db.workspaceKnowledgeItem.findMany({
      where: { workspaceId, approvalStatus: 'REJECTED' },
      include: { source: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    db.workspaceKnowledgeSource.findMany({
      where: { workspaceId },
      orderBy: { inspectedAt: 'desc' },
      take: 100,
    }),
    db.workspaceKnowledgeGap.findMany({
      where: { workspaceId },
      orderBy: { lastDetectedAt: 'desc' },
      take: 100,
    }),
    db.workspaceRecommendationOutcome.findMany({
      where: { workspaceId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    }),
    db.workspaceConfidenceAssessment.findMany({
      where: { workspaceId },
      orderBy: { assessedAt: 'desc' },
      take: 20,
    }),
    db.workspaceKnowledgeCorrection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  const approvedKnowledge = approvedRows.map(mapDbKnowledgeItemToProfileItem)
  const knowledgeGaps = gapRows.map(mapDbKnowledgeGap)
  const confidence = confidenceRows[0]
    ? mapDbConfidenceAssessment(confidenceRows[0])
    : buildWorkspaceConfidenceAssessment({ approvedKnowledge, knowledgeGaps })

  return {
    ...createWorkspaceKnowledgeGrowthSnapshot({
      workspaceId,
      createdAt,
      approvedKnowledge,
      pendingKnowledge: pendingRows.map((row: any) =>
        mapDbKnowledgeItemToQueueItem(row, 'pendingReview'),
      ),
      rejectedKnowledge: rejectedRows.map((row: any) =>
        mapDbKnowledgeItemToQueueItem(row, 'rejected'),
      ),
      knowledgeSources: sourceRows.map(mapDbKnowledgeSource),
      knowledgeGaps,
      recommendationHistory: outcomeRows.map(mapDbRecommendationOutcome),
      confidence,
      dataQualityFindings: [],
    }),
    corrections: correctionRows.map(mapDbCorrection),
    confidenceAssessments: confidenceRows.map(mapDbConfidenceAssessment),
  }
}

export async function upsertPlatformLearningSignal(
  signal: PlatformLearningSignal,
) {
  return db.platformLearningSignal.upsert({
    where: {
      category_label: {
        category: signal.category,
        label: signal.label,
      },
    },
    update: {
      aggregateCount: { increment: Math.max(1, signal.count) },
      confidence:
        signal.count >= 10 ? 'high' : signal.count >= 3 ? 'medium' : 'low',
      lastObservedAt: new Date(),
      metadata: {
        source: signal.source,
        containsTenantData: signal.containsTenantData,
      },
    },
    create: {
      category: signal.category,
      label: signal.label,
      aggregateCount: Math.max(1, signal.count),
      confidence:
        signal.count >= 10 ? 'high' : signal.count >= 3 ? 'medium' : 'low',
      metadata: {
        source: signal.source,
        containsTenantData: signal.containsTenantData,
      },
    },
  })
}

export function createAggregateOnlyPlatformLearningSignal(input: {
  category: PlatformLearningSignal['category']
  label: string
  count: number
}) {
  return createPlatformLearningSignal(input)
}

async function transitionWorkspaceKnowledgeItem({
  actor,
  knowledgeItemId,
  nextStatus,
  revisionType,
  approvalAction,
  reason,
  summaryPrefix,
  archive = false,
}: {
  actor: WorkspaceKnowledgeActor
  knowledgeItemId: string
  nextStatus: 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  revisionType: 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  approvalAction: 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  reason?: string
  summaryPrefix: string
  archive?: boolean
}) {
  const existing = await getWorkspaceKnowledgeItem({
    workspaceId: actor.workspaceId,
    knowledgeItemId,
  })

  if (!existing) {
    throw new WorkspaceKnowledgeValidationError(
      'Workspace knowledge item was not found.',
    )
  }

  const role = normalizeGovernedKnowledgeRole(actor.role)
  return (db.$transaction as any)(async (tx: PrismaLike) => {
    const updated = await tx.workspaceKnowledgeItem.update({
      where: { id: existing.id },
      data: {
        approvalStatus: nextStatus,
        approvedById:
          nextStatus === 'APPROVED' ? actor.userId : existing.approvedById,
        approvedAt:
          nextStatus === 'APPROVED' ? new Date() : existing.approvedAt,
        isArchived: archive,
        reason: normalizeOptionalText(reason),
        version: { increment: 1 },
      },
      include: { source: true },
    })

    await tx.workspaceKnowledgeRevision.create({
      data: revisionDataForItem({
        item: updated,
        revisionType,
        actorUserId: actor.userId,
        changeSummary: reason ?? `${summaryPrefix}: ${updated.title}`,
      }),
    })

    await tx.workspaceKnowledgeApproval.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: updated.id,
        action: approvalAction,
        actorUserId: actor.userId,
        actorRole: toPrismaWorkspaceMemberRole(role),
        reason: normalizeOptionalText(reason),
      },
    })

    const replacesKnowledgeItemId = getReplacementTargetId(
      updated.structuredValue,
    )
    if (nextStatus === 'APPROVED' && replacesKnowledgeItemId) {
      const replaced = await tx.workspaceKnowledgeItem.findFirst({
        where: {
          id: replacesKnowledgeItemId,
          workspaceId: actor.workspaceId,
          approvalStatus: 'APPROVED',
          isArchived: false,
        },
      })

      if (replaced) {
        const superseded = await tx.workspaceKnowledgeItem.update({
          where: { id: replaced.id },
          data: {
            approvalStatus: 'SUPERSEDED',
            isArchived: true,
            supersededById: updated.id,
            version: { increment: 1 },
            reason: `Superseded by approved replacement ${updated.id}.`,
          },
        })

        await tx.workspaceKnowledgeRevision.create({
          data: revisionDataForItem({
            item: superseded,
            revisionType: 'SUPERSEDED',
            actorUserId: actor.userId,
            changeSummary: `Superseded by approved replacement: ${updated.title}`,
          }),
        })

        await tx.workspaceLearningEvent.create({
          data: {
            workspaceId: actor.workspaceId,
            knowledgeItemId: superseded.id,
            eventType: 'knowledge.superseded',
            actorUserId: actor.userId,
            source: 'workspaceKnowledge',
            summary: `Workspace knowledge superseded: ${superseded.title}`,
            metadata: {
              supersededById: updated.id,
            },
          },
        })
      }
    }

    await tx.workspaceLearningEvent.create({
      data: {
        workspaceId: actor.workspaceId,
        knowledgeItemId: updated.id,
        eventType: `knowledge.${nextStatus.toLowerCase()}`,
        actorUserId: actor.userId,
        source: 'workspaceKnowledge',
        summary: `${summaryPrefix}: ${updated.title}`,
      },
    })

    return updated
  })
}

function revisionDataForItem({
  item,
  revisionType,
  actorUserId,
  changeSummary,
}: {
  item: any
  revisionType:
    | 'CREATED'
    | 'UPDATED'
    | 'APPROVED'
    | 'REJECTED'
    | 'ARCHIVED'
    | 'SUPERSEDED'
    | 'ROLLBACK_CANDIDATE'
  actorUserId: string
  changeSummary: string
}) {
  return {
    workspaceId: item.workspaceId,
    knowledgeItemId: item.id,
    version: item.version,
    revisionType,
    category: item.category,
    title: item.title,
    description: item.description,
    structuredValue: item.structuredValue,
    confidence: item.confidence,
    approvalStatus: item.approvalStatus,
    changedById: actorUserId,
    changeSummary,
  }
}

async function assertNoExactDuplicateKnowledge({
  workspaceId,
  category,
  title,
  scope,
  excludeKnowledgeItemId,
}: {
  workspaceId: string
  category: string
  title: string
  scope?: WorkspaceKnowledgeScopeInput
  excludeKnowledgeItemId?: string
}) {
  const existing = await db.workspaceKnowledgeItem.findFirst({
    where: {
      workspaceId,
      category,
      title,
      isArchived: false,
      approvalStatus: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED'] },
      id: excludeKnowledgeItemId ? { not: excludeKnowledgeItemId } : undefined,
    },
  })

  if (!existing) return

  const existingScope = getScopeFromStructuredValue(existing.structuredValue)
  if (scopeKey(existingScope) === scopeKey(scope)) {
    throw new WorkspaceKnowledgeValidationError(
      'This workspace already has matching active knowledge for the same category and scope.',
    )
  }
}

function buildStructuredKnowledgeValue(
  input: Partial<WorkspaceKnowledgeCreateInput>,
) {
  const existingPayload = getKnowledgePayload(input.value)
  return {
    statement: input.title,
    value: existingPayload,
    explanation: input.description ?? null,
    scope: normalizeScope(input.scope),
    metadata: {
      effectiveDate: normalizeOptionalText(input.effectiveDate),
      reviewNotes: normalizeOptionalText(input.reviewNotes),
      relatedModule: normalizeOptionalText(input.relatedModule),
    },
    governance: {
      replacesKnowledgeItemId:
        input.replacesKnowledgeItemId ?? getReplacementTargetId(input.value),
    },
  }
}

function getKnowledgePayload(value: unknown) {
  if (isRecord(value) && 'value' in value) return value.value
  return value ?? null
}

function normalizeScope(
  scope?: WorkspaceKnowledgeScopeInput | null,
): WorkspaceKnowledgeScopeInput {
  if (!scope) {
    return { type: 'entireWorkspace', label: 'Entire Workspace' }
  }
  return {
    type: normalizeRequiredText(scope.type, 'Scope'),
    label: normalizeRequiredText(scope.label, 'Scope label'),
    targetType: scope.targetType,
    targetId: normalizeOptionalText(scope.targetId),
    targetLabel: normalizeOptionalText(scope.targetLabel),
  }
}

function getScopeFromStructuredValue(
  value: unknown,
): WorkspaceKnowledgeScopeInput {
  if (isRecord(value) && isRecord(value.scope)) {
    return normalizeScope(value.scope as WorkspaceKnowledgeScopeInput)
  }
  return { type: 'entireWorkspace', label: 'Entire Workspace' }
}

function getReplacementTargetId(value: unknown) {
  if (isRecord(value) && isRecord(value.governance)) {
    const replacement = value.governance.replacesKnowledgeItemId
    return typeof replacement === 'string' && replacement.trim()
      ? replacement.trim()
      : undefined
  }
  return undefined
}

function getMetadataString(value: unknown, key: string) {
  if (!isRecord(value) || !isRecord(value.metadata)) return undefined
  const candidate = value.metadata[key]
  return typeof candidate === 'string' ? candidate : undefined
}

function scopeKey(scope?: WorkspaceKnowledgeScopeInput | null) {
  const normalized = normalizeScope(scope)
  return [
    normalized.type,
    normalized.targetType ?? '',
    normalized.targetId ?? '',
    normalized.targetLabel ?? '',
  ]
    .join(':')
    .toLowerCase()
}

function domainForScope(
  scope?: WorkspaceKnowledgeScopeInput | null,
): WorkspaceKnowledgeDomain {
  switch (scope?.type) {
    case 'scheduling':
    case 'assignmentRule':
      return 'scheduling'
    case 'crm':
    case 'leads':
    case 'opportunities':
    case 'salesPipeline':
    case 'clients':
    case 'customerSegment':
      return 'crm'
    case 'tasks':
      return 'tasks'
    case 'serviceRequests':
      return 'serviceRequests'
    case 'automations':
      return 'automation'
    case 'reportsAnalytics':
      return 'reports'
    case 'teamOperations':
    case 'specificTeam':
      return 'teams'
    case 'specificBusinessLocation':
      return 'locations'
    default:
      return 'workspace'
  }
}

function sourceTypeForRole(role: GovernedKnowledgeRole) {
  if (role === 'owner') return 'Owner instruction'
  if (role === 'admin') return 'Admin instruction'
  if (role === 'manager') return 'Manager suggestion'
  return 'Member suggestion'
}

function normalizeSourceLabel(
  source: WorkspaceKnowledgeSourceInput | undefined,
  role: GovernedKnowledgeRole,
) {
  if (source?.type === 'Other') {
    return normalizeRequiredText(
      source.customLabel ?? source.label,
      'Source label',
    )
  }
  return normalizeRequiredText(
    source?.label ?? sourceTypeForRole(role),
    'Source',
  )
}

function normalizeKnowledgeStatement(value: string) {
  const normalized = normalizeRequiredText(value, 'Knowledge statement')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalized.length < 12) {
    throw new WorkspaceKnowledgeValidationError(
      'Knowledge statement must be more specific.',
    )
  }
  if (!/[a-z0-9]/i.test(normalized)) {
    throw new WorkspaceKnowledgeValidationError(
      'Knowledge statement must contain meaningful text.',
    )
  }
  if (normalized.length > 1_000) {
    throw new WorkspaceKnowledgeValidationError(
      'Knowledge statement must be 1000 characters or fewer.',
    )
  }
  return normalized
}

function mapDbKnowledgeSource(row: any): WorkspaceKnowledgeSource {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    label: row.label,
    domain: row.domain,
    recordType: row.recordType ?? undefined,
    recordId: row.recordId ?? undefined,
    referenceId: row.referenceId ?? undefined,
    inspectedAt: dateToIso(row.inspectedAt),
    metadata: isRecord(row.metadata) ? row.metadata : undefined,
  }
}

function mapDbKnowledgeItemToProfileItem(
  row: any,
): WorkspaceKnowledgeProfileItem {
  const source = row.source
    ? mapDbKnowledgeSource(row.source)
    : ({
        id: `knowledge-source:${row.id}:missing`,
        workspaceId: row.workspaceId,
        type: 'manualAdminEntry',
        label: row.sourceSummary ?? 'Workspace knowledge',
        domain: 'workspace',
        referenceId: undefined,
        inspectedAt: dateToIso(row.createdAt),
      } satisfies WorkspaceKnowledgeSource)

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    category: row.category,
    title: row.title,
    description: row.description ?? undefined,
    value: row.structuredValue,
    source,
    confidence: normalizeConfidence(row.confidence),
    approvalStatus: mapDbApprovalStatus(row.approvalStatus),
    createdBy: row.createdById,
    approvedBy: row.approvedById ?? undefined,
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt),
    approvedAt: row.approvedAt ? dateToIso(row.approvedAt) : undefined,
    version: row.version,
    supersededBy: row.supersededById ?? undefined,
    isArchived: Boolean(row.isArchived),
    provenance: {
      sourceIds: [source.id],
      referenceIds: source.referenceId ? [source.referenceId] : [],
      evidenceSummary: row.sourceSummary ?? `Created from ${source.label}.`,
      deterministic: true,
    },
  }
}

function mapDbKnowledgeItemToQueueItem(
  row: any,
  status: 'pendingReview' | 'rejected',
): WorkspaceLearningQueueItem {
  const profile = mapDbKnowledgeItemToProfileItem(row)
  const {
    approvalStatus: _approvalStatus,
    approvedBy: _approvedBy,
    approvedAt: _approvedAt,
    isArchived: _isArchived,
    ...proposedKnowledge
  } = profile
  return {
    id: `learning-item:${row.id}`,
    workspaceId: row.workspaceId,
    proposedKnowledge,
    status,
    proposedBy: row.createdById,
    reviewedBy:
      status === 'rejected' ? (row.approvedById ?? undefined) : undefined,
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt),
    reviewedAt:
      status === 'rejected' && row.updatedAt
        ? dateToIso(row.updatedAt)
        : undefined,
    reviewNotes: row.reason ?? undefined,
  }
}

function mapDbKnowledgeGap(row: any): WorkspaceKnowledgeGap {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    category: row.category,
    title: row.title,
    description: row.description,
    severity: row.severity,
    frequency: row.frequency,
    firstSeen: dateToIso(row.firstDetectedAt),
    lastSeen: dateToIso(row.lastDetectedAt),
    affectedDomains: row.affectedDomains ?? [],
    possibleIntegrations: asStringArray(row.metadata?.possibleIntegrations),
    recommendedConfiguration: asStringArray(
      row.metadata?.recommendedConfiguration,
    ),
    resolved: Boolean(row.isResolved),
    resolvedAt: row.resolvedAt ? dateToIso(row.resolvedAt) : undefined,
    sourceReferenceIds: asStringArray(row.metadata?.sourceReferenceIds),
  }
}

function mapDbRecommendationOutcome(row: any): WorkspaceRecommendationOutcome {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    recommendationId: row.recommendationId,
    intent: row.recommendationType,
    status: mapDbRecommendationOutcomeStatus(row.outcome),
    actorId: row.actorUserId,
    occurredAt: dateToIso(row.occurredAt),
    sourceReferenceIds: asStringArray(row.metadata?.sourceReferenceIds),
    notes: row.reason ?? undefined,
    metadata: isRecord(row.metadata) ? row.metadata : undefined,
  }
}

function mapDbCorrection(row: any): WorkspaceUserCorrection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    correctionText: row.correctionText,
    submittedBy: row.submittedById,
    submittedAt: dateToIso(row.createdAt),
    proposedKnowledgeId: row.proposedKnowledgeId ?? undefined,
    status:
      row.status === 'QUEUED_FOR_REVIEW'
        ? 'queuedForReview'
        : row.status === 'DISMISSED'
          ? 'dismissed'
          : 'captured',
  }
}

function mapDbConfidenceAssessment(row: any): WorkspaceConfidenceAssessment {
  return {
    level: normalizeConfidence(row.level),
    score: typeof row.score === 'number' ? row.score : 50,
    factors: [
      ...asStringArray(row.supportingFactors).map((label) => ({
        type: 'approvedKnowledge' as const,
        label,
        impact: 'raises' as const,
        weight: 5,
        explanation: label,
        referenceIds: [],
      })),
      ...asStringArray(row.limitingFactors).map((label) => ({
        type: 'dataCompleteness' as const,
        label,
        impact: 'lowers' as const,
        weight: -5,
        explanation: label,
        referenceIds: [],
      })),
    ],
    known: asStringArray(row.supportingFactors),
    unknown: asStringArray(row.missingData),
    assumptions: [],
    missingData: asStringArray(row.missingData),
    whyConfidenceChanged: [],
    recommendedNextIntegrations: asStringArray(row.recommendedActions),
    expectedImprovement:
      'Confidence improves as approved workspace knowledge and authoritative source coverage increase.',
  }
}

function mapDbApprovalStatus(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'approved'
    case 'REJECTED':
      return 'rejected'
    case 'ARCHIVED':
      return 'archived'
    case 'SUPERSEDED':
      return 'superseded'
    case 'DRAFT':
    case 'PENDING_REVIEW':
    default:
      return 'pendingReview'
  }
}

function normalizeRecommendationOutcome(
  status: WorkspaceRecommendationOutcomeStatus | string,
): PrismaRecommendationOutcomeStatus {
  const normalized = String(status)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase()

  if (normalized === 'REVERSED_LATER') return 'REVERSED'
  if (normalized === 'EXECUTION_FAILED') return 'EXECUTION_FAILED'
  if (normalized === 'EXECUTION_SUCCEEDED') return 'EXECUTION_SUCCEEDED'
  if (normalized === 'CANCELED') return 'CANCELLED'

  const supported: PrismaRecommendationOutcomeStatus[] = [
    'ACCEPTED',
    'REJECTED',
    'EDITED',
    'IGNORED',
    'EXECUTED',
    'REVERSED',
    'EXECUTION_FAILED',
    'EXECUTION_SUCCEEDED',
    'CANCELLED',
  ]
  return supported.includes(normalized as PrismaRecommendationOutcomeStatus)
    ? (normalized as PrismaRecommendationOutcomeStatus)
    : 'IGNORED'
}

type PrismaRecommendationOutcomeStatus =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EDITED'
  | 'IGNORED'
  | 'EXECUTED'
  | 'REVERSED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_SUCCEEDED'
  | 'CANCELLED'

function toPrismaWorkspaceMemberRole(role: GovernedKnowledgeRole) {
  return role.toUpperCase() as 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
}

function mapDbRecommendationOutcomeStatus(
  status: string,
): WorkspaceRecommendationOutcomeStatus {
  switch (status) {
    case 'ACCEPTED':
      return 'accepted'
    case 'REJECTED':
      return 'rejected'
    case 'EDITED':
      return 'edited'
    case 'EXECUTED':
    case 'EXECUTION_SUCCEEDED':
      return 'executed'
    case 'REVERSED':
      return 'reversedLater'
    case 'EXECUTION_FAILED':
      return 'executionFailed'
    case 'CANCELLED':
      return 'cancelled'
    case 'IGNORED':
    default:
      return 'ignored'
  }
}

function normalizeRequiredText(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new WorkspaceKnowledgeValidationError(`${label} is required.`)
  }
  return normalized
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim()
  return normalized || undefined
}

function normalizeConfidence(
  value?: WorkspaceKnowledgeConfidence | string,
): WorkspaceKnowledgeConfidence {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

function normalizeTags(tags?: string[]) {
  return Array.from(
    new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
  )
}

function toJsonValue(value: unknown) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

function dateToIso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
