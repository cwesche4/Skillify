import { useMemo } from 'react'

import {
  countActiveSecondaryFilters,
  type SecondaryFilterValue,
} from '@/lib/listFilters'

type UseClearFiltersOptions = {
  filters: Record<string, SecondaryFilterValue>
  onClear: () => void
}

export function useClearFilters({ filters, onClear }: UseClearFiltersOptions) {
  const activeFilterCount = useMemo(
    () => countActiveSecondaryFilters(filters),
    [filters],
  )

  return {
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    clearFilters: onClear,
  }
}
