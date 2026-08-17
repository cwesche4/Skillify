import { useEffect, useState } from 'react'
import type { BuilderNodeType } from '@/lib/builder/node-types'
import { getFavorites, toggleFavorite } from './store'

export function useFavorites() {
  const [favorites, setFavorites] = useState<BuilderNodeType[]>([])

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  const toggle = (type: BuilderNodeType) => {
    const next = toggleFavorite(type)
    setFavorites(next)
  }

  return { favorites, toggle }
}
