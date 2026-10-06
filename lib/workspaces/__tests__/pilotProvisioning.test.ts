import fs from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  getPilotConfirmationToken,
  parsePilotExpiration,
  parsePilotPlan,
  PILOT_MAX_DURATION_DAYS,
  PILOT_PRODUCTION_CONFIRMATION,
  PilotProvisioningError,
  provisionPilotSubscription,
  type PilotProvisioningInput,
} from '@/lib/billing/pilotProvisioning'
import {
  AccessCodeType,
  SubscriptionAccessSource,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/lib/prisma/enums'
import { resolveAccessCode } from '@/lib/billing/accessCodes'
import {
  parsePilotProvisioningArguments,
  runPilotProvisioningCli,
} from '@/scripts/pilotProvisioningCli'

type TestState = {
  userExists: boolean
  subscription: Record<string, unknown> | null
  accessCode: Record<string, unknown> | null
  redemption: Record<string, unknown> | null
  ownedWorkspaces: Array<Record<string, unknown>>
  accessCodeCreates: number
  subscriptionCreates: number
  redemptionCreates: number
  failRedemption: boolean
}

const now = new Date('2026-10-06T12:00:00.000Z')
const expiresAt = new Date('2026-11-05T12:00:00.000Z')
const localDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5432/skillify'

function request(
  overrides: Partial<PilotProvisioningInput> = {},
): PilotProvisioningInput {
  return {
    clerkUserId: 'user_PILOT_TARGET_123',
    plan: SubscriptionPlan.Pro,
    expiresAt,
    operator: 'release-operator',
    reason: 'Approved controlled pilot',
    environment: 'local',
    execute: false,
    ...overrides,
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createStatefulClient(overrides: Partial<TestState> = {}) {
  const state: TestState = {
    userExists: true,
    subscription: null,
    accessCode: null,
    redemption: null,
    ownedWorkspaces: [],
    accessCodeCreates: 0,
    subscriptionCreates: 0,
    redemptionCreates: 0,
    failRedemption: false,
    ...overrides,
  }

  const makeUser = () =>
    state.userExists
      ? {
          id: 'profile-1',
          clerkId: 'user_PILOT_TARGET_123',
          fullName: 'Pilot Person',
          email: 'pilot@example.test',
          subscription: state.subscription,
          ownedWorkspaces: state.ownedWorkspaces,
        }
      : null

  let transactionQueue = Promise.resolve()
  const baseClient = {
    userProfile: {
      findUnique: vi.fn(
        async ({ where }: { where: Record<string, string> }) => {
          if (where.clerkId && where.clerkId !== 'user_PILOT_TARGET_123') {
            return null
          }
          if (where.id && where.id !== 'profile-1') return null
          return makeUser()
        },
      ),
    },
    workspace: { findUnique: vi.fn() },
    accessCode: {
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
        if (!state.accessCode || state.accessCode.code !== where.code)
          return null
        return {
          ...state.accessCode,
          redemptions: state.redemption ? [state.redemption] : [],
        }
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.accessCodeCreates += 1
        state.accessCode = { id: 'access-1', ...data }
        return state.accessCode
      }),
    },
    subscription: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.subscriptionCreates += 1
        state.subscription = {
          id: 'subscription-1',
          stripeCustomerId: null,
          stripeSubId: null,
          canceledAt: null,
          ...data,
        }
        return state.subscription
      }),
    },
    accessCodeRedemption: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (state.failRedemption)
          throw new Error('simulated redemption failure')
        state.redemptionCreates += 1
        state.redemption = { id: 'redemption-1', ...data }
        return state.redemption
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: 'profile-1' }]),
  }
  type StatefulClient = typeof baseClient & {
    $transaction: ReturnType<typeof vi.fn>
  }
  const client = baseClient as StatefulClient
  client.$transaction = vi.fn(
    <T>(callback: (transaction: typeof client) => Promise<T>): Promise<T> => {
      const transaction = transactionQueue.then(async () => {
        const snapshot = clone({
          subscription: state.subscription,
          accessCode: state.accessCode,
          redemption: state.redemption,
          accessCodeCreates: state.accessCodeCreates,
          subscriptionCreates: state.subscriptionCreates,
          redemptionCreates: state.redemptionCreates,
        })
        try {
          return await callback(client)
        } catch (error) {
          Object.assign(state, snapshot)
          throw error
        }
      })
      transactionQueue = transaction.then(
        () => undefined,
        () => undefined,
      )
      return transaction
    },
  )

  return { client, state }
}

function executeRequest(overrides: Partial<PilotProvisioningInput> = {}) {
  const input = request({ execute: true, ...overrides })
  return {
    ...input,
    confirmation: getPilotConfirmationToken(input),
  }
}

describe('controlled pilot provisioning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts only explicit paid launch plans and finite bounded expiration', () => {
    expect(parsePilotPlan('Basic')).toBe(SubscriptionPlan.Basic)
    expect(parsePilotPlan('pro')).toBe(SubscriptionPlan.Pro)
    expect(parsePilotPlan('ELITE')).toBe(SubscriptionPlan.Elite)
    expect(() => parsePilotPlan('Free')).toThrow(/Basic, Pro, or Elite/)
    expect(() => parsePilotPlan('unknown')).toThrow(/Basic, Pro, or Elite/)
    expect(() => parsePilotExpiration(undefined, now)).toThrow(/ISO timestamp/)
    expect(() => parsePilotExpiration(now.toISOString(), now)).toThrow(/future/)
    expect(() =>
      parsePilotExpiration(new Date(now.getTime() - 1).toISOString(), now),
    ).toThrow(/future/)
    expect(() => parsePilotExpiration('2026-10-05T12:00:00.000Z', now)).toThrow(
      /future/,
    )
    expect(() =>
      parsePilotExpiration(
        new Date(
          now.getTime() + (PILOT_MAX_DURATION_DAYS + 1) * 86_400_000,
        ).toISOString(),
        now,
      ),
    ).toThrow(/90 days/)
    expect(
      parsePilotExpiration(
        new Date(
          now.getTime() + PILOT_MAX_DURATION_DAYS * 86_400_000,
        ).toISOString(),
        now,
      ).toISOString(),
    ).toBe('2027-01-04T12:00:00.000Z')
    expect(() =>
      parsePilotExpiration('2099-01-01T00:00:00.000Z', now),
    ).toThrow()
  })

  it('parses an exact Clerk target and rejects unknown or duplicate CLI options', () => {
    const parsed = parsePilotProvisioningArguments(
      [
        '--clerk-user-id',
        'user_PILOT_TARGET_123',
        '--plan=Pro',
        '--expires-at',
        expiresAt.toISOString(),
        '--operator',
        'operator',
        '--reason',
        'reason',
        '--environment',
        'local',
      ],
      now,
    )
    expect(parsed.execute).toBe(false)
    expect(parsed.plan).toBe(SubscriptionPlan.Pro)
    expect(() =>
      parsePilotProvisioningArguments(['--email', 'pilot@example.test'], now),
    ).toThrow(/Unknown option/)
    expect(() =>
      parsePilotProvisioningArguments(
        [
          '--plan',
          'Pro',
          '--plan',
          'Elite',
          '--expires-at',
          expiresAt.toISOString(),
          '--environment',
          'local',
        ],
        now,
      ),
    ).toThrow(/more than once/)
  })

  it('keeps dry-run read-only and reports no changes', async () => {
    const { client, state } = createStatefulClient()
    const result = await provisionPilotSubscription(request(), {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })
    expect(result.status).toBe('DRY_RUN')
    expect(result.changed).toBe(false)
    expect(state.accessCodeCreates).toBe(0)
    expect(state.subscriptionCreates).toBe(0)
    expect(state.redemptionCreates).toBe(0)
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('requires exact execution and production confirmations', async () => {
    const { client } = createStatefulClient()
    await expect(
      provisionPilotSubscription(request({ execute: true }), {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' })

    const production = executeRequest({
      environment: 'production',
    })
    await expect(
      provisionPilotSubscription(production, {
        client: client as never,
        now,
        databaseUrl: 'postgresql://example.invalid/skillify',
      }),
    ).rejects.toMatchObject({ code: 'PRODUCTION_CONFIRMATION_REQUIRED' })
    production.productionConfirmation = 'i-understand-production'
    await expect(
      provisionPilotSubscription(production, {
        client: client as never,
        now,
        databaseUrl: 'postgresql://example.invalid/skillify',
      }),
    ).rejects.toMatchObject({ code: 'PRODUCTION_CONFIRMATION_REQUIRED' })
    production.productionConfirmation = PILOT_PRODUCTION_CONFIRMATION
    await expect(
      provisionPilotSubscription(production, {
        client: client as never,
        now,
        databaseUrl: 'postgresql://example.invalid/skillify',
      }),
    ).resolves.toMatchObject({ status: 'PROVISIONED' })
  })

  it('binds confirmation to operator and reason audit evidence', async () => {
    const { client } = createStatefulClient()
    const approved = request({
      operator: 'operator-a',
      reason: 'Approved reason A',
    })
    const approvedToken = getPilotConfirmationToken(approved)

    expect(
      getPilotConfirmationToken({ ...approved, operator: 'operator-b' }),
    ).not.toBe(approvedToken)
    expect(
      getPilotConfirmationToken({ ...approved, reason: 'Approved reason B' }),
    ).not.toBe(approvedToken)
    expect(
      getPilotConfirmationToken({
        ...approved,
        operator: 'operator|audit',
        reason: 'reason',
      }),
    ).not.toBe(
      getPilotConfirmationToken({
        ...approved,
        operator: 'operator',
        reason: 'audit|reason',
      }),
    )

    await expect(
      provisionPilotSubscription(
        {
          ...approved,
          operator: 'operator-b',
          execute: true,
          confirmation: approvedToken,
        },
        {
          client: client as never,
          now,
          databaseUrl: localDatabaseUrl,
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' })
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('rejects missing or malformed exact user identity', async () => {
    const missing = createStatefulClient({ userExists: false })
    await expect(
      provisionPilotSubscription(request(), {
        client: missing.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })

    await expect(
      provisionPilotSubscription(request({ clerkUserId: 'not-a-clerk-id' }), {
        client: missing.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CLERK_USER_ID' })
  })

  it('requires bounded operator and reason evidence', async () => {
    const { client } = createStatefulClient()
    await expect(
      provisionPilotSubscription(request({ operator: '' }), {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OPERATOR' })
    await expect(
      provisionPilotSubscription(request({ reason: 'x'.repeat(241) }), {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REASON' })
  })

  it('enforces exact sole-owner Workspace validation', async () => {
    const owned = {
      id: 'workspace-1',
      ownerId: 'profile-1',
      subscriptionId: null,
      archivedAt: null,
    }
    const one = createStatefulClient({ ownedWorkspaces: [owned] })
    await expect(
      provisionPilotSubscription(request(), {
        client: one.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_REQUIRED' })
    await expect(
      provisionPilotSubscription(request({ workspaceId: 'workspace-wrong' }), {
        client: one.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' })

    const many = createStatefulClient({
      ownedWorkspaces: [owned, { ...owned, id: 'workspace-2' }],
    })
    await expect(
      provisionPilotSubscription(request({ workspaceId: 'workspace-1' }), {
        client: many.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'MULTI_WORKSPACE_OWNER' })

    const archivedOnly = createStatefulClient({
      ownedWorkspaces: [{ ...owned, archivedAt: new Date() }],
    })
    await expect(
      provisionPilotSubscription(request({ workspaceId: 'workspace-1' }), {
        client: archivedOnly.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' })

    const conflictingWorkspace = createStatefulClient({
      ownedWorkspaces: [{ ...owned, subscriptionId: 'different-subscription' }],
    })
    await expect(
      provisionPilotSubscription(request({ workspaceId: 'workspace-1' }), {
        client: conflictingWorkspace.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_SUBSCRIPTION_CONFLICT' })
  })

  it('rejects paid, permanent, and incompatible existing subscriptions', async () => {
    const paid = createStatefulClient({
      subscription: {
        id: 'paid-1',
        plan: SubscriptionPlan.Pro,
        status: SubscriptionStatus.active,
        currentPeriodEnd: expiresAt,
        complimentaryEndsAt: null,
        paymentMethodRequired: true,
        accessSource: SubscriptionAccessSource.STRIPE,
        accessCodeId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        stripeCustomerId: 'redacted-present',
        stripeSubId: 'redacted-present',
      },
    })
    await expect(
      provisionPilotSubscription(request(), {
        client: paid.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'PAID_SUBSCRIPTION_CONFLICT' })

    const permanent = createStatefulClient({
      subscription: {
        id: 'manual-1',
        plan: SubscriptionPlan.Elite,
        status: SubscriptionStatus.active,
        currentPeriodEnd: new Date('2099-12-31T00:00:00.000Z'),
        complimentaryEndsAt: null,
        paymentMethodRequired: false,
        accessSource: SubscriptionAccessSource.ADMIN_OVERRIDE,
        accessCodeId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        stripeCustomerId: null,
        stripeSubId: null,
      },
    })
    await expect(
      provisionPilotSubscription(request(), {
        client: permanent.client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CONFLICT' })
  })

  it('creates one finite grant with durable single-use audit evidence', async () => {
    const { client, state } = createStatefulClient()
    const result = await provisionPilotSubscription(executeRequest(), {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })

    expect(result).toMatchObject({
      status: 'PROVISIONED',
      plan: SubscriptionPlan.Pro,
      expiresAt: expiresAt.toISOString(),
      changed: true,
    })
    expect(client.$queryRaw).toHaveBeenCalledOnce()
    expect(state.accessCode).toMatchObject({
      active: false,
      type: AccessCodeType.INTERNAL_ACCESS,
      plan: SubscriptionPlan.Pro,
      maxUses: 1,
      usesCount: 1,
      perUserLimit: 1,
      complimentaryUntil: expiresAt,
      expiresAt,
    })
    expect(String(state.accessCode?.internalReason)).toContain(
      'release-operator',
    )
    expect(String(state.accessCode?.internalReason)).toContain(
      'Approved controlled pilot',
    )
    expect(state.subscription).toMatchObject({
      plan: SubscriptionPlan.Pro,
      status: SubscriptionStatus.trialing,
      complimentaryEndsAt: expiresAt,
      currentPeriodEnd: expiresAt,
      paymentMethodRequired: false,
      accessSource: SubscriptionAccessSource.ACCESS_CODE,
    })
    expect(state.redemption).toMatchObject({
      accessCodeId: 'access-1',
      userId: 'profile-1',
      workspaceId: null,
      subscriptionId: 'subscription-1',
    })
  })

  it('is idempotent for an identical request and rejects a material change', async () => {
    const { client, state } = createStatefulClient()
    const first = executeRequest()
    await provisionPilotSubscription(first, {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })
    const second = await provisionPilotSubscription(first, {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })
    expect(second.status).toBe('ALREADY_PROVISIONED')
    expect(second.changed).toBe(false)
    expect(state.accessCodeCreates).toBe(1)
    expect(state.subscriptionCreates).toBe(1)
    expect(state.redemptionCreates).toBe(1)

    const changed = executeRequest({ plan: SubscriptionPlan.Elite })
    await expect(
      provisionPilotSubscription(changed, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CONFLICT' })
  })

  it('rejects mismatched trial expiration or audit evidence as partial state', async () => {
    const { client, state } = createStatefulClient()
    const input = executeRequest()
    await provisionPilotSubscription(input, {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })

    state.subscription = {
      ...state.subscription,
      trialEndsAt: new Date(expiresAt.getTime() + 86_400_000),
    }
    await expect(
      provisionPilotSubscription(input, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CONFLICT' })

    state.subscription = {
      ...state.subscription,
      trialEndsAt: expiresAt,
    }
    state.accessCode = {
      ...state.accessCode,
      internalReason: JSON.stringify({
        kind: 'CONTROLLED_PILOT',
        version: 1,
        operator: 'different-operator',
        reason: 'different-reason',
      }),
    }
    await expect(
      provisionPilotSubscription(input, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CONFLICT' })
  })

  it('rolls back all durable changes when redemption creation fails', async () => {
    const { client, state } = createStatefulClient({ failRedemption: true })
    await expect(
      provisionPilotSubscription(executeRequest(), {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toThrow(/simulated redemption failure/)
    expect(state.accessCode).toBeNull()
    expect(state.subscription).toBeNull()
    expect(state.redemption).toBeNull()
    expect(state.accessCodeCreates).toBe(0)
    expect(state.subscriptionCreates).toBe(0)
    expect(state.redemptionCreates).toBe(0)
  })

  it('serializes simultaneous identical requests without a double grant', async () => {
    const { client, state } = createStatefulClient()
    const input = executeRequest()
    const results = await Promise.all([
      provisionPilotSubscription(input, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
      provisionPilotSubscription(input, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([
      'ALREADY_PROVISIONED',
      'PROVISIONED',
    ])
    expect(state.accessCodeCreates).toBe(1)
    expect(state.subscriptionCreates).toBe(1)
    expect(state.redemptionCreates).toBe(1)
  })

  it('serializes conflicting requests and refuses the second grant', async () => {
    const { client, state } = createStatefulClient()
    const first = executeRequest({ plan: SubscriptionPlan.Pro })
    const second = executeRequest({ plan: SubscriptionPlan.Elite })
    const results = await Promise.allSettled([
      provisionPilotSubscription(first, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
      provisionPilotSubscription(second, {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ])

    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      value: { status: 'PROVISIONED', plan: SubscriptionPlan.Pro },
    })
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'SUBSCRIPTION_CONFLICT' }),
    })
    expect(state.subscription).toMatchObject({ plan: SubscriptionPlan.Pro })
    expect(state.accessCodeCreates).toBe(1)
    expect(state.subscriptionCreates).toBe(1)
    expect(state.redemptionCreates).toBe(1)
  })

  it('fails closed on local/remote environment confusion', async () => {
    const { client } = createStatefulClient()
    await expect(
      provisionPilotSubscription(request({ environment: 'production' }), {
        client: client as never,
        now,
        databaseUrl: localDatabaseUrl,
      }),
    ).rejects.toMatchObject({ code: 'ENVIRONMENT_MISMATCH' })
    await expect(
      provisionPilotSubscription(request({ environment: 'local' }), {
        client: client as never,
        now,
        databaseUrl: 'postgresql://example.invalid/skillify',
      }),
    ).rejects.toMatchObject({ code: 'ENVIRONMENT_MISMATCH' })
  })

  it('prints redacted dry-run output and no internal access code', async () => {
    const messages: string[] = []
    await runPilotProvisioningCli(
      [
        '--clerk-user-id',
        'user_PILOT_TARGET_123',
        '--plan',
        'Pro',
        '--expires-at',
        expiresAt.toISOString(),
        '--operator',
        'operator',
        '--reason',
        'reason',
        '--environment',
        'local',
      ],
      {
        now,
        databaseUrl: localDatabaseUrl,
        provision: vi.fn(async (input: PilotProvisioningInput) => ({
          status: 'DRY_RUN' as const,
          userId: 'profile-1',
          plan: input.plan,
          expiresAt: input.expiresAt.toISOString(),
          workspaceId: null,
          environment: input.environment,
          databaseTarget: 'local' as const,
          confirmationToken: 'PROVISION-PILOT-ABC123',
          changed: false,
        })),
        write: (message) => messages.push(message),
      },
    )
    const output = messages.join('\n')
    expect(output).toContain('DRY RUN — NO CHANGES MADE')
    expect(output).toContain('PROVISION-PILOT-ABC123')
    expect(output).not.toContain('profile-1')
    expect(output).not.toContain('user_PILOT_TARGET_123')
    expect(output).not.toContain('INTERNAL-PILOT-')
    expect(output).not.toContain(localDatabaseUrl)
  })

  it('keeps the generated internal authority unusable by public redemption', async () => {
    const { client, state } = createStatefulClient()
    await provisionPilotSubscription(executeRequest(), {
      client: client as never,
      now,
      databaseUrl: localDatabaseUrl,
    })

    expect(
      resolveAccessCode({
        code: String(state.accessCode?.code),
        record: state.accessCode as never,
        selectedPlan: SubscriptionPlan.Pro,
        now,
      }),
    ).toMatchObject({ valid: false, invalidReason: 'inactive' })
  })

  it('leaves the retired script unable to mutate or grant permanent access', () => {
    const oldScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts/force-elite-subscription.ts'),
      'utf8',
    )
    expect(oldScript).toContain('RETIRED')
    expect(oldScript).not.toContain("from '@/lib/db'")
    expect(oldScript).not.toContain('prisma.')
    expect(oldScript).not.toContain('2099')
    expect(oldScript).not.toMatch(/user_[A-Za-z0-9_-]{10,}/)
  })
})
