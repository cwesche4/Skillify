export type SecondaryFilterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>

export function countActiveSecondaryFilters(
  filters: Record<string, SecondaryFilterValue>,
) {
  return Object.values(filters).filter((value) => {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.trim() !== '' && value !== 'ALL'
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'boolean') return value
    return value != null
  }).length
}
