import type { BuilderNodeType } from '@/lib/builder/node-types'

const KEY = 'builder:favorites:nodes'

function loadFavorites(): BuilderNodeType[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveFavorites(favs: BuilderNodeType[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(favs))
  } catch {
    // ignore
  }
}

export function getFavorites(): BuilderNodeType[] {
  return loadFavorites()
}

export function toggleFavorite(nodeType: BuilderNodeType): BuilderNodeType[] {
  const current = loadFavorites()
  if (current.includes(nodeType)) {
    const next = current.filter((t) => t !== nodeType)
    saveFavorites(next)
    return next
  }
  const next = [...current, nodeType]
  saveFavorites(next)
  return next
}
