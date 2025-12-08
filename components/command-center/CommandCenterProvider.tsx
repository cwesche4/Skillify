// components/command-center/CommandCenterProvider.tsx
'use client'

import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import type { CommandItem } from '@/components/command-center/types'
import {
  getShortcuts,
  registerShortcut as registryRegister,
  type RegisteredShortcut,
} from './shortcutRegistry'

/* ========================================================================
   CONTEXT SHAPE
======================================================================== */
interface CommandCenterContextValue {
  open: boolean
  setOpen: (open: boolean) => void

  query: string
  setQuery: (query: string) => void

  commands: CommandItem[]
  setCommands: (items: CommandItem[]) => void

  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void

  shortcuts: RegisteredShortcut[]
  registerShortcut: (def: RegisteredShortcut) => void
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(
  null,
)

/* ========================================================================
   PROVIDER
======================================================================== */
export function CommandCenterProvider({ children }: { children: ReactNode }) {
  // Command Center (main dialog)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [commands, setCommands] = useState<CommandItem[]>([])

  // Shortcut overlay (⌘+/)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Runtime registry
  const [shortcuts, setShortcuts] = useState<RegisteredShortcut[]>([])

  /* ----------------------------------------
     Register shortcuts into global registry
  ---------------------------------------- */
  const registerShortcut = useCallback((def: RegisteredShortcut) => {
    registryRegister(def)
    setShortcuts(getShortcuts())
  }, [])

  // Sync registry on mount
  useEffect(() => {
    setShortcuts(getShortcuts())
  }, [])

  /* ========================================================================
     GLOBAL KEYBOARD SHORTCUTS (native keydown)
  ======================================================================== */
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const key = event.key.toLowerCase()

      // ⌘K or Ctrl+K — Toggle Command Center
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // ⌘/ or Ctrl+/ — Open shortcuts overlay
      if ((event.metaKey || event.ctrlKey) && key === '/') {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }

      // ESC — close overlays
      if (key === 'escape') {
        setOpen(false)
        setShortcutsOpen(false)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ========================================================================
     CUSTOM EVENTS (for other components to open/toggle)
     - skillify-open-command-center   → open = true
     - skillify-toggle-command-center → toggle open
     - skillify-open-shortcuts        → shortcutsOpen = true
  ======================================================================== */
  useEffect(() => {
    const openHandler = () => setOpen(true)
    const toggleHandler = () => setOpen((prev) => !prev)
    const shortcutsHandler = () => setShortcutsOpen(true)

    window.addEventListener('skillify-open-command-center', openHandler)
    window.addEventListener('skillify-toggle-command-center', toggleHandler)
    window.addEventListener('skillify-open-shortcuts', shortcutsHandler)

    return () => {
      window.removeEventListener('skillify-open-command-center', openHandler)
      window.removeEventListener(
        'skillify-toggle-command-center',
        toggleHandler,
      )
      window.removeEventListener('skillify-open-shortcuts', shortcutsHandler)
    }
  }, [])

  /* ========================================================================
     CONTEXT VALUE
  ======================================================================== */
  const ctx: CommandCenterContextValue = {
    open,
    setOpen,

    query,
    setQuery,

    commands,
    setCommands,

    shortcutsOpen,
    setShortcutsOpen,

    shortcuts,
    registerShortcut,
  }

  return (
    <CommandCenterContext.Provider value={ctx}>
      {children}
    </CommandCenterContext.Provider>
  )
}

/* ========================================================================
   HOOK
======================================================================== */
export function useCommandCenter() {
  const ctx = useContext(CommandCenterContext)
  if (!ctx) {
    throw new Error(
      'useCommandCenter must be used within a CommandCenterProvider',
    )
  }
  return ctx
}

/* ========================================================================
   TOP BAR TRIGGER BUTTON
   - Use this in your dashboard top bar next to search.
======================================================================== */
export function CommandCenterTrigger() {
  const { setOpen } = useCommandCenter()

  const onClick = useCallback(() => setOpen(true), [setOpen])

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-900 sm:inline-flex"
    >
      <span>Command</span>
      <span className="rounded border border-slate-700 px-1 text-[10px] text-slate-400">
        ⌘K
      </span>
    </button>
  )
}

export type { CommandItem }
