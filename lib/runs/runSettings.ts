export type RunSettings = {
  showSummaryDefault: boolean
  allowUserToggleSummary: boolean
  allowCompare: boolean
  allowHeatmap: boolean
}

const DEFAULT_RUN_SETTINGS: RunSettings = {
  showSummaryDefault: true,
  allowUserToggleSummary: true,
  allowCompare: true,
  allowHeatmap: true,
}

export function loadRunSettings(workspaceId?: string): RunSettings {
  if (!workspaceId) return DEFAULT_RUN_SETTINGS
  try {
    const raw = localStorage.getItem(`runSettings:${workspaceId}`)
    if (!raw) return DEFAULT_RUN_SETTINGS
    return { ...DEFAULT_RUN_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_RUN_SETTINGS
  }
}

export function saveRunSettings(
  workspaceId: string | undefined,
  settings: RunSettings,
) {
  if (!workspaceId) return
  try {
    localStorage.setItem(`runSettings:${workspaceId}`, JSON.stringify(settings))
  } catch {
    // ignore
  }
}
