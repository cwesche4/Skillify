export type AIPlaygroundRuntimeEvent = {
  id: string
  type: string
  requestId?: string
  createdAt?: string
  metadata?: Record<string, unknown>
}

export function normalizeRuntimeEvents(
  value: unknown,
): AIPlaygroundRuntimeEvent[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const event = normalizeRuntimeEvent(item)
      return event ? [event] : []
    })
  }

  if (isPlainRecord(value)) {
    if (Array.isArray(value.events)) return normalizeRuntimeEvents(value.events)
    if (Array.isArray(value.runtimeEvents)) {
      return normalizeRuntimeEvents(value.runtimeEvents)
    }

    const event = normalizeRuntimeEvent(value)
    return event ? [event] : []
  }

  return []
}

function normalizeRuntimeEvent(
  value: unknown,
): AIPlaygroundRuntimeEvent | null {
  if (!isPlainRecord(value)) return null
  if (typeof value.id !== 'string' || !value.id.trim()) return null
  if (typeof value.type !== 'string' || !value.type.trim()) return null

  return {
    id: value.id,
    type: value.type,
    requestId:
      typeof value.requestId === 'string' ? value.requestId : undefined,
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : undefined,
    metadata: isPlainRecord(value.metadata) ? value.metadata : undefined,
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
