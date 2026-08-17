'use client'

type HistoryEntry = {
  id: string
  summary: string
  createdAt: number
  undone?: boolean
  undo: () => void
}

type Listener = () => void

const history: HistoryEntry[] = []
const listeners = new Set<Listener>()
const undoneIds = new Set<string>()

function notify() {
  listeners.forEach((l) => l())
}

export function logAiAction(summary: string, undo: () => void) {
  const entry: HistoryEntry = {
    id: `${Date.now()}:${history.length}`,
    summary,
    createdAt: Date.now(),
    undo,
  }
  history.push(entry)
  notify()
  return entry.id
}

export function getActionHistory() {
  return history.slice()
}

export function subscribeActionHistory(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function undoLastAction() {
  const idx = [...history]
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .find(({ entry }) => !undoneIds.has(entry.id))
  if (!idx) return false
  const { entry } = idx
  try {
    entry.undo()
    undoneIds.add(entry.id)
    history.push({
      id: `undo:${entry.id}:${Date.now()}`,
      summary: `Undid: ${entry.summary}`,
      createdAt: Date.now(),
      undo: () => {},
      undone: true,
    })
    notify()
    return true
  } catch {
    return false
  }
}
