'use client'

export type WorkflowNodeRecentPreference = {
  nodeId: string
  lastUsedAt: string
  useCount: number
}

export type WorkflowNodeDiscoveryPreferences = {
  favorites: string[]
  recent: WorkflowNodeRecentPreference[]
}

const STORAGE_KEY = 'skillify.workflowBuilder.nodeDiscovery.v1'
const RECENT_LIMIT = 20

const emptyPreferences: WorkflowNodeDiscoveryPreferences = {
  favorites: [],
  recent: [],
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function uniqueIds(ids: unknown) {
  if (!Array.isArray(ids)) return []
  return Array.from(
    new Set(
      ids
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  )
}

export function readWorkflowNodeDiscoveryPreferences(): WorkflowNodeDiscoveryPreferences {
  if (!canUseStorage()) return emptyPreferences
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPreferences
    const parsed = JSON.parse(raw) as Partial<WorkflowNodeDiscoveryPreferences>
    return {
      favorites: uniqueIds(parsed.favorites),
      recent: Array.isArray(parsed.recent)
        ? parsed.recent
            .map((item) => ({
              nodeId: String(item?.nodeId ?? '').trim(),
              lastUsedAt: String(item?.lastUsedAt ?? ''),
              useCount: Number.isFinite(Number(item?.useCount))
                ? Number(item?.useCount)
                : 0,
            }))
            .filter((item) => item.nodeId)
            .slice(0, RECENT_LIMIT)
        : [],
    }
  } catch {
    return emptyPreferences
  }
}

export function writeWorkflowNodeDiscoveryPreferences(
  preferences: WorkflowNodeDiscoveryPreferences,
) {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      favorites: uniqueIds(preferences.favorites),
      recent: preferences.recent.slice(0, RECENT_LIMIT),
    }),
  )
}

export function toggleWorkflowNodeFavorite(
  preferences: WorkflowNodeDiscoveryPreferences,
  nodeId: string,
): WorkflowNodeDiscoveryPreferences {
  const favorites = new Set(preferences.favorites)
  if (favorites.has(nodeId)) {
    favorites.delete(nodeId)
  } else {
    favorites.add(nodeId)
  }
  return {
    ...preferences,
    favorites: Array.from(favorites),
  }
}

export function recordWorkflowNodeRecentUse(
  preferences: WorkflowNodeDiscoveryPreferences,
  nodeId: string,
  now = new Date(),
): WorkflowNodeDiscoveryPreferences {
  const existing = new Map(
    preferences.recent.map((item) => [item.nodeId, item]),
  )
  const previous = existing.get(nodeId)
  existing.set(nodeId, {
    nodeId,
    lastUsedAt: now.toISOString(),
    useCount: (previous?.useCount ?? 0) + 1,
  })

  return {
    ...preferences,
    recent: Array.from(existing.values())
      .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
      .slice(0, RECENT_LIMIT),
  }
}
