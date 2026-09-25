import { describe, expect, it } from 'vitest'

import {
  authorizeWorkspaceAccess,
  type AutomationAuthorizationDependencies,
} from '@/lib/automations/authorization'
import {
  configureSimpleAutomationInstallation,
  getSimpleAutomationStatusAfterConfigurationSave,
  removeSimpleAutomationInstallation,
  type SimpleAutomationInstallationDependencies,
  type SimpleAutomationInstallationView,
} from '@/lib/automations/simpleAutomationInstallations'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

const validNewLeadConfig = {
  'notification-channel': 'in-app',
  recipient: 'workspace-owner',
}

function installationDependencies(input?: {
  businessModel?: keyof typeof WorkspaceBusinessModel
  hasCapability?: boolean
}) {
  const installations = new Map<string, SimpleAutomationInstallationView>()
  let automationCount = 0
  let automationRunCount = 0
  let lastCreateInput: Record<string, unknown> | null = null

  const dependencies: SimpleAutomationInstallationDependencies = {
    findWorkspace: async () => ({
      businessModel:
        WorkspaceBusinessModel[
          input?.businessModel ?? 'SIMPLE_SERVICE_BUSINESS'
        ],
    }),
    getCapabilities: async () => ({
      canUseStarterAutomations: input?.hasCapability ?? true,
    }),
    persistInstallation: async (saveInput) => {
      lastCreateInput = saveInput
      const mapKey = `${saveInput.workspaceId}:${saveInput.definitionKey}`
      const existing = installations.get(mapKey)
      const now = new Date('2026-09-22T12:00:00.000Z')

      const installation: SimpleAutomationInstallationView = {
        id: existing?.id ?? `installation-${installations.size + 1}`,
        definitionKey: saveInput.definitionKey,
        definitionVersion: saveInput.definitionVersion,
        automationId:
          existing?.automationId ?? `automation-${automationCount + 1}`,
        config: saveInput.config,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        automationStatus:
          existing?.automationStatus ?? saveInput.automationStatus,
      }
      if (!existing) automationCount += 1
      installations.set(mapKey, installation)
      return installation
    },
    removeInstallation: async ({ workspaceId, definitionKey }) =>
      installations.delete(`${workspaceId}:${definitionKey}`),
  }

  return {
    dependencies,
    installations,
    getAutomationCount: () => automationCount,
    getAutomationRunCount: () => automationRunCount,
    getLastCreateInput: () => lastCreateInput,
  }
}

function workspaceAuthorizationDependencies(input: {
  memberWorkspaceId: string
  role: string
}): Pick<AutomationAuthorizationDependencies, 'getUserId' | 'findMembership'> {
  return {
    getUserId: async () => 'clerk-user',
    findMembership: async ({ workspaceId }) =>
      workspaceId === input.memberWorkspaceId
        ? { userId: 'profile-user', role: input.role }
        : null,
  }
}

describe('Simple Automation installations', () => {
  it('configures a valid recipe and reloads its persisted configuration', async () => {
    const testState = installationDependencies()

    const result = await configureSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        userProfileId: 'profile-user',
        definitionKey: 'new-lead-alert',
        config: validNewLeadConfig,
      },
      testState.dependencies,
    )

    expect(result.ok).toBe(true)
    expect(
      testState.installations.get('workspace-a:new-lead-alert')?.config,
    ).toEqual(validNewLeadConfig)
  })

  it('rejects an invalid definition key', async () => {
    const result = await configureSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        userProfileId: 'profile-user',
        definitionKey: 'not-a-recipe',
        config: {},
      },
      installationDependencies().dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('rejects a recipe unsupported by the workspace model', async () => {
    const result = await configureSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        userProfileId: 'profile-user',
        definitionKey: 'appointment-reminder',
        config: {
          'reminder-time': '24-hours',
          'customer-channel': 'email',
        },
      },
      installationDependencies({ businessModel: 'DIRECT_SALES' }).dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 409 })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])('%s may configure', async (role) => {
    const result = await authorizeWorkspaceAccess(
      { workspaceId: 'workspace-a', access: 'manage' },
      workspaceAuthorizationDependencies({
        memberWorkspaceId: 'workspace-a',
        role,
      }),
    )

    expect(result.allowed).toBe(true)
  })

  it('allows a member to read but not mutate', async () => {
    const dependencies = workspaceAuthorizationDependencies({
      memberWorkspaceId: 'workspace-a',
      role: 'MEMBER',
    })

    expect(
      (
        await authorizeWorkspaceAccess(
          { workspaceId: 'workspace-a', access: 'view' },
          dependencies,
        )
      ).allowed,
    ).toBe(true)
    expect(
      await authorizeWorkspaceAccess(
        { workspaceId: 'workspace-a', access: 'manage' },
        dependencies,
      ),
    ).toMatchObject({ allowed: false, status: 403 })
  })

  it('does not authorize workspace A to read or mutate workspace B', async () => {
    const dependencies = workspaceAuthorizationDependencies({
      memberWorkspaceId: 'workspace-a',
      role: 'OWNER',
    })

    expect(
      await authorizeWorkspaceAccess(
        { workspaceId: 'workspace-b', access: 'view' },
        dependencies,
      ),
    ).toMatchObject({ allowed: false, status: 403 })
    expect(
      await authorizeWorkspaceAccess(
        { workspaceId: 'workspace-b', access: 'manage' },
        dependencies,
      ),
    ).toMatchObject({ allowed: false, status: 403 })
  })

  it('upserts one installation and one Automation across duplicate saves', async () => {
    const testState = installationDependencies()
    const input = {
      workspaceId: 'workspace-a',
      userProfileId: 'profile-user',
      definitionKey: 'new-lead-alert',
      config: validNewLeadConfig,
    }

    await configureSimpleAutomationInstallation(input, testState.dependencies)
    await configureSimpleAutomationInstallation(
      {
        ...input,
        config: { ...validNewLeadConfig, 'notification-channel': 'email' },
      },
      testState.dependencies,
    )

    expect(testState.installations).toHaveLength(1)
    expect(testState.getAutomationCount()).toBe(1)
    expect(testState.getLastCreateInput()).toMatchObject({
      definitionVersion: 1,
      automationStatus: 'INACTIVE',
      automationFlow: null,
    })
    expect(testState.getAutomationRunCount()).toBe(0)
  })

  it('pauses an active Automation when its managed configuration changes', () => {
    expect(getSimpleAutomationStatusAfterConfigurationSave('ACTIVE')).toBe(
      'PAUSED',
    )
    expect(getSimpleAutomationStatusAfterConfigurationSave('PAUSED')).toBe(
      'PAUSED',
    )
    expect(getSimpleAutomationStatusAfterConfigurationSave('INACTIVE')).toBe(
      'INACTIVE',
    )
  })

  it('rejects invalid recipe configuration', async () => {
    const result = await configureSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        userProfileId: 'profile-user',
        definitionKey: 'schedule-change-notification',
        config: { changes: [], 'customer-channel': 'carrier-pigeon' },
      },
      installationDependencies().dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it.each(['estimate-follow-up'])(
    'rejects persistence for coming-soon recipe %s',
    async (definitionKey) => {
      const result = await configureSimpleAutomationInstallation(
        {
          workspaceId: 'workspace-a',
          userProfileId: 'profile-user',
          definitionKey,
          config: {},
        },
        installationDependencies().dependencies,
      )

      expect(result).toMatchObject({ ok: false, status: 409 })
    },
  )

  it('enforces the workspace starter automation capability', async () => {
    const result = await configureSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        userProfileId: 'profile-user',
        definitionKey: 'new-lead-alert',
        config: validNewLeadConfig,
      },
      installationDependencies({ hasCapability: false }).dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('allows a saved setup to be removed after a plan downgrade', async () => {
    const testState = installationDependencies({ hasCapability: false })
    testState.installations.set('workspace-a:new-lead-alert', {
      id: 'installation-1',
      definitionKey: 'new-lead-alert',
      definitionVersion: 1,
      automationId: 'automation-1',
      config: validNewLeadConfig,
      createdAt: new Date('2026-09-22T12:00:00.000Z'),
      updatedAt: new Date('2026-09-22T12:00:00.000Z'),
      automationStatus: 'PAUSED',
    })

    const result = await removeSimpleAutomationInstallation(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
      },
      testState.dependencies,
    )

    expect(result).toEqual({ ok: true, removed: true })
    expect(testState.installations).toHaveLength(0)
  })
})
