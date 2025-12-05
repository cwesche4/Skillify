// components/command-center/CommandCenterShortcuts.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useCommandCenter } from "./CommandCenterProvider"
import type { RegisteredShortcut } from "./shortcutRegistry"

function groupShortcuts(shortcuts: RegisteredShortcut[]) {
  return shortcuts.reduce<Record<string, RegisteredShortcut[]>>((acc, sc) => {
    const key = sc.group ?? "General"
    if (!acc[key]) acc[key] = []
    acc[key].push(sc)
    return acc
  }, {})
}

export function CommandCenterShortcuts() {
  const { shortcutsOpen, setShortcutsOpen, shortcuts } = useCommandCenter()

  if (!shortcutsOpen) return null

  const grouped = groupShortcuts(shortcuts)

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShortcutsOpen(false)}
      >
        <motion.div
          className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl"
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
            <button
              onClick={() => setShortcutsOpen(false)}
              className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-900"
            >
              Esc to close
            </button>
          </div>

          <div className="max-h-[340px] space-y-4 overflow-y-auto pr-1">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {group}
                </p>

                <div className="space-y-1">
                  {items.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-slate-900/70"
                    >
                      <span className="text-[11px] text-slate-100">{sc.label}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-300">
                        {sc.keys.map((k, i) => (
                          <span
                            key={`${sc.id}-${i}`}
                            className="rounded border border-slate-700 px-1.5 py-0.5"
                          >
                            {k}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default CommandCenterShortcuts
