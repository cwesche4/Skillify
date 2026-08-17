import type { Node, Edge } from 'reactflow'

export type MicroPattern = {
  id: string
  name: string
  description?: string
  purpose?: string
  inputs?: string[]
  outputs?: string[]
  nodes: Node[]
  edges: Edge[]
  createdAt: string
}

const KEY = 'builder:micro-patterns'

function loadPatterns(): MicroPattern[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function savePatterns(patterns: MicroPattern[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(patterns))
  } catch {
    // ignore storage errors
  }
}

export function getPatterns(): MicroPattern[] {
  return loadPatterns()
}

export function savePattern(pattern: MicroPattern) {
  const existing = loadPatterns()
  savePatterns([...existing, pattern])
}
