import { useMemo } from 'react'

export function useMemoizedArray<T>(items: T[]): T[] {
  return useMemo(() => items, [items])
}
