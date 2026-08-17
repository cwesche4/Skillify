export type InspectorAISettings = {
  enableInspectorAI: boolean
  enableSuggestions: boolean
  enableAutoFix: boolean
  enableWalkthroughs: boolean
  enableTelemetry: boolean
  enableHeatmap?: boolean
}

const defaultSettings: InspectorAISettings = {
  enableInspectorAI: false,
  enableSuggestions: false,
  enableAutoFix: false,
  enableWalkthroughs: false,
  enableTelemetry: false,
  enableHeatmap: false,
}

export function loadInspectorSettings(
  workspaceId: string | undefined,
): InspectorAISettings {
  if (!workspaceId) return defaultSettings
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = window.localStorage.getItem(
      `skillify.inspector.settings.${workspaceId}`,
    )
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<InspectorAISettings>
    return { ...defaultSettings, ...(parsed ?? {}) }
  } catch {
    return defaultSettings
  }
}

export function saveInspectorSettings(
  workspaceId: string,
  settings: InspectorAISettings,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `skillify.inspector.settings.${workspaceId}`,
      JSON.stringify(settings),
    )
  } catch {
    // ignore storage issues
  }
}
