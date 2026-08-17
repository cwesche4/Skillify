type ViewState = {
  zoom: number
  position: { x: number; y: number }
  inspectorOpen: boolean
  selectedNodeIds: string[]
}

const KEY_PREFIX = 'builder:view:'

function key(automationId: string, userId: string) {
  return `${KEY_PREFIX}${automationId}:${userId}`
}

export function saveViewState(
  automationId: string,
  userId: string,
  state: ViewState,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify(state)
    window.localStorage.setItem(key(automationId, userId), payload)
  } catch {
    // ignore storage errors
  }
}

export function loadViewState(
  automationId: string,
  userId: string,
): ViewState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(automationId, userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.zoom === 'number' &&
      parsed.position &&
      typeof parsed.position.x === 'number' &&
      typeof parsed.position.y === 'number' &&
      typeof parsed.inspectorOpen === 'boolean' &&
      Array.isArray(parsed.selectedNodeIds)
    ) {
      return parsed as ViewState
    }
  } catch {
    // ignore parse/storage errors
  }
  return null
}
