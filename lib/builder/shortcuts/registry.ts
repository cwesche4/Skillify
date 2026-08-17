export type ShortcutAction =
  | 'add-node'
  | 'duplicate'
  | 'delete'
  | 'search'
  | 'toggle-inspector'
  | 'auto-layout'
  | 'group-selection'

export interface Shortcut {
  action: ShortcutAction
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  enabled: boolean
}

export const defaultShortcuts: Shortcut[] = [
  { action: 'add-node', key: 'a', description: 'Add node', enabled: true },
  {
    action: 'duplicate',
    key: 'd',
    meta: true,
    ctrl: true,
    description: 'Duplicate selection',
    enabled: true,
  },
  {
    action: 'delete',
    key: 'Delete',
    description: 'Delete selection',
    enabled: true,
  },
  {
    action: 'search',
    key: 'k',
    meta: true,
    ctrl: true,
    description: 'Search nodes (Command Palette)',
    enabled: true,
  },
  {
    action: 'toggle-inspector',
    key: 'i',
    description: 'Toggle inspector',
    enabled: true,
  },
  {
    action: 'auto-layout',
    key: 'l',
    description: 'Auto layout',
    enabled: true,
  },
  {
    action: 'group-selection',
    key: 'g',
    description: 'Group selection',
    enabled: true,
  },
]

export function isShortcutMatch(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  if (!shortcut.enabled) return false
  if (shortcut.meta && !event.metaKey) return false
  if (shortcut.ctrl && !event.ctrlKey) return false
  if (shortcut.shift && !event.shiftKey) return false
  if (shortcut.alt && !event.altKey) return false
  return event.key.toLowerCase() === shortcut.key.toLowerCase()
}
