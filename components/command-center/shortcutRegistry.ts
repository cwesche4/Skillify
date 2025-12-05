// components/command-center/shortcutRegistry.ts

export type RegisteredShortcut = {
  id: string
  label: string
  keys: string[] // FIXED: must be array for .map()
  group?: string
}

let registry: RegisteredShortcut[] = []

// --------------------------------------------
// Register a keyboard shortcut
// --------------------------------------------
export function registerShortcut(def: RegisteredShortcut) {
  // enforce array format
  const normalized: RegisteredShortcut = {
    ...def,
    keys: Array.isArray(def.keys) ? def.keys : [def.keys],
    group: def.group ?? "General",
  }

  const index = registry.findIndex((s) => s.id === def.id)

  if (index >= 0) registry[index] = normalized
  else registry.push(normalized)
}

// --------------------------------------------
// Return all registered shortcuts
// --------------------------------------------
export function getShortcuts(): RegisteredShortcut[] {
  return registry
}

// --------------------------------------------
// Optional: Clear shortcuts (test/dev only)
// --------------------------------------------
export function clearShortcuts() {
  registry = []
}
