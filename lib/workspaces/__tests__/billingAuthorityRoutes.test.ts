import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  workspaceFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  workspaceUpdate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: {
      findUnique: mocks.workspaceFindUnique,
      update: mocks.workspaceUpdate,
    },
    subscription: { upsert: mocks.subscriptionUpsert },
  },
}))

import { POST as changePlan } from '@/app/api/billing/upgrade/route'
import { POST as startTrial } from '@/app/api/billing/checkout/start-trial/route'

describe('controlled-launch billing authority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-owner' })
    mocks.workspaceFindUnique.mockResolvedValue({
      owner: { id: 'owner-1', clerkId: 'clerk-owner' },
      subscriptionId: 'subscription-existing',
    })
  })

  it.each(['Pro', 'Elite'])(
    'does not let an Owner mint %s entitlement through the upgrade API',
    async (plan) => {
      const response = await changePlan(
        new Request('https://skillify.test/api/billing/upgrade', {
          method: 'POST',
          body: JSON.stringify({ plan, workspaceId: 'workspace-1' }),
        }),
      )

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({
        code: 'SELF_SERVICE_BILLING_DISABLED',
        requestedPlan: plan,
      })
      expect(mocks.subscriptionUpsert).not.toHaveBeenCalled()
      expect(mocks.workspaceUpdate).not.toHaveBeenCalled()
    },
  )

  it('preserves workspace isolation before returning the launch restriction', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      owner: { id: 'owner-2', clerkId: 'another-owner' },
      subscriptionId: null,
    })

    const response = await changePlan(
      new Request('https://skillify.test/api/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: 'Pro', workspaceId: 'workspace-2' }),
      }),
    )

    expect(response.status).toBe(403)
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled()
  })

  it('does not create trial or paid entitlement without provider authority', async () => {
    const response = await startTrial(
      new Request('https://skillify.test/api/billing/checkout/start-trial', {
        method: 'POST',
        body: JSON.stringify({ plan: 'Elite', code: 'UNTRUSTED' }),
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SELF_SERVICE_BILLING_DISABLED',
    })
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled()
    expect(mocks.workspaceUpdate).not.toHaveBeenCalled()
  })

  it('still requires authentication', async () => {
    mocks.auth.mockReturnValue({ userId: null })

    expect(
      await startTrial(
        new Request('https://skillify.test/api/billing/checkout/start-trial', {
          method: 'POST',
        }),
      ),
    ).toMatchObject({ status: 401 })
    expect(mocks.workspaceFindUnique).not.toHaveBeenCalled()
  })
})
