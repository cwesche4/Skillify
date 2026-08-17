import { nanoid } from 'nanoid'
import { create } from 'zustand'

export type FlowSection = {
  id: string
  name: string
  rect: { x: number; y: number; width: number; height: number }
}

type State = {
  sections: FlowSection[]
  addSection: (name: string, rect: FlowSection['rect']) => void
  updateSection: (id: string, rect: FlowSection['rect']) => void
  renameSection: (id: string, name: string) => void
  removeSection: (id: string) => void
}

// Flow sections.
// Visual organization only.
// Must not affect execution, routing, or persistence.
export const useSectionStore = create<State>((set) => ({
  sections: [],
  addSection: (name, rect) =>
    set((state) => ({
      sections: [...state.sections, { id: nanoid(), name, rect }],
    })),
  updateSection: (id, rect) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, rect } : s)),
    })),
  renameSection: (id, name) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, name } : s)),
    })),
  removeSection: (id) =>
    set((state) => ({
      sections: state.sections.filter((s) => s.id !== id),
    })),
}))

export default useSectionStore
