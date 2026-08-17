'use client'

import { create } from 'zustand'

export type VisualGroup = {
  id: string
  name?: string
  nodeIds: string[]
  collapsed: boolean
}

type State = {
  groups: VisualGroup[]
  createGroup: (nodeIds: string[], name?: string) => void
  toggleGroup: (id: string) => void
}

// Visual grouping only.
// Groups must not affect execution, routing, compatibility, or persistence.
export const useGroupStore = create<State>((set) => ({
  groups: [],
  createGroup: (nodeIds, name) =>
    set((state) => {
      if (nodeIds.length < 2) return state
      const exists = state.groups.find(
        (g) => g.nodeIds.join(',') === nodeIds.join(','),
      )
      if (exists) return state
      return {
        groups: [
          ...state.groups,
          {
            id: crypto.randomUUID(),
            name,
            nodeIds: [...nodeIds],
            collapsed: false,
          },
        ],
      }
    }),
  toggleGroup: (id) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === id ? { ...g, collapsed: !g.collapsed } : g,
      ),
    })),
}))
