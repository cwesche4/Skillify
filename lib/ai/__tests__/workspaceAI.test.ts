import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceAIStatus } from '@/lib/prisma/enums'

const mocks = vi.hoisted(() => ({
  prisma: {
    workspaceAIProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    workspaceAIActivity: {
      create: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }))

import { assertWorkspaceAIAvailable } from '@/lib/ai/assertWorkspaceAIAvailable'
import { ensureWorkspaceAIProfile } from '@/lib/ai/ensureWorkspaceAIProfile'
import { getWorkspaceAIContext } from '@/lib/ai/getWorkspaceAIContext'
import { logWorkspaceAIActivity } from '@/lib/ai/logWorkspaceAIActivity'
import {
  DEFAULT_WORKSPACE_AI_GUARDRAILS,
  WorkspaceAIActivityType,
  isWorkspaceAIUsable,
} from '@/lib/ai/workspaceAIStatus'

function workspaceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workspace-a',
    name: 'Workspace A',
    businessName: 'A LLC',
    industry: 'Plumbing',
    businessModel: 'DIRECT_SALES',
    opportunitiesEnabled: false,
    commerceEnabled: false,
    defaultLeadDestination: 'SALE',
    allowDirectLeadToSale: true,
    customerSingularLabel: 'Client',
    customerPluralLabel: 'Clients',
    salesLabel: 'Sales',
    archivedAt: null,
    members: [{ userId: 'user-a', role: 'OWNER' }],
    aiProfile: {
      enabled: true,
      status: WorkspaceAIStatus.READY,
      businessSummary: 'Workspace A summary',
      productsAndServices: { services: ['Repair'] },
      operatingGuidelines: null,
      brandVoice: null,
      customerPolicies: null,
      automationGuardrails: DEFAULT_WORKSPACE_AI_GUARDRAILS,
    },
    ...overrides,
  }
}

describe('workspace AI foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates exactly one AI profile through an idempotent lifecycle helper', async () => {
    mocks.prisma.workspaceAIProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'profile-a',
        workspaceId: 'workspace-a',
      })
    mocks.prisma.workspaceAIProfile.create.mockResolvedValue({
      id: 'profile-a',
      workspaceId: 'workspace-a',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })

    await ensureWorkspaceAIProfile('workspace-a', 'user-a')
    await ensureWorkspaceAIProfile('workspace-a', 'user-a')

    expect(mocks.prisma.workspaceAIProfile.create).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.workspaceAIProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-a',
          enabled: false,
          status: WorkspaceAIStatus.NOT_CONFIGURED,
        }),
      }),
    )
    expect(mocks.prisma.workspaceAIActivity.create).toHaveBeenCalledTimes(1)
  })

  it('returns only the requested workspace AI profile data', async () => {
    mocks.prisma.workspace.findUnique.mockResolvedValue(workspaceFixture())

    const context = await getWorkspaceAIContext({
      workspaceId: 'workspace-a',
      userId: 'user-a',
    })

    expect(mocks.prisma.workspace.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'workspace-a' } }),
    )
    expect(context.workspace.id).toBe('workspace-a')
    expect(context.aiProfile.businessSummary).toBe('Workspace A summary')
  })

  it('rejects users who are not workspace members', async () => {
    mocks.prisma.workspace.findUnique.mockResolvedValue(
      workspaceFixture({ members: [] }),
    )

    await expect(
      getWorkspaceAIContext({ workspaceId: 'workspace-a', userId: 'user-b' }),
    ).rejects.toThrow(/access denied/i)
  })

  it('marks archived, disabled, paused, and not configured profiles unavailable', () => {
    expect(
      isWorkspaceAIUsable({
        enabled: true,
        status: WorkspaceAIStatus.READY,
        archivedAt: new Date(),
      }),
    ).toBe(false)
    expect(
      isWorkspaceAIUsable({
        enabled: false,
        status: WorkspaceAIStatus.READY,
      }),
    ).toBe(false)
    expect(
      isWorkspaceAIUsable({
        enabled: true,
        status: WorkspaceAIStatus.PAUSED,
      }),
    ).toBe(false)
    expect(
      isWorkspaceAIUsable({
        enabled: true,
        status: WorkspaceAIStatus.DISABLED,
      }),
    ).toBe(false)
  })

  it('allows READY and enabled profiles to be considered available', async () => {
    mocks.prisma.workspace.findUnique.mockResolvedValue(workspaceFixture())

    await expect(
      assertWorkspaceAIAvailable({
        workspaceId: 'workspace-a',
        userId: 'user-a',
      }),
    ).resolves.toMatchObject({
      capabilities: { canUseAI: true, canRequestAdvice: true },
    })
  })

  it('defaults autonomous actions off and human approval on', () => {
    expect(DEFAULT_WORKSPACE_AI_GUARDRAILS.allowAutonomousActions).toBe(false)
    expect(DEFAULT_WORKSPACE_AI_GUARDRAILS.requireApprovalForActions).toBe(true)
  })

  it('logs real lifecycle activity without external provider calls', async () => {
    mocks.prisma.workspaceAIActivity.create.mockResolvedValue({ id: 'event-a' })

    await logWorkspaceAIActivity({
      workspaceId: 'workspace-a',
      userId: 'user-a',
      type: WorkspaceAIActivityType.STATUS_CHANGED,
      source: 'test',
    })

    expect(mocks.prisma.workspaceAIActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-a',
          type: WorkspaceAIActivityType.STATUS_CHANGED,
        }),
      }),
    )
  })
})
