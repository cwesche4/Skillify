// lib/workspaces/icon.ts

export const WORKSPACE_COLORS = [
  '#6366F1', // indigo
  '#3B82F6', // blue
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
]

export const WORKSPACE_ICONS = ['⚡', '🧩', '📊', '🚀', '💡', '⚙️', '🧠']

export function getWorkspaceVisual(id: string) {
  // create consistent color/icon pairing from id hash
  let hash = 0
  for (let i = 0; i < id.length; i++)
    hash = id.charCodeAt(i) + ((hash << 5) - hash)

  const color = WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length]
  const icon = WORKSPACE_ICONS[Math.abs(hash) % WORKSPACE_ICONS.length]

  return { color, icon }
}
