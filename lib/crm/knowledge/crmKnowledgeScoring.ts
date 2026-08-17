import type { CRMKnowledgeThresholds } from '@/lib/crm/knowledge/crmKnowledgeTypes'

export const CRM_KNOWLEDGE_THRESHOLDS: CRMKnowledgeThresholds = {
  staleLeadDays: 14,
  staleOpportunityDays: 21,
  dueSoonDays: 3,
  highValueLeadThreshold: 5_000,
  highValueOpportunityThreshold: 10_000,
  sourcePerformanceMinimumSample: 5,
  maxRecommendations: 25,
}

export function resolveCRMKnowledgeThresholds(
  thresholds?: Partial<CRMKnowledgeThresholds>,
): CRMKnowledgeThresholds {
  return {
    ...CRM_KNOWLEDGE_THRESHOLDS,
    ...thresholds,
  }
}

export function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function toDateOrNull(value?: Date | string | null): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dateKeyInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = toDateOrNull(dateKey)
  if (!date) return dateKey
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function compareDateKeys(first?: string, second?: string) {
  const firstKey = normalizeDateKey(first)
  const secondKey = normalizeDateKey(second)
  if (!firstKey && !secondKey) return 0
  if (!firstKey) return 1
  if (!secondKey) return -1
  return firstKey.localeCompare(secondKey)
}

export function normalizeDateKey(value?: string) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = toDateOrNull(value)
  return date ? date.toISOString().slice(0, 10) : null
}

export function daysBetweenDateKeys(first: string, second: string) {
  const firstDate = toDateOrNull(first)
  const secondDate = toDateOrNull(second)
  if (!firstDate || !secondDate) return 0
  return Math.floor(
    (secondDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000),
  )
}

export function daysSince(value: string | undefined, todayKey: string) {
  const dateKey = normalizeDateKey(value)
  if (!dateKey) return null
  return daysBetweenDateKeys(dateKey, todayKey)
}

export function isBlank(value?: string | null) {
  return !value || value.trim().length === 0
}

export function incrementCount(
  map: Record<string, number>,
  key?: string | null,
) {
  const normalizedKey = isBlank(key) ? 'Unspecified' : key!.trim()
  map[normalizedKey] = (map[normalizedKey] ?? 0) + 1
}

export function addCurrency(
  map: Record<string, { count: number; value: number }>,
  key: string | undefined,
  value: number,
) {
  const normalizedKey = isBlank(key) ? 'Unspecified' : key!.trim()
  const current = map[normalizedKey] ?? { count: 0, value: 0 }
  map[normalizedKey] = {
    count: current.count + 1,
    value: current.value + (Number.isFinite(value) ? value : 0),
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

export function sortByScoreThenId<
  T extends { score: number; targetRecordId?: string; id: string },
>(items: T[]) {
  return [...items].sort((first, second) => {
    if (second.score !== first.score) return second.score - first.score
    return (first.targetRecordId ?? first.id).localeCompare(
      second.targetRecordId ?? second.id,
    )
  })
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort()
}
