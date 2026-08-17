import {
  AccessCodeType,
  SubscriptionAccessSource,
  SubscriptionPlan,
  type AccessCodeType as AccessCodeTypeValue,
  type SubscriptionAccessSource as SubscriptionAccessSourceValue,
} from '@/lib/prisma/enums'
import {
  DEFAULT_TRIAL_DAYS,
  PAYMENT_METHOD_REQUIRED_DURING_TRIAL,
  normalizeBillingPlan,
  type BillingPlanId,
} from '@/lib/billing/plans'

export type AccessCodeRecord = {
  id: string
  code: string
  active: boolean
  type: AccessCodeTypeValue
  plan?: SubscriptionPlan | null
  discountPercent?: number | null
  discountAmountCents?: number | null
  trialDaysOverride?: number | null
  complimentaryDays?: number | null
  complimentaryUntil?: Date | string | null
  paymentMethodRequired?: boolean | null
  maxUses?: number | null
  usesCount?: number | null
  perUserLimit?: number | null
  startsAt?: Date | string | null
  expiresAt?: Date | string | null
  internalReason?: string | null
}

export type ResolvedAccess = {
  valid: boolean
  plan: BillingPlanId
  trialDays: number
  paymentMethodRequired: boolean
  accessSource: SubscriptionAccessSourceValue
  accessCodeId?: string
  discountPercent?: number
  discountAmountCents?: number
  complimentaryEndsAt?: Date | null
  message: string
  invalidReason?:
    | 'invalid'
    | 'inactive'
    | 'expired'
    | 'not_started'
    | 'usage_limit'
    | 'plan_restricted'
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function normalizeAccessCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

export function resolveAccessCode({
  code,
  record,
  selectedPlan,
  userUses = 0,
  now = new Date(),
}: {
  code?: string | null
  record?: AccessCodeRecord | null
  selectedPlan: BillingPlanId | string
  userUses?: number
  now?: Date
}): ResolvedAccess {
  const plan = normalizeBillingPlan(selectedPlan)
  const normalizedCode = normalizeAccessCode(code)

  const base: ResolvedAccess = {
    valid: false,
    plan,
    trialDays: DEFAULT_TRIAL_DAYS,
    paymentMethodRequired: PAYMENT_METHOD_REQUIRED_DURING_TRIAL,
    accessSource: SubscriptionAccessSource.NORMAL_TRIAL,
    message: 'That code is invalid or no longer available.',
    invalidReason: 'invalid',
  }

  if (!normalizedCode || !record) return base
  if (!record.active) return { ...base, invalidReason: 'inactive' }

  const startsAt = asDate(record.startsAt)
  const expiresAt = asDate(record.expiresAt)
  if (startsAt && startsAt.getTime() > now.getTime()) {
    return { ...base, invalidReason: 'not_started' }
  }
  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    return { ...base, invalidReason: 'expired' }
  }
  if (record.maxUses !== null && record.maxUses !== undefined) {
    if ((record.usesCount ?? 0) >= record.maxUses) {
      return { ...base, invalidReason: 'usage_limit' }
    }
  }
  if (record.perUserLimit !== null && record.perUserLimit !== undefined) {
    if (userUses >= record.perUserLimit) {
      return { ...base, invalidReason: 'usage_limit' }
    }
  }
  if (record.plan && record.plan !== plan) {
    return { ...base, invalidReason: 'plan_restricted' }
  }

  const trialDays =
    typeof record.trialDaysOverride === 'number' && record.trialDaysOverride > 0
      ? Math.floor(record.trialDaysOverride)
      : DEFAULT_TRIAL_DAYS
  const paymentMethodRequired =
    typeof record.paymentMethodRequired === 'boolean'
      ? record.paymentMethodRequired
      : PAYMENT_METHOD_REQUIRED_DURING_TRIAL
  const complimentaryUntil = asDate(record.complimentaryUntil)
  const complimentaryEndsAt =
    record.type === AccessCodeType.COMPLIMENTARY_ACCESS ||
    record.type === AccessCodeType.INTERNAL_ACCESS
      ? (complimentaryUntil ??
        (typeof record.complimentaryDays === 'number' &&
        record.complimentaryDays > 0
          ? addDays(now, Math.floor(record.complimentaryDays))
          : null))
      : null

  const message =
    record.type === AccessCodeType.COMPLIMENTARY_ACCESS
      ? complimentaryEndsAt
        ? `Complimentary access applied through ${complimentaryEndsAt.toLocaleDateString('en-US')}.`
        : 'Complimentary access applied.'
      : record.type === AccessCodeType.INTERNAL_ACCESS
        ? 'Internal access applied.'
        : trialDays !== DEFAULT_TRIAL_DAYS
          ? `${trialDays}-day trial applied.`
          : record.discountPercent
            ? `${record.discountPercent}% discount applied.`
            : record.discountAmountCents
              ? 'Discount applied.'
              : 'Access code applied.'

  return {
    valid: true,
    plan,
    trialDays,
    paymentMethodRequired,
    accessSource: SubscriptionAccessSource.ACCESS_CODE,
    accessCodeId: record.id,
    discountPercent: record.discountPercent ?? undefined,
    discountAmountCents: record.discountAmountCents ?? undefined,
    complimentaryEndsAt,
    message,
  }
}

export function resolveDefaultAccess(
  plan: BillingPlanId | string,
): ResolvedAccess {
  return {
    valid: true,
    plan: normalizeBillingPlan(plan),
    trialDays: DEFAULT_TRIAL_DAYS,
    paymentMethodRequired: PAYMENT_METHOD_REQUIRED_DURING_TRIAL,
    accessSource: SubscriptionAccessSource.NORMAL_TRIAL,
    message: `${DEFAULT_TRIAL_DAYS}-day trial. $0 today.`,
  }
}
