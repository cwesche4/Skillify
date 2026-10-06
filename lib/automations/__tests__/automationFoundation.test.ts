import { describe, expect, it } from 'vitest'

import {
  authorizeAutomationAccess,
  authorizeWorkspaceAccess,
  buildAutomationRunScope,
  type AutomationAuthorizationDependencies,
} from '@/lib/automations/authorization'
import { getAutomationCapabilities } from '@/lib/automations/capabilities'
import {
  canManageAutomations,
  canTransitionAutomationStatus,
  getAdvancedAutomationMutationError,
  getAutomationActivationError,
  getAutomationExecutionPreconditionError,
} from '@/lib/automations/policy'
import { updateAutomationSchema } from '@/lib/validations/automation'
import { resolveWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

function authorizationDependencies(input: {
  automationWorkspaceId?: string
  membershipWorkspaceId?: string
  role?: string
  userId?: string | null
}): AutomationAuthorizationDependencies {
  const automationWorkspaceId = input.automationWorkspaceId ?? 'workspace-a'
  const membershipWorkspaceId = input.membershipWorkspaceId ?? 'workspace-a'

  return {
    getUserId: async () =>
      input.userId === undefined ? 'clerk-user' : input.userId,
    findAutomation: async ({ automationId, workspaceId }) =>
      workspaceId && workspaceId !== automationWorkspaceId
        ? null
        : { id: automationId, workspaceId: automationWorkspaceId },
    findMembership: async ({ workspaceId }) =>
      workspaceId === membershipWorkspaceId
        ? { userId: 'profile-user', role: input.role ?? 'MEMBER' }
        : null,
  }
}

describe('Automation backend foundation', () => {
  it('hides an Automation in another workspace from a member', async () => {
    const result = await authorizeAutomationAccess(
      { automationId: 'automation-b', access: 'view' },
      authorizationDependencies({
        automationWorkspaceId: 'workspace-b',
        membershipWorkspaceId: 'workspace-a',
      }),
    )

    expect(result).toEqual({
      allowed: false,
      status: 404,
      message: 'Automation not found',
    })
  })

  it('hides a cross-workspace Automation from mutation attempts', async () => {
    const result = await authorizeAutomationAccess(
      { automationId: 'automation-b', access: 'manage' },
      authorizationDependencies({
        automationWorkspaceId: 'workspace-b',
        membershipWorkspaceId: 'workspace-a',
        role: 'OWNER',
      }),
    )

    expect(result.allowed).toBe(false)
    if (result.allowed) throw new Error('Expected access to be denied')
    expect(result.status).toBe(404)
  })

  it.each(['view', 'manage'] as const)(
    'blocks cross-workspace flow %s access',
    async (access) => {
      const result = await authorizeAutomationAccess(
        { automationId: 'automation-b', access },
        authorizationDependencies({
          automationWorkspaceId: 'workspace-b',
          membershipWorkspaceId: 'workspace-a',
          role: 'OWNER',
        }),
      )

      expect(result).toMatchObject({ allowed: false, status: 404 })
    },
  )

  it('blocks cross-workspace execution authorization', async () => {
    expect(
      await authorizeAutomationAccess(
        { automationId: 'automation-b', access: 'manage' },
        authorizationDependencies({
          automationWorkspaceId: 'workspace-b',
          membershipWorkspaceId: 'workspace-a',
          role: 'MANAGER',
        }),
      ),
    ).toMatchObject({ allowed: false, status: 404 })
  })

  it('denies regular members management access while retaining view access', async () => {
    const dependencies = authorizationDependencies({ role: 'MEMBER' })

    expect(
      (
        await authorizeAutomationAccess(
          { automationId: 'automation-a', access: 'view' },
          dependencies,
        )
      ).allowed,
    ).toBe(true)
    expect(
      await authorizeAutomationAccess(
        { automationId: 'automation-a', access: 'manage' },
        dependencies,
      ),
    ).toMatchObject({ allowed: false, status: 403 })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    '%s can manage Automations',
    async (role) => {
      expect(canManageAutomations(role)).toBe(true)
      expect(
        (
          await authorizeAutomationAccess(
            { automationId: 'automation-a', access: 'manage' },
            authorizationDependencies({ role }),
          )
        ).allowed,
      ).toBe(true)
    },
  )

  it('blocks arbitrary workspace creation targets', async () => {
    const dependencies = authorizationDependencies({
      membershipWorkspaceId: 'workspace-a',
      role: 'OWNER',
    })

    expect(
      await authorizeWorkspaceAccess(
        { workspaceId: 'workspace-b', access: 'manage' },
        dependencies,
      ),
    ).toMatchObject({ allowed: false, status: 403 })
  })

  it('requires run IDs to match both Automation and workspace', () => {
    expect(
      buildAutomationRunScope({
        runId: 'run-b',
        automationId: 'automation-a',
        workspaceId: 'workspace-a',
      }),
    ).toEqual({
      id: 'run-b',
      automationId: 'automation-a',
      workspaceId: 'workspace-a',
    })
  })

  it('rejects unsupported general PATCH fields', () => {
    expect(
      updateAutomationSchema.safeParse({
        name: 'Safe name',
        workspaceId: 'workspace-b',
      }).success,
    ).toBe(false)
  })

  it('enforces lifecycle transitions', () => {
    expect(canTransitionAutomationStatus('INACTIVE', 'ACTIVE')).toBe(true)
    expect(canTransitionAutomationStatus('INACTIVE', 'PAUSED')).toBe(false)
    expect(canTransitionAutomationStatus('ARCHIVED', 'ACTIVE')).toBe(false)
    expect(canTransitionAutomationStatus('ARCHIVED', 'INACTIVE')).toBe(true)
  })

  it('does not activate an Automation without an executable flow', () => {
    expect(getAutomationActivationError('ACTIVE', null)).toBe(
      'Automation has no flow.',
    )
    expect(
      getAutomationActivationError('ACTIVE', { nodes: [], edges: [] }),
    ).toBe('Automation must contain at least one node before activation.')
    expect(
      getAutomationActivationError('ACTIVE', {
        nodes: [{ id: 'trigger' }],
        edges: [],
      }),
    ).toBeNull()
  })

  it('keeps Simple-managed Automations out of Advanced mutations', () => {
    expect(getAdvancedAutomationMutationError(true)).toBe(
      'This workflow is managed from Simple Automations.',
    )
    expect(getAdvancedAutomationMutationError(false)).toBe(
      'Advanced Automations are unavailable during the controlled launch.',
    )
  })

  it('requires ACTIVE status and matching workspace before execution', () => {
    expect(
      getAutomationExecutionPreconditionError({
        status: 'PAUSED',
        workspaceId: 'workspace-a',
        expectedWorkspaceId: 'workspace-a',
      }),
    ).toBe('Automation is not active')
    expect(
      getAutomationExecutionPreconditionError({
        status: 'ACTIVE',
        workspaceId: 'workspace-b',
        expectedWorkspaceId: 'workspace-a',
      }),
    ).toBe('Automation not found')
  })

  it('uses workspace or owner billing rather than a member plan', () => {
    const now = new Date('2026-10-06T12:00:00.000Z')
    expect(
      resolveWorkspacePlan({
        workspaceSubscription: { plan: 'Basic', status: 'active' },
        ownerSubscription: { plan: 'Elite', status: 'active' },
        now,
      }),
    ).toBe('Basic')
    expect(
      resolveWorkspacePlan({
        workspaceSubscription: { plan: 'Free', status: 'active' },
        ownerSubscription: { plan: 'Elite', status: 'active' },
        now,
      }),
    ).toBe('Free')
    expect(
      resolveWorkspacePlan({
        ownerSubscription: {
          plan: 'Pro',
          status: 'trialing',
          complimentaryEndsAt: '2026-10-07T12:00:00.000Z',
        },
        now,
      }),
    ).toBe('Pro')
    expect(
      resolveWorkspacePlan({
        ownerSubscription: {
          plan: 'Elite',
          status: 'trialing',
          complimentaryEndsAt: now,
        },
        now,
      }),
    ).toBe('Free')
    expect(
      getAutomationCapabilities(
        resolveWorkspacePlan({
          ownerSubscription: {
            plan: 'Elite',
            status: 'trialing',
            complimentaryEndsAt: new Date(now.getTime() - 1),
          },
          now,
        }),
      ),
    ).toMatchObject({
      canUseStarterAutomations: false,
      canUseAdvancedBuilder: false,
    })
  })

  it('exposes separate starter and advanced plan capabilities', () => {
    expect(getAutomationCapabilities('Basic')).toMatchObject({
      canUseStarterAutomations: true,
      canUseAdvancedBuilder: false,
    })
    expect(getAutomationCapabilities('Pro')).toMatchObject({
      canUseStarterAutomations: true,
      canUseAdvancedBuilder: true,
    })
  })
})
