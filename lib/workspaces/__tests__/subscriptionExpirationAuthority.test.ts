import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    userProfile: { findUnique: mocks.userFindUnique },
    subscription: { findUnique: mocks.subscriptionFindUnique },
  },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

import { auth } from '@clerk/nextjs/server'
import { GET as getLiveCoach } from '@/app/api/coach/live/route'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'
import { getAutomationCapabilities } from '@/lib/automations/capabilities'
import {
  getWorkspacePlan,
  resolveWorkspacePlan,
} from '@/lib/subscriptions/getWorkspacePlan'

describe('finite subscription authorization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses an exact active-before, expired-at, expired-after boundary', () => {
    const expiration = new Date('2026-10-06T12:00:00.000Z')
    const input = {
      ownerSubscription: {
        plan: 'Elite',
        status: 'trialing',
        trialEndsAt: expiration,
        complimentaryEndsAt: expiration,
      },
    }

    expect(
      resolveWorkspacePlan({
        ...input,
        now: new Date(expiration.getTime() - 1),
      }),
    ).toBe('Elite')
    expect(resolveWorkspacePlan({ ...input, now: expiration })).toBe('Free')
    expect(
      resolveWorkspacePlan({
        ...input,
        now: new Date(expiration.getTime() + 1),
      }),
    ).toBe('Free')
  })

  it('grants an active owner-derived finite plan to server capabilities', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      subscription: null,
      owner: {
        subscription: {
          plan: 'Pro',
          status: 'trialing',
          trialEndsAt: null,
          complimentaryEndsAt: new Date(Date.now() + 60_000),
        },
      },
    })

    const plan = await getWorkspacePlan('workspace-1')
    expect(plan).toBe('Pro')
    expect(getAutomationCapabilities(plan)).toMatchObject({
      canUseStarterAutomations: true,
      canUseAdvancedBuilder: true,
    })
  })

  it('returns Free after owner-derived finite access expires', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      subscription: null,
      owner: {
        subscription: {
          plan: 'Elite',
          status: 'trialing',
          trialEndsAt: null,
          complimentaryEndsAt: new Date(Date.now() - 1),
        },
      },
    })

    const plan = await getWorkspacePlan('workspace-1')
    expect(plan).toBe('Free')
    expect(getAutomationCapabilities(plan)).toMatchObject({
      canUseStarterAutomations: false,
      canUseAdvancedBuilder: false,
    })
  })

  it('makes direct user-plan gates fall back after expiration', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'profile-1' })
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce({
        plan: 'Elite',
        status: 'trialing',
        trialEndsAt: null,
        complimentaryEndsAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({
        plan: 'Elite',
        status: 'trialing',
        trialEndsAt: null,
        complimentaryEndsAt: new Date(Date.now() - 1),
      })

    await expect(getUserPlanByClerkId('user_exact')).resolves.toBe('elite')
    await expect(getUserPlanByClerkId('user_exact')).resolves.toBe('basic')
  })

  it('does not let the legacy Basic fallback retain an Elite capability', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'user_exact' } as never)
    mocks.userFindUnique.mockResolvedValue({ id: 'profile-1' })
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: 'Elite',
      status: 'trialing',
      trialEndsAt: new Date('2020-01-01T00:00:00.000Z'),
      complimentaryEndsAt: new Date('2020-01-01T00:00:00.000Z'),
    })

    const response = await getLiveCoach()

    expect(response.status).toBe(403)
  })

  it('preserves legitimate active subscription semantics', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      subscription: {
        plan: 'Basic',
        status: 'active',
        trialEndsAt: null,
        complimentaryEndsAt: null,
      },
      owner: {
        subscription: {
          plan: 'Elite',
          status: 'active',
          trialEndsAt: null,
          complimentaryEndsAt: null,
        },
      },
    })
    await expect(getWorkspacePlan('workspace-1')).resolves.toBe('Basic')
  })

  it('falls through an expired direct pilot to a valid owner authority', () => {
    const now = new Date('2026-10-06T12:00:00.000Z')
    expect(
      resolveWorkspacePlan({
        workspaceSubscription: {
          plan: 'Elite',
          status: 'trialing',
          trialEndsAt: new Date(now.getTime() - 1),
          complimentaryEndsAt: new Date(now.getTime() - 1),
        },
        ownerSubscription: { plan: 'Pro', status: 'active' },
        now,
      }),
    ).toBe('Pro')
  })

  it.each(['canceled', 'past_due'])(
    'does not grant authority for %s status even with a future date',
    (status) => {
      const now = new Date('2026-10-06T12:00:00.000Z')
      expect(
        resolveWorkspacePlan({
          ownerSubscription: {
            plan: 'Elite',
            status,
            trialEndsAt: new Date(now.getTime() + 60_000),
            complimentaryEndsAt: new Date(now.getTime() + 60_000),
          },
          now,
        }),
      ).toBe('Free')
    },
  )
})
