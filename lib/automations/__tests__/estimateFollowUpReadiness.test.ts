import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  integrations: vi.fn(),
  capabilities: vi.fn(),
  sender: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspace },
    integration: { findMany: mocks.integrations },
  },
}))

vi.mock('@/lib/automations/capabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/automations/capabilities')>()),
  getWorkspaceAutomationCapabilities: mocks.capabilities,
}))

vi.mock('@/lib/estimates/estimateEmail', () => ({
  resolveVerifiedEstimateSender: mocks.sender,
}))

import { getSimpleAutomationReadiness } from '@/lib/automations/simpleAutomationReadiness'

describe('Estimate Follow-Up persisted timezone readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.integrations.mockResolvedValue([])
    mocks.capabilities.mockResolvedValue({
      plan: 'Basic',
      canUseStarterAutomations: true,
    })
    mocks.sender.mockResolvedValue({ from: 'estimates@example.test' })
  })

  it.each([
    ['missing', null, false],
    ['invalid', { scheduling: { timezone: 'Not/A_Timezone' } }, false],
    ['supported', { scheduling: { timezone: 'America/New_York' } }, true],
  ])(
    'treats a %s raw persisted timezone as ready=%s',
    async (_label, settings, expectedReady) => {
      mocks.workspace.mockResolvedValue({
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        settings,
      })

      const result = await getSimpleAutomationReadiness({
        workspaceId: 'workspace-a',
        definitionKey: 'estimate-follow-up',
        definitionVersion: 1,
        config: { 'estimate-delay': '3-days' },
      })

      expect(result.ready).toBe(expectedReady)
      expect(
        result.requirements.some(
          (item) => item.code === 'scheduling-timezone-required',
        ),
      ).toBe(!expectedReady)
    },
  )
})
