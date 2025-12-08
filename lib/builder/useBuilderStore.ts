// -------------------------------------------------------------
// FILE: lib/builder/useBuilderStore.ts
// -------------------------------------------------------------

import { create } from 'zustand'

interface BuilderStore {
  fullscreen: boolean
  toggleFullscreen: () => void

  // grouping
  canGroup: boolean
  setCanGroup: (b: boolean) => void

  // undo/redo
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export const useBuilderStore = create<BuilderStore>((set) => ({
  fullscreen: false,
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),

  canGroup: false,
  setCanGroup: (b) => set({ canGroup: b }),

  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
}))
