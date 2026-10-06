import { createHash } from 'node:crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  AccessCodeType,
  SubscriptionAccessSource,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/lib/prisma/enums'

const DAY_MS = 24 * 60 * 60 * 1000

export const PILOT_MAX_DURATION_DAYS = 90
export const PILOT_PRODUCTION_CONFIRMATION = 'I-UNDERSTAND-PRODUCTION'

export type PilotPlan =
  | typeof SubscriptionPlan.Basic
  | typeof SubscriptionPlan.Pro
  | typeof SubscriptionPlan.Elite

export type PilotEnvironment = 'local' | 'staging' | 'production'

export type PilotProvisioningInput = {
  clerkUserId: string
  plan: PilotPlan
  expiresAt: Date
  operator: string
  reason: string
  workspaceId?: string
  environment: PilotEnvironment
  execute: boolean
  confirmation?: string
  productionConfirmation?: string
}

export type PilotProvisioningResult = {
  status: 'DRY_RUN' | 'PROVISIONED' | 'ALREADY_PROVISIONED'
  userId: string
  plan: PilotPlan
  expiresAt: string
  workspaceId: string | null
  environment: PilotEnvironment
  databaseTarget: 'local' | 'remote'
  confirmationToken: string
  changed: boolean
}

type PilotUser = {
  id: string
  clerkId: string
  fullName: string | null
  email: string | null
  subscription: PilotSubscription | null
  ownedWorkspaces: Array<{
    id: string
    ownerId: string
    subscriptionId: string | null
    archivedAt: Date | null
  }>
}

type PilotSubscription = {
  id: string
  plan: string
  status: string
  trialEndsAt: Date | null
  complimentaryEndsAt: Date | null
  currentPeriodEnd: Date
  paymentMethodRequired: boolean
  accessSource: string
  accessCodeId: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  stripeCustomerId: string | null
  stripeSubId: string | null
}

type PilotAccessCode = {
  id: string
  code: string
  active: boolean
  type: string
  plan: string | null
  complimentaryUntil: Date | null
  paymentMethodRequired: boolean | null
  maxUses: number | null
  usesCount: number
  perUserLimit: number | null
  expiresAt: Date | null
  internalReason: string | null
  redemptions: Array<{
    userId: string
    workspaceId: string | null
    subscriptionId: string | null
  }>
}

type PilotTransaction = Pick<
  typeof prisma,
  | 'userProfile'
  | 'workspace'
  | 'subscription'
  | 'accessCode'
  | 'accessCodeRedemption'
  | '$queryRaw'
>

export class PilotProvisioningError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PilotProvisioningError'
  }
}

function requireBoundedText(
  value: string | undefined,
  label: string,
  maxLength: number,
) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new PilotProvisioningError(
      `INVALID_${label.toUpperCase()}`,
      `${label} is required.`,
    )
  }
  if (normalized.length > maxLength) {
    throw new PilotProvisioningError(
      `INVALID_${label.toUpperCase()}`,
      `${label} must be ${maxLength} characters or fewer.`,
    )
  }
  return normalized
}

export function parsePilotPlan(value: string | undefined): PilotPlan {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'basic') return SubscriptionPlan.Basic
  if (normalized === 'pro') return SubscriptionPlan.Pro
  if (normalized === 'elite') return SubscriptionPlan.Elite
  throw new PilotProvisioningError(
    'INVALID_PLAN',
    'plan must be exactly Basic, Pro, or Elite.',
  )
}

export function parsePilotExpiration(
  value: string | undefined,
  now = new Date(),
) {
  const raw = String(value ?? '').trim()
  const expiresAt = new Date(raw)
  if (!raw || Number.isNaN(expiresAt.getTime())) {
    throw new PilotProvisioningError(
      'INVALID_EXPIRATION',
      'expires-at must be a valid ISO timestamp.',
    )
  }
  if (expiresAt.getTime() <= now.getTime()) {
    throw new PilotProvisioningError(
      'INVALID_EXPIRATION',
      'expires-at must be in the future.',
    )
  }
  if (expiresAt.getTime() - now.getTime() > PILOT_MAX_DURATION_DAYS * DAY_MS) {
    throw new PilotProvisioningError(
      'INVALID_EXPIRATION',
      `expires-at must be no more than ${PILOT_MAX_DURATION_DAYS} days in the future.`,
    )
  }
  if (expiresAt.getUTCFullYear() >= 2099) {
    throw new PilotProvisioningError(
      'INVALID_EXPIRATION',
      'Permanent or sentinel expirations are not allowed.',
    )
  }
  return expiresAt
}

export function parsePilotEnvironment(
  value: string | undefined,
): PilotEnvironment {
  if (value === 'local' || value === 'staging' || value === 'production') {
    return value
  }
  throw new PilotProvisioningError(
    'INVALID_ENVIRONMENT',
    'environment must be exactly local, staging, or production.',
  )
}

export function classifyDatabaseTarget(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new PilotProvisioningError(
      'DATABASE_TARGET_UNKNOWN',
      'DATABASE_URL is required; no environment fallback is allowed.',
    )
  }

  let hostname: string
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    throw new PilotProvisioningError(
      'DATABASE_TARGET_UNKNOWN',
      'DATABASE_URL cannot be classified safely.',
    )
  }

  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
    ? ('local' as const)
    : ('remote' as const)
}

export function assertEnvironmentTarget(
  environment: PilotEnvironment,
  databaseTarget: 'local' | 'remote',
) {
  if (environment === 'local' && databaseTarget !== 'local') {
    throw new PilotProvisioningError(
      'ENVIRONMENT_MISMATCH',
      'A local operation cannot target a remote database.',
    )
  }
  if (environment !== 'local' && databaseTarget !== 'remote') {
    throw new PilotProvisioningError(
      'ENVIRONMENT_MISMATCH',
      `${environment} cannot target a local database.`,
    )
  }
}

function canonicalGrantIdentity(input: {
  userId: string
  plan: PilotPlan
  expiresAt: Date
  workspaceId: string | null
  operator: string
  reason: string
}) {
  return JSON.stringify([
    'CONTROLLED_PILOT_V1',
    input.userId,
    input.plan,
    input.expiresAt.toISOString(),
    input.workspaceId ?? 'PRE_WORKSPACE',
    input.operator,
    input.reason,
  ])
}

export function getPilotConfirmationToken(input: {
  clerkUserId: string
  plan: PilotPlan
  expiresAt: Date
  workspaceId?: string
  environment: PilotEnvironment
  operator: string
  reason: string
}) {
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        'PROVISION_PILOT_V1',
        input.clerkUserId,
        input.plan,
        input.expiresAt.toISOString(),
        input.workspaceId ?? 'PRE_WORKSPACE',
        input.environment,
        input.operator.trim(),
        input.reason.trim(),
      ]),
    )
    .digest('hex')
    .slice(0, 16)
    .toUpperCase()
  return `PROVISION-PILOT-${digest}`
}

function getInternalCode(grantIdentity: string) {
  return `INTERNAL-PILOT-${createHash('sha256')
    .update(grantIdentity)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase()}`
}

function getAuditReason(input: { operator: string; reason: string }) {
  return JSON.stringify({
    kind: 'CONTROLLED_PILOT',
    version: 1,
    operator: input.operator,
    reason: input.reason,
  })
}

function sameInstant(left: Date | null, right: Date) {
  return left?.getTime() === right.getTime()
}

function assertWorkspaceBoundary(
  user: PilotUser,
  requestedWorkspaceId: string | undefined,
) {
  const activeOwned = user.ownedWorkspaces.filter(
    (workspace) => workspace.archivedAt === null,
  )
  if (activeOwned.length > 1) {
    throw new PilotProvisioningError(
      'MULTI_WORKSPACE_OWNER',
      'Pilot provisioning is refused because this user owns multiple active workspaces and the user-level subscription cannot be scoped safely.',
    )
  }
  if (activeOwned.length === 0) {
    if (requestedWorkspaceId) {
      throw new PilotProvisioningError(
        'WORKSPACE_MISMATCH',
        'The requested workspace is not an active workspace owned by the target user.',
      )
    }
    return null
  }

  const workspace = activeOwned[0]
  if (!requestedWorkspaceId) {
    throw new PilotProvisioningError(
      'WORKSPACE_REQUIRED',
      'workspace-id is required when the target user already owns a workspace.',
    )
  }
  if (workspace.id !== requestedWorkspaceId || workspace.ownerId !== user.id) {
    throw new PilotProvisioningError(
      'WORKSPACE_MISMATCH',
      'The requested workspace is not the target user’s sole active owned workspace.',
    )
  }
  if (
    workspace.subscriptionId &&
    workspace.subscriptionId !== user.subscription?.id
  ) {
    throw new PilotProvisioningError(
      'WORKSPACE_SUBSCRIPTION_CONFLICT',
      'The workspace already references a different subscription authority.',
    )
  }
  return workspace.id
}

function isMatchingGrant(input: {
  user: PilotUser
  accessCode: PilotAccessCode | null
  plan: PilotPlan
  expiresAt: Date
  workspaceId: string | null
  operator: string
  reason: string
}) {
  const subscription = input.user.subscription
  const accessCode = input.accessCode
  if (!subscription || !accessCode) return false
  if (accessCode.redemptions.length !== 1) return false
  const redemption = accessCode.redemptions[0]

  return (
    subscription.plan === input.plan &&
    subscription.status === SubscriptionStatus.trialing &&
    sameInstant(subscription.trialEndsAt, input.expiresAt) &&
    sameInstant(subscription.complimentaryEndsAt, input.expiresAt) &&
    subscription.currentPeriodEnd.getTime() === input.expiresAt.getTime() &&
    subscription.paymentMethodRequired === false &&
    subscription.accessSource === SubscriptionAccessSource.ACCESS_CODE &&
    subscription.accessCodeId === accessCode.id &&
    subscription.cancelAtPeriodEnd === false &&
    subscription.canceledAt === null &&
    subscription.stripeCustomerId === null &&
    subscription.stripeSubId === null &&
    accessCode.active === false &&
    accessCode.type === AccessCodeType.INTERNAL_ACCESS &&
    accessCode.plan === input.plan &&
    sameInstant(accessCode.complimentaryUntil, input.expiresAt) &&
    accessCode.paymentMethodRequired === false &&
    accessCode.maxUses === 1 &&
    accessCode.usesCount === 1 &&
    accessCode.perUserLimit === 1 &&
    sameInstant(accessCode.expiresAt, input.expiresAt) &&
    accessCode.internalReason ===
      getAuditReason({ operator: input.operator, reason: input.reason }) &&
    redemption.userId === input.user.id &&
    redemption.workspaceId === input.workspaceId &&
    redemption.subscriptionId === subscription.id
  )
}

function assertNoConflictingSubscription(
  user: PilotUser,
  accessCode: PilotAccessCode | null,
  request: {
    plan: PilotPlan
    expiresAt: Date
    workspaceId: string | null
    operator: string
    reason: string
  },
) {
  if (!user.subscription && !accessCode) return
  if (isMatchingGrant({ user, accessCode, ...request })) return

  if (
    user.subscription?.stripeCustomerId ||
    user.subscription?.stripeSubId ||
    user.subscription?.accessSource === SubscriptionAccessSource.STRIPE
  ) {
    throw new PilotProvisioningError(
      'PAID_SUBSCRIPTION_CONFLICT',
      'An existing paid subscription cannot be overwritten by pilot provisioning.',
    )
  }
  throw new PilotProvisioningError(
    'SUBSCRIPTION_CONFLICT',
    'Existing subscription or pilot authority differs from this request; no changes were made.',
  )
}

const userSelection = {
  id: true,
  clerkId: true,
  fullName: true,
  email: true,
  subscription: {
    select: {
      id: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      complimentaryEndsAt: true,
      currentPeriodEnd: true,
      paymentMethodRequired: true,
      accessSource: true,
      accessCodeId: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      stripeCustomerId: true,
      stripeSubId: true,
    },
  },
  ownedWorkspaces: {
    select: {
      id: true,
      ownerId: true,
      subscriptionId: true,
      archivedAt: true,
    },
  },
} as const

async function findAccessCode(
  db: PilotTransaction,
  code: string,
  userId: string,
) {
  return db.accessCode.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      active: true,
      type: true,
      plan: true,
      complimentaryUntil: true,
      paymentMethodRequired: true,
      maxUses: true,
      usesCount: true,
      perUserLimit: true,
      expiresAt: true,
      internalReason: true,
      redemptions: {
        where: { userId },
        select: {
          userId: true,
          workspaceId: true,
          subscriptionId: true,
        },
        take: 2,
      },
    },
  }) as Promise<PilotAccessCode | null>
}

function validateInput(input: PilotProvisioningInput, now: Date) {
  const clerkUserId = requireBoundedText(
    input.clerkUserId,
    'clerk-user-id',
    128,
  )
  if (!/^user_[A-Za-z0-9_-]+$/.test(clerkUserId)) {
    throw new PilotProvisioningError(
      'INVALID_CLERK_USER_ID',
      'clerk-user-id must be an exact Clerk user identifier.',
    )
  }
  const operator = requireBoundedText(input.operator, 'operator', 100)
  const reason = requireBoundedText(input.reason, 'reason', 240)
  const workspaceId = input.workspaceId
    ? requireBoundedText(input.workspaceId, 'workspace-id', 128)
    : undefined
  if (Number.isNaN(input.expiresAt.getTime())) {
    throw new PilotProvisioningError(
      'INVALID_EXPIRATION',
      'expires-at must be a valid ISO timestamp.',
    )
  }
  parsePilotExpiration(input.expiresAt.toISOString(), now)
  if (
    input.plan !== SubscriptionPlan.Basic &&
    input.plan !== SubscriptionPlan.Pro &&
    input.plan !== SubscriptionPlan.Elite
  ) {
    throw new PilotProvisioningError('INVALID_PLAN', 'Unsupported pilot plan.')
  }
  return {
    ...input,
    clerkUserId,
    operator,
    reason,
    workspaceId,
  }
}

function makeResult(input: {
  status: PilotProvisioningResult['status']
  userId: string
  request: PilotProvisioningInput
  workspaceId: string | null
  databaseTarget: 'local' | 'remote'
  confirmationToken: string
}) {
  return {
    status: input.status,
    userId: input.userId,
    plan: input.request.plan,
    expiresAt: input.request.expiresAt.toISOString(),
    workspaceId: input.workspaceId,
    environment: input.request.environment,
    databaseTarget: input.databaseTarget,
    confirmationToken: input.confirmationToken,
    changed: input.status === 'PROVISIONED',
  } satisfies PilotProvisioningResult
}

export async function provisionPilotSubscription(
  rawInput: PilotProvisioningInput,
  options: {
    now?: Date
    databaseUrl?: string
    client?: typeof prisma
  } = {},
): Promise<PilotProvisioningResult> {
  const now = options.now ?? new Date()
  const input = validateInput(rawInput, now)
  const databaseTarget = classifyDatabaseTarget(
    options.databaseUrl ?? process.env.DATABASE_URL,
  )
  assertEnvironmentTarget(input.environment, databaseTarget)
  const confirmationToken = getPilotConfirmationToken(input)
  const client = options.client ?? prisma

  if (input.execute) {
    if (input.confirmation !== confirmationToken) {
      throw new PilotProvisioningError(
        'CONFIRMATION_REQUIRED',
        `Execution requires --confirm ${confirmationToken}.`,
      )
    }
    if (
      input.environment === 'production' &&
      input.productionConfirmation !== PILOT_PRODUCTION_CONFIRMATION
    ) {
      throw new PilotProvisioningError(
        'PRODUCTION_CONFIRMATION_REQUIRED',
        `Production execution requires --confirm-production ${PILOT_PRODUCTION_CONFIRMATION}.`,
      )
    }
  }

  if (!input.execute) {
    const user = (await client.userProfile.findUnique({
      where: { clerkId: input.clerkUserId },
      select: userSelection,
    })) as PilotUser | null
    if (!user) {
      throw new PilotProvisioningError(
        'USER_NOT_FOUND',
        'No UserProfile matches the exact Clerk user identifier.',
      )
    }
    const workspaceId = assertWorkspaceBoundary(user, input.workspaceId)
    const grantIdentity = canonicalGrantIdentity({
      userId: user.id,
      plan: input.plan,
      expiresAt: input.expiresAt,
      workspaceId,
      operator: input.operator,
      reason: input.reason,
    })
    const accessCode = await findAccessCode(
      client,
      getInternalCode(grantIdentity),
      user.id,
    )
    assertNoConflictingSubscription(user, accessCode, {
      plan: input.plan,
      expiresAt: input.expiresAt,
      workspaceId,
      operator: input.operator,
      reason: input.reason,
    })
    return makeResult({
      status: isMatchingGrant({
        user,
        accessCode,
        plan: input.plan,
        expiresAt: input.expiresAt,
        workspaceId,
        operator: input.operator,
        reason: input.reason,
      })
        ? 'ALREADY_PROVISIONED'
        : 'DRY_RUN',
      userId: user.id,
      request: input,
      workspaceId,
      databaseTarget,
      confirmationToken,
    })
  }

  return client.$transaction(async (tx) => {
    const initial = await tx.userProfile.findUnique({
      where: { clerkId: input.clerkUserId },
      select: { id: true },
    })
    if (!initial) {
      throw new PilotProvisioningError(
        'USER_NOT_FOUND',
        'No UserProfile matches the exact Clerk user identifier.',
      )
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "UserProfile" WHERE "id" = ${initial.id} FOR UPDATE`,
    )
    const user = (await tx.userProfile.findUnique({
      where: { id: initial.id },
      select: userSelection,
    })) as PilotUser | null
    if (!user || user.clerkId !== input.clerkUserId) {
      throw new PilotProvisioningError(
        'USER_CHANGED',
        'The target user changed during validation.',
      )
    }

    const workspaceId = assertWorkspaceBoundary(user, input.workspaceId)
    const grantIdentity = canonicalGrantIdentity({
      userId: user.id,
      plan: input.plan,
      expiresAt: input.expiresAt,
      workspaceId,
      operator: input.operator,
      reason: input.reason,
    })
    const code = getInternalCode(grantIdentity)
    const existingCode = await findAccessCode(tx, code, user.id)
    assertNoConflictingSubscription(user, existingCode, {
      plan: input.plan,
      expiresAt: input.expiresAt,
      workspaceId,
      operator: input.operator,
      reason: input.reason,
    })
    if (
      isMatchingGrant({
        user,
        accessCode: existingCode,
        plan: input.plan,
        expiresAt: input.expiresAt,
        workspaceId,
        operator: input.operator,
        reason: input.reason,
      })
    ) {
      return makeResult({
        status: 'ALREADY_PROVISIONED',
        userId: user.id,
        request: input,
        workspaceId,
        databaseTarget,
        confirmationToken,
      })
    }

    const accessCode = await tx.accessCode.create({
      data: {
        code,
        active: false,
        type: AccessCodeType.INTERNAL_ACCESS,
        plan: input.plan,
        complimentaryUntil: input.expiresAt,
        paymentMethodRequired: false,
        maxUses: 1,
        usesCount: 1,
        perUserLimit: 1,
        startsAt: now,
        expiresAt: input.expiresAt,
        internalReason: getAuditReason(input),
        notes:
          'Single-user controlled pilot authority; not customer redeemable.',
      },
    })
    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        subscriberName: user.fullName,
        subscriberEmail: user.email,
        plan: input.plan,
        status: SubscriptionStatus.trialing,
        trialEndsAt: input.expiresAt,
        complimentaryEndsAt: input.expiresAt,
        paymentMethodRequired: false,
        accessSource: SubscriptionAccessSource.ACCESS_CODE,
        accessCodeId: accessCode.id,
        accessReason: 'Controlled pilot provisioning',
        currentPeriodStart: now,
        currentPeriodEnd: input.expiresAt,
        cancelAtPeriodEnd: false,
      },
    })
    await tx.accessCodeRedemption.create({
      data: {
        accessCodeId: accessCode.id,
        userId: user.id,
        workspaceId,
        subscriptionId: subscription.id,
        redeemedAt: now,
      },
    })

    return makeResult({
      status: 'PROVISIONED',
      userId: user.id,
      request: input,
      workspaceId,
      databaseTarget,
      confirmationToken,
    })
  })
}
