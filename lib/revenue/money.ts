export const DEFAULT_REVENUE_CURRENCY = 'USD'

export function dollarsToCents(value: number | string | null | undefined) {
  const parsed =
    typeof value === 'string' ? Number(value.trim()) : Number(value ?? 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed * 100)
}

export function centsToDollars(cents: number | null | undefined) {
  const parsed = Number(cents ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed) / 100
}

export function normalizeAmountCents(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed)
}

export function formatRevenueCurrency(
  cents: number | null | undefined,
  currency = DEFAULT_REVENUE_CURRENCY,
) {
  const normalizedCents = Math.round(Number(cents ?? 0))
  const hasMinorUnits = Math.abs(normalizedCents) % 100 !== 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasMinorUnits ? 2 : 0,
    maximumFractionDigits: hasMinorUnits ? 2 : 0,
  }).format(centsToDollars(normalizedCents))
}
