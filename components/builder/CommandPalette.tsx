'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Shortcut, ShortcutAction } from '@/lib/builder/shortcuts/registry'
import {
  defaultShortcuts,
  isShortcutMatch,
} from '@/lib/builder/shortcuts/registry'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/Command'
import { Dialog, DialogContent } from '@/components/ui/Dialog'

type Props = {
  onAction: (action: ShortcutAction) => void
  shortcuts?: Shortcut[]
}

export default function CommandPalette({
  onAction,
  shortcuts = defaultShortcuts,
}: Props) {
  const [open, setOpen] = useState(false)

  const activeShortcuts = useMemo(
    () => shortcuts.filter((s) => s.enabled),
    [shortcuts],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        activeShortcuts.some(
          (s) => s.action === 'search' && isShortcutMatch(event, s),
        )
      ) {
        event.preventDefault()
        setOpen((o) => !o)
        return
      }
      const match = activeShortcuts.find((s) => isShortcutMatch(event, s))
      if (match && match.action !== 'search') {
        event.preventDefault()
        onAction(match.action)
      }
    },
    [activeShortcuts, onAction],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <Command>
          <CommandInput placeholder="Type a command or search nodes" />
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Shortcuts">
            {activeShortcuts.map((s) => (
              <CommandItem
                key={s.action}
                onSelect={() => {
                  onAction(s.action)
                  setOpen(false)
                }}
              >
                <span className="flex-1">{s.description}</span>
                <span className="text-[11px] text-slate-500">
                  {[
                    s.ctrl ? 'Ctrl' : null,
                    s.meta ? '⌘' : null,
                    s.shift ? '⇧' : null,
                    s.alt ? '⌥' : null,
                    s.key.toUpperCase(),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
