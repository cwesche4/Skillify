import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  WorkspaceAIActivityType,
  WorkspaceAIStatus,
  WorkspaceMemberRole,
  type WorkspaceAIStatus as WorkspaceAIStatusValue,
} from '@/lib/prisma/enums'
import { ensureWorkspaceAIProfile } from '@/lib/ai/ensureWorkspaceAIProfile'
import { logWorkspaceAIActivity } from '@/lib/ai/logWorkspaceAIActivity'
import {
  DEFAULT_WORKSPACE_AI_GUARDRAILS,
  normalizeWorkspaceAIStatus,
} from '@/lib/ai/workspaceAIStatus'
import {
  createWorkspaceKnowledgeItem,
  WorkspaceKnowledgeValidationError,
} from '@/lib/intelligence/workspaceKnowledgeStore'
import { translateWorkspaceAISettingToKnowledge } from '@/lib/intelligence/workspaceKnowledgeGovernance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: { workspaceId: string } }

const WRITE_FIELDS = new Set([
  'enabled',
  'status',
  'businessSummary',
  'productsAndServices',
  'operatingGuidelines',
  'brandVoice',
  'customerPolicies',
  'automationGuardrails',
])

function isAdminRole(role: string) {
  return (
    role === WorkspaceMemberRole.OWNER || role === WorkspaceMemberRole.ADMIN
  )
}

async function getMembership(workspaceId: string, clerkId: string) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: {
      role: true,
      userId: true,
      workspace: { select: { archivedAt: true } },
    },
  })
}

function cleanNullableString(value: unknown, maxLength: number) {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error('Expected a string.')
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new Error(`Must be ${maxLength} characters or fewer.`)
  }
  return trimmed || null
}

function cleanProfileContextValue(value: unknown, field: string) {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 5000) {
      throw new Error(`${field} must be 5000 characters or fewer.`)
    }
    return trimmed || null
  }
  if (typeof value !== 'object') {
    throw new Error(`${field} must be text or a saved JSON structure.`)
  }
  return value
}

function cleanGuardrails(value: unknown) {
  if (value == null) return DEFAULT_WORKSPACE_AI_GUARDRAILS
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('automationGuardrails must be a JSON object.')
  }
  const input = value as Record<string, unknown>
  return {
    ...DEFAULT_WORKSPACE_AI_GUARDRAILS,
    allowAdvice:
      typeof input.allowAdvice === 'boolean'
        ? input.allowAdvice
        : DEFAULT_WORKSPACE_AI_GUARDRAILS.allowAdvice,
    allowDrafting:
      typeof input.allowDrafting === 'boolean'
        ? input.allowDrafting
        : DEFAULT_WORKSPACE_AI_GUARDRAILS.allowDrafting,
    allowActionProposals:
      typeof input.allowActionProposals === 'boolean'
        ? input.allowActionProposals
        : DEFAULT_WORKSPACE_AI_GUARDRAILS.allowActionProposals,
    requireApprovalForActions:
      typeof input.requireApprovalForActions === 'boolean'
        ? input.requireApprovalForActions
        : DEFAULT_WORKSPACE_AI_GUARDRAILS.requireApprovalForActions,
    allowAutonomousActions: false,
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(params.workspaceId, clerkId)
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const profile = await ensureWorkspaceAIProfile(
    params.workspaceId,
    membership.userId,
  )
  const activity = await (prisma as any).workspaceAIActivity?.findMany?.({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({
    aiProfile: profile,
    activity: activity ?? [],
    statusCopy:
      'Workspace AI uses saved business context only when an AI feature is invoked.',
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(params.workspaceId, clerkId)
  if (!membership || !isAdminRole(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await ensureWorkspaceAIProfile(
    params.workspaceId,
    membership.userId,
  )
  const body = await req.json().catch(() => ({}))
  const unsupported = Object.keys(body).filter((key) => !WRITE_FIELDS.has(key))
  if (unsupported.length > 0) {
    return NextResponse.json(
      { error: `Unsupported field: ${unsupported[0]}` },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  try {
    if ('enabled' in body) data.enabled = Boolean(body.enabled)
    if ('status' in body) {
      data.status = normalizeWorkspaceAIStatus(body.status)
    }
    if ('businessSummary' in body) {
      data.businessSummary = cleanNullableString(body.businessSummary, 3000)
    }
    for (const field of [
      'productsAndServices',
      'operatingGuidelines',
      'brandVoice',
      'customerPolicies',
    ]) {
      if (field in body)
        data[field] = cleanProfileContextValue(body[field], field)
    }
    if ('automationGuardrails' in body) {
      data.automationGuardrails = cleanGuardrails(body.automationGuardrails)
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid AI settings.',
      },
      { status: 400 },
    )
  }

  if (data.enabled === true && !('status' in data)) {
    data.status = WorkspaceAIStatus.READY
  }
  if (data.enabled === false && !('status' in data)) {
    data.status = WorkspaceAIStatus.DISABLED
  }

  const updated = await (prisma as any).workspaceAIProfile.update({
    where: { workspaceId: params.workspaceId },
    data,
  })

  const statusChanged =
    data.status && data.status !== (existing?.status as WorkspaceAIStatusValue)
  await logWorkspaceAIActivity({
    workspaceId: params.workspaceId,
    userId: membership.userId,
    type: statusChanged
      ? WorkspaceAIActivityType.STATUS_CHANGED
      : WorkspaceAIActivityType.PROFILE_UPDATED,
    source: 'workspace.settings.ai-profile',
    metadata: {
      changedFields: Object.keys(data),
      previousStatus: existing?.status ?? null,
      nextStatus: updated.status,
    },
  })

  await proposeWorkspaceKnowledgeFromAIProfileSettings({
    workspaceId: params.workspaceId,
    userId: membership.userId,
    role: String(membership.role).toLowerCase(),
    changedData: data,
  })

  return NextResponse.json({ ok: true, aiProfile: updated })
}

async function proposeWorkspaceKnowledgeFromAIProfileSettings({
  workspaceId,
  userId,
  role,
  changedData,
}: {
  workspaceId: string
  userId: string
  role: string
  changedData: Record<string, unknown>
}) {
  const mappings: Array<{
    field: string
    scope: { type: string; label: string }
  }> = [
    {
      field: 'businessSummary',
      scope: { type: 'entireWorkspace', label: 'Entire Workspace' },
    },
    {
      field: 'productsAndServices',
      scope: { type: 'serviceRequests', label: 'Service Requests' },
    },
    {
      field: 'operatingGuidelines',
      scope: { type: 'teamOperations', label: 'Team Operations' },
    },
    {
      field: 'brandVoice',
      scope: { type: 'entireWorkspace', label: 'Entire Workspace' },
    },
    {
      field: 'customerPolicies',
      scope: { type: 'clients', label: 'Clients' },
    },
    {
      field: 'automationGuardrails',
      scope: { type: 'automations', label: 'Automations' },
    },
  ]

  for (const mapping of mappings) {
    if (!(mapping.field in changedData)) continue
    const translated = translateWorkspaceAISettingToKnowledge({
      field: mapping.field,
      value: changedData[mapping.field],
    })
    if (!translated) continue
    try {
      await createWorkspaceKnowledgeItem({
        actor: {
          workspaceId,
          userId,
          role: role as 'owner' | 'admin' | 'manager' | 'member',
        },
        input: {
          category: translated.category,
          title: translated.title,
          description:
            'Proposed from saved Workspace AI settings. Review before making it available to Workspace AI runtime context.',
          value: {
            proposal: {
              title: translated.title,
              summary: translated.summary,
              reasoning: [
                'Created from Workspace AI settings so owners can review it as business guidance.',
              ],
              evidence: ['Workspace AI settings'],
              confidence: 'medium',
              sourceLabel: 'Workspace AI Settings',
            },
            sourceField: mapping.field,
            ...translated.value,
          },
          scope: mapping.scope,
          source: {
            type: 'Workspace AI Settings',
            label: 'Workspace AI Settings',
            domain: 'workspace',
            recordType: 'workspaceAIProfile',
            recordId: workspaceId,
            metadata: {
              settingsField: mapping.field,
            },
          },
          relatedModule: translated.relatedModule,
          reviewNotes: 'Generated from Workspace AI settings save.',
          tags: ['workspace-ai-settings', mapping.field],
        },
      })
    } catch (error) {
      if (
        error instanceof WorkspaceKnowledgeValidationError &&
        error.message.includes('already has matching active knowledge')
      ) {
        continue
      }
      console.warn(
        '[Workspace AI Settings] Knowledge proposal write-through failed.',
        error,
      )
    }
  }
}
